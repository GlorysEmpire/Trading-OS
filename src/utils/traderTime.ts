import type { SessionWindow } from '../types';

/**
 * The trader's home timezone, used for calendar dates ("today", a trade's
 * date, debrief days). One explicit zone, so trade.date, the Dashboard's
 * "today" and the stats never land on different days around midnight.
 */
export const TRADER_TIMEZONE = 'Africa/Lagos';

/** Session windows are always defined in New York time, wherever the trader
 * is (Trading HQ, confirmed 2026-11-02). Local times are derived from NY
 * time, so US daylight-saving shifts and travel never break scoring. */
export const SESSION_TIMEZONE = 'America/New_York';

/** The device's own timezone, for showing session windows in local time. */
export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || TRADER_TIMEZONE;
  } catch {
    return TRADER_TIMEZONE;
  }
}

/** YYYY-MM-DD for `date` in the given timezone (default: the trader's). */
export function traderDateString(date: Date = new Date(), timeZone: string = TRADER_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

/** Whole days between two YYYY-MM-DD date strings (b - a). Calendar-day math,
 * never elapsed wall-clock time. */
export function daysBetweenDateStrings(a: string, b: string): number {
  const toUtcMs = (s: string) => Date.parse(`${s}T00:00:00Z`);
  return Math.round((toUtcMs(b) - toUtcMs(a)) / 86_400_000);
}

/** Minutes since midnight of `date` in `timeZone`. */
export function minutesInZone(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hour12: false }).formatToParts(date);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? '0');
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? '0');
  return (hour % 24) * 60 + minute; // some engines format midnight as "24:00"
}

/** Minutes since midnight in the trader's timezone. */
export function traderNowMinutes(date: Date = new Date()): number {
  return minutesInZone(date, TRADER_TIMEZONE);
}

/** English weekday name ("Monday") of `date` in `timeZone`. */
export function weekdayInZone(date: Date, timeZone: string = TRADER_TIMEZONE): string {
  return new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'long' }).format(date);
}

/** UTC offset of `timeZone` at `date`, in minutes (Lagos = +60, NY = -300 or -240). */
export function zoneOffsetMinutes(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
  }).formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value ?? '0');
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour') % 24, get('minute'), get('second'));
  return Math.round((asUtc - Math.floor(date.getTime() / 1000) * 1000) / 60_000);
}

export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = (hhmm || '0:0').split(':').map(Number);
  return ((h || 0) % 24) * 60 + (m || 0);
}

export function minutesToHhmm(total: number): string {
  const m = ((total % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

/** Convert an NY wall-clock time ("07:00") to the wall-clock time in `timeZone`
 * on the day containing `onDate`. Uses the offsets in force at `onDate`, so it
 * follows US and local daylight saving. */
export function nyTimeIn(hhmm: string, timeZone: string, onDate: Date = new Date()): string {
  const diff = zoneOffsetMinutes(onDate, timeZone) - zoneOffsetMinutes(onDate, SESSION_TIMEZONE);
  return minutesToHhmm(hhmmToMinutes(hhmm) + diff);
}

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/** Is `at` inside this session's window, judged in NY time? For a window that
 * crosses NY midnight, the part after midnight belongs to the previous NY day
 * for the active-days check. */
export function isSessionActiveAt(session: SessionWindow, at: Date = new Date()): boolean {
  const start = hhmmToMinutes(session.nyStart);
  const end = hhmmToMinutes(session.nyEnd);
  if (start === end) return false;
  const now = minutesInZone(at, SESSION_TIMEZONE);
  const nyDay = weekdayInZone(at, SESSION_TIMEZONE);
  let inWindow: boolean;
  let sessionDay = nyDay;
  if (end > start) {
    inWindow = now >= start && now < end;
  } else {
    inWindow = now >= start || now < end;
    if (now < end) sessionDay = WEEKDAYS[(WEEKDAYS.indexOf(nyDay) + 6) % 7];
  }
  if (!inWindow) return false;
  return !session.activeDays?.length || session.activeDays.includes(sessionDay);
}

/** Back-compat name used by the Dashboard. */
export const isSessionActiveNow = (session: SessionWindow, at: Date = new Date()) => isSessionActiveAt(session, at);

export function getActiveSession(sessions: SessionWindow[], at: Date = new Date()): SessionWindow | undefined {
  return sessions.find((s) => isSessionActiveAt(s, at));
}

/** Timeframe label ("1M", "3m", "15M", "1H", "Daily") → minutes. Unknown → Infinity. */
export function timeframeMinutes(tf: string): number {
  const m = /^(\d+)\s*([mhdw]|min)?/i.exec((tf || '').trim());
  if (!m) return /daily/i.test(tf) ? 1440 : /weekly/i.test(tf) ? 10080 : Infinity;
  const n = Number(m[1]);
  const unit = (m[2] || 'm').toLowerCase();
  return unit === 'h' ? n * 60 : unit === 'd' ? n * 1440 : unit === 'w' ? n * 10080 : n;
}

export interface SessionCheckResult {
  /** The session window containing the entry, if any. */
  session?: SessionWindow;
  /** Only sub-5-minute entries are window-restricted (OUT_WINDOW rule). */
  restricted: boolean;
  /** Session check passes unless a restricted entry fell outside every window. */
  pass: boolean;
  outWindow: boolean;
}

/** The Session process check for an entry at `entryAt` on `timeframe`. */
export function evaluateSessionCheck(sessions: SessionWindow[], entryAt: Date, timeframe: string): SessionCheckResult {
  const session = getActiveSession(sessions, entryAt);
  const restricted = timeframeMinutes(timeframe) < 5;
  const outWindow = restricted && !session;
  return { session, restricted, pass: !outWindow, outWindow };
}
