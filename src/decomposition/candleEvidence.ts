type Ohlc = { open: number; high: number; low: number; close: number };

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
