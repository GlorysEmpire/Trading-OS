import { describe, expect, it } from 'vitest';
import { measureCandle } from './candleEvidence';

describe('candlestick evidence', () => {
  it('separates the real body and wicks and reports the close location', () => {
    expect(measureCandle({ open: 100, high: 125, low: 95, close: 120 })).toEqual({
      range: 30, body: 20, bodyPercent: 20 / 30 * 100, upperWick: 5, lowerWick: 5, closeLocation: 'High', direction: 'Up',
    });
    expect(measureCandle({ open: 118, high: 122, low: 95, close: 98 })).toMatchObject({
      body: 20, upperWick: 4, lowerWick: 3, closeLocation: 'Low', direction: 'Down',
    });
  });

  it('handles a flat candle without division by zero', () => {
    expect(measureCandle({ open: 100, high: 100, low: 100, close: 100 })).toEqual({
      range: 0, body: 0, bodyPercent: 0, upperWick: 0, lowerWick: 0, closeLocation: 'Mid', direction: 'Flat',
    });
  });

  it('rejects non-finite and inverted price bounds', () => {
    expect(measureCandle({ open: 100, high: 99, low: 95, close: 97 })).toBeUndefined();
    expect(measureCandle({ open: 100, high: 110, low: 101, close: 105 })).toBeUndefined();
    expect(measureCandle({ open: NaN, high: 110, low: 95, close: 105 })).toBeUndefined();
  });
});
