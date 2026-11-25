import { describe, expect, it } from 'vitest';
import {
  candleAnatomy, candleDraftKey, candleObservation, candleReadMatchesPeriod, composeCandleNarrative, priorCandles, savedCandleInput,
  type CandlestickRead,
} from './candlestick';
import { candleFor, currentOrUpcomingCandle, FEED_PRESETS } from './feeds';
import type { PeriodPlan } from './types';

const prices = { open: 100, high: 120, low: 80, close: 115 };
const btc = FEED_PRESETS[0];
const asOf = '2026-11-25T12:00:00Z';

describe('candlestick decomposition', () => {
  it('measures the requested anatomy, including retention on either side', () => {
    expect(candleAnatomy(prices)).toMatchObject({
      bodyPercent: 37.5, upperWick: 5, lowerWick: 20, lowerQuartile: 90, equilibrium: 100, upperQuartile: 110,
      closePercent: 87.5, retainedPercent: 75,
    });
    expect(candleAnatomy({ ...prices, close: 85 })?.retainedPercent).toBe(75);
    expect(candleAnatomy({ open: 100, high: 100, low: 100, close: 100 }))
      .toMatchObject({ closePercent: undefined, retainedPercent: undefined });
  });

  it('finds three completed periods for the upcoming FX candle without using its prices', () => {
    const profile = FEED_PRESETS[2];
    const weekend = '2026-11-28T12:00:00Z';
    const target = currentOrUpcomingCandle('DAY', weekend, profile, 'EURUSD');
    expect(target.openTime).toBe('2026-11-29T22:00:00.000Z');
    const previous = priorCandles('DAY', target, profile);
    expect(previous.map(({ closeTime }) => closeTime)).toEqual([
      '2026-11-27T22:00:00.000Z', '2026-11-26T22:00:00.000Z', '2026-11-25T22:00:00.000Z',
    ]);
    const read = { asOf: weekend, observations: previous.map((candle) => candleObservation(candle, { prices }, weekend)), answers: {}, narrative: 'Fixture.' };
    expect(candleReadMatchesPeriod(read, target)).toBe(true);
    expect(candleReadMatchesPeriod(read, { ...target, feed: 'OTHER' })).toBe(false);
    expect(candleReadMatchesPeriod({ ...read, asOf: previous[0].openTime }, target)).toBe(false);
    expect(candleReadMatchesPeriod({ ...read, asOf: target.closeTime! }, target)).toBe(false);
    expect(candleObservation(target, { prices }, weekend).evidence).toBeUndefined();
  });

  it('reuses recorded evidence only for the matching feed, symbol, and period', () => {
    const target = candleFor('DAY', asOf, btc, 'BTC');
    const [previous] = priorCandles('DAY', target, btc);
    const observation = candleObservation(previous, { prices }, asOf);
    const plans = [{ read: { completedCandle: observation.evidence } }] as PeriodPlan[];
    expect(savedCandleInput(previous, plans).prices).toEqual(prices);
    expect(savedCandleInput({ ...previous, feed: 'OTHER' }, plans).prices).toEqual({});
    expect(savedCandleInput(target, plans).prices).toEqual({});
    expect(candleDraftKey('user', 'desk', 'DAY', target, btc)).not.toBe(candleDraftKey('user', 'desk', 'DAY', target, { ...btc, zone: 'America/New_York' }));
  });

  it('builds a narrative from entered conclusions and omits missing observations', () => {
    const answers: CandlestickRead['answers'] = {
      anatomy: 'Held the upper half.', classification: 'Expansion', liquidity: 'Lower liquidity swept.',
      expectedDelivery: 'Expansion', direction: 'Bullish', sequence: 'Low first',
      high: 'Upper range', low: 'Prior close', primary: 'Nearby high', extended: 'External high',
      expectedClose: 'Upper quarter', alternative: 'Retracement first', invalidation: 'Close below the prior low',
    };
    expect(composeCandleNarrative(answers)).toBe([
      'Previous candle behaviour: Expansion. Held the upper half.', 'Current market conditions: Lower liquidity swept.',
      'Expected candle delivery: Expansion · Bullish. Low first', 'High formation: Upper range', 'Low formation: Prior close',
      'Primary objective: Nearby high', 'Extended objective: External high', 'Expected closing location: Upper quarter',
      'Alternative scenario: Retracement first', 'Invalidation: Close below the prior low',
    ].join('\n'));
    expect(composeCandleNarrative({})).toBe('');
  });
});
