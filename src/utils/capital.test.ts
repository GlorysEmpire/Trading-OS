import { describe, expect, it } from 'vitest';
import type { Trade } from '../types';
import { calculateCapital } from './capital';

const trade = (id: string, realizedR: number, riskPercentAtEntry?: number, overrides: Partial<Trade> = {}) => ({
  id, status: 'CLOSED', realizedR, timestamp: Number(id.slice(1)), riskPercentAtEntry, ...overrides,
}) as Trade;

describe('calculateCapital', () => {
  const settings = { startingCapital: 1000, currency: 'USD' };

  it('compounds closed results using the risk recorded at trade entry', () => {
    const result = calculateCapital(settings, [trade('t2', -1, 2), trade('t1', 2, 1)], 9);
    expect(result.currentBalance).toBe(999.6); // 1000 + 2% gain, then 2% loss
    expect(result.netProfit).toBe(-0.4);
    expect(result.estimatedTrades).toBe(0);
  });

  it('ignores open and voided trades and estimates older trades', () => {
    const result = calculateCapital(settings, [
      trade('t1', 3),
      trade('t2', -1, 1, { voided: { at: 3, reason: 'duplicate' } }),
      trade('t3', 5, 1, { status: 'OPEN' }),
    ], 1);
    expect(result.currentBalance).toBe(1030);
    expect(result.closedTrades).toBe(1);
    expect(result.estimatedTrades).toBe(1);
  });
});
