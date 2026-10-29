import type { DailyDebrief, DailyEvidence, Trade, TradingHQConfig } from '../types';

/**
 * Daily debrief evidence. Everything here is computed from the Journal so the
 * debrief starts from what actually happened, not from memory.
 */
export function computeDailyEvidence(trades: Trade[], date: string, hq: Pick<TradingHQConfig, 'riskRules'>): DailyEvidence {
  const dayAll = trades.filter((t) => t.date === date);
  const day = dayAll.filter((t) => !t.voided);
  const closed = day.filter((t) => t.status === 'CLOSED');
  const scratchIsLoss = !!hq.riskRules.scratchCountsAsLoss;

  const gradeCounts: Record<string, number> = {};
  const mistakeCodeCounts: Record<string, number> = {};
  let processSum = 0;
  for (const t of day) {
    gradeCounts[t.setupGrade] = (gradeCounts[t.setupGrade] || 0) + 1;
    processSum += t.processScore?.score ?? 0;
    for (const code of t.mistakeCodes ?? []) mistakeCodeCounts[code] = (mistakeCodeCounts[code] || 0) + 1;
  }

  let totalR = 0, wins = 0, losses = 0, scratches = 0;
  for (const t of closed) {
    const r = t.realizedR ?? 0;
    totalR += r;
    if (r > 0) wins++; else if (r < 0) losses++; else scratches++;
  }
  const lossCount = losses + (scratchIsLoss ? scratches : 0);
  const maxDailyLosses = hq.riskRules.maxDailyLosses;

  return {
    date,
    tradesTaken: day.length,
    closedTrades: closed.length,
    openTrades: day.filter((t) => t.status === 'OPEN').length,
    processAvg: day.length ? Number((processSum / day.length).toFixed(2)) : null,
    gradeCounts,
    totalR: Number(totalR.toFixed(2)),
    wins,
    losses,
    scratches,
    lossCount,
    maxDailyLosses,
    halted: lossCount >= maxDailyLosses,
    mistakeCodeCounts,
    ruleBreakTrades: day.filter((t) => (t.mistakeCodes ?? []).length > 0).length,
    violationTrades: day.filter((t) => (t.violations ?? []).length > 0).length,
    voidedCount: dayAll.length - day.length,
    tradeIds: day.map((t) => t.id),
  };
}

/** The most recent debrief before `date` — "yesterday" in trading terms, which
 * may be Friday when debriefing Monday, or further back after time off. */
export function findPreviousDebrief(debriefs: DailyDebrief[], date: string): DailyDebrief | undefined {
  return debriefs
    .filter((d) => d.date < date)
    .sort((a, b) => (a.date < b.date ? 1 : -1))[0];
}

/** True when the day's trades changed after the debrief was written (a trade
 * closed, amended, added or voided later). Shown, never silently merged. */
export function evidenceChangedSince(saved: DailyEvidence, live: DailyEvidence): boolean {
  return JSON.stringify(saved) !== JSON.stringify(live);
}

/** Dates (newest first) that had trades but no debrief, within the given list of dates. */
export function tradingDatesWithoutDebrief(trades: Trade[], debriefs: DailyDebrief[], beforeOrOn: string): string[] {
  const written = new Set(debriefs.map((d) => d.date));
  const tradeDates = new Set(trades.filter((t) => !t.voided && t.date <= beforeOrOn).map((t) => t.date));
  return [...tradeDates].filter((d) => !written.has(d)).sort((a, b) => (a < b ? 1 : -1));
}
