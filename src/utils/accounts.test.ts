import { describe, expect, it } from 'vitest';
import { defaultAccountId, summarizeAccount, tradePnl, unassignedTrades } from './accounts';
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
    expect(tradePnl(trade({ pnlAmount: 312.5, realizedR: 3 }), 10_000, 1)).toEqual({ amount: 312.5, estimated: false, fallbackRisk: false });
  });
  it('estimates from risk % and R otherwise', () => {
    expect(tradePnl(trade({ realizedR: 3, riskPercentAtEntry: 1 }), 10_000, 2).amount).toBe(300);
    const r = tradePnl(trade({ realizedR: -1 }), 10_000, 2);
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

describe('helpers', () => {
  it('finds trades on no account or a missing one', () => {
    const list = [trade({}), trade({ accountId: 'a' }), trade({ accountId: 'gone' }), trade({ voided: { at: 1, reason: 'x' } })];
    expect(unassignedTrades(list, [acc('a')]).map((t) => t.accountId)).toEqual([undefined, 'gone']);
  });
  it('preselects the last used active account, else the only one', () => {
    const t1 = trade({ accountId: 'b', timestamp: 2 });
    expect(defaultAccountId([acc('a'), acc('b')], [trade({ accountId: 'a', timestamp: 1 }), t1])).toBe('b');
    expect(defaultAccountId([acc('a'), acc('b', { archivedAt: 'x' })], [t1])).toBe('a');
    expect(defaultAccountId([acc('a'), acc('b')], [])).toBe('');
  });
});
