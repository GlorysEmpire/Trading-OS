import { describe, it, expect } from 'vitest';
import {
  calculatePlannedR,
  calculateRealizedR,
  computePerformanceStats,
  determineProcessCategory,
} from './tradingCalculations';
import type { ProcessScore, RiskRules, Trade, TradingHQConfig } from '../types';

const BASE_RISK_RULES: RiskRules = {
  riskPerSetupPct: 1.0,
  maxDailyLosses: 2,
  noReEntry: true,
  noAdding: true,
  scratchCountsAsLoss: true,
};

function makeConfig(overrides: Partial<RiskRules> = {}): TradingHQConfig {
  return {
    version: 'v1',
    updatedAt: '2026-01-01T00:00:00Z',
    riskRules: { ...BASE_RISK_RULES, ...overrides },
    setupGrades: [],
    executionModels: [],
    sessions: [],
    processChecks: ['Session', 'Grade', 'Risk', 'Management', 'Structure'],
    mistakeCodes: [],
    notes: '',
  };
}

function makeProcessScore(score: number): ProcessScore {
  return { session: true, grade: true, risk: true, management: true, structure: true, score };
}

let tradeCounter = 0;
function makeTrade(overrides: Partial<Trade> & { date: string; realizedR?: number; timestamp?: number }): Trade {
  tradeCounter += 1;
  return {
    id: `t-${tradeCounter}`,
    date: overrides.date,
    timestamp: overrides.timestamp ?? tradeCounter,
    asset: 'ETH',
    direction: 'LONG',
    timeframe: '15M',
    session: 'New York',
    modelId: 'model-wyckoff-ict',
    setupGrade: 'B+',
    narrative: 'test',
    setupReasoning: 'test',
    entryPrice: 100,
    stopPrice: 95,
    targetPrice: 115,
    exitPrice: 100 + (overrides.realizedR ?? 0) * 5,
    plannedR: 3,
    realizedR: overrides.realizedR ?? 0,
    status: 'CLOSED',
    outcome: (overrides.realizedR ?? 0) > 0 ? 'WIN' : (overrides.realizedR ?? 0) < 0 ? 'LOSS' : 'SCRATCH',
    processScore: makeProcessScore(5),
    violations: [],
    mistakeCodes: [],
    screenshots: {},
    notesDuring: '',
    reflectionAfter: '',
    configVersionUsed: 'v1',
    ...overrides,
  };
}

describe('calculatePlannedR / calculateRealizedR', () => {
  it('computes planned R for a LONG setup', () => {
    expect(calculatePlannedR('LONG', 100, 95, 115)).toBe(3);
  });

  it('computes planned R for a SHORT setup', () => {
    expect(calculatePlannedR('SHORT', 100, 105, 85)).toBe(3);
  });

  it('returns 0 when risk distance is non-positive (invalid stop placement)', () => {
    expect(calculatePlannedR('LONG', 100, 100, 115)).toBe(0);
    expect(calculatePlannedR('LONG', 100, 105, 115)).toBe(0);
  });

  it('computes realized R for a closed LONG trade', () => {
    expect(calculateRealizedR('LONG', 100, 95, 110)).toBe(2);
  });

  it('computes realized R for a closed SHORT trade', () => {
    expect(calculateRealizedR('SHORT', 100, 105, 90)).toBe(2);
  });
});

describe('determineProcessCategory', () => {
  it('categorizes good process + win', () => {
    expect(determineProcessCategory(makeProcessScore(5), 'WIN')).toBe('GOOD_PROCESS_WIN');
  });
  it('categorizes good process + loss', () => {
    expect(determineProcessCategory(makeProcessScore(5), 'LOSS')).toBe('GOOD_PROCESS_LOSS');
  });
  it('categorizes bad process + win', () => {
    expect(determineProcessCategory(makeProcessScore(2), 'WIN')).toBe('BAD_PROCESS_WIN');
  });
  it('categorizes bad process + loss', () => {
    expect(determineProcessCategory(makeProcessScore(2), 'LOSS')).toBe('BAD_PROCESS_LOSS');
  });
  it('treats a scratch outcome as not a win (good process + scratch -> GOOD_PROCESS_LOSS)', () => {
    expect(determineProcessCategory(makeProcessScore(5), 'SCRATCH')).toBe('GOOD_PROCESS_LOSS');
  });
});

describe('computePerformanceStats', () => {
  it('returns all-zero stats for an empty trade list', () => {
    const stats = computePerformanceStats([], makeConfig());
    expect(stats.totalTrades).toBe(0);
    expect(stats.totalR).toBe(0);
    expect(stats.maxDrawdownR).toBe(0);
    expect(stats.riskStatus).toBe('NORMAL');
  });

  it('ignores OPEN trades when computing closed-trade stats', () => {
    const trades: Trade[] = [
      makeTrade({ date: '2026-10-20', realizedR: 2 }),
      makeTrade({ date: '2026-10-21', realizedR: -1, status: 'OPEN' }),
    ];
    const stats = computePerformanceStats(trades, makeConfig());
    expect(stats.totalTrades).toBe(1);
    expect(stats.totalR).toBe(2);
  });

  it('computes max drawdown from the equity curve ordered by trade date, not by logging timestamp', () => {
    // Deliberately logged (timestamp) in the opposite order from when the
    // trades actually happened (date): the Oct 22 win was entered into the
    // system first, then the Oct 20/21 losses were backfilled afterwards.
    // The true chronological equity curve is -2 (Oct 20) -> -5 (Oct 21,
    // trough) -> -1 (Oct 22), for a max drawdown of 3R from the 0 peak
    // (peak never exceeds 0 since the first trade is a loss).
    const trades: Trade[] = [
      makeTrade({ date: '2026-10-22', realizedR: 4, timestamp: 1 }),
      makeTrade({ date: '2026-10-21', realizedR: -3, timestamp: 2 }),
      makeTrade({ date: '2026-10-20', realizedR: -2, timestamp: 3 }),
    ];
    const stats = computePerformanceStats(trades, makeConfig());
    // Chronological by date: -2, -3, +4 -> running: -2, -5, -1. Peak stays 0
    // (running never exceeds it), trough is -5, so drawdown is 5R.
    expect(stats.maxDrawdownR).toBe(5);
    // Sanity: if this were sorted by timestamp instead (4, -3, -2), the
    // running total would be 4, 1, -1 and drawdown would wrongly read as
    // only 5 from a peak of 4 -- a different, wrong curve shape entirely.
  });

  it('a scratch (realizedR 0) continues the loss streak when scratchCountsAsLoss is true', () => {
    const trades: Trade[] = [
      makeTrade({ date: '2026-10-19', realizedR: -1 }),
      makeTrade({ date: '2026-10-20', realizedR: 0 }), // scratch
      makeTrade({ date: '2026-10-21', realizedR: -1 }),
    ];
    const stats = computePerformanceStats(trades, makeConfig({ scratchCountsAsLoss: true }));
    expect(stats.consecutiveLosses).toBe(3);
  });

  it('a scratch (realizedR 0) breaks the loss streak when scratchCountsAsLoss is false', () => {
    const trades: Trade[] = [
      makeTrade({ date: '2026-10-19', realizedR: -1 }),
      makeTrade({ date: '2026-10-20', realizedR: 0 }), // scratch
      makeTrade({ date: '2026-10-21', realizedR: -1 }),
    ];
    const stats = computePerformanceStats(trades, makeConfig({ scratchCountsAsLoss: false }));
    // The streak resets at the scratch, then builds back up to 1 on the
    // next real loss.
    expect(stats.consecutiveLosses).toBe(1);
  });

  it('a win always resets the loss streak to 0', () => {
    const trades: Trade[] = [
      makeTrade({ date: '2026-10-19', realizedR: -1 }),
      makeTrade({ date: '2026-10-20', realizedR: -1 }),
      makeTrade({ date: '2026-10-21', realizedR: 2 }),
    ];
    const stats = computePerformanceStats(trades, makeConfig());
    expect(stats.consecutiveLosses).toBe(0);
  });
});
