import { describe, expect, it } from 'vitest';
import { actualPnl, defaultAccountIds, summarizeAccount, tradeAccountIds, tradePnl, unassignedTrades } from './accounts';
import type { Trade, TradingAccount } from '../types';

const acc = (id: string, over: Partial<TradingAccount> = {}): TradingAccount => ({
  id, name: id, kind: 'PERSONAL', broker: '', currency: 'USD', startingBalance: 10_000, adjustments: [], notes: '', createdAt: '2026-11-01T00:00:00Z', ...over,
});

let n = 0;
const trade = (over: Partial<Trade>): Trade => ({
  id: `t${++n}`, date: '2026-11-10', timestamp: Date.parse('2026-11-10T10:00:00Z') + n, asset: 'BTC', direction: 'LONG', timeframe: '15M', session: 'New York',
  modelId: 'm', setupGrade: 'A+', narrative: '', setupReasoning: '', entryPrice: 100, stopPrice: 90, targetPrice: 150, plannedR: 5,
  status: 'CLOSED', processScore: { session: true, grade: true, risk: true, management: true, structure: true, score: 5 } as Trade['processScore'],
  violations: [], mistakeCodes: [], screenshots: {}, notesDuring: '', reflectionAfter: '', configVersionUsed: 'v1', ...over,
});

describe('tradePnl', () => {
  it('uses the actual amount when entered', () => {
    expect(tradePnl(trade({ accountIds: ['a', 'b'], pnlByAccount: { a: 312.5 }, realizedR: 3 }), 'a', 10_000, 1)).toEqual({ amount: 312.5, estimated: false, fallbackRisk: false });
    // b has no actual amount: estimated on b's own balance
    expect(tradePnl(trade({ accountIds: ['a', 'b'], pnlByAccount: { a: 312.5 }, realizedR: 3, riskPercentAtEntry: 1 }), 'b', 500, 1).amount).toBe(15);
  });
  it('estimates from risk % and R otherwise', () => {
    expect(tradePnl(trade({ realizedR: 3, riskPercentAtEntry: 1 }), 'a', 10_000, 2).amount).toBe(300);
    const r = tradePnl(trade({ realizedR: -1 }), 'a', 10_000, 2);
    expect(r).toEqual({ amount: -200, estimated: true, fallbackRisk: true });
  });
});

describe('summarizeAccount', () => {
  it('adds wins and takes away losses, only for its own trades', () => {
    const a = acc('a');
    const trades = [
      trade({ accountId: 'a', realizedR: 3, outcome: 'WIN', riskPercentAtEntry: 1, closedAt: Date.parse('2026-11-10T12:00:00Z') }),
      trade({ accountId: 'a', realizedR: -1, outcome: 'LOSS', pnlAmount: -95, closedAt: Date.parse('2026-11-11T12:00:00Z') }),
      trade({ accountId: 'b', realizedR: 5, outcome: 'WIN', riskPercentAtEntry: 1 }),
      trade({ accountId: 'a', realizedR: 5, outcome: 'WIN', riskPercentAtEntry: 1, voided: { at: 1, reason: 'dup' } }),
      trade({ accountId: 'a', status: 'OPEN' }),
    ];
    const s = summarizeAccount(a, trades, 1);
    expect(s.balance).toBe(10_205);
    expect(s.tradePnl).toBe(205);
    expect(s.closedTrades).toBe(2);
    expect(s.openTrades).toBe(1);
    expect(s.wins).toBe(1);
    expect(s.losses).toBe(1);
    expect(s.totalR).toBe(2);
    expect(s.estimatedTrades).toBe(1);
    expect(s.returnPct).toBe(2.05);
    expect(s.maxDrawdown).toBe(95);
  });
  it('compounds estimates on the balance at the time, including deposits', () => {
    const a = acc('a', { adjustments: [{ id: 'd', date: '2026-11-10', amount: 10_000, note: 'Top-up' }] });
    const s = summarizeAccount(a, [trade({ accountId: 'a', realizedR: 1, riskPercentAtEntry: 1, closedAt: Date.parse('2026-11-10T15:00:00Z') })], 1);
    expect(s.balance).toBe(20_200);
    expect(s.adjustmentsTotal).toBe(10_000);
    expect(s.tradePnl).toBe(200);
  });
  it('a withdrawal before a trade shrinks the next estimate', () => {
    const a = acc('a', { adjustments: [{ id: 'w', date: '2026-11-12', amount: -5_000, note: 'Payout' }] });
    const s = summarizeAccount(a, [
      trade({ accountId: 'a', realizedR: 1, riskPercentAtEntry: 1, closedAt: Date.parse('2026-11-13T15:00:00Z') }),
    ], 1);
    expect(s.balance).toBe(5_050);
  });
});

describe('one trade on several accounts', () => {
  it('moves every ticked account by its own result, and counts the trade once on each', () => {
    const t = trade({ accountIds: ['a', 'b'], realizedR: 2, outcome: 'WIN', riskPercentAtEntry: 1, pnlByAccount: { b: 9.5 } });
    const a = summarizeAccount(acc('a'), [t], 1);
    const b = summarizeAccount(acc('b', { startingBalance: 500 }), [t], 1);
    expect(a.balance).toBe(10_200);
    expect(b.balance).toBe(509.5);
    expect(a.closedTrades).toBe(1);
    expect(b.estimatedTrades).toBe(0);
  });
  it('still reads the older single-account fields', () => {
    const t = trade({ accountId: 'a', pnlAmount: -50, realizedR: -1 });
    expect(tradeAccountIds(t)).toEqual(['a']);
    expect(actualPnl(t, 'a')).toBe(-50);
    expect(actualPnl(t, 'b')).toBeUndefined();
    expect(tradeAccountIds(trade({ accountIds: [], accountId: 'a' }))).toEqual([]);
  });
});

describe('helpers', () => {
  it('finds trades on no account or a missing one', () => {
    const list = [trade({}), trade({ accountIds: ['a'] }), trade({ accountIds: ['gone'] }), trade({ accountIds: ['gone', 'a'] }), trade({ voided: { at: 1, reason: 'x' } })];
    expect(unassignedTrades(list, [acc('a')]).map((t) => tradeAccountIds(t))).toEqual([[], ['gone']]);
  });
  it('preselects the accounts used last that are still active, else the only one', () => {
    const t1 = trade({ accountIds: ['a', 'b'], timestamp: 2 });
    expect(defaultAccountIds([acc('a'), acc('b')], [trade({ accountIds: ['a'], timestamp: 1 }), t1])).toEqual(['a', 'b']);
    expect(defaultAccountIds([acc('a'), acc('b', { archivedAt: 'x' })], [t1])).toEqual(['a']);
    expect(defaultAccountIds([acc('a'), acc('b')], [])).toEqual([]);
    expect(defaultAccountIds([acc('a')], [])).toEqual(['a']);
  });
});
