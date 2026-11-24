import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { useDecompositionData } from '../../context/DecompositionDataContext';
import { useDecompositionDefinitions } from '../../context/DecompositionDefinitionsContext';
import {
  correlated, deskStack, dueNow, highImpactAhead, latestLayer, readiness, readinessSettings, summarize,
  type DueItem, type ReadinessVerdict,
} from '../../decomposition';
import { useDecompositionDefinitions as useDefs } from '../../context/DecompositionDefinitionsContext';
import { LineSummary } from './DeskDecompositionStack';
import { VerdictPill } from './SummaryCard';
import { fromZoneInput } from '../../utils/timeDisplay';
import { deviceTimeZone, isSessionActiveAt, weekdayInZone } from '../../utils/traderTime';
import { matchDesk } from '../../utils/weekly';
import type { AssetDeskData } from '../../types';

const VERDICT: Record<ReadinessVerdict, { label: string; cls: string }> = {
  READY: { label: 'Ready', cls: 'bg-emerald-500/12 text-emerald-300 ring-emerald-400/30' },
  WAIT: { label: 'Wait', cls: 'bg-amber-500/12 text-amber-300 ring-amber-400/30' },
  CAUTION: { label: 'Caution', cls: 'bg-amber-500/12 text-amber-300 ring-amber-400/30' },
  BACKTEST_ONLY: { label: 'Backtest only', cls: 'bg-rose-500/12 text-rose-300 ring-rose-400/30' },
};

/** Layer 0: "Can I trade now?" From your own rules, session windows, today's calendar and open trades. */
export const ReadinessCard: React.FC = () => {
  const { tradingHQ, trades, calendarEvents, performanceStats, assets } = useTrading();
  const { current } = useDecompositionDefinitions();
  const settings = readinessSettings(current);
  const now = new Date();
  const result = useMemo(() => {
    const todayFocus = tradingHQ.focusRotation.find((d) => d.day === weekdayInZone(now));
    const focus = (todayFocus?.assets ?? []).map((a) => matchDesk(assets, a)).filter((d): d is AssetDeskData => !!d);
    const events = calendarEvents.filter((e) => !e.completed).map((e) => ({
      title: e.title, impact: e.impact, at: fromZoneInput(`${e.date}T${e.time}`, e.timeZone ?? deviceTimeZone()) ?? undefined,
    }));
    const ahead = highImpactAhead(events, now);
    const open = trades.filter((t) => t.status === 'OPEN' && !t.voided).map((t) => ({ asset: t.asset, direction: t.direction }));
    const input = {
      lossesToday: performanceStats.lossCountToday, maxDailyLosses: tradingHQ.riskRules.maxDailyLosses,
      inSessionWindow: tradingHQ.sessions.some((s) => isSessionActiveAt(s, now)),
      upcomingHighImpact: ahead, eventBufferMinutes: settings.eventBufferMinutes,
      openExposure: open, correlationGroups: settings.correlationGroups,
    };
    const base = readiness(input);
    const clashes = focus.filter((d) => open.some((o) => correlated(o.asset, d.symbol, settings.correlationGroups)));
    const next = ahead.find((e) => e.minutesAway > settings.eventBufferMinutes);
    return { base, clashes, next, open: open.length };
  }, [tradingHQ, trades, calendarEvents, performanceStats.lossCountToday, assets, settings]); // eslint-disable-line react-hooks/exhaustive-deps

  let { verdict } = result.base;
  const reasons = [...result.base.reasons];
  if (result.clashes.length && verdict === 'READY') {
    verdict = 'CAUTION';
    reasons.length = 0;
  }
  if (result.clashes.length) reasons.push(`An open trade moves with today's focus: ${result.clashes.map((d) => d.symbol).join(', ')}. Another trade there would risk CORRELATED_OVEREXPOSURE.`);
  const v = VERDICT[verdict];
  return (
    <div className="space-y-3">
      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${v.cls}`}>{v.label}</span>
      <ul className="space-y-1.5 text-sm text-ink-2">{reasons.map((r) => <li key={r}>{r}</li>)}</ul>
      {result.next && verdict === 'READY' && <p className="text-xs text-ink-3">Next high-impact event: {result.next.title} in {result.next.minutesAway} min.</p>}
      <p className="text-[11px] text-ink-3">News buffer {settings.eventBufferMinutes} min · groups from Trading HQ → Decomposition{current.locked ? '' : ' (placeholders until you lock them)'}.</p>
    </div>
  );
};

/** Only what's due: reviews, the map, then the plans for today's focus (UX rule 1). */
export const DueNowCard: React.FC = () => {
  const { assets, tradingHQ, setActiveTab } = useTrading();
  const { structural, plans, loading, profileFor, requestDecompose, requestReview } = useDecompositionData();
  const now = new Date().toISOString();
  const due = useMemo(() => {
    const focus = (tradingHQ.focusRotation.find((d) => d.day === weekdayInZone(new Date()))?.assets ?? [])
      .map((a) => matchDesk(assets, a)).filter((d): d is AssetDeskData => !!d);
    return dueNow({ now, focusDesks: focus.map((d) => ({ id: d.id, symbol: d.symbol })), structural, plans,
      profileFor: (id) => profileFor(id, assets.find((a) => a.id === id)?.category) });
  }, [assets, tradingHQ.focusRotation, structural, plans, profileFor]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (it: DueItem) => {
    if (it.kind === 'REVIEW' && it.planId) requestReview(it.planId);
    else requestDecompose(it.deskId, it.cadence);
    setActiveTab('decomposition');
  };
  if (loading) return <p className="text-sm text-ink-3">Loading…</p>;
  if (!due.length) return <p className="text-sm text-ink-2">Nothing due right now.</p>;
  return (
    <ul className="space-y-2.5">
      {due.map((g) => (
        <li key={g.key} className="rounded-2xl bg-raised p-3 ring-1 ring-inset ring-line">
          <div className="text-sm font-semibold text-ink">{g.title}</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {g.items.map((it) => (
              <button key={`${it.deskId}-${it.planId ?? it.cadence ?? 'map'}`} onClick={() => open(it)} className="tos-cta inline-flex items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-semibold">
                {it.kind === 'REVIEW' ? 'Review' : it.kind === 'BUILD_STRUCTURE' ? 'Map' : 'Plan'} {it.symbol} <ChevronRight className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>
        </li>
      ))}
    </ul>
  );
};

/**
 * Starred analysis body: the decomposition (the map's one-line story, then the
 * month / week / today plans) instead of the desk narrative. Returns null when
 * the desk has no Daily map yet, the fallback (the desk narrative) is shown.
 * Rendered inside a button, so spans and paragraphs only.
 */
export const StarredDecomposition: React.FC<{ desk: AssetDeskData; fallback: React.ReactNode }> = ({ desk, fallback }) => {
  const { mapFor, plans, profileFor } = useDecompositionData();
  const { current, definitionsFor } = useDefs();
  const map = mapFor(desk.id);
  const has = !!map && !!latestLayer(map, 'DAILY');
  const summary = useMemo(() => (has ? summarize(map!, definitionsFor, current) : undefined), [has, map, definitionsFor, current]);
  const lines = useMemo(() => (has ? deskStack({ deskId: desk.id, symbol: desk.symbol, map, plans, now: new Date().toISOString(), profile: profileFor(desk.id, desk.category), definitionsFor, current }) : []),
    [has, desk.id, desk.symbol, desk.category, map, plans, profileFor, definitionsFor, current]);
  if (!has || !summary) return <>{fallback}</>;
  const plansOnly = lines.filter((l) => l.key !== 'STRUCTURE');
  return (
    <>
      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-2"><span className="line-clamp-3 min-w-0 flex-1">{summary.sentence}</span><span className="shrink-0"><VerdictPill verdict={summary.verdict} /></span></p>
      {plansOnly.map((l) => (
        <p key={l.planId ?? l.key} className="flex items-baseline gap-2 text-[11px]">
          <span className="w-12 shrink-0 font-semibold text-ink-2">{l.key === 'DAY' ? 'Today' : l.key === 'WEEK' ? 'Week' : 'Month'}</span>
          <span className="min-w-0 flex-1 text-ink-3">{l.missing ? l.missing : <LineSummary l={l} />}</span>
        </p>
      ))}
    </>
  );
};
