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
  INITIAL_TRADES,
  INITIAL_RESEARCH_QUESTIONS,
  INITIAL_BACKTEST_SAMPLES,
  INITIAL_PSYCHOLOGY_ENTRIES,
  INITIAL_CALENDAR_EVENTS,
  INITIAL_ALERTS,
} from '../data/seedData';
import { computePerformanceStats } from '../utils/tradingCalculations';
import { supabase } from '../lib/supabaseClient';
import { buildTradingHQConfig, loadHQConfigRows, saveHQCategory, seedMissingHQCategories, type HQCategory, type HQConfigRow } from '../lib/hqStore';
import { loadAssetDesks, saveAssetDeskPatch, seedAssetDesksIfMissing } from '../lib/assetDesksStore';

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

  // Still local-only — later weeks per the MVP roadmap
  trades: Trade[];
  addTrade: (trade: Omit<Trade, 'id' | 'timestamp' | 'configVersionUsed'>) => Trade;
  updateTrade: (id: string, updated: Partial<Trade>) => void;
  deleteTrade: (id: string) => void;
  researchQuestions: ResearchQuestion[];
  addResearchQuestion: (rq: Omit<ResearchQuestion, 'id' | 'createdAt'>) => void;
  updateResearchQuestion: (id: string, updated: Partial<ResearchQuestion>) => void;
  backtestSamples: BacktestSample[];
  addBacktestSample: (sample: Omit<BacktestSample, 'id'>) => void;
  updateBacktestSample: (id: string, updated: Partial<BacktestSample>) => void;
  deleteBacktestSample: (id: string) => void;
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
  importDataJSON: (jsonString: string) => boolean;
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

  // ---- Everything else: local-only for now (later weeks) ----
  const [trades, setTrades] = useState<Trade[]>(() => {
    const saved = localStorage.getItem(key('trades'));
    return saved ? JSON.parse(saved) : INITIAL_TRADES;
  });
  const [researchQuestions, setResearchQuestions] = useState<ResearchQuestion[]>(() => {
    const saved = localStorage.getItem(key('rqs'));
    return saved ? JSON.parse(saved) : INITIAL_RESEARCH_QUESTIONS;
  });
  const [backtestSamples, setBacktestSamples] = useState<BacktestSample[]>(() => {
    const saved = localStorage.getItem(key('backtests'));
    return saved ? JSON.parse(saved) : INITIAL_BACKTEST_SAMPLES;
  });
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

  useEffect(() => { localStorage.setItem(key('trades'), JSON.stringify(trades)); }, [trades]);
  useEffect(() => { localStorage.setItem(key('rqs'), JSON.stringify(researchQuestions)); }, [researchQuestions]);
  useEffect(() => { localStorage.setItem(key('backtests'), JSON.stringify(backtestSamples)); }, [backtestSamples]);
  useEffect(() => { localStorage.setItem(key('psychology'), JSON.stringify(psychologyEntries)); }, [psychologyEntries]);
  useEffect(() => { localStorage.setItem(key('calendar'), JSON.stringify(calendarEvents)); }, [calendarEvents]);
  useEffect(() => { localStorage.setItem(key('alerts'), JSON.stringify(alerts)); }, [alerts]);

  const addTrade = (tradeData: Omit<Trade, 'id' | 'timestamp' | 'configVersionUsed'>) => {
    const newTrade: Trade = { ...tradeData, id: `tr-${Date.now().toString().slice(-6)}`, timestamp: Date.now(), configVersionUsed: tradingHQ.version };
    setTrades(prev => [newTrade, ...prev]);
    return newTrade;
  };
  const updateTrade = (id: string, updated: Partial<Trade>) => setTrades(prev => prev.map(t => (t.id === id ? { ...t, ...updated } : t)));
  const deleteTrade = (id: string) => setTrades(prev => prev.filter(t => t.id !== id));

  const addResearchQuestion = (rqData: Omit<ResearchQuestion, 'id' | 'createdAt'>) => {
    const newRq: ResearchQuestion = { ...rqData, id: `rq-${Date.now().toString().slice(-4)}`, createdAt: new Date().toISOString().split('T')[0] };
    setResearchQuestions(prev => [newRq, ...prev]);
  };
  const updateResearchQuestion = (id: string, updated: Partial<ResearchQuestion>) =>
    setResearchQuestions(prev => prev.map(rq => (rq.id === id ? { ...rq, ...updated } : rq)));

  const addBacktestSample = (sampleData: Omit<BacktestSample, 'id'>) => {
    const newSample: BacktestSample = { ...sampleData, id: `bt-${Date.now().toString().slice(-4)}` };
    setBacktestSamples(prev => [newSample, ...prev]);
    if (sampleData.researchQuestionId) {
      setResearchQuestions(prev => prev.map(rq => (rq.id === sampleData.researchQuestionId ? { ...rq, sampleCount: (rq.sampleCount || 0) + 1 } : rq)));
    }
  };
  const updateBacktestSample = (id: string, updated: Partial<BacktestSample>) => setBacktestSamples(prev => prev.map(s => (s.id === id ? { ...s, ...updated } : s)));
  const deleteBacktestSample = (id: string) => setBacktestSamples(prev => prev.filter(s => s.id !== id));

  const addPsychologyEntry = (entryData: Omit<PsychologyEntry, 'id' | 'timestamp'>) => {
    const newEntry: PsychologyEntry = { ...entryData, id: `psy-${Date.now().toString().slice(-4)}`, timestamp: Date.now() };
    setPsychologyEntries(prev => [newEntry, ...prev]);
  };

  const addCalendarEvent = (eventData: Omit<OperationalCalendarEvent, 'id'>) => {
    const newEvent: OperationalCalendarEvent = { ...eventData, id: `cal-${Date.now().toString().slice(-4)}` };
    setCalendarEvents(prev => [...prev, newEvent]);
  };
  const toggleCalendarEvent = (id: string) => setCalendarEvents(prev => prev.map(ev => (ev.id === id ? { ...ev, completed: !ev.completed } : ev)));

  const addAlert = (alertData: Omit<AlertRule, 'id'>) => {
    const newAlert: AlertRule = { ...alertData, id: `al-${Date.now().toString().slice(-4)}` };
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

  const importDataJSON = (jsonString: string): boolean => {
    try {
      const parsed = JSON.parse(jsonString);
      // Trading HQ and Asset Desks are Supabase-backed now, so imports only
      // restore the still-local pieces.
      if (parsed.trades) setTrades(parsed.trades);
      if (parsed.researchQuestions) setResearchQuestions(parsed.researchQuestions);
      if (parsed.backtestSamples) setBacktestSamples(parsed.backtestSamples);
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
        trades,
        addTrade,
        updateTrade,
        deleteTrade,
        researchQuestions,
        addResearchQuestion,
        updateResearchQuestion,
        backtestSamples,
        addBacktestSample,
        updateBacktestSample,
        deleteBacktestSample,
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
