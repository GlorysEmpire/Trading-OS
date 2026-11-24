import React, { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { useTrading } from '../../context/TradingContext';
import { useDecompositionData } from '../../context/DecompositionDataContext';
import {
  PLACEHOLDER_CORRELATION_GROUPS, PLACEHOLDER_EVENT_BUFFER_MINUTES, correlated, dueNow, highImpactAhead, readiness,
  type DueItem, type ReadinessVerdict,
} from '../../decomposition';
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
      upcomingHighImpact: ahead, eventBufferMinutes: PLACEHOLDER_EVENT_BUFFER_MINUTES,
      openExposure: open, correlationGroups: PLACEHOLDER_CORRELATION_GROUPS,
    };
    const base = readiness(input);
    const clashes = focus.filter((d) => open.some((o) => correlated(o.asset, d.symbol, PLACEHOLDER_CORRELATION_GROUPS)));
    const next = ahead.find((e) => e.minutesAway > PLACEHOLDER_EVENT_BUFFER_MINUTES);
    return { base, clashes, next, open: open.length };
  }, [tradingHQ, trades, calendarEvents, performanceStats.lossCountToday, assets]); // eslint-disable-line react-hooks/exhaustive-deps

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
      <p className="text-[11px] text-ink-3">News buffer {PLACEHOLDER_EVENT_BUFFER_MINUTES} min and correlation groups are placeholders until set in Trading HQ.</p>
    </div>
  );
};

/** Only what's due: reviews, the map, then the plans for today's focus (UX rule 1). */
export const DueNowCard: React.FC = () => {
  const { assets, tradingHQ, setActiveTab } = useTrading();
  const { structural, plans, loading, profileFor, requestDecompose } = useDecompositionData();
  const now = new Date().toISOString();
  const due = useMemo(() => {
    const focus = (tradingHQ.focusRotation.find((d) => d.day === weekdayInZone(new Date()))?.assets ?? [])
      .map((a) => matchDesk(assets, a)).filter((d): d is AssetDeskData => !!d);
    return dueNow({ now, focusDesks: focus.map((d) => ({ id: d.id, symbol: d.symbol })), structural, plans,
      profileFor: (id) => profileFor(id, assets.find((a) => a.id === id)?.category) });
  }, [assets, tradingHQ.focusRotation, structural, plans, profileFor]); // eslint-disable-line react-hooks/exhaustive-deps

  const open = (it: DueItem) => { if (it.kind !== 'REVIEW') requestDecompose(it.deskId); setActiveTab('decomposition'); };
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
