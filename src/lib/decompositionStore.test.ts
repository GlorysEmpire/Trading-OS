/**
 * M2: the data layer round-trips the contract without losing anything, and
 * saves through the append-only rules. The database rules themselves
 * (append-only, one plan per candle, review after close, owner-only) are
 * checked against Postgres separately; here a small in-memory client stands
 * in for Supabase. Prices and times are synthetic fixtures.
 */
import { describe, expect, it } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  insertPeriodPlan, insertReview, layerFromRow, layerToRow, loadPeriodPlans, loadStructuralRecords, newLayers, planFromRow, planToRow,
  attachCandlestickRead, createStructuralRecord, saveStructuralUpdate, savePlanRead,
} from './decompositionStore';
import {
  PLACEHOLDER_DEFINITIONS as DEFS, answerPeriodStep, appendLayerVersion, evaluatePeriodPlan, startPeriodPlan, summarize,
  type PeriodPlan,
} from '../decomposition';
import { fixtureDailyBearish, fixtureDecomposition, fixturePeriodRead, fixtureWeeklyBearish } from '../decomposition/fixtures';
import { candleObservation, type CandlestickRead } from '../decomposition/candlestick';

const UID = 'user-1';

/** Minimal in-memory stand-in for the Supabase query builder (only what the store uses). */
function fakeSupabase() {
  const tables: Record<string, Record<string, unknown>[]> = {};
  const from = (table: string) => {
    const rows = (tables[table] ??= []);
    let filters: Array<(r: Record<string, unknown>) => boolean> = [];
    let pendingInsert: Record<string, unknown>[] | null = null;
    let pendingUpdate: Record<string, unknown> | null = null;
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (c: string, v: unknown) => { filters.push((r) => c === 'read' ? JSON.stringify(r[c]) === v : r[c] === v); return api; },
      gt: (c: string, v: string) => { filters.push((r) => Date.parse(r[c] as string) > Date.parse(v)); return api; },
      in: (c: string, vs: unknown[]) => { filters.push((r) => vs.includes(r[c])); return api; },
      order: () => api,
      insert: (row: Record<string, unknown>) => {
        const now = new Date('2026-11-23T10:00:00Z').toISOString();
        const full = { created_at: now, ...row } as Record<string, unknown>;
        if (table === 'trading_os_period_plans' && rows.some((r) => r.desk_id === full.desk_id && r.cadence === full.cadence && r.candle_open === full.candle_open && r.feed === full.feed)) {
          pendingInsert = null;
          (api as { _err: unknown })._err = { code: '23505', message: 'duplicate key' };
          return api;
        }
        if (table === 'trading_os_period_reviews') full.saved_at = now;
        rows.push(full);
        pendingInsert = [full];
        return api;
      },
      update: (patch: Record<string, unknown>) => { pendingUpdate = patch; return api; },
      single: () => Promise.resolve(api._err ? { data: null, error: api._err } : { data: pendingInsert?.[0] ?? null, error: null }),
      maybeSingle: () => {
        const row = rows.find((r) => filters.every((f) => f(r)));
        if (row && pendingUpdate) Object.assign(row, pendingUpdate);
        return Promise.resolve({ data: row ?? null, error: null });
      },
      then: (resolve: (v: unknown) => void) => {
        if (api._err) return resolve({ data: null, error: api._err });
        if (pendingUpdate) { rows.filter((r) => filters.every((f) => f(r))).forEach((r) => Object.assign(r, pendingUpdate)); return resolve({ error: null }); }
        if (pendingInsert) return resolve({ data: pendingInsert, error: null });
        const out = rows.filter((r) => filters.every((f) => f(r)));
        filters = [];
        return resolve({ data: out, error: null });
      },
    };
    return api;
  };
  return { client: { from } as unknown as SupabaseClient, tables };
}

describe('row mapping round-trips the contract', () => {
  it('layer versions and plans come back exactly as they went in', () => {
    const rec = appendLayerVersion(fixtureDecomposition({ id: 'rec-1' }), { id: 'l1', asOf: '2026-11-22T17:30:00.000Z', createdAt: '2026-11-22T18:00:00.000Z', definitionsVersion: DEFS.version, data: fixtureDailyBearish() });
    const layer = rec.layers[0];
    expect(layerFromRow({ ...layerToRow(layer, UID), created_at: layer.createdAt, locked_at: null })).toEqual(layer);

    const plan = startPeriodPlan({
      id: 'p1', cadence: 'DAY', candle: { symbol: 'FIXTURE-ASSET', feed: 'FIXTURE-FEED', openTime: '2026-11-23T00:00:00.000Z', closeTime: '2026-11-24T00:00:00.000Z' },
      createdAt: '2026-11-23T05:05:00.000Z', structural: rec, gate: { answeredAt: 'x', structureChanged: false, reasons: [] }, definitionsVersion: DEFS.version,
    });
    expect(planFromRow({ ...planToRow(plan, UID), created_at: plan.createdAt })).toEqual(plan);
  });
  it('normalises database timestamps (+00:00) to the ISO form the period key uses', () => {
    const p = planFromRow({ ...planToRow({ ...({} as PeriodPlan), id: 'p', deskId: 'd', cadence: 'DAY', mode: 'LIVE', createdAt: 'x', candle: { symbol: 'S', feed: 'F', openTime: 'x' }, structuralVersionRef: { structuralRecordId: 'r', revision: 1, layerIds: {} }, gate: { answeredAt: 'x', structureChanged: false, reasons: [] }, definitionsVersion: 'v', read: {} }, UID), candle_open: '2026-11-23 00:00:00+00', created_at: '2026-11-23T05:05:00+00:00' });
    expect(p.candle.openTime).toBe('2026-11-23T00:00:00.000Z');
  });
});

describe('Journey 1 through the store: map → daily plan → summary, no retyping', () => {
  it('saves the structural map, starts and fills a daily plan, and reads it back with the same verdict', async () => {
    const { client, tables } = fakeSupabase();
    let rec = await createStructuralRecord(client, UID, { deskId: 'desk-1', symbol: 'FIXTURE-ASSET', mode: 'LIVE' });
    rec = await saveStructuralUpdate(client, UID, rec, [
      { asOf: '2026-11-22T17:30:00.000Z', data: fixtureWeeklyBearish() },
      { asOf: '2026-11-22T17:30:00.000Z', data: fixtureDailyBearish() },
    ], DEFS.version);
    expect(tables.trading_os_structural_layers.map((l) => [l.timeframe, l.version])).toEqual([['WEEKLY', 1], ['DAILY', 1]]);
    await expect(saveStructuralUpdate(client, UID, rec, [{ asOf: 'x', data: fixtureDailyBearish() }], DEFS.version)).rejects.toThrow(/No structural change/);

    const [loadedRec] = await loadStructuralRecords(client, UID, 'desk-1');
    expect(summarize(loadedRec, () => DEFS, DEFS).verdict).toBe('WATCH_POI');

    let plan = startPeriodPlan({
      id: 'plan-1', cadence: 'DAY', candle: { symbol: 'FIXTURE-ASSET', feed: 'FIXTURE-FEED', openTime: '2026-11-22T00:00:00.000Z', closeTime: '2026-11-23T00:00:00.000Z' },
      createdAt: 'x', structural: loadedRec, gate: { answeredAt: '2026-11-22T05:00:00.000Z', structureChanged: false, reasons: [] }, definitionsVersion: DEFS.version,
    });
    plan = await insertPeriodPlan(client, UID, plan);
    const read = fixturePeriodRead();
    for (const k of Object.keys(read) as Array<keyof typeof read>) plan = answerPeriodStep(plan, k, read[k] as never);
    await savePlanRead(client, UID, plan);
    await expect(insertPeriodPlan(client, UID, plan)).rejects.toThrow(/already a day plan/);

    const [loadedPlan] = await loadPeriodPlans(client, UID, { deskId: 'desk-1' });
    expect(loadedPlan.read).toEqual(plan.read);
    expect(evaluatePeriodPlan(loadedRec, loadedPlan, DEFS)).toMatchObject({ verdict: 'WATCH_POI', reason: 'Wait for price at POI A (17R to the draw).' });

    const candle = { ...plan.candle, openTime: '2026-11-21T00:00:00Z', closeTime: plan.candle.openTime };
    const candleRead: CandlestickRead = {
      asOf: '2026-11-22T12:00:00Z', observations: [candleObservation(candle, { prices: { open: 10, high: 12, low: 9, close: 11 } }, plan.candle.openTime)],
      answers: { invalidation: 'Prior low' }, narrative: 'Test candle narrative.',
    };
    const attached = await attachCandlestickRead(client, UID, loadedPlan, candleRead);
    expect(attached).toEqual({ ...loadedPlan.read, candlestickDecomposition: candleRead });
    await expect(attachCandlestickRead(client, UID, loadedPlan, candleRead)).rejects.toThrow(/plan changed/);
    const [withCandleRead] = await loadPeriodPlans(client, UID);
    expect(evaluatePeriodPlan(loadedRec, withCandleRead, DEFS)).toEqual(evaluatePeriodPlan(loadedRec, loadedPlan, DEFS));

    const reviewed = await insertReview(client, UID, loadedPlan, { savedAt: 'x', prediction: 'WRONG', process: 'CORRECT', lesson: 'Waited for the inducement.' });
    const [again] = await loadPeriodPlans(client, UID);
    expect(again.review).toEqual(reviewed.review);
    expect(again.read).toEqual(attached);
    await expect(attachCandlestickRead(client, UID, again, candleRead)).rejects.toThrow(/forecast can no longer change/);
  });
  it('newLayers returns only what an update added', () => {
    const a = appendLayerVersion(fixtureDecomposition(), { id: 'l1', asOf: 'x', createdAt: 'x', definitionsVersion: 'v', data: fixtureWeeklyBearish() });
    const b = appendLayerVersion(a, { id: 'l2', asOf: 'x', createdAt: 'x', definitionsVersion: 'v', data: fixtureDailyBearish() });
    expect(newLayers(a, b).map((l) => l.id)).toEqual(['l2']);
  });
});
