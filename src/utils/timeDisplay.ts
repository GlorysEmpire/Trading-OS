/**
 * How trading times are shown and typed.
 *
 * Trading time is New York time: sessions, entry times, the trading day.
 * The trader can switch the view to their own local time; the other zone is
 * shown beside it where it helps to correlate. Stored values are always
 * absolute instants (ISO / epoch), so the view never changes the data.
 */
import { SESSION_TIMEZONE, deviceTimeZone, zoneOffsetMinutes } from './traderTime';

export type TimeView = 'NY' | 'LOCAL';

const STORAGE_KEY = 'trading_os_v1_store_time_view';

function readStored(): TimeView {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'LOCAL' ? 'LOCAL' : 'NY';
  } catch {
    return 'NY';
  }
}

let current: TimeView = typeof localStorage === 'undefined' ? 'NY' : readStored();

export function getTimeView(): TimeView {
  return current;
}

export function setTimeView(view: TimeView) {
  current = view;
  try {
    localStorage.setItem(STORAGE_KEY, view);
  } catch {
    // Storage unavailable: the choice lasts for this visit only.
  }
}

/** The IANA zone for a view. */
export function viewZone(view: TimeView = current): string {
  return view === 'NY' ? SESSION_TIMEZONE : deviceTimeZone();
}

/** Short label for a zone: "NY" for New York, else the city ("Lagos"). */
export function zoneLabel(timeZone: string): string {
  if (timeZone === SESSION_TIMEZONE) return 'NY';
  return timeZone.split('/').pop()?.replace(/_/g, ' ') || timeZone;
}

/** True when the device is already on New York time (then there's no "other" zone to show). */
export function localIsNY(): boolean {
  const local = deviceTimeZone();
  if (local === SESSION_TIMEZONE) return true;
  const now = new Date();
  return zoneOffsetMinutes(now, local) === zoneOffsetMinutes(now, SESSION_TIMEZONE)
    && zoneOffsetMinutes(new Date(now.getTime() + 182 * 86_400_000), local) === zoneOffsetMinutes(new Date(now.getTime() + 182 * 86_400_000), SESSION_TIMEZONE);
}

function toDate(input: Date | string | number): Date | null {
  const d = input instanceof Date ? input : new Date(input);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "Nov 20, 09:30 NY" (or "Nov 20, 15:30 Lagos" in the local view). */
export function formatTradingTime(
  input: Date | string | number | undefined | null,
  opts: { date?: boolean; time?: boolean; view?: TimeView; zone?: string } = {},
): string {
  if (input === undefined || input === null || input === '') return '';
  const d = toDate(input);
  if (!d) return '';
  const zone = opts.zone ?? viewZone(opts.view);
  const showDate = opts.date !== false;
  const showTime = opts.time !== false;
  const text = new Intl.DateTimeFormat('en-US', {
    timeZone: zone,
    ...(showDate ? { month: 'short', day: 'numeric' } : {}),
    ...(showTime ? { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' } : {}),
  }).format(d);
  return showTime ? `${text} ${zoneLabel(zone)}` : text;
}

/** The same instant in the zone not being viewed, e.g. "= 15:30 Lagos". Empty
 * when the device is on New York time. */
export function otherZoneHint(input: Date | string | number, view: TimeView = current): string {
  if (localIsNY()) return '';
  const other: TimeView = view === 'NY' ? 'LOCAL' : 'NY';
  const d = toDate(input);
  if (!d) return '';
  const zone = viewZone(other);
  const sameDay = new Intl.DateTimeFormat('en-CA', { timeZone: zone }).format(d) === new Intl.DateTimeFormat('en-CA', { timeZone: viewZone(view) }).format(d);
  return `= ${formatTradingTime(d, { view: other, date: !sameDay })}`;
}

/** "YYYY-MM-DDTHH:mm" for a datetime-local input, in the given zone. */
export function toZoneInput(input: Date | string | number, timeZone: string = viewZone()): string {
  const d = toDate(input);
  if (!d) return '';
  const shifted = new Date(d.getTime() + zoneOffsetMinutes(d, timeZone) * 60_000);
  return shifted.toISOString().slice(0, 16);
}

/** A datetime-local value read as wall-clock time in `timeZone`. Handles
 * daylight saving. Null when the value isn't a date-time. */
export function fromZoneInput(local: string, timeZone: string = viewZone()): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(local);
  if (!m) return null;
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = asUtc - zoneOffsetMinutes(new Date(asUtc), timeZone) * 60_000;
  t = asUtc - zoneOffsetMinutes(new Date(t), timeZone) * 60_000;
  return new Date(t);
}
