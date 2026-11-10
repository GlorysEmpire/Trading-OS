import React, { useState, useEffect, useRef } from 'react';
import { ChartImage } from './ChartImage';
import { CapitalCard } from './CapitalCard';
import { useTrading } from '../context/TradingContext';
import { getAuthHeaders } from '../lib/supabaseClient';
import { traderDateString, traderNowMinutes, isSessionActiveAt, nyTimeIn, deviceTimeZone, weekdayInZone } from '../utils/traderTime';
import type { AssetDeskData } from '../types';
import { findPreviousDebrief } from '../utils/debrief';
import { addDays, findPreviousWeeklyReview, matchDesk, weekStartOf } from '../utils/weekly';
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
  X,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Crosshair,
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


/** All of an asset's chart screenshots, ordered so the single "best" one
 * (most recently uploaded BIAS-category chart — the one meant to summarize
 * current directional read — falling back to the most recent of any
 * category) comes first, followed by the rest by recency. Empty array when
 * the desk has none. */
function getOrderedChartScreenshots(asset: AssetDeskData) {
  const charts = asset.charts ?? [];
  if (charts.length === 0) return [];
  const byRecency = [...charts].sort(
    (a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime()
  );
  const best = byRecency.find((c) => c.category === 'BIAS') ?? byRecency[0];
  return [best, ...byRecency.filter((c) => c.id !== best.id)];
}

/** Best single chart screenshot to represent an asset at a glance (see
 * getOrderedChartScreenshots). Returns undefined when the desk has none. */
function getBestChartScreenshot(asset: AssetDeskData) {
  return getOrderedChartScreenshots(asset)[0];
}

/** The scenario currently marked PRIMARY for this desk, if any. */
function getPrimaryScenario(asset: AssetDeskData) {
  return asset.scenarios.find((s) => s.probability === 'PRIMARY');
}

/** A short, glanceable external-context line — only the fields that are
 * actually filled in, so an empty desk doesn't show a row of em-dashes. */
function getExternalContextSummary(asset: AssetDeskData): string {
  const ctx = asset.externalContext;
  const parts: string[] = [];
  if (ctx.dxy) parts.push(`DXY ${ctx.dxy}`);
  if (ctx.yields10Y) parts.push(`10Y ${ctx.yields10Y}`);
  if (ctx.fundingRate) parts.push(`Funding ${ctx.fundingRate}`);
  if (ctx.openInterest) parts.push(`OI ${ctx.openInterest}`);
  if (ctx.etfFlows) parts.push(`ETF ${ctx.etfFlows}`);
  if (ctx.liquidations) parts.push(`Liq ${ctx.liquidations}`);
  if (parts.length === 0 && ctx.macroNews) parts.push(ctx.macroNews);
  return parts.join(' · ');
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
    debriefs,
    setDebriefDate,
    weeklyReviews,
    chartMigration,
    pendingSetups,
    setDeskTabRequest,
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

  // Tapping a Market Watch card opens a quick-look modal in place — a
  // trader scanning the watch shouldn't be bounced into Asset Desks just
  // to see what's going on with an asset; that full-detail view is a
  // deliberate "I need to edit this" trip, not the default glance.
  const [expandedAssetId, setExpandedAssetId] = useState<string | null>(null);
  useEffect(() => {
    if (!expandedAssetId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExpandedAssetId(null);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [expandedAssetId]);

  // Which chart screenshot the quick-look modal's carousel is currently on.
  // Resets whenever a different asset is opened (or the modal is closed).
  const [modalImageIndex, setModalImageIndex] = useState(0);
  const chartScrollRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    setModalImageIndex(0);
  }, [expandedAssetId]);

  const openTrades = trades.filter((t) => t.status === 'OPEN' && !t.voided);
  const todayStr = traderDateString();
  const hourNow = Math.floor(nowMinutes / 60);
  const greeting = hourNow < 12 ? 'Good morning' : hourNow < 17 ? 'Good afternoon' : 'Good evening';
  const greetingDate = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Africa/Lagos' });
  const lossesLeft = Math.max(0, tradingHQ.riskRules.maxDailyLosses - performanceStats.lossCountToday);
  const todayEvents = calendarEvents.filter((e) => e.date === todayStr);
  // Judged in NY time (sessions are defined there); nowMinutes ticking keeps it live.
  const activeSession = tradingHQ.sessions.find((s) => isSessionActiveAt(s, new Date()));
  const localTz = deviceTimeZone();
  const localTzLabel = localTz.split('/').pop()?.replace(/_/g, ' ') ?? localTz;
  const todayFocus = tradingHQ.focusRotation.find((d) => d.day === weekdayInZone(new Date()));
  const activeAlerts = alerts.filter((a) => a.active);
  const watchedAssets = assets.filter((a) => a.watchlisted);
  const activeRQ = researchQuestions[0];

  // Daily Mission: what the last debrief committed today to, and whether
  // today's debrief is written. The debrief slot is 18:55 Lagos; the nudge
  // appears from 18:00, or earlier if trades were already taken today.
  const lastDebrief = findPreviousDebrief(debriefs, todayStr);
  const todaysDebrief = debriefs.find((d) => d.date === todayStr);
  const tradedToday = trades.some((t) => t.date === todayStr && !t.voided);
  const debriefDue = !todaysDebrief && (nowMinutes >= 18 * 60 || tradedToday);
  const showMission = !!(todayFocus || lastDebrief?.upgradeForTomorrow || lastDebrief?.tomorrowAssignment || debriefDue || todaysDebrief);
  const openDebrief = () => { setDebriefDate(todayStr); setActiveTab('debrief'); };
  const livePending = pendingSetups.filter((p) => p.status === 'PENDING');
  const openSetups = (deskId: string) => { setSelectedAssetId(deskId); setDeskTabRequest('setups'); setActiveTab('asset-desks'); };

  // This week's plan comes from last week's review: its upgrade, and the bias
  // written for today's focus assets.
  const weekPlan = findPreviousWeeklyReview(weeklyReviews, weekStartOf(todayStr));
  const weekPlanIsCurrent = weekPlan?.weekStart === addDays(weekStartOf(todayStr), -7);
  const todayBiases = weekPlanIsCurrent && todayFocus
    ? weekPlan!.watchlist.filter((w) => w.day === todayFocus.day && (w.bias || w.keyLevels))
    : [];

  const handleGenerateDailyBrief = async () => {
    setAiBriefLoading(true);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          prompt:
            `Generate a concise daily operational briefing for the trader using only the context provided: today's session windows (defined in NY time), active risk limits, today's focus assets${todayFocus ? ` (${todayFocus.assets.join(', ')}, ${todayFocus.activity})` : ''} and their current desk biases, the active research question, and the upgrade in focus from the last debrief. Do not invent market data.`,
          context: {
            rules: tradingHQ.riskRules,
            sessionsNY: tradingHQ.sessions.map((s) => ({ name: s.name, ny: `${s.nyStart}-${s.nyEnd}` })),
            todayFocus: todayFocus ?? null,
            upgradeInFocus: lastDebrief?.upgradeForTomorrow ?? null,
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
        `The AI briefing is unavailable right now. From Trading HQ: ${tradingHQ.riskRules.riskPerSetupPct}% risk per setup, max ${tradingHQ.riskRules.maxDailyLosses} losses today${tradingHQ.riskRules.noReEntry ? ', no re-entry' : ''}.${todayFocus ? ` Today's focus: ${todayFocus.assets.join(' / ')} (${todayFocus.activity}).` : ''}`
      );
    } finally {
      setAiBriefLoading(false);
    }
  };

  const expandedAsset = watchedAssets.find((a) => a.id === expandedAssetId);

  return (
    <>
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Greeting + where you stand today */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm text-ink-3">{greetingDate}</p>
          <h1 className="text-2xl sm:text-3xl font-semibold tracking-tight text-ink mt-0.5">{greeting}</h1>
          <p className="text-sm text-ink-2 mt-1.5 max-w-2xl leading-relaxed">
            {activeSession ? <>The <span className="font-semibold text-ink">{activeSession.name}</span> session is open.</> : 'No session is open right now.'}{' '}
            {lossesLeft > 0
              ? <>You can risk <span className="font-semibold text-ink">{tradingHQ.riskRules.riskPerSetupPct}%</span> per trade and have <span className="font-semibold text-ink">{lossesLeft} of {tradingHQ.riskRules.maxDailyLosses}</span> losses left today.</>
              : <>You've reached today's loss limit, so trading is paused until tomorrow.</>}
            {openTrades.length > 0 && <> {openTrades.length} trade{openTrades.length > 1 ? 's are' : ' is'} open.</>}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleGenerateDailyBrief}
            disabled={aiBriefLoading}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-panel hover:bg-raised text-ink-2 border border-line text-sm font-medium transition"
          >
            <Sparkles className="w-4 h-4 text-sky-400" />
            <span>{aiBriefLoading ? 'Writing your brief…' : 'Daily brief'}</span>
          </button>
          <button
            onClick={() => setQuickTradeModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold transition shadow-sm"
          >
            <span>+ Log trade</span>
          </button>
        </div>
      </div>

      {performanceStats.riskStatus === 'MAX_LOSS_HALT' && (
        <div className="bg-rose-950/50 border border-rose-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-6 h-6 text-rose-400 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold text-rose-300">Daily loss limit reached ({tradingHQ.riskRules.maxDailyLosses} losses). Trading is paused until tomorrow.</h2>
              <p className="text-sm text-rose-300/80 mt-0.5">This is your own rule from Trading HQ. Take a break, write the debrief, and come back next session.</p>
            </div>
          </div>
          <button onClick={() => setActiveTab('psychology')} className="px-3 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-600 text-white text-sm font-medium transition">
            Write a psychology note
          </button>
        </div>
      )}

      {chartMigration && (chartMigration.running || chartMigration.error) && (
        <div className={`rounded border px-3 py-2 font-mono text-[11px] ${chartMigration.error ? 'border-amber-900 bg-amber-950/30 text-amber-300' : 'border-slate-800 bg-panel text-slate-400'}`}>
          {chartMigration.error
            ? `Moving screenshots to file storage stopped (${chartMigration.done}/${chartMigration.total} moved): ${chartMigration.error} Nothing was lost; the rest stay where they are and the move retries next time the app loads.`
            : `Moving saved screenshots to file storage… ${chartMigration.done}/${chartMigration.total}`}
        </div>
      )}

      {showMission && (
        <div className="bg-panel border border-slate-800 rounded-xl px-4 py-3 grid grid-cols-1 md:grid-cols-[auto_1fr_1fr_auto] gap-3 items-center font-mono text-xs">
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Today's focus</span>
            <span className="text-cyan-300 font-bold">{todayFocus?.assets.join(' / ') || '—'}</span>
            {todayFocus?.activity && <span className="block text-[10px] text-slate-500">{todayFocus.activity}</span>}
            {todayBiases.map((w) => {
              const desk = matchDesk(assets, w.asset);
              return (
                <button key={w.asset} onClick={() => { if (desk) { setSelectedAssetId(desk.id); setActiveTab('asset-desks'); } }} className="block text-left text-[10px] text-slate-300 font-sans hover:text-cyan-300" title={w.keyLevels}>
                  <span className="font-mono text-slate-500">{w.asset}:</span> {w.bias || w.keyLevels}
                </button>
              );
            })}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Upgrade in focus</span>
            <span className="text-slate-200 font-sans">{lastDebrief?.upgradeForTomorrow || '—'}</span>
            {weekPlan?.upgradeForNextWeek && (
              <span className="block text-[10px] text-slate-400 font-sans mt-0.5"><span className="font-mono text-slate-500">Week:</span> {weekPlan.upgradeForNextWeek}</span>
            )}
          </div>
          <div className="min-w-0">
            <span className="text-[10px] text-slate-500 uppercase tracking-wider block">Today's assignment</span>
            <span className="text-slate-200 font-sans">{lastDebrief?.tomorrowAssignment || '—'}</span>
          </div>
          {todaysDebrief ? (
            <button onClick={openDebrief} className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 justify-self-start md:justify-self-end">
              <ClipboardCheck className="w-3.5 h-3.5" /> Debrief done
            </button>
          ) : debriefDue ? (
            <button onClick={openDebrief} className="flex items-center gap-1.5 px-3 py-1.5 rounded border border-cyan-800 bg-cyan-950/40 text-cyan-300 hover:bg-cyan-900/40 justify-self-start md:justify-self-end">
              <ClipboardCheck className="w-3.5 h-3.5" /> Write today's debrief
            </button>
          ) : (
            <span className="text-[10px] text-slate-500 justify-self-start md:justify-self-end">Debrief slot 18:55</span>
          )}
        </div>
      )}

      {livePending.length > 0 && (
        <div className="bg-panel border border-slate-800 rounded-xl px-4 py-3 space-y-2">
          <div className="flex items-center justify-between font-mono text-xs">
            <span className="flex items-center gap-2 text-slate-200 font-bold uppercase tracking-wider"><Crosshair className="w-3.5 h-3.5 text-cyan-400" /> Pending setups ({livePending.length})</span>
            <span className="text-[10px] text-slate-500">Tap one to open it on its desk</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px] min-w-[520px]">
              <tbody>
                {livePending.slice(0, 8).map((p) => (
                  <tr key={p.id} onClick={() => openSetups(p.deskId)} className="border-t border-slate-800/60 cursor-pointer hover:bg-slate-800/30">
                    <td className="py-1.5 text-slate-200 font-bold">{p.asset}</td>
                    <td className={p.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}>{p.direction}</td>
                    <td className="text-slate-300">@ {p.entryPrice}</td>
                    <td className="text-slate-500">SL {p.stopPrice} · TP {p.targetPrice}</td>
                    <td className="text-cyan-300 font-bold">{p.plannedR}R</td>
                    <td className="text-purple-300">{p.setupGrade}</td>
                    <td className="text-slate-500 text-right">{p.validUntil && p.validUntil < todayStr ? <span className="text-amber-400">past valid date</span> : p.timeframe}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* AI Daily Brief Drawer/Box */}
      {aiBriefText && (
        <div className="bg-panel border border-cyan-500/40 rounded-lg p-4 font-mono text-xs text-cyan-200/90 relative">
          <div className="flex items-center justify-between mb-2 text-cyan-400 font-bold uppercase text-[11px] tracking-wider">
            <span className="flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" />
              AI operational briefing & risk check
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
          <h3 className="text-base font-semibold text-ink flex items-center gap-2">
            <Clock className="w-4 h-4 text-cyan-400" />
            Today
          </h3>
          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400">{todayStr}</span>
            <div className="relative">
              <button
                onClick={() => setCustomizeOpen((v) => !v)}
                className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-cyan-300 border border-slate-700 rounded px-2 py-1 transition"
              >
                <Settings2 className="w-3 h-3" />
                <span>Customize</span>
              </button>
              {customizeOpen && (
                <div className="absolute right-0 mt-1.5 z-20 w-64 bg-raised border border-slate-700 rounded-lg shadow-xl p-2 space-y-0.5">
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
          <div className="bg-panel border border-slate-800 rounded-xl p-3.5 space-y-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Trading sessions</span>
            <div className="space-y-2">
              {tradingHQ.sessions.map((s) => {
                const live = activeSession?.id === s.id;
                return (
                  <div
                    key={s.id}
                    className={`p-2 rounded border text-xs transition-all duration-500 ${
                      live ? 'bg-emerald-950/30 border-emerald-800/60' : 'bg-raised border-slate-800 opacity-60'
                    }`}
                  >
                    <div className="flex items-center justify-between font-mono font-medium text-slate-200">
                      <span>{s.name}</span>
                      {live && (
                        <span className="flex items-center gap-1 text-emerald-400 text-[10px] px-1.5 py-0.5 rounded bg-emerald-950/50 border border-emerald-800/60">
                          <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                          Live
                        </span>
                      )}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1 font-mono">
                      NY {s.nyStart} – {s.nyEnd} | {localTzLabel} {nyTimeIn(s.nyStart, localTz)} – {nyTimeIn(s.nyEnd, localTz)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Economic News & Macro Events */}
          {widgetPrefs.macroEvents && (
          <div className="bg-panel border border-slate-800 rounded-xl p-3.5 space-y-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Today's macro events</span>
            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
              {todayEvents.filter((e) => e.type === 'NEWS').length > 0 ? (
                todayEvents
                  .filter((e) => e.type === 'NEWS')
                  .map((ev) => (
                    <div key={ev.id} className="p-2 rounded bg-raised border border-slate-800 text-xs">
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
          <div className="bg-panel border border-slate-800 rounded-xl p-3.5 space-y-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Scheduled assignment</span>
            {activeRQ ? (
              <div className="p-2.5 rounded bg-raised border border-cyan-800/40 space-y-1.5">
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
          <div className="bg-panel border border-slate-800 rounded-xl p-3.5 space-y-2">
            <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Open trades & risk</span>
            {openTrades.length > 0 ? (
              <div className="space-y-1.5">
                {openTrades.map((t) => (
                  <div key={t.id} className="p-2 rounded bg-raised border border-slate-800 text-xs flex items-center justify-between">
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
              <div className="p-3 text-center text-slate-400 text-xs bg-raised rounded border border-slate-800">
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
          <h3 className="text-base font-semibold text-ink flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            Market watch
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
          <div className="p-5 text-center bg-panel border border-dashed border-slate-800 rounded-lg space-y-2">
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
        <div
          className={
            watchedAssets.length > 1
              ? 'flex gap-3 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 scroll-smooth'
              : 'flex gap-3'
          }
        >
          {watchedAssets.map((asset) => {
            const isBullish = asset.currentBias === 'BULLISH' || asset.currentBias === 'ACCUMULATION' || asset.currentBias === 'RE-ACCUMULATION';
            const isBearish = asset.currentBias === 'BEARISH' || asset.currentBias === 'DISTRIBUTION';
            const accent = isBullish ? 'emerald' : isBearish ? 'rose' : 'slate';
            const BiasIcon = isBullish ? TrendingUp : isBearish ? TrendingDown : Minus;
            const chart = getBestChartScreenshot(asset);
            const primaryScenario = getPrimaryScenario(asset);
            const externalContextLine = getExternalContextSummary(asset);

            return (
              <div
                key={asset.id}
                onClick={() => setExpandedAssetId(asset.id)}
                className={`group relative snap-start shrink-0 w-[300px] sm:w-[340px] ${
                  watchedAssets.length === 1 ? 'sm:w-full lg:max-w-xl' : ''
                } bg-panel hover:bg-raised border border-slate-800 hover:border-slate-700 rounded-lg cursor-pointer transition flex flex-col overflow-hidden`}
              >
                <span
                  className={`absolute left-0 top-0 bottom-0 w-1 z-10 ${
                    accent === 'emerald' ? 'bg-emerald-500' : accent === 'rose' ? 'bg-rose-500' : 'bg-slate-600'
                  }`}
                />

                {/* Chart screenshot — the fastest visual read of current price action */}
                <div className="relative h-28 w-full bg-canvas border-b border-slate-800 overflow-hidden">
                  {chart ? (
                    <ChartImage
                      src={chart.url}
                      alt={`${asset.symbol} ${chart.timeframe} chart`}
                      className="w-full h-full object-cover group-hover:opacity-90 transition"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="text-[10px] font-mono text-slate-600 uppercase">No chart screenshot yet</span>
                    </div>
                  )}
                  {chart && (
                    <span className="absolute bottom-1 right-1.5 text-[9px] font-mono font-bold text-slate-200 bg-black/60 px-1 py-0.5 rounded">
                      {chart.timeframe}
                    </span>
                  )}
                </div>

                <div className="pl-4 pr-3.5 py-3 flex flex-col gap-2">
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

                  <div className="text-[11px] text-slate-400 line-clamp-2 font-sans pt-0.5">
                    {asset.currentNarrative || 'No narrative logged yet.'}
                  </div>

                  {/* Primary scenario — the one path this desk is actually trading toward */}
                  {primaryScenario ? (
                    <div className="border-t border-slate-800/80 pt-1.5 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1 py-0.5 rounded">
                          Primary
                        </span>
                        <span className="text-[10px] font-mono text-slate-500">{primaryScenario.label}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 font-sans">{primaryScenario.thesis}</p>
                    </div>
                  ) : (
                    <div className="border-t border-slate-800/80 pt-1.5">
                      <span className="text-[10px] font-mono text-slate-600">No primary scenario set</span>
                    </div>
                  )}

                  {/* External context — only shown when the desk actually has data logged */}
                  {externalContextLine && (
                    <div className="text-[10px] font-mono text-slate-500 truncate border-t border-slate-800/80 pt-1.5">
                      {externalContextLine}
                    </div>
                  )}
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
          <h3 className="text-base font-semibold text-ink flex items-center gap-2">
            <Activity className="w-4 h-4 text-cyan-400" />
            Performance
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
          <div className="bg-panel border border-line rounded-xl p-4" title="R = results in units of what you risked. +3R means you made three times your risk.">
            <span className="text-xs text-ink-3">Today</span>
            <div className={`text-2xl font-semibold tracking-tight mt-1 font-mono ${performanceStats.todayR > 0 ? 'text-emerald-400' : performanceStats.todayR < 0 ? 'text-rose-400' : 'text-ink-2'}`}>
              {performanceStats.todayR > 0 ? `+${performanceStats.todayR}` : performanceStats.todayR}R
            </div>
            <span className="text-xs text-ink-3">Result today, in R</span>
          </div>
          <div className="bg-panel border border-line rounded-xl p-4" title="R = results in units of what you risked. +3R means you made three times your risk.">
            <span className="text-xs text-ink-3">This week</span>
            <div className={`text-2xl font-semibold tracking-tight mt-1 font-mono ${performanceStats.weeklyR > 0 ? 'text-emerald-400' : performanceStats.weeklyR < 0 ? 'text-rose-400' : 'text-ink-2'}`}>
              {performanceStats.weeklyR > 0 ? `+${performanceStats.weeklyR}` : performanceStats.weeklyR}R
            </div>
            <span className="text-xs text-ink-3">Last 7 days</span>
          </div>
          <div className="bg-panel border border-line rounded-xl p-4" title="R = results in units of what you risked. +3R means you made three times your risk.">
            <span className="text-xs text-ink-3">All time</span>
            <div className={`text-2xl font-semibold tracking-tight mt-1 font-mono ${performanceStats.totalR > 0 ? 'text-emerald-400' : performanceStats.totalR < 0 ? 'text-rose-400' : 'text-ink-2'}`}>
              {performanceStats.totalR > 0 ? `+${performanceStats.totalR}` : performanceStats.totalR}R
            </div>
            <span className="text-xs text-ink-3">{performanceStats.totalTrades} closed trades</span>
          </div>
          <div className="bg-panel border border-line rounded-xl p-4">
            <span className="text-xs text-ink-3">Win rate</span>
            <div className="text-2xl font-semibold tracking-tight mt-1 font-mono text-ink">{performanceStats.winRate}%</div>
            <span className="text-xs text-ink-3">Share of trades that won</span>
          </div>
          <div className="bg-panel border border-line rounded-xl p-4" title="The average result per trade, combining how often you win and how big wins and losses are.">
            <span className="text-xs text-ink-3">Expectancy</span>
            <div className={`text-2xl font-semibold tracking-tight mt-1 font-mono ${performanceStats.expectancy > 0 ? 'text-emerald-400' : performanceStats.expectancy < 0 ? 'text-rose-400' : 'text-ink-2'}`}>
              {performanceStats.expectancy > 0 ? `+${performanceStats.expectancy}` : performanceStats.expectancy}R
            </div>
            <span className="text-xs text-ink-3">Average result per trade</span>
          </div>
          <div className="bg-panel border border-line rounded-xl p-4" title="The biggest drop from a high point in results to a later low.">
            <span className="text-xs text-ink-3">Worst dip</span>
            <div className={`text-2xl font-semibold tracking-tight mt-1 font-mono ${performanceStats.maxDrawdownR > 0 ? 'text-rose-400' : 'text-ink-2'}`}>
              {performanceStats.maxDrawdownR > 0 ? `-${performanceStats.maxDrawdownR}` : 0}R
            </div>
            <span className="text-xs text-ink-3">Biggest drop from a high</span>
          </div>
        </div>

        <CapitalCard />

        {/* Process vs Outcome Paradigm Card */}
        {widgetPrefs.processMatrix && (
        <div className="bg-panel border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span className="font-mono text-xs font-bold text-slate-200 uppercase tracking-wide">
                Process integrity vs outcome matrix
              </span>
            </div>
            <span className="text-[11px] font-mono text-slate-400 italic">
              "A profitable trade does not automatically mean a good trade."
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs font-mono">
            <div className="p-3 rounded bg-raised border border-emerald-800/60">
              <div className="text-emerald-400 font-bold text-xs uppercase">Good process + win</div>
              <div className="text-slate-300 text-[11px] mt-1">Systematic execution rewarded by market probability.</div>
              <div className="text-lg font-bold text-emerald-300 mt-2">
                {trades.filter((t) => !t.voided && t.processCategory === 'GOOD_PROCESS_WIN').length} Trades
              </div>
            </div>

            <div className="p-3 rounded bg-raised border border-cyan-800/60">
              <div className="text-cyan-400 font-bold text-xs uppercase">Good process + loss</div>
              <div className="text-slate-300 text-[11px] mt-1">Acceptable business cost. All 5 process checks passed.</div>
              <div className="text-lg font-bold text-cyan-300 mt-2">
                {trades.filter((t) => !t.voided && t.processCategory === 'GOOD_PROCESS_LOSS').length} Trades ({performanceStats.goodProcessLossPct}%)
              </div>
            </div>

            <div className="p-3 rounded bg-[#201824] border border-amber-800/60">
              <div className="text-amber-400 font-bold text-xs uppercase">Bad process + win</div>
              <div className="text-slate-300 text-[11px] mt-1">Toxic positive reinforcement. Violated rules yet made PnL.</div>
              <div className="text-lg font-bold text-amber-300 mt-2">
                {trades.filter((t) => !t.voided && t.processCategory === 'BAD_PROCESS_WIN').length} Trades ({performanceStats.badProcessWinPct}%)
              </div>
            </div>

            <div className="p-3 rounded bg-[#241318] border border-rose-900/60">
              <div className="text-rose-400 font-bold text-xs uppercase">Bad process + loss</div>
              <div className="text-slate-300 text-[11px] mt-1">Double penalty. Self-sabotage & discipline breakdown.</div>
              <div className="text-lg font-bold text-rose-300 mt-2">
                {trades.filter((t) => !t.voided && t.processCategory === 'BAD_PROCESS_LOSS').length} Trades
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
          <h3 className="text-base font-semibold text-ink flex items-center gap-2">
            <Radar className="w-4 h-4 text-purple-400" />
            Research
          </h3>
          <button
            onClick={() => setActiveTab('research')}
            className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
          >
            <span>Open Research Lab</span>
            <ExternalLink className="w-3 h-3" />
          </button>
        </div>

        <div className="bg-panel border border-slate-800 rounded-xl p-4 space-y-3">
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

              <p className="text-xs text-slate-300 font-sans mt-2 italic bg-canvas p-2.5 rounded border border-slate-800">
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

    {/* Market Watch quick-look modal — a bigger look at one asset without
        leaving the Dashboard. Asset Desks stays the place to actually edit
        anything; this is the "what's going on with this?" glance. */}
    {expandedAsset && (() => {
      const isBullish = expandedAsset.currentBias === 'BULLISH' || expandedAsset.currentBias === 'ACCUMULATION' || expandedAsset.currentBias === 'RE-ACCUMULATION';
      const isBearish = expandedAsset.currentBias === 'BEARISH' || expandedAsset.currentBias === 'DISTRIBUTION';
      const accent = isBullish ? 'emerald' : isBearish ? 'rose' : 'slate';
      const BiasIcon = isBullish ? TrendingUp : isBearish ? TrendingDown : Minus;
      const charts = getOrderedChartScreenshots(expandedAsset);
      const primaryScenario = getPrimaryScenario(expandedAsset);
      const externalContextLine = getExternalContextSummary(expandedAsset);
      const activeChart = charts[modalImageIndex];
      const scrollChartsBy = (dir: -1 | 1) => {
        const el = chartScrollRef.current;
        if (!el) return;
        el.scrollBy({ left: dir * el.clientWidth, behavior: 'smooth' });
      };

      return (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
          onClick={() => setExpandedAssetId(null)}
        >
          <div
            className="relative w-full max-w-lg max-h-[88vh] overflow-y-auto bg-well border border-slate-700 rounded-xl shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setExpandedAssetId(null)}
              className="absolute top-3 right-3 z-10 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-slate-300 hover:text-ink transition"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Bigger chart screenshot(s) — the whole point of tapping in.
                Scroll/swipe sideways (or use the arrows) when a desk has
                more than one. */}
            <div className="relative h-56 sm:h-64 w-full bg-canvas rounded-t-xl overflow-hidden">
              {charts.length > 0 ? (
                <>
                  <div
                    key={expandedAsset.id}
                    ref={chartScrollRef}
                    onScroll={(e) => {
                      const el = e.currentTarget;
                      if (el.clientWidth === 0) return;
                      setModalImageIndex(Math.round(el.scrollLeft / el.clientWidth));
                    }}
                    className="h-full w-full flex overflow-x-auto snap-x snap-mandatory scrollbar-hide"
                  >
                    {charts.map((c) => (
                      <div key={c.id} className="h-full w-full shrink-0 snap-center flex items-center justify-center">
                        <ChartImage
                          src={c.url}
                          alt={`${expandedAsset.symbol} ${c.timeframe} chart`}
                          className="max-w-full max-h-full object-contain"
                        />
                      </div>
                    ))}
                  </div>

                  {activeChart && (
                    <span className="absolute top-2 left-2.5 text-[10px] font-mono font-bold text-slate-200 bg-black/60 px-1.5 py-0.5 rounded pointer-events-none">
                      {activeChart.timeframe} · {activeChart.title}
                    </span>
                  )}

                  {charts.length > 1 && (
                    <>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          scrollChartsBy(-1);
                        }}
                        disabled={modalImageIndex === 0}
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-slate-200 transition disabled:opacity-20 disabled:cursor-default"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          scrollChartsBy(1);
                        }}
                        disabled={modalImageIndex >= charts.length - 1}
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-full bg-black/50 hover:bg-black/70 text-slate-200 transition disabled:opacity-20 disabled:cursor-default"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
                        {charts.map((c, i) => (
                          <span
                            key={c.id}
                            className={`w-1.5 h-1.5 rounded-full transition ${
                              i === modalImageIndex ? 'bg-white' : 'bg-white/30'
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <span className="text-xs font-mono text-slate-600 uppercase">No chart screenshot yet</span>
                </div>
              )}
            </div>

            <div className="p-5 space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-slate-100 text-xl tracking-wide">{expandedAsset.symbol}</span>
                <span
                  className={`flex items-center gap-1.5 text-xs font-mono font-bold px-2 py-1 rounded ${
                    accent === 'emerald'
                      ? 'text-emerald-300 bg-emerald-500/10'
                      : accent === 'rose'
                      ? 'text-rose-300 bg-rose-500/10'
                      : 'text-slate-400 bg-slate-500/10'
                  }`}
                >
                  <BiasIcon className="w-4 h-4" />
                  {expandedAsset.currentBias}
                </span>
              </div>

              <div>
                <span className="text-[10px] font-mono text-slate-500 uppercase">Narrative</span>
                <p className="text-sm text-slate-300 font-sans mt-1">
                  {expandedAsset.currentNarrative || 'No narrative logged yet.'}
                </p>
              </div>

              <div className="border-t border-slate-800 pt-3">
                <span className="text-[10px] font-mono text-slate-500 uppercase">Primary Scenario</span>
                {primaryScenario ? (
                  <div className="mt-1 space-y-1">
                    <span className="inline-block text-[10px] font-mono font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded">
                      {primaryScenario.label}
                    </span>
                    <p className="text-sm text-slate-300 font-sans">{primaryScenario.thesis}</p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600 font-sans mt-1">No primary scenario set yet.</p>
                )}
              </div>

              {externalContextLine && (
                <div className="border-t border-slate-800 pt-3">
                  <span className="text-[10px] font-mono text-slate-500 uppercase">External Context</span>
                  <p className="text-sm text-slate-300 font-mono mt-1">{externalContextLine}</p>
                </div>
              )}

              <button
                onClick={() => {
                  setSelectedAssetId(expandedAsset.id);
                  setActiveTab('asset-desks');
                  setExpandedAssetId(null);
                }}
                className="w-full mt-2 flex items-center justify-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold uppercase tracking-wide py-2.5 rounded-lg transition"
              >
                <span>Open Full Analysis in Asset Desks</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      );
    })()}
    </>
  );
};
