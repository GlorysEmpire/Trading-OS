import { describe, expect, it } from 'vitest';
import type { PendingSetup, TradingHQConfig } from '../types';
import { isPastValidity, setupStats, setupToTrade } from './pendingSetups';
import { buildClosedTrade } from './tradeIntegrity';

const hq = {
  version: 'v7',
  riskRules: { riskPerSetupPct: 1, maxDailyLosses: 2, noReEntry: true, noAdding: true, scratchCountsAsLoss: true },
  sessions: [
    { id: 'l', name: 'London', nyStart: '00:00', nyEnd: '05:00', activeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
    { id: 'ny', name: 'New York', nyStart: '07:00', nyEnd: '12:00', activeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] },
  ],
} as unknown as TradingHQConfig;

const setup = (o: Partial<PendingSetup> = {}): PendingSetup => ({
  id: 'ps1', deskId: 'd1', asset: 'BTC', direction: 'SHORT', timeframe: '15M', modelId: 'model-wyckoff-ict', setupGrade: 'A+',
  entryPrice: 81800, stopPrice: 82600, targetPrice: 76100, plannedR: 7.13, narrative: 'Daily bearish OB + FVG above 4H inducement',
  setupReasoning: 'Distribution mostly confirmed on 4H', screenshots: ['sb:trading-os-charts/u/a.webp', 'sb:trading-os-charts/u/b.webp'],
  status: 'PENDING', configVersionAtPlan: 'v7', createdAt: '', updatedAt: '', ...o,
});
const checks = { session: true, grade: true, risk: true, management: true, structure: true };

describe('setupToTrade', () => {
  it('carries every detail over and links back to the setup', () => {
    const t = setupToTrade(setup(), { entryAt: new Date('2026-11-02T13:30:00Z'), checks }, hq, 0); // 08:30 NY
    expect(t).toMatchObject({
      asset: 'BTC', direction: 'SHORT', setupGrade: 'A+', entryPrice: 81800, stopPrice: 82600, targetPrice: 76100,
      narrative: 'Daily bearish OB + FVG above 4H inducement', status: 'OPEN', session: 'New York', date: '2026-11-02', fromSetupId: 'ps1',
    });
    expect(t.plannedR).toBe(7.13);
    expect(t.screenshots.before).toBe('sb:trading-os-charts/u/a.webp');
    expect(t.screenshots.additional?.[0].url).toBe('sb:trading-os-charts/u/b.webp');
    expect(t.processScore.score).toBe(5);
  });

  it('uses the actual fill for R and notes the slippage', () => {
    const t = setupToTrade(setup(), { entryAt: new Date('2026-11-02T13:30:00Z'), fillPrice: 81700, checks }, hq, 0);
    expect(t.entryPrice).toBe(81700);
    expect(t.plannedR).toBe(6.22); // 5600 / 900
    expect(t.notesDuring).toMatch(/81700/);
  });

  it('applies the OUT_WINDOW rule to a sub-5M entry outside the windows', () => {
    const t = setupToTrade(setup({ timeframe: '1M' }), { entryAt: new Date('2026-11-02T11:00:00Z'), checks }, hq, 0); // 06:00 NY
    expect(t.mistakeCodes).toContain('OUT_WINDOW');
    expect(t.processScore.session).toBe(false);
    expect(t.processScore.score).toBe(4);
  });

  it('flags the daily halt but still records the trade', () => {
    const t = setupToTrade(setup(), { entryAt: new Date('2026-11-02T13:30:00Z'), checks }, hq, 2);
    expect(t.violations.some((v) => /daily loss/i.test(v))).toBe(true);
  });

  it('refuses a setup that is not pending', () => {
    expect(() => setupToTrade(setup({ status: 'TRIGGERED' }), { entryAt: new Date(), checks }, hq, 0)).toThrow();
  });

  it('a converted trade closes at TP with the expected R', () => {
    const t = setupToTrade(setup(), { entryAt: new Date('2026-11-02T13:30:00Z'), checks }, hq, 0);
    const closed = buildClosedTrade({ ...t, id: 'x', timestamp: 1, configVersionUsed: 'v7' }, { exitPrice: t.targetPrice, processScore: t.processScore, mistakeCodes: [] });
    expect(closed.realizedR).toBe(7.13);
    expect(closed.outcome).toBe('WIN');
  });
});

describe('helpers', () => {
  it('flags setups past their valid-until date', () => {
    expect(isPastValidity(setup({ validUntil: '2026-11-01' }), '2026-11-02')).toBe(true);
    expect(isPastValidity(setup({ validUntil: '2026-11-02' }), '2026-11-02')).toBe(false);
    expect(isPastValidity(setup({ validUntil: '2026-11-01', status: 'EXPIRED' }), '2026-11-02')).toBe(false);
  });

  it('counts outcomes and the trigger rate', () => {
    const list = [setup(), setup({ status: 'TRIGGERED' }), setup({ status: 'INVALIDATED' }), setup({ status: 'EXPIRED' })];
    expect(setupStats(list)).toEqual({ pending: 1, triggered: 1, invalidated: 1, expired: 1, triggerRate: 33 });
  });
});
