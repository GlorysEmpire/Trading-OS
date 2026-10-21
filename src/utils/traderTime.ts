import type { SessionWindow } from '../types';

/**
 * The trader's explicit timezone. Previously "today"/"this week" were
 * computed in a mix of UTC (`.toISOString().split('T')[0]`) and whatever
 * timezone the browser happened to be in, so trade.date, the Dashboard's
 * "today", and the performance stats could each land on a different
 * calendar day right around midnight. This is the single explicit
 * timezone used everywhere that matters, instead of that ambiguity.
 */
export const TRADER_TIMEZONE = 'Africa/Lagos';

/** "Today" as YYYY-MM-DD in the trader's timezone — use this instead of
 * `new Date().toISOString().split('T')[0]` (which is UTC, not the
 * trader's day) anywhere a trade/event is being dated "today". */
export function traderDateString(date: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TRADER_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/** Whole days between two YYYY-MM-DD date strings (b - a), both assumed to
 * already be in the trader's timezone. Avoids mixing calendar-day math
 * with elapsed-wall-clock-time math (Date.now() - trade.timestamp), which
 * silently breaks for any trade logged on a different day than it was
 * entered (e.g. a backfilled/imported trade). */
export function daysBetweenDateStrings(a: string, b: string): number {
  const toUtcMs = (s: string) => Date.parse(`${s}T00:00:00Z`);
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

/** Minutes since midnight, in the trader's timezone. */
export function traderNowMinutes(date: Date = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: TRADER_TIMEZONE,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  // Intl can format midnight as "24:00" in some engines — normalize.
  return (hour % 24) * 60 + minute;
}

function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return (h % 24) * 60 + (m || 0);
}

/** Is this session active right now, in the trader's own (Lagos) time?
 * Session windows are configured per-session in both NY and Lagos time;
 * since the trader lives in Lagos, "active now" is judged against the
 * Lagos side, handling the one session (Tokyo) that crosses midnight. */
export function isSessionActiveNow(session: SessionWindow, nowMinutes: number = traderNowMinutes()): boolean {
  const start = hhmmToMinutes(session.lagosStart);
  const end = hhmmToMinutes(session.lagosEnd);
  if (start === end) return false;
  if (end > start) return nowMinutes >= start && nowMinutes < end;
  return nowMinutes >= start || nowMinutes < end; // wraps past midnight
}

export function getActiveSession(sessions: SessionWindow[], nowMinutes: number = traderNowMinutes()): SessionWindow | undefined {
  return sessions.find((s) => isSessionActiveNow(s, nowMinutes));
}
