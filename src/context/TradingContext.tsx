import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import {
  AssetDeskData,
  Trade,
  TradeAmendment,
  DailyDebrief,
  WeeklyReview,
  PendingSetup,
  ResearchQuestion,
  BacktestSample,
  PsychologyEntry,
  OperationalCalendarEvent,
  AlertRule,
  PerformanceStats,
  TradingHQConfig,
} from '../types';
import {
  INITIAL_PSYCHOLOGY_ENTRIES,
  INITIAL_CALENDAR_EVENTS,
  INITIAL_ALERTS,
} from '../data/seedData';
import { computePerformanceStats } from '../utils/tradingCalculations';
import { supabase } from '../lib/supabaseClient';
import { buildTradingHQConfig, loadHQConfigRows, saveHQCategory, seedMissingHQCategories, type HQCategory, type HQConfigRow } from '../lib/hqStore';
import { archiveAssetDesk, createAssetDesk, loadAssetDesks, saveAssetDeskPatch, seedAssetDesksIfMissing, updateInstrument, type InstrumentInput } from '../lib/assetDesksStore';
import { amendTradeRecord, insertTradesIfNew, loadAmendments, loadTrades, saveTrade } from '../lib/tradeStore';
import { loadDebriefs, upsertDebrief } from '../lib/debriefStore';
import { isInlineImage, uploadChart } from '../lib/chartStorage';
import { loadWeeklyReviews, upsertWeeklyReview } from '../lib/weeklyReviewStore';
import { loadPendingSetups, savePendingSetup as persistPendingSetup } from '../lib/pendingSetupStore';
import { setupToTrade, type TriggerInput } from '../utils/pendingSetups';
import { computeDailyEvidence } from '../utils/debrief';
import { calculatePlannedR } from '../utils/tradingCalculations';
import { traderDateString as traderDay } from '../utils/traderTime';
import { applyAmendment, assertFreeUpdate, buildClosedTrade, diffEvidence, isTradeLocked, type AmendablePatch, type CloseTradeInput } from '../utils/tradeIntegrity';
import { importResearchQuestionsOnce, loadResearchQuestions, removeResearchQuestion, saveResearchQuestion } from '../lib/researchStore';
import { importBacktestSamplesOnce, loadBacktestSamples, removeBacktestSample, saveBacktestSample } from '../lib/backtestStore';
import { loadCapitalSettings, saveCapitalSettings, type CapitalSettings } from '../lib/capitalStore';
import { calculateCapital, type CapitalSummary } from '../utils/capital';
import { archiveAndResetDeskAnalysis, type DeskAnalysisHistory, type DeskAnalysisOutcome, type DeskAnalysisScope } from '../lib/deskAnalysisHistoryStore';

/** crypto.randomUUID() is collision-safe; the old `Date.now().toString().slice(-N)`
 * scheme could (and occasionally did) collide when two records were created within
 * the same render tick. Falls back for any runtime without the Web Crypto API. */
function genId(prefix: string): string {
  const uuid = typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
}

export type NavSection =
  | 'dashboard'
  | 'calendar'
  | 'alerts'
  | 'trading-hq'
  | 'asset-desks'
  | 'journal'
  | 'debrief'
  | 'weekly-review'
  | 'backtesting'
  | 'research'
  | 'psychology'
  | 'market-intelligence'
  | 'scanner'
  | 'ai-assistant';

export type PendingSetupInput = Omit<PendingSetup, 'id' | 'status' | 'resolution' | 'createdAt' | 'updatedAt' | 'configVersionAtPlan' | 'plannedR'>;

interface TradingContextType {
  theme: 'ash' | 'dark';
  setTheme: (theme: 'ash' | 'dark') => void;
  activeTab: NavSection;
  setActiveTab: (tab: NavSection) => void;

  // Real, Supabase-backed (this week's scope)
  tradingHQ: TradingHQConfig;
  hqLoading: boolean;
  hqError: string | null;
  updateHQCategory: (category: HQCategory, newContent: unknown, changedReason: string) => Promise<void>;

  assets: AssetDeskData[];
  desksLoading: boolean;
  desksError: string | null;
  selectedAssetId: string;
  setSelectedAssetId: (id: string) => void;
  updateAssetDesk: (id: string, updated: Partial<AssetDeskData>) => Promise<void>;
  createInstrument: (input: InstrumentInput) => Promise<void>;
  updateInstrument: (id: string, input: InstrumentInput) => Promise<void>;
  archiveInstrument: (id: string) => Promise<void>;
  resolveDeskAnalysis: (deskId: string, scope: DeskAnalysisScope, outcome: DeskAnalysisOutcome, reason: string) => Promise<DeskAnalysisHistory>;

  trades: Trade[];
  tradesLoading: boolean;
  tradesError: string | null;
  localTradeImportCount: number;
  addTrade: (trade: Omit<Trade, 'id' | 'timestamp' | 'configVersionUsed'>) => Promise<Trade>;
  /** Open trades: any field. Locked (closed/voided) trades: documentation only. */
  updateTrade: (id: string, updated: Partial<Trade>) => Promise<void>;
  closeTrade: (id: string, input: CloseTradeInput) => Promise<void>;
  amendTrade: (id: string, patch: AmendablePatch, reason: string) => Promise<void>;
  voidTrade: (id: string, reason: string) => Promise<void>;
  /** Append-only amendment history, keyed by trade id, oldest first. */
  tradeAmendments: Record<string, TradeAmendment[]>;
  amendmentsError: string | null;
  /** Newest first. */
  debriefs: DailyDebrief[];
  debriefsLoading: boolean;
  debriefsError: string | null;
  saveDebrief: (debrief: Omit<DailyDebrief, 'createdAt' | 'updatedAt'>) => Promise<void>;
  /** Date (YYYY-MM-DD) the Debrief view should open on, e.g. from a Dashboard link. */
  debriefDate: string | null;
  setDebriefDate: (date: string | null) => void;
  /** Newest first. */
  weeklyReviews: WeeklyReview[];
  weeklyReviewsLoading: boolean;
  weeklyReviewsError: string | null;
  saveWeeklyReview: (review: Omit<WeeklyReview, 'createdAt' | 'updatedAt'>) => Promise<void>;
  /** Newest first. */
  pendingSetups: PendingSetup[];
  pendingSetupsError: string | null;
  addPendingSetup: (input: PendingSetupInput) => Promise<PendingSetup>;
  /** Only while PENDING. */
  updatePendingSetup: (id: string, patch: Partial<PendingSetupInput>) => Promise<void>;
  /** Converts the setup into an open Journal trade; returns the trade. */
  triggerPendingSetup: (id: string, input: TriggerInput) => Promise<Trade>;
  resolvePendingSetup: (id: string, status: 'INVALIDATED' | 'EXPIRED', reason: string) => Promise<void>;
  /** Asset Desk sub-tab to open on (e.g. from a Dashboard link). */
  deskTabRequest: string | null;
  setDeskTabRequest: (tab: string | null) => void;
  /** Progress of the one-time move of inline screenshots into file storage. */
  chartMigration: { total: number; done: number; failed: number; error?: string; running: boolean } | null;
  importLocalTrades: () => Promise<number>;
  researchQuestions: ResearchQuestion[];
  researchLoading: boolean;
  researchError: string | null;
  localResearchImportCount: number;
  addResearchQuestion: (rq: Omit<ResearchQuestion, 'id' | 'createdAt'>) => Promise<ResearchQuestion>;
  updateResearchQuestion: (id: string, updated: Partial<ResearchQuestion>) => Promise<void>;
  importLocalResearchQuestions: () => Promise<number>;
  backtestSamples: BacktestSample[];
  backtestLoading: boolean;
  backtestError: string | null;
  localBacktestImportCount: number;
  addBacktestSample: (sample: Omit<BacktestSample, 'id'>) => Promise<BacktestSample>;
  updateBacktestSample: (id: string, updated: Partial<BacktestSample>) => Promise<void>;
  deleteBacktestSample: (id: string) => Promise<void>;
  importLocalBacktestSamples: () => Promise<number>;
  psychologyEntries: PsychologyEntry[];
  addPsychologyEntry: (entry: Omit<PsychologyEntry, 'id' | 'timestamp'>) => void;
  calendarEvents: OperationalCalendarEvent[];
  addCalendarEvent: (event: Omit<OperationalCalendarEvent, 'id'>) => void;
  toggleCalendarEvent: (id: string) => void;
  alerts: AlertRule[];
  addAlert: (alert: Omit<AlertRule, 'id'>) => void;
  toggleAlert: (id: string) => void;
  performanceStats: PerformanceStats;
  capitalSettings: CapitalSettings | null;
  capitalSummary: CapitalSummary | null;
  capitalLoading: boolean;
  capitalError: string | null;
  updateCapitalSettings: (settings: CapitalSettings) => Promise<void>;
  exportDataJSON: () => void;
  importDataJSON: (jsonString: string) => Promise<boolean>;
  quickTradeModalOpen: boolean;
  setQuickTradeModalOpen: (open: boolean) => void;
}

const TradingContext = createContext<TradingContextType | undefined>(undefined);

const STORAGE_KEY = 'trading_os_v1_store';

export const TradingProvider: React.FC<{ userId: string; children: React.ReactNode }> = ({ userId, children }) => {
  const key = (name: string) => `${STORAGE_KEY}_${userId}_${name}`;

  const [activeTab, setActiveTab] = useState<NavSection>('dashboard');
  const [quickTradeModalOpen, setQuickTradeModalOpen] = useState(false);

  const [theme, setTheme] = useState<'ash' | 'dark'>(() => {
    const saved = localStorage.getItem(`${STORAGE_KEY}_theme`);
    return saved === 'dark' || saved === 'ash' ? saved : 'ash';
  });

  useEffect(() => {
    localStorage.setItem(`${STORAGE_KEY}_theme`, theme);
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  // ---- Trading HQ: real, versioned, Supabase-backed ----
  const [hqRows, setHqRows] = useState<HQConfigRow[]>([]);
  const [hqLoading, setHqLoading] = useState(true);
  const [hqError, setHqError] = useState<string | null>(null);

  const refreshHQ = useCallback(async () => {
    const rows = await loadHQConfigRows(supabase, userId);
    setHqRows(rows);
    return rows;
  }, [userId]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setHqLoading(true);
        let rows = await loadHQConfigRows(supabase, userId);
        if (rows.length < 7) {
          await seedMissingHQCategories(supabase, userId, rows);
          rows = await loadHQConfigRows(supabase, userId);
        }
        if (active) setHqRows(rows);
      } catch (e) {
        if (active) setHqError(e instanceof Error ? e.message : 'Failed to load Trading HQ');
      } finally {
        if (active) setHqLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const { config: tradingHQ, rowsByCategory } = buildTradingHQConfig(hqRows);

  const [capitalSettings, setCapitalSettings] = useState<CapitalSettings | null>(null);
  const [capitalLoading, setCapitalLoading] = useState(true);
  const [capitalError, setCapitalError] = useState<string | null>(null);
  useEffect(() => {
    let active = true;
    setCapitalLoading(true);
    loadCapitalSettings(supabase, userId)
      .then(settings => { if (active) setCapitalSettings(settings); })
      .catch(error => { if (active) setCapitalError(error instanceof Error ? error.message : 'Could not load capital settings'); })
      .finally(() => { if (active) setCapitalLoading(false); });
    return () => { active = false; };
  }, [userId]);
  const updateCapitalSettings = async (settings: CapitalSettings) => {
    await saveCapitalSettings(supabase, userId, settings);
    setCapitalSettings(settings);
    setCapitalError(null);
  };

  const updateHQCategory = async (category: HQCategory, newContent: unknown, changedReason: string) => {
    const row = rowsByCategory[category];
    if (!row) throw new Error(`No active row for category ${category} yet — reload and try again.`);
    await saveHQCategory(supabase, row, newContent, changedReason);
    await refreshHQ();
  };

  // ---- Asset Desks: real, Supabase-backed ----
  const [assets, setAssets] = useState<AssetDeskData[]>([]);
  const [desksLoading, setDesksLoading] = useState(true);
  const [desksError, setDesksError] = useState<string | null>(null);
  const [selectedAssetId, setSelectedAssetId] = useState<string>('');

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        setDesksLoading(true);
        await seedAssetDesksIfMissing(supabase, userId);
        const desks = await loadAssetDesks(supabase, userId);
        if (!active) return;
        setAssets(desks);
        if (desks.length > 0) setSelectedAssetId(prev => prev || desks[0].id);
      } catch (e) {
        if (active) setDesksError(e instanceof Error ? e.message : 'Failed to load Asset Desks');
      } finally {
        if (active) setDesksLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [userId]);

  const updateAssetDesk = async (id: string, updated: Partial<AssetDeskData>) => {
    // Optimistic local update, then persist.
    setAssets(prev => prev.map(a => (a.id === id ? { ...a, ...updated } : a)));
    await saveAssetDeskPatch(supabase, id, updated);
  };

  const refreshDesks = useCallback(async () => {
    const desks = await loadAssetDesks(supabase, userId);
    setAssets(desks);
    setSelectedAssetId(previous => desks.some(desk => desk.id === previous) ? previous : desks[0]?.id || '');
  }, [userId]);
  const createInstrument = async (input: InstrumentInput) => { await createAssetDesk(supabase, userId, input); await refreshDesks(); };
  const updateInstrumentMetadata = async (id: string, input: InstrumentInput) => { await updateInstrument(supabase, id, input); await refreshDesks(); };
  const archiveInstrument = async (id: string) => { await archiveAssetDesk(supabase, id); await refreshDesks(); };
  const resolveDeskAnalysis = async (deskId: string, scope: DeskAnalysisScope, outcome: DeskAnalysisOutcome, reason: string) => {
    const history = await archiveAndResetDeskAnalysis(supabase, deskId, scope, outcome, reason);
    await refreshDesks();
    return history;
  };

  // ---- Week 2: durable, Supabase-backed journal; local entries require explicit import ----
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [tradesError, setTradesError] = useState<string | null>(null);
  const [amendmentList, setAmendmentList] = useState<TradeAmendment[]>([]);
  const [amendmentsError, setAmendmentsError] = useState<string | null>(null);
  const [debriefs, setDebriefs] = useState<DailyDebrief[]>([]);
  const [debriefsLoading, setDebriefsLoading] = useState(true);
  const [debriefsError, setDebriefsError] = useState<string | null>(null);
  const [debriefDate, setDebriefDate] = useState<string | null>(null);
  useEffect(() => {
    setDebriefsLoading(true);
    loadDebriefs(supabase, userId)
      .then((list) => { setDebriefs(list); setDebriefsError(null); })
      .catch((error) => setDebriefsError(error instanceof Error ? error.message : 'Failed to load debriefs'))
      .finally(() => setDebriefsLoading(false));
  }, [userId]);
  const [pendingSetups, setPendingSetups] = useState<PendingSetup[]>([]);
  const [pendingSetupsError, setPendingSetupsError] = useState<string | null>(null);
  const [deskTabRequest, setDeskTabRequest] = useState<string | null>(null);
  useEffect(() => {
    loadPendingSetups(supabase, userId)
      .then((list) => { setPendingSetups(list); setPendingSetupsError(null); })
      .catch((error) => setPendingSetupsError(error instanceof Error ? error.message : 'Failed to load pending setups'));
  }, [userId]);
  const putSetup = async (next: PendingSetup) => {
    await persistPendingSetup(supabase, userId, next);
    setPendingSetups((prev) => (prev.some((p) => p.id === next.id) ? prev.map((p) => (p.id === next.id ? next : p)) : [next, ...prev]));
    setPendingSetupsError(null);
  };
  const addPendingSetup = async (input: PendingSetupInput) => {
    const now = new Date().toISOString();
    const setup: PendingSetup = {
      ...input,
      id: genId('ps'),
      plannedR: calculatePlannedR(input.direction, input.entryPrice, input.stopPrice, input.targetPrice),
      status: 'PENDING',
      configVersionAtPlan: tradingHQ.version,
      createdAt: now,
      updatedAt: now,
    };
    await putSetup(setup);
    return setup;
  };
  const updatePendingSetup = async (id: string, patch: Partial<PendingSetupInput>) => {
    const current = pendingSetups.find((p) => p.id === id); if (!current) return;
    if (current.status !== 'PENDING') throw new Error('Only a pending setup can be edited.');
    const merged = { ...current, ...patch };
    await putSetup({ ...merged, plannedR: calculatePlannedR(merged.direction, merged.entryPrice, merged.stopPrice, merged.targetPrice), updatedAt: new Date().toISOString() });
  };
  const triggerPendingSetup = async (id: string, input: TriggerInput) => {
    const setup = pendingSetups.find((p) => p.id === id);
    if (!setup) throw new Error('Setup not found.');
    // Never convert twice (e.g. if a previous attempt saved the trade but not the setup).
    const existing = trades.find((t) => t.fromSetupId === id);
    if (existing) {
      await putSetup({ ...setup, status: 'TRIGGERED', resolution: { at: new Date().toISOString(), tradeId: existing.id }, updatedAt: new Date().toISOString() });
      return existing;
    }
    const lossCount = computeDailyEvidence(trades, traderDay(input.entryAt), tradingHQ).lossCount;
    const trade = await addTrade(setupToTrade(setup, input, tradingHQ, lossCount));
    await putSetup({ ...setup, status: 'TRIGGERED', resolution: { at: new Date().toISOString(), tradeId: trade.id }, updatedAt: new Date().toISOString() });
    return trade;
  };
  const resolvePendingSetup = async (id: string, status: 'INVALIDATED' | 'EXPIRED', reason: string) => {
    const setup = pendingSetups.find((p) => p.id === id); if (!setup) return;
    if (setup.status !== 'PENDING') throw new Error('This setup is already resolved.');
    if (!reason.trim()) throw new Error('Add a short reason.');
    await putSetup({ ...setup, status, resolution: { at: new Date().toISOString(), reason: reason.trim() }, updatedAt: new Date().toISOString() });
  };

  const [weeklyReviews, setWeeklyReviews] = useState<WeeklyReview[]>([]);
  const [weeklyReviewsLoading, setWeeklyReviewsLoading] = useState(true);
  const [weeklyReviewsError, setWeeklyReviewsError] = useState<string | null>(null);
  useEffect(() => {
    setWeeklyReviewsLoading(true);
    loadWeeklyReviews(supabase, userId)
      .then((list) => { setWeeklyReviews(list); setWeeklyReviewsError(null); })
      .catch((error) => setWeeklyReviewsError(error instanceof Error ? error.message : 'Failed to load weekly reviews'))
      .finally(() => setWeeklyReviewsLoading(false));
  }, [userId]);
  const saveWeeklyReview = async (input: Omit<WeeklyReview, 'createdAt' | 'updatedAt'>) => {
    const existing = weeklyReviews.find((r) => r.weekStart === input.weekStart);
    const now = new Date().toISOString();
    const saved = await upsertWeeklyReview(supabase, userId, { ...input, createdAt: existing?.createdAt ?? now, updatedAt: now });
    setWeeklyReviews((prev) => [saved, ...prev.filter((r) => r.weekStart !== saved.weekStart)].sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1)));
    setWeeklyReviewsError(null);
  };
  const saveDebrief = async (input: Omit<DailyDebrief, 'createdAt' | 'updatedAt'>) => {
    const existing = debriefs.find((d) => d.date === input.date);
    const now = new Date().toISOString();
    const saved = await upsertDebrief(supabase, userId, { ...input, createdAt: existing?.createdAt ?? now, updatedAt: now });
    setDebriefs((prev) => [saved, ...prev.filter((d) => d.date !== saved.date)].sort((a, b) => (a.date < b.date ? 1 : -1)));
    setDebriefsError(null);
  };
  const [localTradeImportCount, setLocalTradeImportCount] = useState(0);

  // ---- Week 3: durable, Supabase-backed research & backtesting; local entries require explicit import ----
  const [researchQuestions, setResearchQuestions] = useState<ResearchQuestion[]>([]);
  const [researchLoading, setResearchLoading] = useState(true);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [localResearchImportCount, setLocalResearchImportCount] = useState(0);

  const [backtestSamples, setBacktestSamples] = useState<BacktestSample[]>([]);
  const [backtestLoading, setBacktestLoading] = useState(true);
  const [backtestError, setBacktestError] = useState<string | null>(null);
  const [localBacktestImportCount, setLocalBacktestImportCount] = useState(0);
  const [psychologyEntries, setPsychologyEntries] = useState<PsychologyEntry[]>(() => {
    const saved = localStorage.getItem(key('psychology'));
    return saved ? JSON.parse(saved) : INITIAL_PSYCHOLOGY_ENTRIES;
  });
  const [calendarEvents, setCalendarEvents] = useState<OperationalCalendarEvent[]>(() => {
    const saved = localStorage.getItem(key('calendar'));
    return saved ? JSON.parse(saved) : INITIAL_CALENDAR_EVENTS;
  });
  const [alerts, setAlerts] = useState<AlertRule[]>(() => {
    const saved = localStorage.getItem(key('alerts'));
    return saved ? JSON.parse(saved) : INITIAL_ALERTS;
  });

  useEffect(() => {
    const raw = localStorage.getItem(key('trades'));
    try { setLocalTradeImportCount(raw ? (JSON.parse(raw) as Trade[]).length : 0); } catch { setLocalTradeImportCount(0); }
    setTradesLoading(true);
    loadTrades(supabase, userId).then(setTrades).catch(error => setTradesError(error instanceof Error ? error.message : 'Failed to load journal')).finally(() => setTradesLoading(false));
    // Amendment history is non-blocking: if the log table isn't migrated yet the
    // journal still loads, and the Journal shows why amending isn't available.
    loadAmendments(supabase, userId).then(list => { setAmendmentList(list); setAmendmentsError(null); }).catch(error => setAmendmentsError(error instanceof Error ? error.message : 'Failed to load amendment history'));
  }, [userId]);
  useEffect(() => {
    const raw = localStorage.getItem(key('rqs'));
    try { setLocalResearchImportCount(raw ? (JSON.parse(raw) as ResearchQuestion[]).length : 0); } catch { setLocalResearchImportCount(0); }
    setResearchLoading(true);
    loadResearchQuestions(supabase, userId).then(setResearchQuestions).catch(error => setResearchError(error instanceof Error ? error.message : 'Failed to load research questions')).finally(() => setResearchLoading(false));
  }, [userId]);
  useEffect(() => {
    const raw = localStorage.getItem(key('backtests'));
    try { setLocalBacktestImportCount(raw ? (JSON.parse(raw) as BacktestSample[]).length : 0); } catch { setLocalBacktestImportCount(0); }
    setBacktestLoading(true);
    loadBacktestSamples(supabase, userId).then(setBacktestSamples).catch(error => setBacktestError(error instanceof Error ? error.message : 'Failed to load backtest samples')).finally(() => setBacktestLoading(false));
  }, [userId]);
  useEffect(() => { localStorage.setItem(key('psychology'), JSON.stringify(psychologyEntries)); }, [psychologyEntries]);
  useEffect(() => { localStorage.setItem(key('calendar'), JSON.stringify(calendarEvents)); }, [calendarEvents]);
  useEffect(() => { localStorage.setItem(key('alerts'), JSON.stringify(alerts)); }, [alerts]);

  const addTrade = async (tradeData: Omit<Trade, 'id' | 'timestamp' | 'configVersionUsed'>) => {
    const newTrade: Trade = {
      ...tradeData, id: genId('tr'), timestamp: Date.now(),
      configVersionUsed: tradingHQ.version,
      riskPercentAtEntry: tradeData.riskPercentAtEntry ?? tradingHQ.riskRules.riskPerSetupPct,
    };
    await saveTrade(supabase, userId, newTrade);
    setTrades(prev => [newTrade, ...prev]);
    return newTrade;
  };
  const replaceTrade = (next: Trade) => setTrades(prev => prev.map(trade => (trade.id === next.id ? next : trade)));
  const updateTrade = async (id: string, updated: Partial<Trade>) => {
    const current = trades.find(trade => trade.id === id); if (!current) return;
    assertFreeUpdate(current, updated);
    const next = { ...current, ...updated }; await saveTrade(supabase, userId, next); replaceTrade(next);
  };
  const closeTrade = async (id: string, input: CloseTradeInput) => {
    const current = trades.find(trade => trade.id === id); if (!current) return;
    const next = buildClosedTrade(current, input);
    await saveTrade(supabase, userId, next); replaceTrade(next);
  };
  const amendTrade = async (id: string, patch: AmendablePatch, reason: string) => {
    const current = trades.find(trade => trade.id === id); if (!current) return;
    if (!isTradeLocked(current)) throw new Error('Open trades can be edited directly — amendments are for closed trades.');
    if (current.voided) throw new Error('A voided trade can\'t be amended.');
    if (!reason.trim()) throw new Error('Every amendment needs a reason.');
    const next = applyAmendment(current, patch);
    const changes = diffEvidence(current, next);
    if (changes.length === 0) throw new Error('Nothing changed — no amendment logged.');
    const amendment = await amendTradeRecord(supabase, current, next, 'AMEND', reason.trim());
    setAmendmentList(prev => [...prev, amendment]);
    replaceTrade(next);
  };
  const voidTrade = async (id: string, reason: string) => {
    const current = trades.find(trade => trade.id === id); if (!current) return;
    if (current.voided) return;
    if (!reason.trim()) throw new Error('Voiding a trade needs a reason.');
    const next: Trade = { ...current, voided: { at: Date.now(), reason: reason.trim() } };
    const amendment = await amendTradeRecord(supabase, current, next, 'VOID', reason.trim());
    setAmendmentList(prev => [...prev, amendment]);
    replaceTrade(next);
  };
  const tradeAmendments = amendmentList.reduce<Record<string, TradeAmendment[]>>((acc, a) => { (acc[a.tradeId] = acc[a.tradeId] || []).push(a); return acc; }, {});
  const importLocalTrades = async () => {
    const raw = localStorage.getItem(key('trades')); const local = raw ? JSON.parse(raw) as Trade[] : [];
    const count = await insertTradesIfNew(supabase, userId, local); setTrades(await loadTrades(supabase, userId)); setLocalTradeImportCount(0); return count;
  };

  const addResearchQuestion = async (rqData: Omit<ResearchQuestion, 'id' | 'createdAt'>) => {
    const newRq: ResearchQuestion = { ...rqData, id: genId('rq'), createdAt: new Date().toISOString().split('T')[0] };
    await saveResearchQuestion(supabase, userId, newRq);
    setResearchQuestions(prev => [newRq, ...prev]);
    return newRq;
  };
  const updateResearchQuestion = async (id: string, updated: Partial<ResearchQuestion>) => {
    const current = researchQuestions.find(rq => rq.id === id); if (!current) return;
    const next = { ...current, ...updated };
    await saveResearchQuestion(supabase, userId, next);
    setResearchQuestions(prev => prev.map(rq => (rq.id === id ? next : rq)));
  };
  const importLocalResearchQuestions = async () => {
    const raw = localStorage.getItem(key('rqs')); const local = raw ? JSON.parse(raw) as ResearchQuestion[] : [];
    const count = await importResearchQuestionsOnce(supabase, userId, local);
    setResearchQuestions(await loadResearchQuestions(supabase, userId));
    setLocalResearchImportCount(0);
    return count;
  };

  const addBacktestSample = async (sampleData: Omit<BacktestSample, 'id'>) => {
    const newSample: BacktestSample = { ...sampleData, id: genId('bt') };
    await saveBacktestSample(supabase, userId, newSample);
    setBacktestSamples(prev => [newSample, ...prev]);
    if (sampleData.researchQuestionId) {
      const rq = researchQuestions.find(r => r.id === sampleData.researchQuestionId);
      if (rq) await updateResearchQuestion(rq.id, { sampleCount: (rq.sampleCount || 0) + 1 });
    }
    return newSample;
  };
  const updateBacktestSample = async (id: string, updated: Partial<BacktestSample>) => {
    const current = backtestSamples.find(s => s.id === id); if (!current) return;
    const next = { ...current, ...updated };
    await saveBacktestSample(supabase, userId, next);
    setBacktestSamples(prev => prev.map(s => (s.id === id ? next : s)));
  };
  const deleteBacktestSample = async (id: string) => {
    await removeBacktestSample(supabase, id);
    setBacktestSamples(prev => prev.filter(s => s.id !== id));
  };
  const importLocalBacktestSamples = async () => {
    const raw = localStorage.getItem(key('backtests')); const local = raw ? JSON.parse(raw) as BacktestSample[] : [];
    const count = await importBacktestSamplesOnce(supabase, userId, local);
    setBacktestSamples(await loadBacktestSamples(supabase, userId));
    setLocalBacktestImportCount(0);
    return count;
  };

  const addPsychologyEntry = (entryData: Omit<PsychologyEntry, 'id' | 'timestamp'>) => {
    const newEntry: PsychologyEntry = { ...entryData, id: genId('psy'), timestamp: Date.now() };
    setPsychologyEntries(prev => [newEntry, ...prev]);
  };

  const addCalendarEvent = (eventData: Omit<OperationalCalendarEvent, 'id'>) => {
    const newEvent: OperationalCalendarEvent = { ...eventData, id: genId('cal') };
    setCalendarEvents(prev => [...prev, newEvent]);
  };
  const toggleCalendarEvent = (id: string) => setCalendarEvents(prev => prev.map(ev => (ev.id === id ? { ...ev, completed: !ev.completed } : ev)));

  const addAlert = (alertData: Omit<AlertRule, 'id'>) => {
    const newAlert: AlertRule = { ...alertData, id: genId('al') };
    setAlerts(prev => [newAlert, ...prev]);
  };
  const toggleAlert = (id: string) => setAlerts(prev => prev.map(al => (al.id === id ? { ...al, active: !al.active } : al)));

  // One-time background move of legacy inline (base64) screenshots into
  // Supabase Storage, so records stay small and the app stays fast. Runs once
  // per session after everything has loaded; stops at the first storage error
  // (e.g. the chart-storage migration hasn't been run) without changing data.
  const [chartMigration, setChartMigration] = useState<TradingContextType['chartMigration']>(null);
  const chartMigrationStarted = useRef(false);
  useEffect(() => {
    if (chartMigrationStarted.current || tradesLoading || backtestLoading || desksLoading) return;
    chartMigrationStarted.current = true;

    const tradeJobs = trades.filter((t) => {
      const s = t.screenshots || {};
      return [s.before, s.during, s.after, ...(s.additional ?? []).map((a) => (typeof a === 'string' ? a : a.url))].some(isInlineImage);
    });
    const backtestJobs = backtestSamples.filter((b) => [b.screenshot, b.outcomeScreenshot, ...(b.screenshots ?? []).map((x) => x.url)].some(isInlineImage));
    const deskJobs = assets.filter((a) => (a.charts ?? []).some((c) => isInlineImage(c.url)));
    const total =
      tradeJobs.reduce((n, t) => n + [t.screenshots.before, t.screenshots.during, t.screenshots.after, ...(t.screenshots.additional ?? []).map((a) => (typeof a === 'string' ? a : a.url))].filter(isInlineImage).length, 0) +
      backtestJobs.reduce((n, b) => n + [b.screenshot, b.outcomeScreenshot, ...(b.screenshots ?? []).map((x) => x.url)].filter(isInlineImage).length, 0) +
      deskJobs.reduce((n, a) => n + (a.charts ?? []).filter((c) => isInlineImage(c.url)).length, 0);
    if (total === 0) return;

    let done = 0;
    const progress = (patch: Partial<NonNullable<TradingContextType['chartMigration']>> = {}) =>
      setChartMigration((prev) => ({ total, failed: 0, running: true, ...(prev ?? {}), ...patch, done }));
    const move = async (src?: string) => {
      if (!isInlineImage(src)) return src;
      const ref = await uploadChart(src);
      done++;
      progress();
      return ref;
    };

    (async () => {
      progress();
      try {
        for (const t of tradeJobs) {
          const s = t.screenshots;
          const screenshots = {
            ...s,
            before: await move(s.before),
            during: await move(s.during),
            after: await move(s.after),
            additional: s.additional
              ? await Promise.all(s.additional.map(async (a, i) => (typeof a === 'string' ? { id: `add-${i}`, url: (await move(a)) as string, title: `Additional #${i + 1}` } : { ...a, url: (await move(a.url)) as string })))
              : undefined,
          };
          const next = { ...t, screenshots };
          await saveTrade(supabase, userId, next);
          setTrades((prev) => prev.map((x) => (x.id === t.id ? { ...x, screenshots } : x)));
        }
        for (const b of backtestJobs) {
          const next = {
            ...b,
            screenshot: await move(b.screenshot),
            outcomeScreenshot: await move(b.outcomeScreenshot),
            screenshots: b.screenshots ? await Promise.all(b.screenshots.map(async (x) => ({ ...x, url: (await move(x.url)) as string }))) : undefined,
          };
          await saveBacktestSample(supabase, userId, next);
          setBacktestSamples((prev) => prev.map((x) => (x.id === b.id ? next : x)));
        }
        for (const a of deskJobs) {
          const charts = await Promise.all((a.charts ?? []).map(async (c) => ({ ...c, url: (await move(c.url)) as string })));
          await saveAssetDeskPatch(supabase, a.id, { charts });
          setAssets((prev) => prev.map((x) => (x.id === a.id ? { ...x, charts } : x)));
        }
        progress({ running: false });
      } catch (e) {
        progress({ running: false, failed: total - done, error: e instanceof Error ? e.message : 'Chart upload failed' });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tradesLoading, backtestLoading, desksLoading]);

  const performanceStats = computePerformanceStats(trades, tradingHQ);
  const capitalSummary = capitalSettings
    ? calculateCapital(capitalSettings, trades, tradingHQ.riskRules.riskPerSetupPct)
    : null;

  const exportDataJSON = () => {
    const data = { exportDate: new Date().toISOString(), tradingHQ, assets, trades, tradeAmendments: amendmentList, debriefs, weeklyReviews, pendingSetups, researchQuestions, backtestSamples, psychologyEntries, calendarEvents, alerts };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trading_os_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importDataJSON = async (jsonString: string): Promise<boolean> => {
    try {
      const parsed = JSON.parse(jsonString);
      // Trading HQ and Asset Desks are Supabase-backed now. Trades, research
      // questions, and backtest samples are too (Weeks 2–3) — a restore has to
      // actually write them through, not just set local state, or the
      // "imported" data would vanish again on next reload.
      if (Array.isArray(parsed.trades)) {
        // Add-only: a backup can restore missing trades but never overwrite an
        // existing (possibly locked) one.
        await insertTradesIfNew(supabase, userId, parsed.trades as Trade[]);
        setTrades(await loadTrades(supabase, userId));
      }
      if (Array.isArray(parsed.researchQuestions)) {
        for (const rq of parsed.researchQuestions as ResearchQuestion[]) await saveResearchQuestion(supabase, userId, rq);
        setResearchQuestions(await loadResearchQuestions(supabase, userId));
      }
      if (Array.isArray(parsed.backtestSamples)) {
        for (const sample of parsed.backtestSamples as BacktestSample[]) await saveBacktestSample(supabase, userId, sample);
        setBacktestSamples(await loadBacktestSamples(supabase, userId));
      }
      if (parsed.psychologyEntries) setPsychologyEntries(parsed.psychologyEntries);
      if (parsed.calendarEvents) setCalendarEvents(parsed.calendarEvents);
      if (parsed.alerts) setAlerts(parsed.alerts);
      return true;
    } catch (e) {
      console.error('Import failed', e);
      return false;
    }
  };

  return (
    <TradingContext.Provider
      value={{
        theme,
        setTheme,
        activeTab,
        setActiveTab,
        tradingHQ,
        hqLoading,
        hqError,
        updateHQCategory,
        assets,
        desksLoading,
        desksError,
        selectedAssetId,
        setSelectedAssetId,
        updateAssetDesk,
      createInstrument,
      updateInstrument: updateInstrumentMetadata,
      archiveInstrument,
        resolveDeskAnalysis,
        trades,
        tradesLoading,
        tradesError,
        localTradeImportCount,
        addTrade,
        updateTrade,
        closeTrade,
        amendTrade,
        voidTrade,
        tradeAmendments,
        amendmentsError,
        debriefs,
        debriefsLoading,
        debriefsError,
        saveDebrief,
        debriefDate,
        setDebriefDate,
        weeklyReviews,
        weeklyReviewsLoading,
        weeklyReviewsError,
        saveWeeklyReview,
        chartMigration,
        pendingSetups,
        pendingSetupsError,
        addPendingSetup,
        updatePendingSetup,
        triggerPendingSetup,
        resolvePendingSetup,
        deskTabRequest,
        setDeskTabRequest,
        importLocalTrades,
        researchQuestions,
        researchLoading,
        researchError,
        localResearchImportCount,
        addResearchQuestion,
        updateResearchQuestion,
        importLocalResearchQuestions,
        backtestSamples,
        backtestLoading,
        backtestError,
        localBacktestImportCount,
        addBacktestSample,
        updateBacktestSample,
        deleteBacktestSample,
        importLocalBacktestSamples,
        psychologyEntries,
        addPsychologyEntry,
        calendarEvents,
        addCalendarEvent,
        toggleCalendarEvent,
        alerts,
        addAlert,
        toggleAlert,
        performanceStats,
        capitalSettings,
        capitalSummary,
        capitalLoading,
        capitalError,
        updateCapitalSettings,
        exportDataJSON,
        importDataJSON,
        quickTradeModalOpen,
        setQuickTradeModalOpen,
      }}
    >
      {children}
    </TradingContext.Provider>
  );
};

export const useTrading = () => {
  const context = useContext(TradingContext);
  if (!context) {
    throw new Error('useTrading must be used within a TradingProvider');
  }
  return context;
};
