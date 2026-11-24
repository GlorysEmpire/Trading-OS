import type { PeriodCandle } from './types';

export type Ohlc = { open: number; high: number; low: number; close: number };
export type RecordedCandle = { candle: PeriodCandle; prices: Ohlc; metrics: NonNullable<ReturnType<typeof measureCandle>> };

/** A planning input has to be closed by the opening of the planned candle. */
export function recordCompletedCandle(candle: PeriodCandle, prices: Partial<Ohlc>, cutoff: string): RecordedCandle | undefined {
  const opens = Date.parse(candle.openTime);
  const closes = Date.parse(candle.closeTime ?? '');
  if (!(opens < closes && closes <= Date.parse(cutoff))) return;
  if (prices.open === undefined || prices.high === undefined || prices.low === undefined || prices.close === undefined) return;
  const ohlc = { open: prices.open, high: prices.high, low: prices.low, close: prices.close };
  const metrics = measureCandle(ohlc);
  return metrics && { candle, prices: ohlc, metrics };
}

export function compareCandles(latest: RecordedCandle, earlier: RecordedCandle) {
  if (!earlier.candle.closeTime || Date.parse(earlier.candle.closeTime) > Date.parse(latest.candle.openTime)
    || earlier.candle.feed !== latest.candle.feed || earlier.candle.symbol !== latest.candle.symbol) return undefined;
  const a = latest.prices;
  const b = earlier.prices;
  return {
    rangeRatio: earlier.metrics.range > 0 ? latest.metrics.range / earlier.metrics.range : undefined,
    bodyRatio: earlier.metrics.body > 0 ? latest.metrics.body / earlier.metrics.body : undefined,
    closeChange: a.close - b.close,
    formation: a.high <= b.high && a.low >= b.low ? 'Inside' : a.high > b.high && a.low < b.low ? 'Outside' : a.high > b.high ? 'Expanded above' : 'Expanded below',
    highTaken: a.high > b.high,
    lowTaken: a.low < b.low,
    rejectedHigh: a.high > b.high && a.close <= b.high,
    rejectedLow: a.low < b.low && a.close >= b.low,
  };
}

/** Chart measurements for the educational panel. They do not classify the trade or alter gate logic. */
export function measureCandle({ open, high, low, close }: Ohlc) {
  if (![open, high, low, close].every(Number.isFinite) || high < Math.max(open, close) || low > Math.min(open, close)) return;
  const range = high - low;
  if (!Number.isFinite(range)) return;
  const body = Math.abs(close - open);
  const closeFraction = range ? (close - low) / range : 0.5;
  return {
    range,
    body,
    bodyPercent: range ? body / range * 100 : 0,
    upperWick: high - Math.max(open, close),
    lowerWick: Math.min(open, close) - low,
    closeLocation: closeFraction >= 2 / 3 ? 'High' : closeFraction <= 1 / 3 ? 'Low' : 'Mid',
    direction: close > open ? 'Up' : close < open ? 'Down' : 'Flat',
  };
}
