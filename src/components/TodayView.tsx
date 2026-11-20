import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowDown, ArrowUp, CalendarDays, Check, ChevronRight, ClipboardCheck, Crosshair, EyeOff, FlaskConical,
  GripVertical, LayoutGrid, Plus, ShieldAlert, Sparkles, Star, Wallet, X,
} from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import { getAuthHeaders } from '../lib/supabaseClient';
import { traderDateString, traderNowMinutes, isSessionActiveAt, weekdayInZone } from '../utils/traderTime';
import { viewZone } from '../utils/timeDisplay';
import { contextSummary, getLanes } from '../utils/marketContext';
import { findPreviousDebrief } from '../utils/debrief';
import { addDays, findPreviousWeeklyReview, matchDesk, weekStartOf } from '../utils/weekly';
import { formatMoney } from '../utils/accounts';
import { badgeDefsFor, badgeStates, badgeValues, disciplineDays, disciplineStreak, disciplineToday, planKeptStreak, winStreak, TIER_LABEL } from '../utils/discipline';
import type { AssetDeskData } from '../types';
import { ChartImage } from './ChartImage';
import { BadgeCoin, LiquidBar, LiquidOrb, StreakFlame, useCountUp } from './DisciplineVisuals';

// ---- Layout (a view preference, kept in this browser) ----------------------

type CardId = 'plan' | 'setups' | 'starred' | 'open' | 'accounts' | 'progress' | 'calendar' | 'research';

const CARD_META: Record<CardId, { title: string; icon: React.ElementType; wide?: boolean }> = {
  plan: { title: "Today's plan", icon: ClipboardCheck },
  setups: { title: "Today's setups", icon: Crosshair },
  starred: { title: 'Starred analysis', icon: Star, wide: true },
  open: { title: 'Open trades & risk', icon: ShieldAlert },
  accounts: { title: 'Accounts', icon: Wallet },
  progress: { title: 'Discipline progress', icon: Sparkles },
  calendar: { title: "Today's calendar", icon: CalendarDays },
  research: { title: 'Research', icon: FlaskConical },
};

const DEFAULT_ORDER: CardId[] = ['plan', 'setups', 'starred', 'open', 'accounts', 'progress', 'calendar', 'research'];
const DEFAULT_HIDDEN: CardId[] = ['calendar', 'research'];
const LAYOUT_KEY = 'trading_os_today_layout_v1';

interface Layout { order: CardId[]; hidden: CardId[] }

function loadLayout(): Layout {
  try {
    const raw = localStorage.getItem(LAYOUT_KEY);
    if (raw) {
      const p = JSON.parse(raw) as Partial<Layout>;
      const known = (p.order ?? []).filter((id): id is CardId => id in CARD_META);
      const order = [...known, ...DEFAULT_ORDER.filter((id) => !known.includes(id))];
      return { order, hidden: (p.hidden ?? []).filter((id): id is CardId => id in CARD_META) };
    }
  } catch { /* fall through */ }
  return { order: DEFAULT_ORDER, hidden: DEFAULT_HIDDEN };
}

const fmtR = (r: number) => `${r > 0 ? '+' : ''}${Math.round(r * 100) / 100}R`;
const toneR = (r: number) => (r > 0 ? 'text-emerald-400' : r < 0 ? 'text-rose-400' : 'text-ink');

const BIAS_DOT: Record<string, string> = {
  BULLISH: '#34d399', ACCUMULATION: '#34d399', 'RE-ACCUMULATION': '#34d399',
  BEARISH: '#fb7185', DISTRIBUTION: '#fb7185', NEUTRAL: '#94a3b8',
};

function bestChart(asset: AssetDeskData) {
  const charts = [...(asset.charts ?? [])].sort((a, b) => new Date(b.uploadedAt).getTime() - new Date(a.uploadedAt).getTime());
  return charts.find((c) => c.category === 'BIAS') ?? charts[0];
}

/** Opens the Journal on a given tab (read once by JournalView). */
export function requestJournalView(view: 'trades' | 'accounts') {
  try { sessionStorage.setItem('tos-journal-view', view); } catch { /* best effort */ }
}

// ---- View -----------------------------------------------------------------

export const TodayView: React.FC = () => {
  const ctx = useTrading();
  const {
    tradingHQ, assets, trades, researchQuestions, calendarEvents, performanceStats, setActiveTab, setSelectedAssetId,
    debriefs, setDebriefDate, weeklyReviews, chartMigration, pendingSetups, setDeskTabRequest, timeView,
    accounts, accountSummaries, accountPropStatus, backtestSamples, setQuickTradeModalOpen,
  } = ctx;

  const [nowMinutes, setNowMinutes] = useState(() => traderNowMinutes());
  useEffect(() => { const t = setInterval(() => setNowMinutes(traderNowMinutes()), 30_000); return () => clearInterval(t); }, []);

  const [layout, setLayout] = useState<Layout>(loadLayout);
  const [arranging, setArranging] = useState(false);
  const [dragId, setDragId] = useState<CardId | null>(null);
  useEffect(() => { try { localStorage.setItem(LAYOUT_KEY, JSON.stringify(layout)); } catch { /* view preference only */ } }, [layout]);

  const [briefLoading, setBriefLoading] = useState(false);
  const [briefText, setBriefText] = useState<string | null>(null);

  const todayStr = traderDateString();
  const hourNow = new Date().getHours();
  const greeting = hourNow < 12 ? 'Good morning' : hourNow < 17 ? 'Good afternoon' : 'Good evening';
  const greetingDate = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', timeZone: viewZone(timeView) });
  const rules = tradingHQ.riskRules;
  const lossesLeft = Math.max(0, rules.maxDailyLosses - performanceStats.lossCountToday);
  const halted = performanceStats.riskStatus === 'MAX_LOSS_HALT' || lossesLeft === 0;
  const activeSession = tradingHQ.sessions.find((s) => isSessionActiveAt(s, new Date()));
  const openTrades = trades.filter((t) => t.status === 'OPEN' && !t.voided);
  const todayFocus = tradingHQ.focusRotation.find((d) => d.day === weekdayInZone(new Date()));
  const lastDebrief = findPreviousDebrief(debriefs, todayStr);
  const todaysDebrief = debriefs.find((d) => d.date === todayStr);
  const tradedToday = trades.some((t) => t.date === todayStr && !t.voided);
  const debriefDue = !todaysDebrief && (nowMinutes >= 18 * 60 || tradedToday);
  const livePending = pendingSetups.filter((p) => p.status === 'PENDING');
  const starred = assets.filter((a) => a.watchlisted);
  const activeAccounts = accounts.filter((a) => !a.archivedAt);
  const activeRQ = researchQuestions[0];
  const todayEvents = calendarEvents.filter((e) => e.date === todayStr).sort((a, b) => a.time.localeCompare(b.time));
  const weekPlan = findPreviousWeeklyReview(weeklyReviews, weekStartOf(todayStr));
  const weekPlanIsCurrent = weekPlan?.weekStart === addDays(weekStartOf(todayStr), -7);
  const todayBiases = weekPlanIsCurrent && todayFocus ? weekPlan!.watchlist.filter((w) => w.day === todayFocus.day && (w.bias || w.keyLevels)) : [];

  const discipline = useMemo(() => {
    const days = disciplineDays(trades);
    const badges = badgeStates(badgeValues(trades, debriefs, backtestSamples, rules.maxDailyLosses, todayStr, tradingHQ.setupGrades[0]?.grade), badgeDefsFor(tradingHQ));
    return {
      today: disciplineToday(trades, todayStr),
      streak: disciplineStreak(days),
      plan: planKeptStreak(trades),
      wins: winStreak(trades),
      badges,
    };
  }, [trades, debriefs, backtestSamples, rules.maxDailyLosses, todayStr, tradingHQ]);

  const openDesk = (deskId: string, tab?: 'setups') => { setSelectedAssetId(deskId); if (tab) setDeskTabRequest(tab); setActiveTab('asset-desks'); };
  const openDebrief = () => { setDebriefDate(todayStr); setActiveTab('debrief'); };

  const generateBrief = async () => {
    setBriefLoading(true);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          prompt: `Generate a concise daily operational briefing for the trader using only the context provided: today's session windows (NY time), active risk limits, today's focus assets${todayFocus ? ` (${todayFocus.assets.join(', ')}, ${todayFocus.activity})` : ''} and their desk biases, the active research question, and the upgrade in focus from the last debrief. Do not invent market data. External context is context, never a buy or sell signal.`,
          context: {
            rules, sessionsNY: tradingHQ.sessions.map((s) => ({ name: s.name, ny: `${s.nyStart}-${s.nyEnd}` })),
            todayFocus: todayFocus ?? null, upgradeInFocus: lastDebrief?.upgradeForTomorrow ?? null, stats: performanceStats,
            activeAssets: assets.map((a) => ({ symbol: a.symbol, bias: a.currentBias, narrative: a.currentNarrative })),
            activeRQ: activeRQ ? { code: activeRQ.code, title: activeRQ.title, progress: `${activeRQ.sampleCount}/${activeRQ.targetSamples}` } : null,
          },
        }),
      });
      const data = await response.json();
      setBriefText(response.ok ? data.text || 'Briefing generated.' : data.error || 'Could not generate the briefing right now.');
    } catch {
      setBriefText(`The AI briefing is unavailable right now. From Trading HQ: ${rules.riskPerSetupPct}% risk per setup, max ${rules.maxDailyLosses} losses today${rules.noReEntry ? ', no re-entry' : ''}.${todayFocus ? ` Today's focus: ${todayFocus.assets.join(' / ')} (${todayFocus.activity}).` : ''}`);
    } finally {
      setBriefLoading(false);
    }
  };

  // ---- Layout actions
  const visible = layout.order.filter((id) => !layout.hidden.includes(id));
  const hiddenCards = layout.order.filter((id) => layout.hidden.includes(id));
  const move = (id: CardId, delta: number) => setLayout((l) => {
    const vis = l.order.filter((x) => !l.hidden.includes(x));
    const i = vis.indexOf(id);
    const j = i + delta;
    if (i < 0 || j < 0 || j >= vis.length) return l;
    [vis[i], vis[j]] = [vis[j], vis[i]];
    return { ...l, order: [...vis, ...l.order.filter((x) => l.hidden.includes(x))] };
  });
  const dropOn = (target: CardId) => setLayout((l) => {
    if (!dragId || dragId === target) return l;
    const order = l.order.filter((x) => x !== dragId);
    order.splice(order.indexOf(target), 0, dragId);
    return { ...l, order };
  });
  const hide = (id: CardId) => setLayout((l) => ({ ...l, hidden: [...l.hidden, id] }));
  const show = (id: CardId) => setLayout((l) => ({ order: [...l.order.filter((x) => x !== id && !l.hidden.includes(x)), id, ...l.order.filter((x) => x !== id && l.hidden.includes(x))], hidden: l.hidden.filter((x) => x !== id) }));

  // ---- Cards
  const nextBadge = [...discipline.badges].filter((b) => b.next).sort((a, b) => (b.value / b.next!.target) - (a.value / a.next!.target))[0];
  const latestEarned = [...discipline.badges].filter((b) => b.tier).sort((a, b) => ['bronze', 'silver', 'gold'].indexOf(b.tier!) - ['bronze', 'silver', 'gold'].indexOf(a.tier!))[0];

  const cardBody = (id: CardId): React.ReactNode => {
    switch (id) {
      case 'plan': return (
        <div className="space-y-4">
          <SessionTimeline sessions={tradingHQ.sessions} nowMinutes={nowMinutes} activeId={activeSession?.id} />
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Fact label="Focus">
              {todayFocus ? <>{todayFocus.assets.join(' / ')} <span className="text-ink-3">· {todayFocus.activity}</span></> : <span className="text-ink-3">No focus set for today</span>}
              {todayBiases.map((w) => {
                const desk = matchDesk(assets, w.asset);
                return <button key={w.asset} onClick={() => desk && openDesk(desk.id)} className="mt-1 block text-left text-xs text-ink-2 hover:text-accent" title={w.keyLevels}><span className="text-ink-3">{w.asset}:</span> {w.bias || w.keyLevels}</button>;
              })}
            </Fact>
            <Fact label="Upgrade in focus">{lastDebrief?.upgradeForTomorrow || <span className="text-ink-3">From your next debrief</span>}</Fact>
            <Fact label="Assignment">{lastDebrief?.tomorrowAssignment || <span className="text-ink-3">None set</span>}</Fact>
            <Fact label="Debrief">
              {todaysDebrief
                ? <button onClick={openDebrief} className="inline-flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300"><Check className="h-3.5 w-3.5" /> Written</button>
                : debriefDue
                  ? <button onClick={openDebrief} className="inline-flex items-center gap-1 font-semibold text-accent hover:underline">Write today's debrief <ChevronRight className="h-3.5 w-3.5" /></button>
                  : <span className="text-ink-3">Due after the session</span>}
            </Fact>
          </dl>
        </div>
      );
      case 'setups': return livePending.length ? (
        <ul className="-mx-2 divide-y divide-line">
          {livePending.slice(0, 6).map((p) => (
            <li key={p.id}>
              <button onClick={() => openDesk(p.deskId, 'setups')} className="w-full flex items-center gap-3 rounded-xl px-2 py-2.5 text-left hover:bg-raised transition">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-[11px] font-bold ring-1 ring-inset ${p.direction === 'LONG' ? 'bg-emerald-500/12 text-emerald-300 ring-emerald-400/25' : 'bg-rose-500/12 text-rose-300 ring-rose-400/25'}`}>{p.direction === 'LONG' ? 'L' : 'S'}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2 text-sm font-semibold text-ink">{p.asset} <span className="rounded-md bg-raised px-1.5 py-0.5 text-[10px] font-semibold text-ink-2 ring-1 ring-inset ring-line">{p.setupGrade}</span></span>
                  <span className="block text-xs tabular-nums text-ink-3">@ {p.entryPrice} · SL {p.stopPrice} · TP {p.targetPrice}{p.validUntil && p.validUntil < todayStr ? <span className="text-amber-400"> · past valid date</span> : ''}</span>
                </span>
                <span className="tos-figure text-sm text-accent">{p.plannedR}R</span>
              </button>
            </li>
          ))}
        </ul>
      ) : <Empty text="No setups waiting. Plan one on an Asset Desk and it shows here until it triggers." action="Open Asset Desks" onAction={() => setActiveTab('asset-desks')} />;
      case 'starred': return starred.length ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {starred.map((a) => {
            const chart = bestChart(a);
            const primary = a.scenarios.find((s) => s.probability === 'PRIMARY');
            const ctxLine = contextSummary(getLanes(a));
            return (
              <button key={a.id} onClick={() => openDesk(a.id)} className="tos-card-hover group text-left rounded-2xl bg-raised ring-1 ring-inset ring-line overflow-hidden hover:ring-line-strong">
                <div className="chart-frame relative aspect-[16/8] overflow-hidden">
                  {chart ? <ChartImage src={chart.url} alt={`${a.symbol} chart`} className="h-full w-full object-cover opacity-90 transition duration-500 group-hover:scale-[1.03] group-hover:opacity-100" />
                    : <div className="grid h-full place-items-center text-[11px] text-slate-500">No chart yet</div>}
                  <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />
                  <div className="absolute bottom-2.5 left-3 right-3 flex items-end justify-between gap-2">
                    <span className="text-base font-bold tracking-tight text-white">{a.symbol}</span>
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-black/55 px-2 py-0.5 text-[10px] font-semibold text-white ring-1 ring-inset ring-white/15 backdrop-blur">
                      <span className="h-1.5 w-1.5 rounded-full" style={{ background: BIAS_DOT[a.currentBias] ?? '#94a3b8' }} />{a.currentBias.replace('-', ' ').toLowerCase()}</span>
                  </div>
                </div>
                <div className="p-3.5 space-y-1.5">
                  <p className="text-xs text-ink-2 line-clamp-2 leading-relaxed">{a.currentNarrative || 'No narrative written yet.'}</p>
                  {primary && <p className="text-[11px] text-ink-3 line-clamp-1"><span className="font-semibold text-ink-2">Primary:</span> {primary.thesis}</p>}
                  {ctxLine && <p className="text-[11px] text-ink-3 line-clamp-1">{ctxLine}</p>}
                </div>
              </button>
            );
          })}
        </div>
      ) : <Empty text="Star a desk on Asset Desks and its latest analysis, bias and chart are pinned here." action="Open Asset Desks" onAction={() => setActiveTab('asset-desks')} />;
      case 'open': return (
        <div className="space-y-3">
          {openTrades.length ? (
            <ul className="space-y-2">
              {openTrades.map((t) => (
                <li key={t.id} className="flex items-center justify-between rounded-xl bg-raised px-3 py-2 ring-1 ring-inset ring-line text-sm">
                  <span className="flex items-center gap-2 font-semibold text-ink">{t.asset}<span className={`text-[10px] font-semibold ${t.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}`}>{t.direction}</span></span>
                  <span className="tos-figure text-accent">{t.plannedR}R</span>
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-ink-3">No open trades. Capital fully preserved.</p>}
          <div>
            <div className="flex justify-between text-xs text-ink-3 mb-1.5"><span>Losses today</span><span className="tabular-nums">{performanceStats.lossCountToday} of {rules.maxDailyLosses}</span></div>
            <LiquidBar pct={(performanceStats.lossCountToday / Math.max(1, rules.maxDailyLosses)) * 100} tone={halted ? 'rose' : performanceStats.lossCountToday ? 'amber' : 'emerald'} />
          </div>
        </div>
      );
      case 'accounts': return activeAccounts.length ? (
        <ul className="space-y-3.5">
          {activeAccounts.map((a) => {
            const s = accountSummaries[a.id];
            const prop = accountPropStatus[a.id];
            const daily = prop?.daily;
            return (
              <li key={a.id}>
                <button onClick={() => { requestJournalView('accounts'); setActiveTab('journal'); }} className="w-full text-left group">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="truncate text-sm font-semibold text-ink group-hover:text-accent">{a.name}</span>
                    <span className="tos-figure text-sm text-ink">{formatMoney(s?.balance ?? a.startingBalance, a.currency)}</span>
                  </div>
                  <div className="mt-0.5 flex justify-between text-[11px] text-ink-3">
                    <span>{daily ? `Daily loss ${formatMoney(daily.used, a.currency)} of ${formatMoney(daily.limit, a.currency)}` : `${s?.closedTrades ?? 0} closed trades`}</span>
                    <span className={toneR(s?.returnPct ?? 0)}>{(s?.returnPct ?? 0) > 0 ? '+' : ''}{s?.returnPct ?? 0}%</span>
                  </div>
                  {daily && <LiquidBar className="mt-1.5" pct={(daily.used / Math.max(1, daily.limit)) * 100} tone={daily.state === 'OK' ? 'aqua' : daily.state === 'BREACHED' ? 'rose' : 'amber'} />}
                </button>
              </li>
            );
          })}
        </ul>
      ) : <Empty text="Add the accounts you trade, with their capital, so each trade moves the right balance." action="Add an account" onAction={() => { requestJournalView('accounts'); setActiveTab('journal'); }} />;
      case 'progress': return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <MiniStat label="Plan kept" value={discipline.plan.current} suffix={discipline.plan.current === 1 ? 'trade' : 'trades'} hint="Closed trades in a row at 5/5" />
            <MiniStat label="Wins in a row" value={discipline.wins} hint="Shown for information, never rewarded" muted />
          </div>
          {nextBadge && (
            <div className="flex items-center gap-3 rounded-2xl bg-raised p-3 ring-1 ring-inset ring-line">
              <BadgeCoin tier={nextBadge.tier} mono={nextBadge.def.mono} size={46} />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-ink-3">Next: {TIER_LABEL[nextBadge.next!.tier]} {nextBadge.def.name}</div>
                <div className="text-sm font-semibold text-ink">{nextBadge.next!.target - nextBadge.value} {nextBadge.def.unit} to go</div>
                <LiquidBar className="mt-1.5" pct={(nextBadge.value / nextBadge.next!.target) * 100} />
              </div>
            </div>
          )}
          <button onClick={() => setActiveTab('discipline')} className="inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">
            {latestEarned ? `See all badges · latest ${TIER_LABEL[latestEarned.tier!]} ${latestEarned.def.name}` : 'See all badges'} <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      );
      case 'calendar': return todayEvents.length ? (
        <ul className="space-y-2">
          {todayEvents.map((e) => (
            <li key={e.id} className="flex items-center gap-3 text-sm">
              <span className="w-12 shrink-0 tabular-nums text-ink-3">{e.time}</span>
              <span className="min-w-0 flex-1 truncate text-ink">{e.title}</span>
              {e.impact && <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-semibold ${e.impact === 'HIGH' ? 'bg-rose-500/15 text-rose-300' : e.impact === 'MEDIUM' ? 'bg-amber-500/15 text-amber-300' : 'bg-raised text-ink-3'}`}>{e.impact.toLowerCase()}</span>}
            </li>
          ))}
        </ul>
      ) : <Empty text="Nothing on the calendar today." action="Open Calendar" onAction={() => setActiveTab('calendar')} />;
      case 'research': return activeRQ ? (
        <button onClick={() => setActiveTab('research')} className="w-full text-left space-y-2">
          <div className="flex items-center justify-between text-xs"><span className="font-semibold text-accent">{activeRQ.code}</span><span className="text-ink-3">{activeRQ.status.replace('_', ' ').toLowerCase()}</span></div>
          <p className="text-sm font-medium text-ink line-clamp-2">{activeRQ.title}</p>
          <LiquidBar pct={(activeRQ.sampleCount / Math.max(1, activeRQ.targetSamples)) * 100} />
          <p className="text-[11px] tabular-nums text-ink-3">{activeRQ.sampleCount} of {activeRQ.targetSamples} samples</p>
        </button>
      ) : <Empty text="No research question yet." action="Open Research" onAction={() => setActiveTab('research')} />;
    }
  };

  const orbTone = halted ? 'rose' : discipline.today.pct < 60 ? 'amber' : 'aqua';
  const todayR = useCountUp(performanceStats.todayR);
  const weekR = useCountUp(performanceStats.weeklyR);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Hero */}
      <section className={`tos-card tos-rise relative overflow-hidden p-5 sm:p-7 ${halted ? 'ring-1 ring-rose-500/30' : ''}`}>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full opacity-40 blur-3xl" style={{ background: halted ? 'radial-gradient(circle, #e11d48, transparent 70%)' : 'radial-gradient(circle, var(--tos-blob-1), transparent 70%)' }} />
        <div className="relative flex flex-col-reverse gap-6 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 flex-1">
            <p className="text-sm text-ink-3">{greetingDate}</p>
            <h1 className="mt-1 text-[1.75rem] sm:text-[2.1rem] font-semibold tracking-[-0.03em] leading-tight text-ink">
              {halted ? 'Done for today. The system held.' : greeting}
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-ink-2">
              {halted
                ? <>You reached your limit of {rules.maxDailyLosses} losses, your own rule from Trading HQ. Stepping away now is the discipline. Write the debrief and come back next session.</>
                : <>{activeSession ? <>The <b className="font-semibold text-ink">{activeSession.name}</b> session is open. </> : 'No session is open right now. '}
                  Risk <b className="font-semibold text-ink">{rules.riskPerSetupPct}%</b> per trade · <b className="font-semibold text-ink">{lossesLeft} of {rules.maxDailyLosses}</b> losses left
                  {openTrades.length > 0 && <> · {openTrades.length} open</>}.</>}
            </p>
            <div className="mt-5 flex flex-wrap items-center gap-2.5">
              {halted ? (
                <button onClick={openDebrief} className="tos-cta inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold"><ClipboardCheck className="h-4 w-4" /> Write the debrief</button>
              ) : (
                <button onClick={() => setQuickTradeModalOpen(true)} className="tos-cta inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold" title="Shortcut: ⌘K / Ctrl+K"><Plus className="h-4 w-4" /> Log a trade</button>
              )}
              <button onClick={generateBrief} disabled={briefLoading} className="tos-glass inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium text-ink-2 hover:text-ink transition">
                <Sparkles className="h-4 w-4 text-accent" /> {briefLoading ? 'Writing your brief…' : 'Daily brief'}
              </button>
            </div>
            <div className="mt-6 grid grid-cols-3 gap-2 sm:max-w-md">
              <HeroFigure label="Today" value={<span className={toneR(performanceStats.todayR)}>{fmtR(todayR)}</span>} />
              <HeroFigure label="This week" value={<span className={toneR(performanceStats.weeklyR)}>{fmtR(weekR)}</span>} />
              <HeroFigure label="Discipline streak" value={<span className="inline-flex items-center gap-1">{discipline.streak.current}<StreakFlame n={discipline.streak.current} className="h-4 w-4" /></span>} hint={`days · best ${discipline.streak.best}`} />
            </div>
          </div>
          <div className="flex items-center justify-center md:pr-2">
            <div className="tos-bob">
              <LiquidOrb pct={discipline.today.pct} tone={orbTone} label="Discipline" sub={discipline.today.trades ? `${discipline.today.trades} trade${discipline.today.trades > 1 ? 's' : ''} today` : 'No trades yet'} size={176} />
            </div>
          </div>
        </div>
      </section>

      {chartMigration && (chartMigration.running || chartMigration.error) && (
        <div className={`rounded-xl px-4 py-2.5 text-xs ${chartMigration.error ? 'bg-amber-500/10 text-amber-300 ring-1 ring-amber-500/25' : 'tos-glass text-ink-3'}`}>
          {chartMigration.error
            ? `Moving screenshots to file storage stopped (${chartMigration.done}/${chartMigration.total} moved): ${chartMigration.error} Nothing was lost; the move retries next time the app loads.`
            : `Moving saved screenshots to file storage… ${chartMigration.done}/${chartMigration.total}`}
        </div>
      )}

      {briefText && (
        <div className="tos-card tos-pop relative p-5">
          <button onClick={() => setBriefText(null)} className="absolute right-4 top-4 text-ink-3 hover:text-ink" aria-label="Close brief"><X className="h-4 w-4" /></button>
          <div className="tos-label mb-2 flex items-center gap-2"><Sparkles className="h-3.5 w-3.5 text-accent" /> Daily brief</div>
          <p className="whitespace-pre-line text-sm leading-relaxed text-ink-2">{briefText}</p>
        </div>
      )}

      {/* Cards */}
      <div className="flex items-center justify-between">
        <h2 className="tos-label">Your day</h2>
        <button onClick={() => setArranging((v) => !v)} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition ${arranging ? 'tos-cta' : 'tos-glass text-ink-2 hover:text-ink'}`}>
          {arranging ? <><Check className="h-3.5 w-3.5" /> Done</> : <><LayoutGrid className="h-3.5 w-3.5" /> Arrange</>}
        </button>
      </div>

      {arranging && (
        <div className="tos-glass tos-pop rounded-2xl p-3.5 text-xs text-ink-2">
          <p>Drag cards or use the arrows to reorder. Hide what you don't need.{hiddenCards.length ? ' Add a hidden card back:' : ''}</p>
          {hiddenCards.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              {hiddenCards.map((id) => { const Icon = CARD_META[id].icon; return (
                <button key={id} onClick={() => show(id)} className="inline-flex items-center gap-1.5 rounded-full bg-raised px-3 py-1.5 ring-1 ring-inset ring-line hover:ring-accent/50 hover:text-ink">
                  <Plus className="h-3.5 w-3.5" /><Icon className="h-3.5 w-3.5" /> {CARD_META[id].title}
                </button>
              ); })}
            </div>
          )}
          <button onClick={() => setLayout({ order: DEFAULT_ORDER, hidden: DEFAULT_HIDDEN })} className="mt-2.5 text-ink-3 underline-offset-2 hover:text-ink hover:underline">Reset to default</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {visible.map((id, i) => {
          const meta = CARD_META[id];
          const Icon = meta.icon;
          return (
            <section key={id}
              draggable={arranging}
              onDragStart={() => setDragId(id)}
              onDragEnd={() => setDragId(null)}
              onDragOver={(e) => { if (arranging) e.preventDefault(); }}
              onDrop={(e) => { e.preventDefault(); dropOn(id); setDragId(null); }}
              className={`tos-card tos-rise p-5 ${meta.wide ? 'lg:col-span-2' : ''} ${arranging ? 'cursor-grab ring-1 ring-dashed ring-accent/30' : ''} ${dragId === id ? 'opacity-50' : ''}`}
              style={{ animationDelay: `${60 + i * 50}ms` }}>
              <header className="mb-4 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-2 text-sm font-semibold text-ink">
                  {arranging && <GripVertical className="h-4 w-4 text-ink-3" />}
                  <span className="grid h-7 w-7 place-items-center rounded-lg bg-raised ring-1 ring-inset ring-line"><Icon className="h-3.5 w-3.5 text-accent" /></span>
                  {meta.title}
                  {id === 'setups' && livePending.length > 0 && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold text-accent">{livePending.length}</span>}
                </h3>
                {arranging && (
                  <div className="flex items-center gap-1">
                    <IconBtn label="Move up" onClick={() => move(id, -1)} disabled={i === 0}><ArrowUp className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn label="Move down" onClick={() => move(id, 1)} disabled={i === visible.length - 1}><ArrowDown className="h-3.5 w-3.5" /></IconBtn>
                    <IconBtn label="Hide card" onClick={() => hide(id)}><EyeOff className="h-3.5 w-3.5" /></IconBtn>
                  </div>
                )}
              </header>
              <div className={arranging ? 'pointer-events-none select-none opacity-80' : ''}>{cardBody(id)}</div>
            </section>
          );
        })}
      </div>
    </div>
  );
};

// ---- Small pieces ----------------------------------------------------------

const Fact: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div className="rounded-xl bg-raised p-3 ring-1 ring-inset ring-line">
    <dt className="tos-label mb-1">{label}</dt>
    <dd className="text-sm text-ink">{children}</dd>
  </div>
);

const Empty: React.FC<{ text: string; action: string; onAction: () => void }> = ({ text, action, onAction }) => (
  <div className="rounded-xl border border-dashed border-line-strong p-4 text-center">
    <p className="text-sm text-ink-3">{text}</p>
    <button onClick={onAction} className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-accent hover:underline">{action} <ChevronRight className="h-3.5 w-3.5" /></button>
  </div>
);

const IconBtn: React.FC<{ label: string; onClick: () => void; disabled?: boolean; children: React.ReactNode }> = ({ label, onClick, disabled, children }) => (
  <button type="button" aria-label={label} title={label} onClick={onClick} disabled={disabled}
    className="grid h-7 w-7 place-items-center rounded-lg bg-raised text-ink-2 ring-1 ring-inset ring-line hover:text-ink disabled:opacity-30">{children}</button>
);

const HeroFigure: React.FC<{ label: string; value: React.ReactNode; hint?: string }> = ({ label, value, hint }) => (
  <div className="rounded-2xl bg-raised px-3 py-2.5 ring-1 ring-inset ring-line">
    <div className="text-[11px] text-ink-3">{label}</div>
    <div className="tos-figure mt-0.5 text-lg text-ink">{value}</div>
    {hint && <div className="text-[10px] text-ink-3">{hint}</div>}
  </div>
);

const MiniStat: React.FC<{ label: string; value: number; suffix?: string; hint: string; muted?: boolean }> = ({ label, value, suffix, hint, muted }) => {
  const n = useCountUp(value);
  return (
    <div className="rounded-2xl bg-raised p-3 ring-1 ring-inset ring-line" title={hint}>
      <div className="text-[11px] text-ink-3">{label}</div>
      <div className={`tos-figure mt-0.5 text-2xl ${muted ? 'text-ink-2' : 'text-ink'}`}>{Math.round(n)}{suffix && <span className="ml-1 text-xs font-medium text-ink-3">{suffix}</span>}</div>
      <div className="text-[10px] leading-snug text-ink-3">{hint}</div>
    </div>
  );
};

/** 24h New York strip with each session as a segment and a "now" marker. */
const SessionTimeline: React.FC<{ sessions: Array<{ id: string; name: string; nyStart: string; nyEnd: string }>; nowMinutes: number; activeId?: string }> = ({ sessions, nowMinutes, activeId }) => {
  const toMin = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
  const pct = (m: number) => `${(m / 1440) * 100}%`;
  return (
    <div>
      <div className="relative h-9 rounded-xl bg-well ring-1 ring-inset ring-line">
        {sessions.map((s) => {
          const a = toMin(s.nyStart);
          let b = toMin(s.nyEnd);
          if (b <= a) b = 1440;
          const live = s.id === activeId;
          return (
            <div key={s.id} className={`absolute inset-y-1 rounded-lg px-2 flex items-center overflow-hidden text-[10px] font-semibold whitespace-nowrap ${live ? 'bg-gradient-to-r from-teal-300/90 to-cyan-500/90 text-[#032420] shadow-[0_0_16px_rgba(45,212,191,.4)]' : 'bg-white/[.06] text-ink-2 ring-1 ring-inset ring-line'}`}
              style={{ left: pct(a), width: pct(b - a) }} title={`${s.name} · ${s.nyStart}–${s.nyEnd} NY`}>
              {s.name}
            </div>
          );
        })}
        <div className="absolute -inset-y-1 w-0.5 rounded-full bg-ink shadow-[0_0_8px_rgba(255,255,255,.6)]" style={{ left: pct(nowMinutes) }} aria-label="Now" />
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] tabular-nums text-ink-3"><span>00:00</span><span>06:00</span><span>12:00</span><span>18:00</span><span>24:00 NY</span></div>
    </div>
  );
};
