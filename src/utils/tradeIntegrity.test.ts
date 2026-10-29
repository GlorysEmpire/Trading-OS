import { describe, expect, it } from 'vitest';
import type { Trade } from '../types';
import { applyAmendment, assertFreeUpdate, buildClosedTrade, diffEvidence, isCountedTrade, isTradeLocked } from './tradeIntegrity';
import { computePerformanceStats } from './tradingCalculations';

const checks = { session: true, grade: true, risk: true, management: true, structure: false, score: 4 };

function openTrade(overrides: Partial<Trade> = {}): Trade {
  return {
    id: 'tr-1', date: '2026-10-29', timestamp: 1, asset: 'XAUUSD', direction: 'LONG', timeframe: '15m',
    session: 'New York', modelId: 'm1', setupGrade: 'A+', narrative: 'n', setupReasoning: 'r',
    entryPrice: 100, stopPrice: 90, targetPrice: 150, plannedR: 5, status: 'OPEN', processScore: checks,
    violations: [], mistakeCodes: [], screenshots: {}, notesDuring: '', reflectionAfter: '', configVersionUsed: 'v3',
    ...overrides,
  };
}

describe('buildClosedTrade', () => {
  it('computes R, outcome and category, and locks the trade', () => {
    const closed = buildClosedTrade(openTrade(), { exitPrice: 130, processScore: checks, mistakeCodes: ['BE_EARLY'] }, 42);
    expect(closed.realizedR).toBe(3);
    expect(closed.outcome).toBe('WIN');
    expect(closed.processCategory).toBe('GOOD_PROCESS_WIN');
    expect(closed.status).toBe('CLOSED');
    expect(closed.closedAt).toBe(42);
    expect(isTradeLocked(closed)).toBe(true);
  });

  it('refuses to re-close a closed trade', () => {
    const closed = buildClosedTrade(openTrade(), { exitPrice: 90, processScore: checks, mistakeCodes: [] });
    expect(() => buildClosedTrade(closed, { exitPrice: 150, processScore: checks, mistakeCodes: [] })).toThrow();
  });

  it('honours an explicit outcome override', () => {
    const closed = buildClosedTrade(openTrade(), { exitPrice: 100.5, outcome: 'SCRATCH', processScore: checks, mistakeCodes: [] });
    expect(closed.outcome).toBe('SCRATCH');
  });
});

describe('applyAmendment + diffEvidence', () => {
  it('recomputes R and outcome when the exit price is corrected', () => {
    const closed = buildClosedTrade(openTrade(), { exitPrice: 130, processScore: checks, mistakeCodes: [] });
    const amended = applyAmendment(closed, { exitPrice: 85 });
    expect(amended.realizedR).toBe(-1.5);
    expect(amended.outcome).toBe('LOSS');
    expect(amended.processCategory).toBe('GOOD_PROCESS_LOSS');
    const fields = diffEvidence(closed, amended).map((c) => c.field);
    expect(fields).toEqual(expect.arrayContaining(['exitPrice', 'realizedR', 'outcome', 'processCategory']));
    expect(fields).not.toContain('narrative');
  });

  it('recomputes the process score from the checks', () => {
    const closed = buildClosedTrade(openTrade(), { exitPrice: 130, processScore: checks, mistakeCodes: [] });
    const amended = applyAmendment(closed, { processScore: { ...checks, grade: false, management: false, score: 99 } });
    expect(amended.processScore.score).toBe(2);
    expect(amended.processCategory).toBe('BAD_PROCESS_WIN');
  });
});

describe('locking', () => {
  it('allows documentation on a closed trade but blocks evidence edits', () => {
    const closed = buildClosedTrade(openTrade(), { exitPrice: 130, processScore: checks, mistakeCodes: [] });
    expect(() => assertFreeUpdate(closed, { reflectionAfter: 'held well' })).not.toThrow();
    expect(() => assertFreeUpdate(closed, { exitPrice: 150 })).toThrow(/locked/);
    expect(() => assertFreeUpdate(openTrade(), { exitPrice: 150 })).not.toThrow();
  });

  it('keeps voided trades out of performance stats', () => {
    const hq = { riskRules: { riskPerSetupPct: 1, maxDailyLosses: 2, noReEntry: true, noAdding: true, scratchCountsAsLoss: true } } as any;
    const a = buildClosedTrade(openTrade({ id: 'a' }), { exitPrice: 130, processScore: checks, mistakeCodes: [] });
    const dup = { ...buildClosedTrade(openTrade({ id: 'b' }), { exitPrice: 130, processScore: checks, mistakeCodes: [] }), voided: { at: 1, reason: 'duplicate' } };
    expect(isCountedTrade(dup)).toBe(false);
    expect(computePerformanceStats([a, dup], hq).totalTrades).toBe(1);
  });
});
