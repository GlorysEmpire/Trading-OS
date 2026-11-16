/**
 * Market Context (MC-1): external-context lanes on an Asset Desk.
 *
 * External data is context for the narrative, never a buy/sell signal.
 * Every value carries its source and as-of time; lanes and fields start from a
 * per-asset-class template and are fully editable per desk afterwards.
 */
import type {
  AssetCategory,
  AssetDeskData,
  ContextEntryBy,
  ContextField,
  ContextLane,
  OperationalCalendarEvent,
} from '../types';
import { SESSION_TIMEZONE, zoneOffsetMinutes } from './traderTime';

type ExternalContext = AssetDeskData['externalContext'];

let idCounter = 0;
export function contextId(prefix: string): string {
  idCounter = (idCounter + 1) % 1000;
  return `${prefix}-${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 5)}`;
}

/** The trader's own reading notes (from market-concepts-notes.md), offered as
 * each field's starting concept note. Editable per field. */
export const CONCEPT_NOTES: Record<string, string> = {
  funding:
    'Perps use a regular payment to stay near spot. Positive: longs pay shorts; negative: shorts pay longs. The side that pays is the crowded side, and the crowded side gets squeezed. Negative funding after a big drop = late shorts, fuel for a bounce if price turns. Not a buy signal.',
  openInterest:
    'Total value of open futures positions; no direction on its own. Price up + OI up = new longs. Price up + OI down = short covering. Price down + OI up = new shorts. Price down + OI down = longs flushed.',
  liquidations:
    'Forced closes of leveraged positions. They sit beyond obvious highs and lows, which is what liquidity is made of. A big flush with OI dropping often marks the end of a move, not the start.',
  yield2y:
    '2-year = the Fed gauge. Tracks where the market thinks the Fed rate will average over two years; moves on CPI, jobs data and Fed speeches. Falling 2-year = hikes being priced out, the first sign of relief.',
  yield10y:
    '10-year = the economy gauge: long-run growth and inflation. 10-year rising faster than the 2-year = long-run inflation or debt worries. Both rising = tighter money, a headwind for BTC. Spread (10y − 2y) negative = inverted.',
  rateOdds:
    'Markets move on surprises, not known facts. Near 100% odds, most room for surprise is on the soft side (weak data → odds fall → relief). A hawkish surprise is still possible.',
  etfFlows: 'Spot demand. A reversal needs spot demand; a leverage flush alone only gives a bounce.',
  stablecoins: 'Spot demand: dry powder on exchanges. Shrinking supply = buying power leaving.',
  coinbasePremium: 'Spot demand from US buyers: Coinbase price vs other exchanges. A discount = weak US spot demand.',
};

type FieldSeed = { label: string; key?: string; note?: keyof typeof CONCEPT_NOTES; staleAfterHours?: number };
type LaneSeed = { name: string; question: string; fields: FieldSeed[]; kind?: ContextLane['kind'] };

const MACRO: LaneSeed = {
  name: 'Macro',
  question: 'Is money getting tighter or looser?',
  fields: [
    { label: 'Rate-decision odds', note: 'rateOdds', staleAfterHours: 72 },
    { label: '2-year yield', note: 'yield2y', staleAfterHours: 48 },
    { label: '10-year yield', key: 'yields10Y', note: 'yield10y', staleAfterHours: 48 },
    { label: 'DXY', key: 'dxy', staleAfterHours: 48 },
  ],
};
const EVENTS: LaneSeed = { name: 'Events', question: 'What could change the odds this week?', fields: [], kind: 'EVENTS' };

/** Starting lanes per asset class. Seeds only: copied into a desk on first use,
 * then the desk owns them. */
const TEMPLATES: Record<'CRYPTO' | 'DEFAULT', LaneSeed[]> = {
  CRYPTO: [
    {
      name: 'Spot demand',
      question: 'Is real buying (not leverage) showing up?',
      fields: [
        { label: 'ETF net flows', key: 'etfFlows', note: 'etfFlows', staleAfterHours: 72 },
        { label: 'Stablecoin supply', note: 'stablecoins', staleAfterHours: 168 },
        { label: 'Coinbase premium', note: 'coinbasePremium', staleAfterHours: 48 },
      ],
    },
    {
      name: 'Leverage',
      question: 'Is the crowd leaning one way?',
      fields: [
        { label: 'Open interest', key: 'openInterest', note: 'openInterest', staleAfterHours: 24 },
        { label: 'Funding', key: 'fundingRate', note: 'funding', staleAfterHours: 24 },
      ],
    },
    {
      name: 'Forced',
      question: 'Who just got flushed?',
      fields: [{ label: 'Liquidations', key: 'liquidations', note: 'liquidations', staleAfterHours: 24 }],
    },
    MACRO,
    EVENTS,
  ],
  DEFAULT: [
    { name: 'Spot demand', question: 'Is real buying showing up?', fields: [{ label: 'Fund / ETF flows', key: 'etfFlows', staleAfterHours: 72 }] },
    { name: 'Leverage', question: 'Is the crowd leaning one way?', fields: [{ label: 'Futures open interest', key: 'openInterest', note: 'openInterest', staleAfterHours: 48 }] },
    { name: 'Forced', question: 'Who just got flushed?', fields: [{ label: 'Liquidations', key: 'liquidations', note: 'liquidations', staleAfterHours: 24 }] },
    MACRO,
    EVENTS,
  ],
};

const LEGACY_KEYS = ['etfFlows', 'openInterest', 'fundingRate', 'liquidations', 'yields10Y', 'dxy'] as const;

export function emptyField(label: string, extra: Partial<ContextField> = {}): ContextField {
  return { id: contextId('cf'), label, value: '', source: '', asOf: '', enteredBy: 'MANUAL', ...extra };
}

export function templateLanes(category: AssetCategory): ContextLane[] {
  const seeds = category === 'CRYPTO' ? TEMPLATES.CRYPTO : TEMPLATES.DEFAULT;
  return seeds.map((seed) => ({
    id: contextId('cl'),
    name: seed.name,
    question: seed.question,
    kind: seed.kind ?? 'FIELDS',
    fields: seed.fields.map((f) =>
      emptyField(f.label, {
        staleAfterHours: f.staleAfterHours,
        conceptNote: f.note ? CONCEPT_NOTES[f.note] : undefined,
      }),
    ),
  }));
}

/** Best-effort read of the old block-level "updatedAt" (a locale string). */
function legacyAsOf(updatedAt: string | undefined): string {
  // Only trust an ISO timestamp. The old block saved a locale string, and
  // day/month order in those can't be read safely, so they get "no time".
  if (!updatedAt || !/^\d{4}-\d{2}-\d{2}T/.test(updatedAt)) return '';
  const t = Date.parse(updatedAt);
  return Number.isNaN(t) ? '' : new Date(t).toISOString();
}

/** Builds lanes for a desk that only has the old flat fields. Old values go
 * into the matching template field; values with no matching field get their own
 * field in the closest lane, so nothing is dropped. */
export function lanesFromLegacy(ctx: ExternalContext, category: AssetCategory): ContextLane[] {
  const lanes = templateLanes(category);
  const seeds = category === 'CRYPTO' ? TEMPLATES.CRYPTO : TEMPLATES.DEFAULT;
  const asOf = legacyAsOf(ctx.updatedAt);
  const fill = (key: (typeof LEGACY_KEYS)[number], fallbackLane: string, fallbackLabel: string) => {
    const value = (ctx[key] ?? '').trim();
    if (!value) return;
    const patch = { value, source: 'Manual (before lanes)', asOf, enteredBy: 'MANUAL' as ContextEntryBy };
    for (let li = 0; li < seeds.length; li++) {
      const fi = seeds[li].fields.findIndex((f) => f.key === key);
      if (fi >= 0) {
        lanes[li].fields[fi] = { ...lanes[li].fields[fi], ...patch };
        return;
      }
    }
    const lane = lanes.find((l) => l.name === fallbackLane) ?? lanes[0];
    lane.fields.push(emptyField(fallbackLabel, patch));
  };
  fill('etfFlows', 'Spot demand', 'ETF net flows');
  fill('openInterest', 'Leverage', 'Open interest');
  fill('fundingRate', 'Leverage', 'Funding');
  fill('liquidations', 'Forced', 'Liquidations');
  fill('yields10Y', 'Macro', '10-year yield');
  fill('dxy', 'Macro', 'DXY');
  const news = (ctx.macroNews ?? '').trim();
  if (news) {
    const macro = lanes.find((l) => l.name === 'Macro');
    macro?.fields.push(emptyField('Macro news', { value: news, source: 'Manual (before lanes)', asOf }));
  }
  return lanes;
}

/** The lanes to show for a desk: saved lanes, else built from the old fields. */
export function getLanes(desk: Pick<AssetDeskData, 'externalContext' | 'category'>): ContextLane[] {
  const ctx = desk.externalContext ?? { updatedAt: '' };
  if (Array.isArray(ctx.lanes)) return ctx.lanes;
  return lanesFromLegacy(ctx, desk.category);
}

/** New externalContext with the lanes saved. Old flat fields are kept as they were. */
export function withLanes(ctx: ExternalContext | undefined, lanes: ContextLane[], now: Date = new Date()): ExternalContext {
  return { ...(ctx ?? { updatedAt: '' }), version: 2, lanes, updatedAt: now.toISOString() };
}

export function isStale(field: ContextField, now: Date = new Date()): boolean {
  if (!field.value || !field.asOf || !field.staleAfterHours) return false;
  const t = Date.parse(field.asOf);
  if (Number.isNaN(t)) return false;
  return now.getTime() - t > field.staleAfterHours * 3_600_000;
}

/** "now", "5 h", "3 d" — how old the value is. Empty when no as-of time. */
export function fieldAge(field: ContextField, now: Date = new Date()): string {
  if (!field.asOf) return '';
  const t = Date.parse(field.asOf);
  if (Number.isNaN(t)) return '';
  const hours = Math.max(0, (now.getTime() - t) / 3_600_000);
  if (hours < 1) return 'now';
  if (hours < 48) return `${Math.floor(hours)} h`;
  return `${Math.floor(hours / 24)} d`;
}

/** "Nov 16, 03:55 NY". */
export function formatAsOfNY(iso: string): string {
  const t = Date.parse(iso);
  if (!iso || Number.isNaN(t)) return 'no time';
  const s = new Intl.DateTimeFormat('en-US', {
    timeZone: SESSION_TIMEZONE, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).format(new Date(t));
  return `${s} NY`;
}

/** ISO → "YYYY-MM-DDTHH:mm" in New York time, for a datetime-local input. */
export function isoToNyInput(iso: string): string {
  const t = Date.parse(iso);
  if (!iso || Number.isNaN(t)) return '';
  const d = new Date(t + zoneOffsetMinutes(new Date(t), SESSION_TIMEZONE) * 60_000);
  return d.toISOString().slice(0, 16);
}

/** "YYYY-MM-DDTHH:mm" read as New York time → ISO. Handles daylight saving. */
export function nyInputToIso(local: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return '';
  const asUtc = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  let t = asUtc - zoneOffsetMinutes(new Date(asUtc), SESSION_TIMEZONE) * 60_000;
  // Re-check once at the guessed instant (offset can differ across a DST change).
  t = asUtc - zoneOffsetMinutes(new Date(t), SESSION_TIMEZONE) * 60_000;
  return new Date(t).toISOString();
}

/** Saves an edit to a field. A changed value keeps the old one as `previous`. */
export function applyFieldEdit(field: ContextField, edit: Partial<ContextField>, now: Date = new Date()): ContextField {
  const next: ContextField = { ...field, ...edit };
  const valueChanged = edit.value !== undefined && edit.value.trim() !== field.value.trim();
  if (valueChanged && field.value.trim()) next.previous = { value: field.value, asOf: field.asOf };
  if (edit.enteredBy === 'MANUAL') next.confirmedAt = now.toISOString();
  return next;
}

export function confirmField(field: ContextField, now: Date = new Date()): ContextField {
  return { ...field, confirmedAt: now.toISOString(), enteredBy: field.enteredBy === 'AI_DRAFT' ? 'MANUAL' : field.enteredBy };
}

export function needsConfirmation(field: ContextField): boolean {
  return field.enteredBy === 'AI_DRAFT' && !field.confirmedAt;
}

/** One line for the Dashboard's Market Watch. */
export function contextSummary(lanes: ContextLane[], max = 5): string {
  const parts: string[] = [];
  for (const lane of lanes) {
    for (const f of lane.fields) {
      if (f.value.trim()) parts.push(`${f.label} ${f.value}`);
    }
  }
  return parts.slice(0, max).join(' · ');
}

/** True when the event's asset field names this desk (e.g. "BTC", "BTC, ETH", "USD"). */
export function eventMatchesDesk(event: OperationalCalendarEvent, symbol: string): boolean {
  const tokens = (event.assetOrCurrency ?? '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  const sym = symbol.toUpperCase();
  return tokens.some((t) => t === sym || t === 'ALL');
}

/** Upcoming, not-yet-done Calendar events linked to the desk, soonest first. */
export function upcomingDeskEvents(events: OperationalCalendarEvent[], symbol: string, todayYmd: string, max = 3): OperationalCalendarEvent[] {
  return events
    .filter((e) => !e.completed && e.date >= todayYmd && eventMatchesDesk(e, symbol))
    .sort((a, b) => (a.date + (a.time ?? '')).localeCompare(b.date + (b.time ?? '')))
    .slice(0, max);
}
