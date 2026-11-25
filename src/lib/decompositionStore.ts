import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';
import { candleReadMatchesPeriod } from '../decomposition/candlestick';
import {
  updateStructure, type Cadence, type DecompositionMode, type LayerData, type LayerTimeframe, type LayerVersion, type PeriodGateCheck,
  type PeriodPlan, type PeriodReview, type StructuralRecord, type StructuralVersionRef,
} from '../decomposition';

/**
 * M2 data layer for Market Decomposition. Row mapping is pure and tested;
 * the database enforces append-only layers, plan immutability after review,
 * one plan per candle, and reviews only after the candle close
 * (supabase/migrations/20261123010000_market_decomposition.sql).
 */

const iso = (t: string | null | undefined) => (t ? new Date(t).toISOString() : undefined);
const newId = () => (globalThis.crypto?.randomUUID ? globalThis.crypto.randomUUID() : `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`);

// ---- Row shapes ------------------------------------------------------------------

export interface StructuralRecordRow {
  id: string; user_id: string; desk_id: string; symbol: string; mode: DecompositionMode;
  research_question_id: string | null; outcome: StructuralRecord['outcome'] | null; created_at: string;
}
export interface StructuralLayerRow {
  id: string; user_id: string; structural_record_id: string; timeframe: LayerTimeframe; version: number;
  as_of: string; definitions_version: string; data: LayerData; locked_at: string | null; created_at: string;
}
export interface PeriodPlanRow {
  id: string; user_id: string; desk_id: string; cadence: Cadence; symbol: string; feed: string;
  candle_open: string; candle_close: string | null; mode: DecompositionMode;
  structural_record_id: string; structural_revision: number; structural_layer_ids: StructuralVersionRef['layerIds'];
  parent_plan_id: string | null; gate: PeriodGateCheck; definitions_version: string; read: PeriodPlan['read']; created_at: string;
}
export interface PeriodReviewRow { plan_id: string; user_id: string; saved_at: string; prediction: PeriodReview['prediction']; process: PeriodReview['process']; lesson: string }

// ---- Pure mapping ----------------------------------------------------------------

export function layerFromRow(r: StructuralLayerRow): LayerVersion {
  return {
    id: r.id, decompositionId: r.structural_record_id, timeframe: r.timeframe, version: r.version,
    asOf: iso(r.as_of)!, definitionsVersion: r.definitions_version, createdAt: iso(r.created_at)!, data: r.data,
    ...(r.locked_at ? { lockedAt: iso(r.locked_at) } : {}),
  };
}

export function layerToRow(l: LayerVersion, userId: string): Omit<StructuralLayerRow, 'created_at' | 'locked_at'> {
  return {
    id: l.id, user_id: userId, structural_record_id: l.decompositionId, timeframe: l.timeframe, version: l.version,
    as_of: l.asOf, definitions_version: l.definitionsVersion, data: l.data,
  };
}

export function recordFromRows(r: StructuralRecordRow, layers: StructuralLayerRow[]): StructuralRecord {
  return {
    id: r.id, deskId: r.desk_id, symbol: r.symbol, mode: r.mode, createdAt: iso(r.created_at)!,
    layers: layers.filter((l) => l.structural_record_id === r.id).map(layerFromRow).sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.version - b.version),
    ...(r.outcome ? { outcome: r.outcome } : {}),
    ...(r.research_question_id ? { researchQuestionId: r.research_question_id } : {}),
  };
}

export function planFromRow(r: PeriodPlanRow, review?: PeriodReviewRow): PeriodPlan {
  return {
    id: r.id, deskId: r.desk_id, cadence: r.cadence,
    candle: { symbol: r.symbol, feed: r.feed, openTime: iso(r.candle_open)!, ...(r.candle_close ? { closeTime: iso(r.candle_close) } : {}) },
    mode: r.mode, createdAt: iso(r.created_at)!,
    structuralVersionRef: { structuralRecordId: r.structural_record_id, revision: r.structural_revision, layerIds: r.structural_layer_ids },
    ...(r.parent_plan_id ? { parentPlanId: r.parent_plan_id } : {}),
    gate: r.gate, definitionsVersion: r.definitions_version, read: r.read ?? {},
    ...(review ? { review: { savedAt: iso(review.saved_at)!, prediction: review.prediction, process: review.process, lesson: review.lesson } } : {}),
  };
}

export function planToRow(p: PeriodPlan, userId: string): Omit<PeriodPlanRow, 'created_at'> {
  return {
    id: p.id, user_id: userId, desk_id: p.deskId, cadence: p.cadence, symbol: p.candle.symbol, feed: p.candle.feed,
    candle_open: p.candle.openTime, candle_close: p.candle.closeTime ?? null, mode: p.mode,
    structural_record_id: p.structuralVersionRef.structuralRecordId, structural_revision: p.structuralVersionRef.revision,
    structural_layer_ids: p.structuralVersionRef.layerIds, parent_plan_id: p.parentPlanId ?? null,
    gate: p.gate, definitions_version: p.definitionsVersion, read: p.read,
  };
}

/** The layer versions a structural update added (to insert), in order. */
export function newLayers(before: StructuralRecord, after: StructuralRecord): LayerVersion[] {
  const had = new Set(before.layers.map((l) => l.id));
  return after.layers.filter((l) => !had.has(l.id));
}

/** Plain message for the database's own rule errors (they are already plain). */
function fail(error: { message?: string; code?: string } | null): never {
  if (error?.code === '42P01' || /trading_os_(structural|period)/.test(error?.message ?? '') && /does not exist/.test(error?.message ?? '')) {
    throw new Error('Market decomposition needs its one-time database update before records can be saved.');
  }
  throw toSupabaseError(error ?? { message: 'Unknown database error' });
}

// ---- Structural records --------------------------------------------------------------

export async function loadStructuralRecords(supabase: SupabaseClient, userId: string, deskId?: string): Promise<StructuralRecord[]> {
  let q = supabase.from('trading_os_structural_records').select('*').eq('user_id', userId);
  if (deskId) q = q.eq('desk_id', deskId);
  const { data: recs, error } = await q.order('created_at');
  if (error) fail(error);
  const ids = (recs ?? []).map((r) => r.id);
  if (!ids.length) return [];
  const { data: layers, error: e2 } = await supabase.from('trading_os_structural_layers').select('*').in('structural_record_id', ids);
  if (e2) fail(e2);
  return (recs as StructuralRecordRow[]).map((r) => recordFromRows(r, (layers ?? []) as StructuralLayerRow[]));
}

export async function createStructuralRecord(
  supabase: SupabaseClient, userId: string,
  input: { deskId: string; symbol: string; mode: DecompositionMode; researchQuestionId?: string },
): Promise<StructuralRecord> {
  const row = { id: newId(), user_id: userId, desk_id: input.deskId, symbol: input.symbol, mode: input.mode, research_question_id: input.researchQuestionId ?? null };
  const { data, error } = await supabase.from('trading_os_structural_records').insert(row).select('*').single();
  if (error) fail(error);
  return recordFromRows(data as StructuralRecordRow, []);
}

/**
 * Saves a structural update: only the layers that changed become new
 * versions (contract `updateStructure`), inserted in order. Returns the
 * record as stored (the database sets created/locked times).
 */
export async function saveStructuralUpdate(
  supabase: SupabaseClient, userId: string, record: StructuralRecord,
  layers: Array<{ asOf: string; data: LayerData }>, definitionsVersion: string,
): Promise<StructuralRecord> {
  const next = updateStructure(record, layers.map((l) => ({ id: newId(), ...l })), { createdAt: new Date().toISOString(), definitionsVersion });
  for (const l of newLayers(record, next)) {
    const { error } = await supabase.from('trading_os_structural_layers').insert(layerToRow(l, userId));
    if (error) fail(error);
  }
  const [stored] = await loadStructuralRecords(supabase, userId, record.deskId).then((all) => all.filter((r) => r.id === record.id));
  return stored ?? next;
}

// ---- Period plans ----------------------------------------------------------------------

export async function loadPeriodPlans(supabase: SupabaseClient, userId: string, filter: { deskId?: string; cadence?: Cadence } = {}): Promise<PeriodPlan[]> {
  let q = supabase.from('trading_os_period_plans').select('*').eq('user_id', userId);
  if (filter.deskId) q = q.eq('desk_id', filter.deskId);
  if (filter.cadence) q = q.eq('cadence', filter.cadence);
  const { data: plans, error } = await q.order('candle_open', { ascending: false });
  if (error) fail(error);
  const ids = (plans ?? []).map((p) => p.id);
  const reviews = new Map<string, PeriodReviewRow>();
  if (ids.length) {
    const { data, error: e2 } = await supabase.from('trading_os_period_reviews').select('*').in('plan_id', ids);
    if (e2) fail(e2);
    for (const r of (data ?? []) as PeriodReviewRow[]) reviews.set(r.plan_id, r);
  }
  return ((plans ?? []) as PeriodPlanRow[]).map((p) => planFromRow(p, reviews.get(p.id)));
}

/** Inserts a plan made by the contract's startPeriodPlan (give it an id from `newPlanId`). */
export async function insertPeriodPlan(supabase: SupabaseClient, userId: string, plan: PeriodPlan): Promise<PeriodPlan> {
  const { data, error } = await supabase.from('trading_os_period_plans').insert(planToRow(plan, userId)).select('*').single();
  if (error?.code === '23505') throw new Error(`There is already a ${plan.cadence.toLowerCase()} plan for this ${plan.cadence === 'DAY' ? 'day' : plan.cadence === 'WEEK' ? 'week' : 'month'} on ${plan.candle.symbol} (${plan.candle.feed}).`);
  if (error) fail(error);
  return planFromRow(data as PeriodPlanRow);
}

/** Saves the plan's answers (allowed until it is reviewed). */
export async function savePlanRead(supabase: SupabaseClient, userId: string, plan: PeriodPlan): Promise<void> {
  const { error } = await supabase.from('trading_os_period_plans').update({ read: plan.read }).eq('id', plan.id).eq('user_id', userId);
  if (error) fail(error);
}

/** Attach a forward candle read without replacing a newer plan edit or a closed forecast. */
export async function attachCandlestickRead(
  supabase: SupabaseClient, userId: string, plan: PeriodPlan,
  candlestickDecomposition: NonNullable<PeriodPlan['read']['candlestickDecomposition']>,
): Promise<PeriodPlan['read']> {
  const { asOf } = candlestickDecomposition;
  if (plan.review || plan.mode !== 'LIVE' || !(Date.parse(asOf) < Date.parse(plan.candle.closeTime ?? ''))) {
    throw new Error('This candle is closed. Its forecast can no longer change.');
  }
  if (!candleReadMatchesPeriod(candlestickDecomposition, plan.candle)) throw new Error('The completed candle evidence does not match this plan.');
  const read = { ...plan.read, candlestickDecomposition };
  const { data, error } = await supabase.from('trading_os_period_plans').update({ read })
    .eq('id', plan.id).eq('user_id', userId).eq('read', JSON.stringify(plan.read)).gt('candle_close', asOf)
    .select('read').maybeSingle();
  if (error) fail(error);
  if (!data) throw new Error('The plan changed while you were editing. Refresh the desk to attach this draft.');
  return data.read as PeriodPlan['read'];
}

/** Records the candle close time once, when the chart prints it. */
export async function setCandleClose(supabase: SupabaseClient, userId: string, planId: string, closeTime: string): Promise<void> {
  const { error } = await supabase.from('trading_os_period_plans').update({ candle_close: closeTime }).eq('id', planId).eq('user_id', userId);
  if (error) fail(error);
}

/** Saves the review (once). The database refuses it before the candle close. */
export async function insertReview(supabase: SupabaseClient, userId: string, plan: PeriodPlan, review: PeriodReview): Promise<PeriodPlan> {
  const { data, error } = await supabase.from('trading_os_period_reviews')
    .insert({ plan_id: plan.id, user_id: userId, prediction: review.prediction, process: review.process, lesson: review.lesson })
    .select('*').single();
  if (error?.code === '23505') throw new Error('This plan is already reviewed; a saved review cannot change.');
  if (error) fail(error);
  const r = data as PeriodReviewRow;
  return { ...plan, review: { savedAt: iso(r.saved_at)!, prediction: r.prediction, process: r.process, lesson: r.lesson } };
}

export const newPlanId = newId;

// ---- Backtests (M5) ------------------------------------------------------------------

/** Records a backtest's outcome once (database function; refuses a second time or without a Daily read). */
export async function recordBacktestOutcome(supabase: SupabaseClient, recordId: string, outcome: Omit<NonNullable<StructuralRecord['outcome']>, 'recordedAt'>): Promise<NonNullable<StructuralRecord['outcome']>> {
  const { data, error } = await supabase.rpc('trading_os_record_backtest_outcome', { p_record_id: recordId, p_outcome: outcome });
  if (error?.code === '42883' || error?.code === 'PGRST202') throw new Error('Backtest outcomes need a one-time database update before they can be saved.');
  if (error) fail(error);
  return data as NonNullable<StructuralRecord['outcome']>;
}
