/**
 * Candle schedule per data feed (M3). A plan belongs to the candle the
 * symbol's own chart prints, so the open time comes from the feed's daily
 * reset, not from the NY trading day. Pure: callers pass the time in.
 *
 * Each daily candle has a trading date. A feed that resets in the evening
 * (e.g. 17:00 New York on FX/CFD feeds) opens a date's candle on the evening
 * before it. Weeks start with Monday's trading date; months with the 1st.
 */
import type { Cadence, PeriodCandle } from './types';

export interface FeedProfile {
  /** Exchange / data feed name as the chart shows it, e.g. "BINANCE", "OANDA". */
  feed: string;
  /** Daily reset: IANA zone and HH:MM in that zone. */
  zone: string;
  time: string;
}

/** Common presets. Always editable: the chart is the source of truth. */
export const FEED_PRESETS: Array<FeedProfile & { label: string }> = [
  { label: 'Crypto exchange (00:00 UTC)', feed: 'BINANCE', zone: 'UTC', time: '00:00' },
  { label: 'Forex / CFD broker (17:00 New York)', feed: 'OANDA', zone: 'America/New_York', time: '17:00' },
];

const DAY = 86_400_000;

function partsIn(t: number, zone: string) {
  const p = new Intl.DateTimeFormat('en-US', { timeZone: zone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' })
    .formatToParts(new Date(t)).reduce<Record<string, number>>((a, x) => (x.type !== 'literal' ? { ...a, [x.type]: Number(x.value) } : a), {});
  return { y: p.year, m: p.month, d: p.day, h: p.hour % 24, min: p.minute, s: p.second };
}

/** Offset of `zone` from UTC at instant t, in ms. */
function offset(t: number, zone: string): number {
  const p = partsIn(t, zone);
  return Date.UTC(p.y, p.m - 1, p.d, p.h, p.min, p.s) - Math.floor(t / 1000) * 1000;
}

/** UTC instant of a wall-clock date/time in a zone (DST-safe). */
function zonedToUtc(y: number, m: number, d: number, hh: number, mm: number, zone: string): number {
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let t = guess - offset(guess, zone);
  t = guess - offset(t, zone);
  return t;
}

const hm = (time: string) => { const [h, m] = time.split(':').map(Number); return { h: h || 0, m: m || 0 }; };
/** True when the reset falls in the evening, so a candle opens the day before its trading date. */
const opensEveningBefore = (p: FeedProfile) => hm(p.time).h >= 12;

/** Open instant of the daily candle for trading date y-m-d. */
function dayOpen(y: number, m: number, d: number, p: FeedProfile): number {
  const { h, m: mi } = hm(p.time);
  const shift = opensEveningBefore(p) ? -1 : 0;
  const base = new Date(Date.UTC(y, m - 1, d + shift));
  return zonedToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), h, mi, p.zone);
}

/** Trading date (UTC-midnight timestamp) of the daily candle that contains `t`. */
function tradingDate(t: number, p: FeedProfile): number {
  const z = partsIn(t, p.zone);
  let date = Date.UTC(z.y, z.m - 1, z.d);
  if (opensEveningBefore(p)) date += DAY; // after the evening reset you're on tomorrow's candle
  // Step back if `t` is before that date's open (morning reset not reached yet / evening reset not reached yet).
  for (let i = 0; i < 3; i++) {
    const dt = new Date(date);
    if (dayOpen(dt.getUTCFullYear(), dt.getUTCMonth() + 1, dt.getUTCDate(), p) <= t) break;
    date -= DAY;
  }
  return date;
}

const openOfDate = (date: number, p: FeedProfile) => { const d = new Date(date); return dayOpen(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate(), p); };

/** The candle (open and close) of a cadence that contains instant `at`, on this feed. */
export function candleFor(cadence: Cadence, at: string, profile: FeedProfile, symbol: string): PeriodCandle {
  const t = Date.parse(at);
  const td = tradingDate(t, profile);
  const d = new Date(td);
  let start: number;
  let next: number;
  if (cadence === 'DAY') {
    start = td;
    next = td + DAY;
  } else if (cadence === 'WEEK') {
    const dow = (d.getUTCDay() + 6) % 7; // Monday = 0
    start = td - dow * DAY;
    next = start + 7 * DAY;
  } else {
    start = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1);
    next = Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1);
  }
  return {
    symbol,
    feed: profile.feed,
    openTime: new Date(openOfDate(start, profile)).toISOString(),
    closeTime: new Date(openOfDate(next, profile)).toISOString(),
  };
}

/** The candle before the one containing `at` (e.g. "yesterday's daily candle"). */
export function previousCandle(cadence: Cadence, at: string, profile: FeedProfile, symbol: string): PeriodCandle {
  const current = candleFor(cadence, at, profile, symbol);
  return candleFor(cadence, new Date(Date.parse(current.openTime) - 60_000).toISOString(), profile, symbol);
}

/** Plain label for a candle, e.g. "Week of Nov 23" / "Nov 24" / "November 2026". */
export function candleLabel(cadence: Cadence, c: PeriodCandle, profile: FeedProfile): string {
  const t = Date.parse(c.openTime) + (opensEveningBefore(profile) ? DAY : 0) + 60_000;
  const fmt = (o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-US', { timeZone: profile.zone, ...o }).format(new Date(t));
  if (cadence === 'MONTH') return fmt({ month: 'long', year: 'numeric' });
  if (cadence === 'WEEK') return `Week of ${fmt({ month: 'short', day: 'numeric' })}`;
  return fmt({ weekday: 'short', month: 'short', day: 'numeric' });
}
