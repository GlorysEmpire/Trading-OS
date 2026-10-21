import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import {
  AssetDeskData,
  Trade,
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
import { importTradesOnce, loadTrades, removeTrade, saveTrade } from '../lib/tradeStore';
import { importResearchQuestionsOnce, loadResearchQuestions, removeResearchQuestion, saveResearchQuestion } from '../lib/researchStore';
import { importBacktestSamplesOnce, loadBacktestSamples, removeBacktestSample, saveBacktestSample } from '../lib/backtestStore';

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
  | 'backtesting'
  | 'research'
  | 'psychology'
  | 'market-intelligence'
  | 'scanner'
  | 'ai-assistant';

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

  trades: Trade[];
  tradesLoading: boolean;
  tradesError: string | null;
  localTradeImportCount: number;
  addTrade: (trade: Omit<Trade, 'id' | 'timestamp' | 'configVersionUsed'>) => Promise<Trade>;
  updateTrade: (id: string, updated: Partial<Trade>) => Promise<void>;
  deleteTrade: (id: string) => Promise<void>;
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

  const updateHQCategory = async (category: HQCategory, newContent: unknown, changedReason: string) => {
    const row = rowsByCategory[category];
    if (!row) throw new Error(`No active row for category ${category} yet — reload and try again.`);
    await saveHQCategory(supabase, userId, row, newContent, changedReason);
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

  // ---- Week 2: durable, Supabase-backed journal; local entries require explicit import ----
  const [trades, setTrades] = useState<Trade[]>([]);
  const [tradesLoading, setTradesLoading] = useState(true);
  const [tradesError, setTradesError] = useState<string | null>(null);
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
    const newTrade: Trade = { ...tradeData, id: genId('tr'), timestamp: Date.now(), configVersionUsed: tradingHQ.version };
    await saveTrade(supabase, userId, newTrade);
    setTrades(prev => [newTrade, ...prev]);
    return newTrade;
  };
  const updateTrade = async (id: string, updated: Partial<Trade>) => {
    const current = trades.find(trade => trade.id === id); if (!current) return;
    const next = { ...current, ...updated }; await saveTrade(supabase, userId, next); setTrades(prev => prev.map(trade => trade.id === id ? next : trade));
  };
  const deleteTrade = async (id: string) => { await removeTrade(supabase, id); setTrades(prev => prev.filter(trade => trade.id !== id)); };
  const importLocalTrades = async () => {
    const raw = localStorage.getItem(key('trades')); const local = raw ? JSON.parse(raw) as Trade[] : [];
    const count = await importTradesOnce(supabase, userId, local); setTrades(await loadTrades(supabase, userId)); setLocalTradeImportCount(0); return count;
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

  const performanceStats = computePerformanceStats(trades, tradingHQ);

  const exportDataJSON = () => {
    const data = { exportDate: new Date().toISOString(), tradingHQ, assets, trades, researchQuestions, backtestSamples, psychologyEntries, calendarEvents, alerts };
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
        for (const trade of parsed.trades as Trade[]) await saveTrade(supabase, userId, trade);
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
        trades,
        tradesLoading,
        tradesError,
        localTradeImportCount,
        addTrade,
        updateTrade,
        deleteTrade,
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
