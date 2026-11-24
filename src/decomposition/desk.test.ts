/**
 * M4 process tests: the Asset Desk only displays decomposition data (no retyping).
 * Journeys 1, 2 and 5 at the desk, plus scenario → POI links. Synthetic fixtures.
 */
import { describe, expect, it } from 'vitest';
import {
  FEED_PRESETS, PLACEHOLDER_DEFINITIONS as DEFS, answerPeriodStep, candleFor, deskStack, mapLevels, mapPois, periodStepsFor, resolvePoi,
  startPeriodPlan, updateStructure, type PeriodPlan, type StructuralRecord,
} from './index';
import { fixtureDailyBearish, fixtureDecomposition, fixturePeriodRead, fixturePoi, fixtureWeeklyBearish } from './fixtures';

const CRYPTO = FEED_PRESETS[0];
const NOW = '2026-11-24T08:00:00Z';
const meta = (createdAt: string) => ({ createdAt, definitionsVersion: DEFS.version });
const build = (): StructuralRecord => updateStructure(fixtureDecomposition({ id: 'rec', deskId: 'desk-1', symbol: 'FIXTURE-ASSET' }), [
  { id: 'w1', asOf: '2026-11-20T00:00:00Z', data: fixtureWeeklyBearish() },
  { id: 'd1', asOf: '2026-11-22T00:00:00Z', data: fixtureDailyBearish() },
], meta('2026-11-22T18:00:00Z'));
const stack = (map: StructuralRecord | undefined, plans: PeriodPlan[] = []) =>
  deskStack({ deskId: 'desk-1', symbol: 'FIXTURE-ASSET', map, plans, now: NOW, profile: CRYPTO, definitionsFor: () => DEFS, current: DEFS });
const dayPlan = (map: StructuralRecord) => {
  const read = fixturePeriodRead();
  return periodStepsFor('DAY').reduce((p, s) => answerPeriodStep(p, s.key, read[s.key] as never),
    startPeriodPlan({ id: 'day', cadence: 'DAY', candle: candleFor('DAY', NOW, CRYPTO, 'FIXTURE-ASSET'), createdAt: NOW, structural: map, gate: { answeredAt: NOW, structureChanged: false, reasons: [] }, definitionsVersion: DEFS.version }));
};

describe('Journey 1 at the desk: structure → month → week → today, without retyping', () => {
  it('shows bias, draw, POI A/B and invalidation from the map, and today from the daily plan', () => {
    const map = build();
    const [structure, month, week, today] = stack(map, [dayPlan(map)]);
    expect(structure).toMatchObject({ title: 'Structure', bias: 'BEARISH', draw: 78, invalidation: 121, verdict: 'WATCH_POI' });
    expect([structure.poiA?.low, structure.poiA?.high, structure.poiB?.low]).toEqual([112, 114, 116]);
    expect(month).toMatchObject({ title: 'Month', missing: 'No monthly plan yet', when: 'November 2026' });
    expect(week).toMatchObject({ missing: 'No weekly plan yet', when: 'Week of Nov 23' });
    expect(today).toMatchObject({ title: 'Today', bias: 'BEARISH', draw: 78, invalidation: 121, verdict: 'WATCH_POI', stale: false, when: 'Tue, Nov 24' });
  });
  it('the ladder lists the map levels (inducement, POIs, EQ, target, invalidation) read-only', () => {
    const levels = mapLevels(build());
    expect(levels.map((l) => l.name)).toEqual(expect.arrayContaining(['Inducement', 'POI A', 'POI B', 'Daily equilibrium', 'Daily target', 'Daily invalidation', 'Weekly draw below']));
    expect(levels.find((l) => l.id === 'D-eq')).toMatchObject({ low: 100, high: 100, source: 'Map · Daily' });
  });
});

describe('Journey 2 at the desk: leave the chart → no POIs', () => {
  it('the structure line says leave the chart and carries no POI', () => {
    const map = updateStructure(fixtureDecomposition({ deskId: 'desk-1' }), [{ id: 'd', asOf: 'x', data: fixtureDailyBearish({ structure: { status: 'INCONCLUSIVE' }, dealingRange: { status: 'INCONCLUSIVE' }, pois: { status: 'NOT_APPLICABLE' } }) }], meta('x'));
    const [structure] = stack(map);
    expect(structure.verdict).toBe('LEAVE_CHART');
    expect(structure.poiA).toBeUndefined();
    expect(mapLevels(map).some((l) => l.kind.startsWith('POI'))).toBe(false);
  });
  it('no map → the desk says so instead of showing empty fields', () => {
    expect(stack(undefined)[0]).toEqual({ key: 'STRUCTURE', title: 'Structure', missing: 'No structural map yet' });
  });
});

describe('Journey 5 at the desk: each layer keeps its own as-of time', () => {
  it('after a weekly-only refresh the desk shows the new weekly time and the old daily time', () => {
    const map = updateStructure(build(), [{ id: 'w2', asOf: '2026-11-23T00:00:00Z', data: { ...fixtureWeeklyBearish(), trend: { status: 'INCONCLUSIVE' } } }], meta('2026-11-23T18:00:00Z'));
    const [structure] = stack(map);
    expect(structure.asOf).toEqual({ WEEKLY: '2026-11-23T00:00:00Z', DAILY: '2026-11-22T00:00:00Z' });
    expect(structure.when).toBe('Map revision 3');
  });
});

describe('scenarios pick POIs from the map', () => {
  it('lists map POIs once, and an old link still resolves after the map changes', () => {
    const map = build();
    expect(mapPois(map).map((x) => x.label)).toEqual(['Daily POI A', 'Daily POI B']);
    const moved = updateStructure(map, [{ id: 'd2', asOf: 'x', data: fixtureDailyBearish({ pois: { status: 'IDENTIFIED', value: { primary: fixturePoi({ id: 'poi-new', high: 115, low: 113 }) } } }) }], meta('x'));
    expect(resolvePoi(moved, 'poi-new')).toMatchObject({ current: true });
    expect(resolvePoi(moved, 'poi-b')).toMatchObject({ current: false, poi: { low: 116 } });
    expect(resolvePoi(moved, 'nope')).toBeUndefined();
  });
});
