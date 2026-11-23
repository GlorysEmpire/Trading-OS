/**
 * Daily Record (M0.1): one per asset per trading day, built in the sessions,
 * inside the structural story. It points at the exact structural version it
 * was built on and keeps pointing there even after the structure changes.
 *
 * The day's gates and POI checks reuse the M0 Daily logic: today's read is
 * laid over the referenced structural Daily layer and evaluated with
 * evaluateDaily / dailyPoiChecks / summarize.
 */
import type {
  DailyLayer, DailyRead, DailyRecord, DecompositionDefinitions, GateResult, MorningCheck, StructuralRecord,
} from './types';
import { evaluateDaily, isIdentified, type DraftDaily } from './logic';
import { currentStructuralRef, morningGate, resolveStructural } from './structural';
import { summarize, type DecompositionSummary } from './summary';

/** Steps of today's read, one question each, in order. */
export const DAILY_READ_KEYS = ['priorCandle', 'liquidity', 'depth', 'expectation', 'pois', 'draw', 'entryModels', 'session'] as const;
export type DailyReadKey = typeof DAILY_READ_KEYS[number];

/** Starts today's record. Refuses unless the morning gate says START_DAILY. */
export function startDailyRecord(input: {
  id: string;
  tradingDay: string;
  createdAt: string;
  structural: StructuralRecord | undefined;
  morningCheck: MorningCheck | undefined;
  definitionsVersion: string;
}): DailyRecord {
  const gate = morningGate(input.structural, input.morningCheck);
  if (gate.next !== 'START_DAILY') throw new Error(gate.reason);
  const rec = input.structural!;
  return {
    id: input.id,
    deskId: rec.deskId,
    symbol: rec.symbol,
    tradingDay: input.tradingDay,
    mode: rec.mode,
    createdAt: input.createdAt,
    structuralVersionRef: currentStructuralRef(rec),
    morningCheck: input.morningCheck!,
    definitionsVersion: input.definitionsVersion,
    read: {},
  };
}

/** Answers one step of today's read (returns a new record; the structural ref never changes). */
export function answerDailyStep<K extends DailyReadKey>(rec: DailyRecord, key: K, step: DailyRead[K]): DailyRecord {
  return { ...rec, read: { ...rec.read, [key]: step } };
}

export function nextDailyReadStep(rec: DailyRecord): DailyReadKey | undefined {
  return DAILY_READ_KEYS.find((k) => !rec.read[k]);
}

/** The structural Daily layer this record was built on. */
function baseDaily(structural: StructuralRecord, rec: DailyRecord): DailyLayer {
  const layers = resolveStructural(structural, rec.structuralVersionRef);
  const d = layers.DAILY;
  if (!d) throw new Error('This daily record has no structural Daily layer to build on.');
  return d.data as DailyLayer;
}

/** Today's read laid over the referenced structural Daily layer, in the M0 Daily shape. */
export function mergedDaily(structural: StructuralRecord, rec: DailyRecord): DraftDaily {
  const base = baseDaily(structural, rec);
  const r = rec.read;
  return {
    structure: base.structure,
    dealingRange: base.dealingRange,
    phase: base.phase,
    leg: base.leg,
    candles: r.priorCandle,
    // Today's liquidity view replaces the structural map when given.
    liquidity: r.liquidity ?? base.liquidity,
    depth: r.depth,
    pois: r.pois,
    targetInvalidation: r.draw,
  };
}

/** The day's verdict (leave the chart / observation only / watch POI), using M0's Daily gates. */
export function evaluateDailyRecord(structural: StructuralRecord, rec: DailyRecord, defs: DecompositionDefinitions): GateResult {
  return evaluateDaily(mergedDaily(structural, rec), defs);
}

/**
 * Summary of the day: the referenced structural layers plus today's read,
 * through the same summarize() the M0 card uses.
 */
export function summarizeDailyRecord(
  structural: StructuralRecord,
  rec: DailyRecord,
  definitionsFor: (version: string) => DecompositionDefinitions | undefined,
  current: DecompositionDefinitions,
): DecompositionSummary & { structuralRevision: number; structureMovedOn: boolean; tradingDay: string } {
  const layers = resolveStructural(structural, rec.structuralVersionRef);
  const merged = mergedDaily(structural, rec);
  const daily = layers.DAILY!;
  const view: StructuralRecord = {
    ...structural,
    layers: [
      ...(layers.WEEKLY ? [layers.WEEKLY] : []),
      { ...daily, version: daily.version, asOf: rec.createdAt, definitionsVersion: rec.definitionsVersion, data: { timeframe: 'DAILY', ...merged } as DailyLayer },
    ],
  };
  return {
    ...summarize(view, definitionsFor, current),
    structuralRevision: rec.structuralVersionRef.revision,
    structureMovedOn: structural.layers.length > rec.structuralVersionRef.revision,
    tradingDay: rec.tradingDay,
  };
}

/** True when today's read has a valid POI with enough R: setups may link to it. */
export function canPlanSetups(structural: StructuralRecord, rec: DailyRecord, defs: DecompositionDefinitions): boolean {
  return evaluateDailyRecord(structural, rec, defs).verdict === 'WATCH_POI' && isIdentified(rec.read.pois);
}
