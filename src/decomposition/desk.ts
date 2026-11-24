/**
 * What the Asset Desk shows from the decomposition (M4). Pure: the desk
 * never re-enters this data, it only displays it (UX rule 7: summary first,
 * one line each for structure → month → week → today).
 */
import type { Bias, Cadence, DailyLayer, DecompositionDefinitions, LayerVerdict, PeriodPlan, Poi, StructuralRecord, WeeklyLayer } from './types';
import { evaluateDaily, isIdentified, latestLayer, validRange } from './logic';
import { evaluatePeriodPlan } from './plans';
import { summarize } from './summary';
import { candleFor, candleLabel, type FeedProfile } from './feeds';

export interface StackLine {
  key: 'STRUCTURE' | Cadence;
  title: string;
  /** e.g. "Week of Nov 23" or "Map revision 3". */
  when?: string;
  bias?: Bias;
  draw?: number;
  poiA?: Poi;
  poiB?: Poi;
  invalidation?: number;
  verdict?: LayerVerdict;
  /** Shown when there is nothing yet (e.g. "No weekly plan yet"). */
  missing?: string;
  /** True when the line is an older plan, not for the current candle. */
  stale?: boolean;
  planId?: string;
  /** STRUCTURE only: when each layer was read (each keeps its own time). */
  asOf?: Partial<Record<'MONTHLY' | 'WEEKLY' | 'DAILY', string>>;
}

const sideBias = (p?: Poi): Bias | undefined => (p ? (p.side === 'SELL' ? 'BEARISH' : 'BULLISH') : undefined);

function planLine(plan: PeriodPlan, map: StructuralRecord | undefined, defs: DecompositionDefinitions, profile: FeedProfile, current: boolean): StackLine {
  const r = plan.read;
  const f = isIdentified(r.formation) ? r.formation.value : undefined;
  return {
    key: plan.cadence,
    title: plan.cadence === 'MONTH' ? 'Month' : plan.cadence === 'WEEK' ? 'Week' : 'Today',
    when: candleLabel(plan.cadence, plan.candle, profile),
    bias: sideBias(f?.primary),
    draw: isIdentified(r.draw) ? r.draw.value.target : undefined,
    poiA: f?.primary,
    poiB: f?.backup,
    invalidation: isIdentified(r.invalidation) ? r.invalidation.value.price : undefined,
    verdict: map ? safeVerdict(() => evaluatePeriodPlan(map, plan, defs).verdict) : undefined,
    stale: !current,
    planId: plan.id,
  };
}

function safeVerdict(fn: () => LayerVerdict): LayerVerdict | undefined {
  try { return fn(); } catch { return undefined; }
}

/** The desk stack: structural story, then the latest Month, Week and Day plans. */
export function deskStack(input: {
  deskId: string;
  symbol: string;
  map?: StructuralRecord;
  plans: PeriodPlan[];
  now: string;
  profile: FeedProfile;
  definitionsFor: (v: string) => DecompositionDefinitions | undefined;
  current: DecompositionDefinitions;
}): StackLine[] {
  const { map, profile } = input;
  const lines: StackLine[] = [];
  const daily = map ? latestLayer(map, 'DAILY') : undefined;
  if (!map || !daily) {
    lines.push({ key: 'STRUCTURE', title: 'Structure', missing: 'No structural map yet' });
  } else {
    const s = summarize(map, input.definitionsFor, input.current);
    const d = daily.data as DailyLayer;
    const pois = isIdentified(d.pois) ? d.pois.value : {};
    const weekly = latestLayer(map, 'WEEKLY')?.data as WeeklyLayer | undefined;
    lines.push({
      key: 'STRUCTURE',
      title: 'Structure',
      when: `Map revision ${map.layers.length}`,
      bias: s.daily?.bias !== 'NEUTRAL' ? s.daily?.bias : s.weekly?.bias,
      draw: s.daily?.target ?? (weekly && isIdentified(weekly.draw) ? weekly.draw.value.below ?? weekly.draw.value.above : undefined),
      poiA: pois.primary,
      poiB: pois.backup,
      invalidation: s.daily?.invalidation,
      verdict: safeVerdict(() => evaluateDaily(d, input.definitionsFor(daily.definitionsVersion) ?? input.current).verdict),
      asOf: Object.fromEntries((['MONTHLY', 'WEEKLY', 'DAILY'] as const).map((tf) => [tf, latestLayer(map, tf)?.asOf]).filter(([, v]) => v)),
    });
  }
  for (const cadence of ['MONTH', 'WEEK', 'DAY'] as Cadence[]) {
    const mine = input.plans.filter((p) => p.deskId === input.deskId && p.cadence === cadence && p.mode === 'LIVE')
      .sort((a, b) => b.candle.openTime.localeCompare(a.candle.openTime));
    const now = candleFor(cadence, input.now, profile, input.symbol);
    const currentPlan = mine.find((p) => Date.parse(p.candle.openTime) === Date.parse(now.openTime));
    const title = cadence === 'MONTH' ? 'Month' : cadence === 'WEEK' ? 'Week' : 'Today';
    if (currentPlan) lines.push(planLine(currentPlan, map, input.current, profile, true));
    else lines.push({ key: cadence, title, when: candleLabel(cadence, now, profile), missing: `No ${cadence === 'DAY' ? 'daily' : cadence === 'WEEK' ? 'weekly' : 'monthly'} plan yet` });
  }
  return lines;
}

/** Map levels for the Levels ladder (read-only there; edited only through decomposition). */
export interface MapLevel { id: string; name: string; kind: string; low: number; high: number; source: string }

export function mapLevels(map?: StructuralRecord): MapLevel[] {
  if (!map) return [];
  const out: MapLevel[] = [];
  const add = (l: MapLevel) => { if (Number.isFinite(l.low) && Number.isFinite(l.high)) out.push(l); };
  const daily = latestLayer(map, 'DAILY')?.data as DailyLayer | undefined;
  for (const tf of ['MONTHLY', 'WEEKLY'] as const) {
    const l = latestLayer(map, tf)?.data as WeeklyLayer | undefined;
    const name = tf === 'MONTHLY' ? 'Monthly' : 'Weekly';
    if (l && isIdentified(l.pois)) l.pois.value.forEach((p) => add({ id: `${tf}-${p.id}`, name: p.label, kind: `POI · ${p.kind}`, low: p.low, high: p.high, source: `Map · ${name}` }));
    if (l && isIdentified(l.draw)) {
      if (l.draw.value.above !== undefined) add({ id: `${tf}-draw-up`, name: `${name} draw above`, kind: 'Draw', low: l.draw.value.above, high: l.draw.value.above, source: `Map · ${name}` });
      if (l.draw.value.below !== undefined) add({ id: `${tf}-draw-down`, name: `${name} draw below`, kind: 'Draw', low: l.draw.value.below, high: l.draw.value.below, source: `Map · ${name}` });
    }
  }
  if (daily) {
    if (isIdentified(daily.liquidity)) {
      for (const l of daily.liquidity.value.levels) {
        const kind = l.kind.replace('_', ' ').toLowerCase().replace(/^\w/, (c) => c.toUpperCase());
        const isInd = daily.liquidity.value.inducementId === l.id;
        const base = l.label || kind;
        add({ id: `D-${l.id}`, name: `${base}${isInd && !/inducement/i.test(base) ? ' (inducement)' : ''}${l.swept ? ' · swept' : ''}`, kind, low: l.price, high: l.price, source: 'Map · Daily' });
      }
    }
    if (isIdentified(daily.pois)) {
      const { primary, backup } = daily.pois.value;
      const named = (tag: string, label: string) => (label.trim() === tag ? tag : `${tag} · ${label}`);
      if (primary) add({ id: 'D-poi-a', name: named('POI A', primary.label), kind: `POI · ${primary.kind}`, low: primary.low, high: primary.high, source: 'Map · Daily' });
      if (backup) add({ id: 'D-poi-b', name: named('POI B', backup.label), kind: `POI · ${backup.kind}`, low: backup.low, high: backup.high, source: 'Map · Daily' });
    }
    if (isIdentified(daily.dealingRange) && validRange(daily.dealingRange.value)) {
      const r = daily.dealingRange.value;
      add({ id: 'D-eq', name: 'Daily equilibrium', kind: 'Equilibrium', low: (r.high + r.low) / 2, high: (r.high + r.low) / 2, source: 'Map · Daily' });
    }
    if (isIdentified(daily.targetInvalidation)) {
      add({ id: 'D-target', name: 'Daily target', kind: 'Target', low: daily.targetInvalidation.value.target, high: daily.targetInvalidation.value.target, source: 'Map · Daily' });
      add({ id: 'D-inv', name: 'Daily invalidation', kind: 'Invalidation', low: daily.targetInvalidation.value.invalidation, high: daily.targetInvalidation.value.invalidation, source: 'Map · Daily' });
    }
  }
  return out;
}

/** POIs a scenario can link to (one tap), keyed by a stable id. */
export function mapPois(map?: StructuralRecord): Array<{ id: string; label: string; poi: Poi }> {
  if (!map) return [];
  const out: Array<{ id: string; label: string; poi: Poi }> = [];
  const daily = latestLayer(map, 'DAILY')?.data as DailyLayer | undefined;
  if (daily && isIdentified(daily.pois)) {
    if (daily.pois.value.primary) out.push({ id: daily.pois.value.primary.id, label: 'Daily POI A', poi: daily.pois.value.primary });
    if (daily.pois.value.backup) out.push({ id: daily.pois.value.backup.id, label: 'Daily POI B', poi: daily.pois.value.backup });
  }
  for (const tf of ['WEEKLY', 'MONTHLY'] as const) {
    const l = latestLayer(map, tf)?.data as WeeklyLayer | undefined;
    const name = tf === 'WEEKLY' ? 'Weekly' : 'Monthly';
    if (l && isIdentified(l.pois)) l.pois.value.forEach((p) => out.push({ id: p.id, label: p.label.startsWith(name) ? p.label : `${name} · ${p.label}`, poi: p }));
  }
  const seen = new Set<string>();
  return out.filter((x) => (seen.has(x.id) ? false : (seen.add(x.id), true)));
}

/** Resolves a scenario's linked POI ids against any version of the map (old links stay readable). */
export function resolvePoi(map: StructuralRecord | undefined, poiId: string): { poi: Poi; current: boolean } | undefined {
  if (!map) return undefined;
  const current = mapPois(map).find((x) => x.id === poiId);
  if (current) return { poi: current.poi, current: true };
  for (const l of [...map.layers].reverse()) {
    let pois: Array<Poi | undefined> = [];
    if (l.data.timeframe === 'DAILY') { const d = l.data as DailyLayer; if (isIdentified(d.pois)) pois = [d.pois.value.primary, d.pois.value.backup]; }
    else if (l.data.timeframe === 'WEEKLY' || l.data.timeframe === 'MONTHLY') { const w = l.data as WeeklyLayer; if (isIdentified(w.pois)) pois = w.pois.value; }
    const hit = pois.find((p) => p?.id === poiId);
    if (hit) return { poi: hit, current: false };
  }
  return undefined;
}
