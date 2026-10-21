import React, { useState, useEffect } from 'react';
import { useTrading } from '../context/TradingContext';
import { getAuthHeaders } from '../lib/supabaseClient';
import { traderDateString, traderNowMinutes, isSessionActiveNow } from '../utils/traderTime';
import {
  Activity,
  AlertTriangle,
  Calendar,
  Clock,
  ExternalLink,
  Flame,
  Layers,
  Radar,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  TrendingDown,
  TrendingUp,
  Minus,
  Zap,
  Settings2,
  Check,
} from 'lucide-react';

/** Which of the Dashboard's secondary panels are shown. The point of a
 * command center is to surface what's actionable at a glance — so the
 * always-on priority items (risk/open-trades status, Market Watch, the
 * core R/win-rate numbers) can't be hidden, but the lower-priority
 * situational panels below default to hidden and are opt-in via
 * "Customize". Persisted per-browser; this is a view preference, not
 * trading data, so it doesn't need to live in Supabase. */
type DashboardWidgetKey = 'sessions' | 'macroEvents' | 'scheduledAssignment' | 'processMatrix' | 'research';

const DASHBOARD_WIDGET_LABELS: Record<DashboardWidgetKey, string> = {
  sessions: 'Trading Sessions panel',
  macroEvents: "Today's Macro Events",
  scheduledAssignment: 'Scheduled Research Assignment',
  processMatrix: 'Process Integrity vs Outcome Matrix',
  research: 'Research Engine & Continuous Study',
};

const DASHBOARD_WIDGET_ORDER: DashboardWidgetKey[] = ['sessions', 'macroEvents', 'scheduledAssignment', 'processMatrix', 'research'];

const DASHBOARD_PREFS_KEY = 'trading_os_dashboard_widgets_v1';

function loadDashboardWidgetPrefs(): Record<DashboardWidgetKey, boolean> {
  const defaults: Record<DashboardWidgetKey, boolean> = {
    sessions: false,
    macroEvents: false,
    scheduledAssignment: false,
    processMatrix: false,
    research: false,
  };
  try {
    const raw = localStorage.getItem(DASHBOARD_PREFS_KEY);
    if (!raw) return defaults;
    return { ...defaults, ...JSON.parse(raw) };
  } catch {
    return defaults;
  }
}

export const DashboardView: React.FC = () => {
  const {
    tradingHQ,
    assets,
    trades,
    researchQuestions,
    calendarEvents,
    alerts,
    performanceStats,
    setActiveTab,
    setSelectedAssetId,
    setQuickTradeModalOpen,
  } = useTrading();

  const [aiBriefLoading, setAiBriefLoading] = useState(false);
  const [aiBriefText, setAiBriefText] = useState<string | null>(null);

  // Ticks once a minute so the active-session indicator (and the LIVE
  // badge in the sessions card) actually moves across sessions over the
  // course of the day, instead of being computed once on mount.
  const [nowMinutes, setNowMinutes] = useState(() => traderNowMinutes());
  useEffect(() => {
    const interval = setInterval(() => setNowMinutes(traderNowMinutes()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const [widgetPrefs, setWidgetPrefs] = useState<Record<DashboardWidgetKey, boolean>>(loadDashboardWidgetPrefs);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem(DASHBOARD_PREFS_KEY, JSON.stringify(widgetPrefs));
    } catch {
      /* best-effort — a view preference, never load-bearing */
    }
  }, [widgetPrefs]);
  const toggleWidget = (key: DashboardWidgetKey) => setWidgetPrefs((prev) => ({ ...prev, [key]: !prev[key] }));

  const openTrades = trades.filter((t) => t.status === 'OPEN');
  const todayStr = traderDateString();
  const todayEvents = calendarEvents.filter((e) => e.date === todayStr);
  const activeSession = tradingHQ.sessions.find((s) => isSessionActiveNow(s, nowMinutes));
  const activeAlerts = alerts.filter((a) => a.active);
  const watchedAssets = assets.filter((a) => a.watchlisted);
  const activeRQ = researchQuestions[0];

  const handleGenerateDailyBrief = async () => {
    setAiBriefLoading(true);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          prompt:
            'Generate a high-density daily operational executive briefing for the trader: review today\'s session windows, active risk limits (1% risk, max 2 losses, no re-entry), current market biases for BTC/ETH/NQ, today\'s backtest assignment (ETH RQ-05), and psychological vigilance.',
          context: {
            rules: tradingHQ.riskRules,
            stats: performanceStats,
            activeAssets: assets.map((a) => ({
              symbol: a.symbol,
              bias: a.currentBias,
              narrative: a.currentNarrative,
            })),
            activeRQ: activeRQ
              ? { code: activeRQ.code, title: activeRQ.title, progress: `${activeRQ.sampleCount}/${activeRQ.targetSamples}` }
              : null,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAiBriefText(data.error || 'Could not generate the briefing right now.');
        return;
      }
      setAiBriefText(data.text || 'Operational briefing generated.');
    } catch (e: any) {
      setAiBriefText(
        'Operational Briefing: You are operating under active Trading HQ rules. Max 2 losses daily limit, strict 1% risk per setup. No re-entry allowed after stop. Focus on high-timeframe liquidity sweeps inside prime NY/Lagos windows. Tuesday focus: ETH RQ-05 backtest session.'
      );
    } finally {
      setAiBriefLoading(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Top Banner: Operational Posture & Risk Halt Banner */}
      {performanceStats.riskStatus === 'MAX_LOSS_HALT' ? (
        <div className="bg-rose-950/70 border-2 border-rose-600 rounded-lg p-4 flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-3">
            <ShieldAlert className="w-8 h-8 text-rose-500 animate-pulse" />
            <div>
              <h2 className="font-mono text-sm font-bold text-rose-200 uppercase tracking-wide">
                TRADING HALTED: MAXIMUM DAILY LOSS LIMIT REACHED ({tradingHQ.riskRules.maxDailyLosses} LOSSES)
              </h2>
              <p className="text-xs text-rose-300/90 font-sans mt-0.5">
                Per Trading HQ immutable rule, discretionary execution is locked until the next session. Do not revenge trade.
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveTab('psychology')}
            className="px-3 py-1.5 bg-rose-800 hover:bg-rose-700 text-white font-mono text-xs rounded transition"
          >
            LOG PSYCHOLOGY REVIEW
          </button>
        </div>
      ) : (
        <div className="bg-[#121926] border border-slate-800 rounded-lg p-3 sm:p-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping" />
            <div>
              <div className="font-mono text-xs font-semibold text-slate-200 uppercase tracking-wider flex items-center gap-2">
                <span>OPERATIONAL STATUS: NORMAL</span>
                <span className="text-slate-600">•</span>
                <span className="text-cyan-400 transition-all duration-500">
                  {activeSession ? `${activeSession.name.toUpperCase()} SESSION WINDOW ACTIVE` : 'BETWEEN SESSION WINDOWS'}
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-sans">
                Methodology Version <span className="font-mono text-slate-300">{tradingHQ.version}</span> | Strict 1% risk per setup | Absolute No Re-Entry rule enforced
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleGenerateDailyBrief}
              disabled={aiBriefLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 font-mono text-xs transition cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>{aiBriefLoading ? 'SYNTHESIZING...' : 'DAILY BRIEF'}</span>
            </button>
            <button
              onClick={() => setQuickTradeModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition cursor-pointer"
            >
              <span>+ LOG TRADE</span>
            </button>
          </div>
        </div>
      )}

      {/* AI Daily Brief Drawer/Box */}
      {aiBriefText && (
        <div className="bg-[#0e1624] border border-cyan-500/40 rounded-lg p-4 font-mono text-xs text-cyan-200/90 relative">
          <div className="flex items-center justify-between mb-2 text-cyan-400 font-bold uppercase text-[11px] tracking-wider">
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              AI OPERATIONAL BRIEFING & RISK CHECK
            </span>
            <button onClick={() => setAiBriefText(null)} className="text-slate-500 hover:text-slate-300">
              ✕
            </button>
          </div>
          <div className="whitespace-pre-line leading-relaxed text-slate-300 font-sans">{aiBriefText}</div>
        </div>
      )}

      {/* SECTION 1: TODAY — What matters today? */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            1. TODAY — OPERATIONAL AWARENESS
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400">{todayStr}</span>
            <div className="relative">
              <button
                onClick={() => setCustomizeOpen((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-cyan-300 border border-slate-700 rounded px-2 py-1 transition"
              >
                <Settings2 className="w-3 h-3" />
                <span>CUSTOMIZE</span>
              </button>
              {customizeOpen && (
                <div className="absolute right-0 mt-1.5 z-20 w-64 bg-[#141d2a] border border-slate-700 rounded-lg shadow-xl p-2 space-y-0.5">
                  <p className="text-[10px] font-mono text-slate-500 px-2 py-1 uppercase">Show additional panels</p>
                  {DASHBOARD_WIDGET_ORDER.map((key) => (
                    <button
                      key={key}
                      onClick={() => toggleWidget(key)}
                      className="w-full flex items-center justify-between gap-2 px-2 py-1.5 rounded hover:bg-slate-800/80 text-left text-xs font-sans text-slate-200"
                    >
                      <span>{DASHBOARD_WIDGET_LABELS[key]}</span>
                      <span
                        className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                          widgetPrefs[key] ? 'bg-cyan-600 border-cyan-500' : 'border-slate-600'
                        }`}
                      >
                        {widgetPrefs[key] && <Check className="w-3 h-3 text-white" />}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div
          className={`grid grid-cols-1 gap-4 ${
            { 1: 'md:grid-cols-1', 2: 'md:grid-cols-2', 3: 'md:grid-cols-3', 4: 'md:grid-cols-4' }[
              1 + (widgetPrefs.sessions ? 1 : 0) + (widgetPrefs.macroEvents ? 1 : 0) + (widgetPrefs.scheduledAssignment ? 1 : 0)
            ]
          }`}
        >
          {/* Active Sessions */}
          {widgetPrefs.sessions && (
          <div className="bg-[#101722] border border-slate-800 rounded-lg p-3.5 space-y-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">TRADING SESSIONS</span>
            <div className="space-y-2">
              {tradingHQ.sessions.map((s) => {
                const live = activeSession?.id === s.id;
                return (
                  <div
                    key={s.id}
                    className={`p-2 rounded border text-xs transition-all duration-500 ${
                      live ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-[#16202f] border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-medium text-slate-200">
                      <span>{s.name}</span>
                      {live && (
                        <span className="flex items-center gap-1 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/60">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          LIVE
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      NY: {s.nyStart} – {s.nyEnd} | Lagos: {s.lagosStart} – {s.lagosEnd}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Economic News & Macro Events */}
          {widgetPrefs.macroEvents && (
          <div className="bg-[#101722] border border-slate-800 rounded-lg p-3.5 space-y-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">TODAY'S MACRO EVENTS</span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {todayEvents.filter((e) => e.type === 'NEWS').length > 0 ? (
                todayEvents
                  .filter((e) => e.type === 'NEWS')
                  .map((ev) => (
                    <div key={ev.id} className="p-2 rounded bg-[#16202f] border border-slate-800 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-amber-300 text-[11px]">{ev.time}</span>
                        <span className="text-[10px] font-mono px-1 rounded bg-rose-950 text-rose-300">
                          {ev.impact}
                        </span>
                      </div>
                      <div className="text-slate-200 font-medium text-[11px] mt-0.5">{ev.title}</div>
                    </div>
                  ))
              ) : (
                <div className="text-slate-500 text-xs p-3 text-center font-mono">No high-impact releases logged today</div>
              )}
            </div>
          </div>
          )}

          {/* Scheduled Backtesting & Research */}
          {widgetPrefs.scheduledAssignment && (
          <div className="bg-[#101722] border border-slate-800 rounded-lg p-3.5 space-y-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">SCHEDULED ASSIGNMENT</span>
            {activeRQ ? (
              <div className="p-2.5 rounded bg-[#16202f] border border-cyan-800/40 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-cyan-400 font-bold text-xs">{activeRQ.code}</span>
                  <span className="text-[10px] font-mono text-slate-400">{activeRQ.scheduledDay}s</span>
                </div>
                <div className="text-slate-200 text-xs line-clamp-2 font-medium">{activeRQ.title}</div>
                <div className="text-[11px] font-mono text-slate-400 flex items-center justify-between pt-1 border-t border-slate-800">
                  <span>Asset: {activeRQ.initialAsset}</span>
                  <span className="text-cyan-300 font-semibold">{activeRQ.sampleCount} / {activeRQ.targetSamples} Samples</span>
                </div>
              </div>
            ) : (
              <div className="text-slate-500 text-xs p-3 text-center">No active research question</div>
            )}
          </div>
          )}

          {/* Open Trades & Risk Status */}
          <div className="bg-[#101722] border border-slate-800 rounded-lg p-3.5 space-y-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">OPEN TRADES & RISK</span>
            {openTrades.length > 0 ? (
              <div className="space-y-1.5">
                {openTrades.map((t) => (
                  <div key={t.id} className="p-2 rounded bg-[#16202f] border border-slate-800 text-xs flex items-center justify-between">
                    <div>
                      <span className="font-mono font-bold text-slate-200 mr-2">{t.asset}</span>
                      <span className={`font-mono text-[10px] px-1 py-0.5 rounded ${t.direction === 'LONG' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'}`}>
                        {t.direction}
                      </span>
                    </div>
                    <div className="font-mono text-cyan-400 font-semibold">{t.plannedR}R</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-slate-400 text-xs bg-[#16202f] rounded border border-slate-800">
                <span className="font-mono text-emerald-400">0 Active Trades</span>
                <p className="text-[10px] text-slate-500 mt-0.5">Capital fully preserved</p>
              </div>
            )}
            <div className="text-[11px] font-mono text-slate-400 flex justify-between pt-1 border-t border-slate-800">
              <span>Today's Losses:</span>
              <span className={performanceStats.lossCountToday >= 2 ? 'text-rose-400 font-bold' : 'text-slate-300'}>
                {performanceStats.lossCountToday} of {tradingHQ.riskRules.maxDailyLosses} max
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* SECTION 2: MARKET — What am I watching? */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            2. MARKET WATCH — ACTIVE ASSET WORKSPACES
          </h3>
          <button
            onClick={() => setActiveTab('asset-desks')}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>Manage Watchlist in Asset Desks</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        {watchedAssets.length === 0 ? (
          <div className="p-5 text-center bg-[#101722] border border-dashed border-slate-800 rounded-lg space-y-2">
            <p className="text-xs font-mono text-slate-400">
              Market Watch is empty. Star the instruments you're actively monitoring from Asset Desks to pin them here.
            </p>
            <button
              onClick={() => setActiveTab('asset-desks')}
              className="text-xs font-mono text-cyan-400 hover:text-cyan-300 inline-flex items-center gap-1"
            >
              <span>Open Asset Desks</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          </div>
        ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {watchedAssets.map((asset) => {
            const isBullish = asset.currentBias === 'BULLISH' || asset.currentBias === 'ACCUMULATION' || asset.currentBias === 'RE-ACCUMULATION';
            const isBearish = asset.currentBias === 'BEARISH' || asset.currentBias === 'DISTRIBUTION';
            const accent = isBullish ? 'emerald' : isBearish ? 'rose' : 'slate';
            const BiasIcon = isBullish ? TrendingUp : isBearish ? TrendingDown : Minus;

            return (
              <div
                key={asset.id}
                onClick={() => {
                  setSelectedAssetId(asset.id);
                  setActiveTab('asset-desks');
                }}
                className={`relative bg-[#101722] hover:bg-[#141d2a] border border-slate-800 hover:border-slate-700 rounded-lg pl-4 pr-3.5 py-3 cursor-pointer transition flex flex-col gap-2 overflow-hidden`}
              >
                <span
                  className={`absolute left-0 top-0 bottom-0 w-1 ${
                    accent === 'emerald' ? 'bg-emerald-500' : accent === 'rose' ? 'bg-rose-500' : 'bg-slate-600'
                  }`}
                />

                {/* Symbol + bias — the only two things that need to register instantly */}
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-slate-100 text-base tracking-wide">{asset.symbol}</span>
                  <span
                    className={`flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${
                      accent === 'emerald'
                        ? 'text-emerald-300'
                        : accent === 'rose'
                        ? 'text-rose-300'
                        : 'text-slate-400'
                    }`}
                  >
                    <BiasIcon className="w-3.5 h-3.5" />
                    {asset.currentBias}
                  </span>
                </div>

                {/* The one number a trader glances for: the key level */}
                <div className="flex items-baseline justify-between">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">Key Level</span>
                  <span className="font-mono text-cyan-300 font-bold text-sm">
                    {asset.quickLevels.keySustainedLevel || '—'}
                  </span>
                </div>

                <div className="text-[11px] text-slate-400 truncate font-sans border-t border-slate-800/80 pt-1.5">
                  {asset.currentNarrative || 'No narrative logged yet.'}
                </div>
              </div>
            );
          })}
        </div>
        )}
      </section>

      {/* SECTION 3: TRADING — Performance & Process Score Matrix */}
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            3. TRADING — PERFORMANCE & PROCESS INTEGRITY
          </h3>
          <button
            onClick={() => setActiveTab('journal')}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>View Full Journal ({trades.length})</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="bg-[#101722] border border-slate-800 rounded-lg p-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase">TODAY'S R</span>
            <div className={`text-xl font-mono font-bold mt-1 ${performanceStats.todayR > 0 ? 'text-emerald-400' : performanceStats.todayR < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {performanceStats.todayR > 0 ? `+${performanceStats.todayR}` : performanceStats.todayR}R
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Today's cumulative</span>
          </div>

          <div className="bg-[#101722] border border-slate-800 rounded-lg p-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase">WEEKLY R</span>
            <div className={`text-xl font-mono font-bold mt-1 ${performanceStats.weeklyR > 0 ? 'text-emerald-400' : performanceStats.weeklyR < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
              {performanceStats.weeklyR > 0 ? `+${performanceStats.weeklyR}` : performanceStats.weeklyR}R
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Last 7 days</span>
          </div>

          <div className="bg-[#101722] border border-slate-800 rounded-lg p-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase">TOTAL R (ALL TIME)</span>
            <div className={`text-xl font-mono font-bold mt-1 ${performanceStats.totalR > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
              {performanceStats.totalR > 0 ? `+${performanceStats.totalR}` : performanceStats.totalR}R
            </div>
            <span className="text-[10px] text-slate-500 font-mono">{performanceStats.totalTrades} closed trades</span>
          </div>

          <div className="bg-[#101722] border border-slate-800 rounded-lg p-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase">WIN RATE</span>
            <div className="text-xl font-mono font-bold text-slate-100 mt-1">
              {performanceStats.winRate}%
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Win frequency</span>
          </div>

          <div className="bg-[#101722] border border-slate-800 rounded-lg p-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase">EXPECTANCY</span>
            <div className="text-xl font-mono font-bold text-cyan-400 mt-1">
              +{performanceStats.expectancy}R
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Avg R per execution</span>
          </div>

          <div className="bg-[#101722] border border-slate-800 rounded-lg p-3">
            <span className="text-[10px] font-mono text-slate-400 uppercase">MAX DRAWDOWN</span>
            <div className="text-xl font-mono font-bold text-rose-400 mt-1">
              -{performanceStats.maxDrawdownR}R
            </div>
            <span className="text-[10px] text-slate-500 font-mono">Peak-to-trough R</span>
          </div>
        </div>

        {/* Process vs Outcome Paradigm Card */}
        {widgetPrefs.processMatrix && (
        <div className="bg-[#0f1520] border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wide">
                PROCESS INTEGRITY VS OUTCOME MATRIX
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 italic">
              "A profitable trade does not automatically mean a good trade."
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded bg-[#131d2b] border border-emerald-800/60">
              <div className="text-emerald-400 font-bold text-xs uppercase">GOOD PROCESS + WIN</div>
              <div className="text-slate-300 text-[11px] mt-1">Systematic execution rewarded by market probability.</div>
              <div className="text-lg font-bold text-emerald-300 mt-2">
                {trades.filter((t) => t.processCategory === 'GOOD_PROCESS_WIN').length} Trades
              </div>
            </div>

            <div className="p-3 rounded bg-[#18212e] border border-cyan-800/60">
              <div className="text-cyan-400 font-bold text-xs uppercase">GOOD PROCESS + LOSS</div>
              <div className="text-slate-300 text-[11px] mt-1">Acceptable business cost. All 5 process checks passed.</div>
              <div className="text-lg font-bold text-cyan-300 mt-2">
                {trades.filter((t) => t.processCategory === 'GOOD_PROCESS_LOSS').length} Trades ({performanceStats.goodProcessLossPct}%)
              </div>
            </div>

            <div className="p-3 rounded bg-[#201824] border border-amber-800/60">
              <div className="text-amber-400 font-bold text-xs uppercase">BAD PROCESS + WIN</div>
              <div className="text-slate-300 text-[11px] mt-1">Toxic positive reinforcement. Violated rules yet made PnL.</div>
              <div className="text-lg font-bold text-amber-300 mt-2">
                {trades.filter((t) => t.processCategory === 'BAD_PROCESS_WIN').length} Trades ({performanceStats.badProcessWinPct}%)
              </div>
            </div>

            <div className="p-3 rounded bg-[#241318] border border-rose-900/60">
              <div className="text-rose-400 font-bold text-xs uppercase">BAD PROCESS + LOSS</div>
              <div className="text-slate-300 text-[11px] mt-1">Double penalty. Self-sabotage & discipline breakdown.</div>
              <div className="text-lg font-bold text-rose-300 mt-2">
                {trades.filter((t) => t.processCategory === 'BAD_PROCESS_LOSS').length} Trades
              </div>
            </div>
          </div>
        </div>
        )}
      </section>

      {/* SECTION 4: RESEARCH & LEARNING */}
      {widgetPrefs.research && (
      <section className="space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
            <Radar className="w-4 h-4 text-purple-400" />
            4. RESEARCH ENGINE & CONTINUOUS STUDY
          </h3>
          <button
            onClick={() => setActiveTab('research')}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>Open Research Lab</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-3">
          {activeRQ && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 bg-purple-950/80 border border-purple-800 text-purple-300 font-mono text-xs font-bold rounded">
                    {activeRQ.code}
                  </span>
                  <h4 className="text-sm font-semibold text-slate-100">{activeRQ.title}</h4>
                </div>
                <span className="text-xs font-mono text-slate-400">
                  Status: <strong className="text-cyan-400">{activeRQ.status}</strong>
                </span>
              </div>

              <p className="text-xs text-slate-300 font-sans mt-2 italic bg-[#0c1119] p-2.5 rounded border border-slate-800">
                "{activeRQ.hypothesis}"
              </p>

              {/* Progress bar */}
              <div className="mt-3 space-y-1">
                <div className="flex justify-between text-[11px] font-mono text-slate-400">
                  <span>Sample Collection Progress:</span>
                  <span className="text-purple-300 font-bold">
                    {activeRQ.sampleCount} / {activeRQ.targetSamples} Samples ({Math.round((activeRQ.sampleCount / activeRQ.targetSamples) * 100)}%)
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full transition-all duration-500"
                    style={{ width: `${Math.min(100, (activeRQ.sampleCount / activeRQ.targetSamples) * 100)}%` }}
                  />
                </div>
              </div>

              <div className="text-xs text-slate-400 mt-2 font-sans">
                <strong className="text-slate-300 font-mono text-[11px] uppercase">Preliminary Findings: </strong>
                {activeRQ.findings}
              </div>
            </div>
          )}
        </div>
      </section>
      )}
    </div>
  );
};
