/**
 * Market Context (MC-2): the levels ladder.
 *
 * One price-sorted list of the trader's own levels (liquidity, POIs, quick
 * levels) and outside levels (cost bases, option strikes, liquidation
 * clusters). Levels of different kinds that overlap or sit within a small band
 * are flagged as confluence: a prompt to look closer, never a trade signal.
 */
import type { AssetDeskData, ExternalLevel } from '../types';

export interface PriceRange {
  low: number;
  high: number;
}

/** Reads "81,800", "$94,800", "75.6k", "~49k", "68–72.5k", "81,800 – 83,200".
 * Returns null when it can't be read with confidence (never guesses). */
export function parsePriceRange(text: string | undefined | null): PriceRange | null {
  if (!text) return null;
  const cleaned = text
    .replace(/(\d),(?=\d{3}(\D|$))/g, '$1') // thousands separators
    .replace(/[$~≈\s]/g, '');
  const matches = [...cleaned.matchAll(/(\d+(?:\.\d+)?)([kKmM])?/g)];
  if (matches.length === 0 || matches.length > 2) return null;
  const mult = (s: string | undefined) => (!s ? 1 : s.toLowerCase() === 'k' ? 1_000 : 1_000_000);
  const nums = matches.map((m) => ({ n: Number(m[1]), suffix: m[2] as string | undefined }));
  if (nums.length === 2) {
    const [a, b] = nums;
    // "68–72.5k": the suffix belongs to both numbers.
    if (!a.suffix && b.suffix && a.n <= b.n) a.suffix = b.suffix;
  }
  const values = nums.map((x) => x.n * mult(x.suffix));
  if (values.some((v) => !Number.isFinite(v) || v <= 0)) return null;
  return { low: Math.min(...values), high: Math.max(...values) };
}

export type LevelOrigin = 'liquidity' | 'poi' | 'quick' | 'external';

export interface LadderRow {
  /** `${origin}:${id}` — unique across the ladder. */
  key: string;
  origin: LevelOrigin;
  id: string;
  name: string;
  kind: string;
  mine: boolean;
  priceText: string;
  range: PriceRange | null;
  source: string;
  asOf?: string;
  stale: boolean;
  aiDraft: boolean;
  status?: string;
  /** Names of other levels in confluence with this one. */
  confluence: string[];
}

export const DEFAULT_BAND_PCT = 1;

/** Kinds offered when naming a liquidity level. Suggestions only: any text works. */
export const LIQUIDITY_KIND_SUGGESTIONS = ['Bull liquidity', 'Bear liquidity', 'Inducement', 'Equal highs', 'Equal lows', 'Range high', 'Range low'];
export const EXTERNAL_KIND_SUGGESTIONS = ['Cost basis', 'Options strike', 'Liquidation cluster', 'On-chain block', 'Prior high / low'];

/** Readable label for the kinds older zones were saved with. */
export function kindLabel(kind: string): string {
  const legacy: Record<string, string> = { BSL: 'BSL', SSL: 'SSL', EQH: 'Equal highs', EQL: 'Equal lows', RANGE_HIGH: 'Range high', RANGE_LOW: 'Range low' };
  return legacy[kind] ?? kind;
}

/** Every kind in use on any desk, plus the suggestions, for the kind picker. */
export function kindOptions(desks: AssetDeskData[], which: 'liquidity' | 'external'): string[] {
  const used = desks.flatMap((d) => (which === 'liquidity' ? d.liquidityZones.map((z) => kindLabel(z.type)) : (d.externalLevels ?? []).map((l) => l.kind)));
  const base = which === 'liquidity' ? LIQUIDITY_KIND_SUGGESTIONS : EXTERNAL_KIND_SUGGESTIONS;
  const seen = new Set<string>();
  return [...base, ...used].filter((k) => {
    const key = k.trim().toLowerCase();
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function isLevelStale(level: ExternalLevel, now: Date): boolean {
  if (!level.asOf || !level.staleAfterHours) return false;
  const t = Date.parse(level.asOf);
  return !Number.isNaN(t) && now.getTime() - t > level.staleAfterHours * 3_600_000;
}

/** Gap between two ranges as a % of the price around them. 0 when they overlap. */
export function gapPct(a: PriceRange, b: PriceRange): number {
  const gap = Math.max(0, Math.max(a.low, b.low) - Math.min(a.high, b.high));
  if (gap === 0) return 0;
  const ref = (Math.max(a.low, b.low) + Math.min(a.high, b.high)) / 2;
  return (gap / ref) * 100;
}

export interface Ladder {
  /** Priced rows, highest first. */
  rows: LadderRow[];
  /** Levels whose price couldn't be read; shown separately, never guessed. */
  unpriced: LadderRow[];
  reference: PriceRange | null;
  /** Index in `rows` before which the "price now" row sits (rows.length = below all). */
  referenceIndex: number | null;
  bandPct: number;
}

export function buildLadder(desk: AssetDeskData, now: Date = new Date()): Ladder {
  const bandPct = desk.confluenceBandPct && desk.confluenceBandPct > 0 ? desk.confluenceBandPct : DEFAULT_BAND_PCT;
  const all: LadderRow[] = [];
  const push = (row: Omit<LadderRow, 'key' | 'range' | 'confluence'>) =>
    all.push({ ...row, key: `${row.origin}:${row.id}`, range: parsePriceRange(row.priceText), confluence: [] });

  for (const z of desk.liquidityZones) {
    push({ origin: 'liquidity', id: z.id, name: z.notes || kindLabel(z.type), kind: kindLabel(z.type), mine: true, priceText: z.level, source: 'Desk', stale: false, aiDraft: false, status: z.status });
  }
  for (const p of desk.activePOIs) {
    push({ origin: 'poi', id: p.id, name: p.name, kind: p.type ? `POI · ${p.type}` : 'POI', mine: true, priceText: p.priceRange, source: p.timeframe ? `Desk · ${p.timeframe}` : 'Desk', stale: false, aiDraft: false, status: p.active ? undefined : 'Inactive' });
  }
  const q = desk.quickLevels;
  if (q?.high24h?.trim()) push({ origin: 'quick', id: 'high24h', name: '24h high', kind: 'Range', mine: true, priceText: q.high24h, source: 'Desk', stale: false, aiDraft: false });
  if (q?.low24h?.trim()) push({ origin: 'quick', id: 'low24h', name: '24h low', kind: 'Range', mine: true, priceText: q.low24h, source: 'Desk', stale: false, aiDraft: false });
  if (q?.keySustainedLevel?.trim()) push({ origin: 'quick', id: 'key', name: 'Key level', kind: 'Key level', mine: true, priceText: q.keySustainedLevel, source: 'Desk', stale: false, aiDraft: false });
  for (const l of desk.externalLevels ?? []) {
    push({ origin: 'external', id: l.id, name: l.label, kind: l.kind || 'External', mine: false, priceText: l.price, source: l.source || 'No source', asOf: l.asOf, stale: isLevelStale(l, now), aiDraft: l.enteredBy === 'AI_DRAFT' && !l.confirmedAt });
  }

  const rows = all.filter((r) => r.range).sort((a, b) => b.range!.high - a.range!.high || b.range!.low - a.range!.low);
  const unpriced = all.filter((r) => !r.range);

  for (let i = 0; i < rows.length; i++) {
    for (let j = i + 1; j < rows.length; j++) {
      const a = rows[i];
      const b = rows[j];
      if (a.kind.trim().toLowerCase() === b.kind.trim().toLowerCase()) continue;
      if (gapPct(a.range!, b.range!) <= bandPct) {
        a.confluence.push(`${b.name} ${b.priceText}`);
        b.confluence.push(`${a.name} ${a.priceText}`);
      }
    }
  }

  const reference = parsePriceRange(desk.referencePrice?.value);
  let referenceIndex: number | null = null;
  if (reference) {
    const idx = rows.findIndex((r) => (r.range!.high + r.range!.low) / 2 < reference.high);
    referenceIndex = idx === -1 ? rows.length : idx;
  }
  return { rows, unpriced, reference, referenceIndex, bandPct };
}

/** "Above: … · Below: …" — the nearest level each side of the reference price. */
export function nearestLevels(ladder: Ladder): { above?: LadderRow; below?: LadderRow; inside: LadderRow[] } {
  if (!ladder.reference) return { inside: [] };
  const p = ladder.reference.high;
  const inside = ladder.rows.filter((r) => r.range!.low <= p && r.range!.high >= p && r.range!.low !== r.range!.high);
  const above = [...ladder.rows].reverse().find((r) => r.range!.low > p);
  const below = ladder.rows.find((r) => r.range!.high < p);
  return { above, below, inside };
}
