import { describe, expect, it } from 'vitest';
import type { AssetDeskData, DailyDebrief, Trade } from '../types';
import { computeDailyEvidence } from './debrief';
import { addDays, computeWeeklyEvidence, findPreviousWeeklyReview, matchDesk, weekDates, weekStartOf } from './weekly';

const hq = { riskRules: { riskPerSetupPct: 1, maxDailyLosses: 2, noReEntry: true, noAdding: true, scratchCountsAsLoss: true } };
const ps = (score: number) => ({ session: score > 0, grade: score > 1, risk: score > 2, management: score > 3, structure: score > 4, score });
let n = 0;
function trade(o: Partial<Trade>): Trade {
  return {
    id: `t${n++}`, date: '2026-11-02', timestamp: 1, asset: 'BTC', direction: 'SHORT', timeframe: '15M', session: 'New York',
    modelId: 'm', setupGrade: 'A+', narrative: '', setupReasoning: '', entryPrice: 100, stopPrice: 110, targetPrice: 50,
    plannedR: 5, status: 'CLOSED', realizedR: 1, processScore: ps(5), violations: [], mistakeCodes: [], screenshots: {},
    notesDuring: '', reflectionAfter: '', configVersionUsed: 'v1', ...o,
  };
}
function debrief(date: string, executed: DailyDebrief['previousUpgradeExecuted']): DailyDebrief {
  return { date, presenceQuality: '', previousUpgradeExecuted: executed, upgradeForTomorrow: 'u', tomorrowAssignment: '', evidence: computeDailyEvidence([], date, hq), createdAt: '', updatedAt: '' };
}

describe('week dates', () => {
  it('starts weeks on Monday', () => {
    expect(weekStartOf('2026-11-02')).toBe('2026-11-02'); // Monday
    expect(weekStartOf('2026-11-07')).toBe('2026-11-02'); // Saturday
    expect(weekStartOf('2026-11-08')).toBe('2026-11-02'); // Sunday
    expect(weekStartOf('2026-11-09')).toBe('2026-11-09');
    expect(weekDates('2026-11-02')).toHaveLength(7);
    expect(addDays('2026-10-30', 3)).toBe('2026-11-02');
  });
});

describe('computeWeeklyEvidence', () => {
  it('aggregates the week, ignoring voided trades and other weeks', () => {
    const trades = [
      trade({ date: '2026-11-02', realizedR: 3, processScore: ps(5) }),
      trade({ date: '2026-11-03', realizedR: -1, setupGrade: 'B+', processScore: ps(3), mistakeCodes: ['BE_EARLY', 'OUT_WINDOW'] }),
      trade({ date: '2026-11-03', realizedR: -1, setupGrade: 'B+', processScore: ps(4), mistakeCodes: ['BE_EARLY'] }),
      trade({ date: '2026-11-04', realizedR: -1, voided: { at: 1, reason: 'dup' } }),
      trade({ date: '2026-10-30', realizedR: -1 }),
    ];
    const debriefs = [debrief('2026-11-02', 'NA'), debrief('2026-11-03', 'YES'), debrief('2026-10-30', 'NO')];
    const e = computeWeeklyEvidence(trades, debriefs, '2026-11-02', hq);
    expect(e.tradesTaken).toBe(3);
    expect(e.processAvg).toBe(4);
    expect(e.gradeCounts).toEqual({ 'A+': 1, 'B+': 2 });
    expect(e.mostCommonMistake).toBe('BE_EARLY');
    expect(e.totalR).toBe(1);
    expect(e.haltDays).toBe(1); // two losses on Tuesday
    expect(e.tradingDays).toBe(2);
    expect(e.debriefsWritten).toBe(2);
    expect(e.tradingDaysWithoutDebrief).toEqual([]);
    expect(e.upgradesYes).toBe(1);
    expect(e.upgradesNo).toBe(0);
    expect(e.processByDay[1]).toMatchObject({ date: '2026-11-03', trades: 2, processAvg: 3.5 });
  });

  it('lists trading days without a debrief', () => {
    const e = computeWeeklyEvidence([trade({ date: '2026-11-05' })], [], '2026-11-02', hq);
    expect(e.tradingDaysWithoutDebrief).toEqual(['2026-11-05']);
  });
});

describe('matchDesk', () => {
  const desk = (symbol: string, name: string) => ({ symbol, name } as AssetDeskData);
  const desks = [desk('XAUUSD', 'Gold'), desk('NQ', 'Nasdaq 100'), desk('BTC', 'Bitcoin'), desk('EURUSD', 'Euro')];
  it('matches by symbol, name, or alias', () => {
    expect(matchDesk(desks, 'Gold')?.symbol).toBe('XAUUSD');
    expect(matchDesk(desks, 'NAS')?.symbol).toBe('NQ');
    expect(matchDesk(desks, 'btc')?.symbol).toBe('BTC');
    expect(matchDesk(desks, 'EU')?.symbol).toBe('EURUSD');
    expect(matchDesk(desks, 'JP225')).toBeUndefined();
  });
});

describe('findPreviousWeeklyReview', () => {
  it('returns the latest earlier review', () => {
    const r = (weekStart: string) => ({ weekStart } as any);
    expect(findPreviousWeeklyReview([r('2026-10-19'), r('2026-10-26'), r('2026-11-02')], '2026-11-02')?.weekStart).toBe('2026-10-26');
  });
});
