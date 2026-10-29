import { describe, expect, it } from 'vitest';
import type { DailyDebrief, Trade } from '../types';
import { computeDailyEvidence, evidenceChangedSince, findPreviousDebrief, tradingDatesWithoutDebrief } from './debrief';

const hq = { riskRules: { riskPerSetupPct: 1, maxDailyLosses: 2, noReEntry: true, noAdding: true, scratchCountsAsLoss: true } };
const ps = (score: number) => ({ session: score > 0, grade: score > 1, risk: score > 2, management: score > 3, structure: score > 4, score });

function trade(o: Partial<Trade>): Trade {
  return {
    id: Math.random().toString(36), date: '2026-10-29', timestamp: 1, asset: 'XAUUSD', direction: 'LONG', timeframe: '15m',
    session: 'NY', modelId: 'm', setupGrade: 'A+', narrative: '', setupReasoning: '', entryPrice: 100, stopPrice: 90,
    targetPrice: 150, plannedR: 5, status: 'CLOSED', processScore: ps(5), violations: [], mistakeCodes: [],
    screenshots: {}, notesDuring: '', reflectionAfter: '', configVersionUsed: 'v1', ...o,
  };
}

describe('computeDailyEvidence', () => {
  it('summarises only that day, ignoring voided trades', () => {
    const trades = [
      trade({ realizedR: 3, setupGrade: 'A+', processScore: ps(5) }),
      trade({ realizedR: -1, setupGrade: 'B+', processScore: ps(3), mistakeCodes: ['BE_EARLY'] }),
      trade({ realizedR: -1, voided: { at: 1, reason: 'dup' } }),
      trade({ date: '2026-10-28', realizedR: -1 }),
      trade({ status: 'OPEN', realizedR: undefined, setupGrade: 'B+', processScore: ps(4) }),
    ];
    const e = computeDailyEvidence(trades, '2026-10-29', hq);
    expect(e.tradesTaken).toBe(3);
    expect(e.closedTrades).toBe(2);
    expect(e.openTrades).toBe(1);
    expect(e.processAvg).toBe(4);
    expect(e.gradeCounts).toEqual({ 'A+': 1, 'B+': 2 });
    expect(e.totalR).toBe(2);
    expect(e.mistakeCodeCounts).toEqual({ BE_EARLY: 1 });
    expect(e.ruleBreakTrades).toBe(1);
    expect(e.voidedCount).toBe(1);
    expect(e.halted).toBe(false);
  });

  it('flags the daily halt, counting scratches when the rule says so', () => {
    const trades = [trade({ realizedR: -1 }), trade({ realizedR: 0 })];
    expect(computeDailyEvidence(trades, '2026-10-29', hq).halted).toBe(true);
    const lenient = { riskRules: { ...hq.riskRules, scratchCountsAsLoss: false } };
    expect(computeDailyEvidence(trades, '2026-10-29', lenient).halted).toBe(false);
  });

  it('handles a day with no trades', () => {
    const e = computeDailyEvidence([], '2026-10-29', hq);
    expect(e.tradesTaken).toBe(0);
    expect(e.processAvg).toBeNull();
  });
});

describe('debrief history helpers', () => {
  const d = (date: string): DailyDebrief => ({
    date, presenceQuality: '', previousUpgradeExecuted: null, upgradeForTomorrow: `up ${date}`, tomorrowAssignment: '',
    evidence: computeDailyEvidence([], date, hq), createdAt: '', updatedAt: '',
  });

  it('finds the latest earlier debrief, skipping gaps', () => {
    const list = [d('2026-10-23'), d('2026-10-27'), d('2026-10-29')];
    expect(findPreviousDebrief(list, '2026-10-29')?.date).toBe('2026-10-27');
    expect(findPreviousDebrief(list, '2026-10-23')).toBeUndefined();
  });

  it('lists trading days that have no debrief', () => {
    const trades = [trade({ date: '2026-10-27' }), trade({ date: '2026-10-28' }), trade({ date: '2026-10-28', voided: { at: 1, reason: 'x' } })];
    expect(tradingDatesWithoutDebrief(trades, [d('2026-10-27')], '2026-10-29')).toEqual(['2026-10-28']);
  });

  it('detects evidence that changed after the debrief', () => {
    const before = computeDailyEvidence([trade({ realizedR: 1 })], '2026-10-29', hq);
    const after = computeDailyEvidence([trade({ realizedR: -1 })], '2026-10-29', hq);
    expect(evidenceChangedSince(before, before)).toBe(false);
    expect(evidenceChangedSince(before, after)).toBe(true);
  });
});
