/** M3: candle boundaries come from the feed's own daily reset (not the NY trading day). */
import { describe, expect, it } from 'vitest';
import { FEED_PRESETS, candleFor, candleLabel, previousCandle } from './index';

const CRYPTO = FEED_PRESETS[0]; // 00:00 UTC
const FX = FEED_PRESETS[1]; // 17:00 New York

describe('crypto feed (00:00 UTC reset)', () => {
  it('day, week and month candles', () => {
    // 02:00 UTC Tue Nov 24 is still Monday evening in New York, but the chart is on Tuesday's candle.
    expect(candleFor('DAY', '2026-11-24T02:00:00Z', CRYPTO, 'BTCUSD')).toEqual({ symbol: 'BTCUSD', feed: 'BINANCE', openTime: '2026-11-24T00:00:00.000Z', closeTime: '2026-11-25T00:00:00.000Z' });
    expect(candleFor('WEEK', '2026-11-24T02:00:00Z', CRYPTO, 'BTCUSD')).toMatchObject({ openTime: '2026-11-23T00:00:00.000Z', closeTime: '2026-11-30T00:00:00.000Z' });
    expect(candleFor('MONTH', '2026-11-24T02:00:00Z', CRYPTO, 'BTCUSD')).toMatchObject({ openTime: '2026-11-01T00:00:00.000Z', closeTime: '2026-12-01T00:00:00.000Z' });
  });
  it('previous candle and labels', () => {
    expect(previousCandle('DAY', '2026-11-24T02:00:00Z', CRYPTO, 'BTCUSD').openTime).toBe('2026-11-23T00:00:00.000Z');
    expect(candleLabel('WEEK', candleFor('WEEK', '2026-11-24T02:00:00Z', CRYPTO, 'X'), CRYPTO)).toBe('Week of Nov 23');
    expect(candleLabel('MONTH', candleFor('MONTH', '2026-11-24T02:00:00Z', CRYPTO, 'X'), CRYPTO)).toBe('November 2026');
  });
});

describe('FX feed (17:00 New York reset, opens the evening before)', () => {
  it('handles Friday close and the Sunday reopen on the weekday schedule', () => {
    const weekdays = FEED_PRESETS[2];
    expect(candleFor('DAY', '2026-11-28T12:00:00Z', weekdays, 'EURUSD')).toMatchObject({
      openTime: '2026-11-26T22:00:00.000Z', closeTime: '2026-11-27T22:00:00.000Z',
    });
    expect(previousCandle('DAY', '2026-11-29T23:00:00Z', weekdays, 'EURUSD').closeTime).toBe('2026-11-27T22:00:00.000Z');
    expect(candleFor('MONTH', '2026-11-10T12:00:00Z', weekdays, 'EURUSD').openTime).toBe('2026-11-01T22:00:00.000Z');
  });
  it('a 17:00 NY reset opens tomorrow\'s candle the evening before (EST = 22:00 UTC)', () => {
    expect(candleFor('DAY', '2026-11-23T23:00:00Z', FX, 'EURUSD')).toMatchObject({ openTime: '2026-11-23T22:00:00.000Z', closeTime: '2026-11-24T22:00:00.000Z' });
    expect(candleFor('DAY', '2026-11-23T21:00:00Z', FX, 'EURUSD')).toMatchObject({ openTime: '2026-11-22T22:00:00.000Z' });
    expect(candleLabel('DAY', candleFor('DAY', '2026-11-23T23:00:00Z', FX, 'X'), FX)).toBe('Tue, Nov 24');
  });
  it('the week opens Sunday 17:00 NY; the month opens the evening before the 1st', () => {
    expect(candleFor('WEEK', '2026-11-25T12:00:00Z', FX, 'EURUSD')).toMatchObject({ openTime: '2026-11-22T22:00:00.000Z', closeTime: '2026-11-29T22:00:00.000Z' });
    expect(candleFor('MONTH', '2026-11-10T12:00:00Z', FX, 'EURUSD')).toMatchObject({ openTime: '2026-10-31T21:00:00.000Z', closeTime: '2026-11-30T22:00:00.000Z' });
  });
  it('follows US daylight saving (EDT = 21:00 UTC)', () => {
    expect(candleFor('DAY', '2026-07-15T12:00:00Z', FX, 'EURUSD').openTime).toBe('2026-07-14T21:00:00.000Z');
  });
});
