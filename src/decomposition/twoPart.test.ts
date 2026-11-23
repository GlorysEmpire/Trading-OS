/**
 * Process tests 9–11 (architecture §9) and the M0.1 two-part rules:
 * Structural Record (M/W/D/4H, append-only, new version only on change) and
 * Daily Record (per asset per trading day, pinned to a structural version).
 * All prices are synthetic fixtures.
 */
import { describe, expect, it } from 'vitest';
import {
  DAILY_READ_KEYS, DAILY_READ_STEPS, PLACEHOLDER_DEFINITIONS as DEFS, STRUCTURAL_STEPS, answerDailyStep, canPlanSetups, currentStructuralRef,
  evaluateDailyRecord, evaluateH4, isStructureNewer, latestLayer, morningGate, nextDailyReadStep, resolveStructural, startDailyRecord,
  structureChanged, summarizeDailyRecord, updateStructure,
  type DailyRead, type DailyRecord, type MorningCheck, type StructuralRecord,
} from './index';
import { fixtureDailyBearish, fixtureDailyRead, fixtureDecomposition, fixtureH4Aligned, fixturePoi, fixtureWeeklyBearish } from './fixtures';

const META = { definitionsVersion: DEFS.version };
const lookup = (v: string) => (v === DEFS.version ? DEFS : undefined);

/** Map built in last night's backtesting block (Lagos 18:30 = NY 12:30 in November). */
const buildMap = (): StructuralRecord =>
  updateStructure(fixtureDecomposition({ id: 'struct-1' }), [
    { id: 'w1', asOf: '2026-11-22T17:30:00Z', data: fixtureWeeklyBearish() },
    { id: 'd1', asOf: '2026-11-22T17:30:00Z', data: fixtureDailyBearish() },
    { id: 'h1', asOf: '2026-11-22T17:30:00Z', data: fixtureH4Aligned() },
  ], { ...META, createdAt: '2026-11-22T18:00:00Z' });

const noChange: MorningCheck = { answeredAt: '2026-11-23T06:00:00Z', structureChanged: false, reasons: [] };
const changed: MorningCheck = { answeredAt: '2026-11-23T06:00:00Z', structureChanged: true, reasons: ['DAILY_CHOCH'] };

const fillDay = (rec: DailyRecord, read: DailyRead = fixtureDailyRead()) =>
  DAILY_READ_KEYS.reduce((acc, k) => answerDailyStep(acc, k, read[k] as never), rec);

describe('Journey 9 — a daily record needs a structural record', () => {
  it('refuses to start without a structural map, and says why', () => {
    expect(morningGate(undefined, noChange).next).toBe('BUILD_STRUCTURE');
    expect(() => startDailyRecord({ id: 'day-1', tradingDay: '2026-11-23', createdAt: '2026-11-23T06:05:00Z', structural: undefined, morningCheck: noChange, ...META }))
      .toThrow(/Build the structural map first/);
  });
  it('also refuses a map that has no Daily layer yet', () => {
    const weeklyOnly = updateStructure(fixtureDecomposition(), [{ id: 'w', asOf: 'x', data: fixtureWeeklyBearish() }], { ...META, createdAt: 'x' });
    expect(morningGate(weeklyOnly, noChange).next).toBe('BUILD_STRUCTURE');
  });
  it('asks the morning question before starting', () => {
    const gate = morningGate(buildMap(), undefined);
    expect(gate.next).toBe('ANSWER_MORNING_CHECK');
    expect(gate.reason).toMatch(/Did structure change overnight/);
  });
});

describe('Journey 10 — overnight structural change forces a structural update first', () => {
  it('blocks the daily record until the map is updated, then starts on the new version', () => {
    const map = buildMap();
    const gate = morningGate(map, changed);
    expect(gate.next).toBe('UPDATE_STRUCTURE');
    expect(gate.reason).toMatch(/daily choch/);
    expect(() => startDailyRecord({ id: 'day-1', tradingDay: '2026-11-23', createdAt: '2026-11-23T06:05:00Z', structural: map, morningCheck: changed, ...META }))
      .toThrow(/Update the structural map first/);

    const flipped = fixtureDailyBearish({ structure: { status: 'IDENTIFIED', value: { trend: 'BULLISH', lastBos: 118, bosKind: 'EXTERNAL' } } });
    const updated = updateStructure(map, [{ id: 'd2', asOf: '2026-11-23T06:10:00Z', data: flipped }], { ...META, createdAt: '2026-11-23T06:10:00Z' });
    expect(morningGate(updated, changed).next).toBe('START_DAILY');
    const day = startDailyRecord({ id: 'day-1', tradingDay: '2026-11-23', createdAt: '2026-11-23T06:15:00Z', structural: updated, morningCheck: changed, ...META });
    expect(day.structuralVersionRef.layerIds.DAILY).toBe('d2');
  });
  it('a "changed" answer must say what changed', () => {
    expect(morningGate(buildMap(), { ...changed, reasons: [] }).next).toBe('ANSWER_MORNING_CHECK');
  });
  it('no overnight change → the existing map is used, no new version', () => {
    const map = buildMap();
    expect(morningGate(map, noChange)).toEqual({ next: 'START_DAILY', reason: 'No overnight change. Use the existing map.' });
    const day = startDailyRecord({ id: 'day-1', tradingDay: '2026-11-23', createdAt: '2026-11-23T06:05:00Z', structural: map, morningCheck: noChange, ...META });
    expect(day.structuralVersionRef).toEqual({ structuralRecordId: 'struct-1', revision: 3, layerIds: { WEEKLY: 'w1', DAILY: 'd1', H4: 'h1' } });
  });
});

describe('Journey 11 — a daily record keeps its structural version', () => {
  it('still points at, and is judged on, the version it was built on after structure is updated later', () => {
    const map = buildMap();
    const day = fillDay(startDailyRecord({ id: 'day-1', tradingDay: '2026-11-23', createdAt: '2026-11-23T06:05:00Z', structural: map, morningCheck: noChange, ...META }));
    expect(evaluateDailyRecord(map, day, DEFS).verdict).toBe('WATCH_POI');

    // Later that day the Daily range is re-marked lower: POI A would now sit in equilibrium/discount.
    const later = updateStructure(map, [{ id: 'd2', asOf: '2026-11-23T17:30:00Z', data: fixtureDailyBearish({ dealingRange: { status: 'IDENTIFIED', value: { high: 140, low: 100, currentPrice: 108 } } }) }],
      { ...META, createdAt: '2026-11-23T18:00:00Z' });

    expect(day.structuralVersionRef.layerIds.DAILY).toBe('d1');
    expect(resolveStructural(later, day.structuralVersionRef).DAILY?.id).toBe('d1');
    expect(latestLayer(later, 'DAILY')?.id).toBe('d2');
    expect(isStructureNewer(later, day.structuralVersionRef)).toBe(true);
    expect(evaluateDailyRecord(later, day, DEFS).verdict).toBe('WATCH_POI'); // judged on d1, not d2

    const s = summarizeDailyRecord(later, day, lookup, DEFS);
    expect(s.structuralRevision).toBe(3);
    expect(s.structureMovedOn).toBe(true);
    expect(s.daily?.location).toBe('PREMIUM');
    expect(s.sentence).toMatch(/sell from POI A 112–114 toward 78 \(17R\)/);
  });
});

describe('structural record rules', () => {
  it('saves a new version only when structure changed', () => {
    const map = buildMap();
    expect(structureChanged(map, fixtureDailyBearish())).toBe(false);
    expect(() => updateStructure(map, [{ id: 'd2', asOf: 'x', data: fixtureDailyBearish() }], { ...META, createdAt: 'x' }))
      .toThrow(/No structural change/);
    const mixed = updateStructure(map, [
      { id: 'w2', asOf: 'x', data: fixtureWeeklyBearish() },
      { id: 'h2', asOf: 'x', data: { ...fixtureH4Aligned(), alignment: { status: 'IDENTIFIED', value: 'CONFLICT' } } },
    ], { ...META, createdAt: 'x' });
    expect(mixed.layers.map((l) => l.id)).toEqual(['w1', 'd1', 'h1', 'h2']);
    expect(map.layers).toHaveLength(3); // original untouched
  });
  it('key order does not count as a change', () => {
    const { targetInvalidation, ...rest } = fixtureDailyBearish();
    const reordered = { targetInvalidation, ...rest };
    expect(structureChanged(buildMap(), reordered)).toBe(false);
  });
  it('saves layers in Monthly → Weekly → Daily → 4H order, whatever order they are given', () => {
    const rec = updateStructure(fixtureDecomposition(), [
      { id: 'h', asOf: 'x', data: fixtureH4Aligned() },
      { id: 'm', asOf: 'x', data: { ...fixtureWeeklyBearish(), timeframe: 'MONTHLY' } },
      { id: 'd', asOf: 'x', data: fixtureDailyBearish() },
    ], { ...META, createdAt: 'x' });
    expect(rec.layers.map((l) => l.timeframe)).toEqual(['MONTHLY', 'DAILY', 'H4']);
    expect(currentStructuralRef(rec).layerIds).toEqual({ MONTHLY: 'm', DAILY: 'd', H4: 'h' });
  });
  it('a 4H conflict is noted and the Daily wins', () => {
    expect(evaluateH4({ ...fixtureH4Aligned(), alignment: { status: 'IDENTIFIED', value: 'CONFLICT' } }).reason).toMatch(/the Daily wins/);
    expect(evaluateH4({}).verdict).toBe('INCOMPLETE');
  });
  it('a ref only resolves on its own record', () => {
    const ref = currentStructuralRef(buildMap());
    expect(() => resolveStructural(fixtureDecomposition({ id: 'other' }), ref)).toThrow(/another structural record/);
  });
});

describe('daily record rules (reusing the M0 Daily gates)', () => {
  const start = () => startDailyRecord({ id: 'day-1', tradingDay: '2026-11-23', createdAt: '2026-11-23T06:05:00Z', structural: buildMap(), morningCheck: noChange, ...META });
  it('asks one step at a time, in order', () => {
    let day = start();
    expect(nextDailyReadStep(day)).toBe('priorCandle');
    day = answerDailyStep(day, 'priorCandle', fixtureDailyRead().priorCandle);
    expect(nextDailyReadStep(day)).toBe('liquidity');
    expect(nextDailyReadStep(fillDay(day))).toBeUndefined();
    expect(DAILY_READ_STEPS.map((s) => s.key)).toEqual([...DAILY_READ_KEYS]);
  });
  it('a sell POI in discount on today\'s read is rejected (M0 checkPoi), so no setups', () => {
    const read = { ...fixtureDailyRead(), pois: { status: 'IDENTIFIED' as const, value: { primary: fixturePoi({ high: 86, low: 84 }) } } };
    const day = fillDay(start(), read);
    expect(evaluateDailyRecord(buildMap(), day, DEFS).verdict).toBe('OBSERVATION_ONLY');
    expect(canPlanSetups(buildMap(), day, DEFS)).toBe(false);
  });
  it('a valid day read allows setups to link to it', () => {
    expect(canPlanSetups(buildMap(), fillDay(start()), DEFS)).toBe(true);
  });
  it('the structural flow runs Monthly → Weekly → Daily → 4H, one question per step', () => {
    const order = [...new Set(STRUCTURAL_STEPS.map((s) => s.timeframe))];
    expect(order).toEqual(['MONTHLY', 'WEEKLY', 'DAILY', 'H4']);
    expect(STRUCTURAL_STEPS.every((s) => s.question.endsWith('?'))).toBe(true);
  });
});
