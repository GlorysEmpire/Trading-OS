/** M3 / UX rule 1: Today lists only what's due, driven by the focus rotation. Synthetic fixtures. */
import { describe, expect, it } from 'vitest';
import { FEED_PRESETS, candleFor, dueNow, startPeriodPlan, updateStructure, type PeriodPlan } from './index';
import { fixtureDailyBearish, fixtureDecomposition, fixtureWeeklyBearish } from './fixtures';

const CRYPTO = FEED_PRESETS[0];
const NOW = '2026-11-24T08:00:00Z'; // Tuesday
const map = (deskId: string) => updateStructure(fixtureDecomposition({ id: `rec-${deskId}`, deskId }), [
  { id: `${deskId}-w`, asOf: 'x', data: fixtureWeeklyBearish() }, { id: `${deskId}-d`, asOf: 'x', data: fixtureDailyBearish() },
], { createdAt: '2026-11-22T18:00:00Z', definitionsVersion: 'v' });
const plan = (deskId: string, symbol: string, cadence: 'MONTH' | 'WEEK' | 'DAY', at: string): PeriodPlan =>
  startPeriodPlan({ id: `${deskId}-${cadence}-${at}`, cadence, candle: candleFor(cadence, at, CRYPTO, symbol), createdAt: at, structural: map(deskId), gate: { answeredAt: at, structureChanged: false, reasons: [] }, definitionsVersion: 'v' });

const BTC = { id: 'btc', symbol: 'BTCUSD' };
const ETH = { id: 'eth', symbol: 'ETHUSD' };

describe('only what is due', () => {
  it('no map yet → only "build the structural map"', () => {
    const due = dueNow({ now: NOW, focusDesks: [BTC, ETH], structural: [], plans: [], profileFor: () => CRYPTO });
    expect(due.map((g) => g.title)).toEqual(['Build the structural map: BTC, ETH']);
  });
  it('lists the plans missing for the current candles, grouped', () => {
    const due = dueNow({ now: NOW, focusDesks: [BTC, ETH], structural: [map('btc'), map('eth')], plans: [plan('btc', 'BTCUSD', 'MONTH', NOW), plan('eth', 'ETHUSD', 'MONTH', NOW), plan('btc', 'BTCUSD', 'WEEK', NOW)], profileFor: () => CRYPTO });
    expect(due.map((g) => g.title)).toEqual(['Weekly plan due: ETH', 'Daily plan due: BTC, ETH']);
    expect(due[1].items[0].candle?.openTime).toBe('2026-11-24T00:00:00.000Z');
  });
  it('nothing due when every plan exists → empty list', () => {
    const plans = (['MONTH', 'WEEK', 'DAY'] as const).map((c) => plan('btc', 'BTCUSD', c, NOW));
    expect(dueNow({ now: NOW, focusDesks: [BTC], structural: [map('btc')], plans, profileFor: () => CRYPTO })).toEqual([]);
  });
  it("asks to review yesterday's daily plan (any asset, first), and names older ones by date", () => {
    const plans = [
      ...(['MONTH', 'WEEK', 'DAY'] as const).map((c) => plan('btc', 'BTCUSD', c, NOW)),
      plan('eth', 'ETHUSD', 'DAY', '2026-11-23T08:00:00Z'),
      plan('eth', 'ETHUSD', 'DAY', '2026-11-20T08:00:00Z'),
      { ...plan('btc', 'BTCUSD', 'DAY', '2026-11-23T08:00:00Z'), review: { savedAt: 'x', prediction: 'CORRECT' as const, process: 'CORRECT' as const, lesson: 'l' } },
    ];
    const due = dueNow({ now: NOW, focusDesks: [BTC], structural: [map('btc')], plans, profileFor: () => CRYPTO });
    expect(due.map((g) => g.title)).toEqual(["Review yesterday's daily plan: ETH", 'Review the daily plan for Fri, Nov 20: ETH']);
  });
  it('backtest plans never nag', () => {
    const bt = { ...plan('btc', 'BTCUSD', 'DAY', '2026-11-23T08:00:00Z'), mode: 'BACKTEST' as const };
    expect(dueNow({ now: NOW, focusDesks: [], structural: [], plans: [bt], profileFor: () => CRYPTO })).toEqual([]);
  });
});
