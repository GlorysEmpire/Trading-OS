/**
 * Process tests: the 8 user journeys from the architecture doc (§8), at the
 * contract level. Later milestones repeat them through the store and the UI.
 * All prices are synthetic fixtures (see fixtures.ts), not market data.
 */
import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_CORRELATION_GROUPS, PLACEHOLDER_DEFINITIONS, appendLayerVersion, evaluateDaily, latestLayer, layerHistory, nextStep,
  readiness, recordOutcome, researchSampleCount, summarize,
  type DecompositionDefinitions, type Decomposition, type LayerData,
} from './index';
import { fixtureDailyBearish, fixtureDecomposition, fixturePoi, fixtureWeeklyBearish } from './fixtures';

const DEFS = PLACEHOLDER_DEFINITIONS;
const lookup = (...blocks: DecompositionDefinitions[]) => (v: string) => blocks.find((b) => b.version === v);
let seq = 0;
const add = (dec: Decomposition, data: LayerData, asOf = '2026-11-23T10:00:00Z', defs = DEFS, createdAt = '2026-11-23T10:05:00Z') =>
  appendLayerVersion(dec, { id: `layer-${++seq}`, asOf, createdAt, definitionsVersion: defs.version, data });

describe('Journey 1 — bearish continuation, full pass', () => {
  it('weekly + daily identified → POI A/B in premium with ≥3R → summary carries bias, POIs, inducement, target, invalidation', () => {
    let dec = fixtureDecomposition();
    dec = add(dec, fixtureWeeklyBearish());
    dec = add(dec, fixtureDailyBearish());
    const s = summarize(dec, lookup(DEFS), DEFS);

    expect(s.verdict).toBe('WATCH_POI');
    expect(s.weekly?.bias).toBe('BEARISH');
    expect(s.daily?.bias).toBe('BEARISH');
    expect(s.daily?.location).toBe('PREMIUM');
    expect(s.daily?.equilibrium).toBe(100);
    expect(s.daily?.pois.map((p) => [p.role, p.location, p.valid])).toEqual([['PRIMARY', 'PREMIUM', true], ['BACKUP', 'PREMIUM', true]]);
    expect(s.daily?.pois[0].rToDraw).toBe(17);
    expect(s.daily?.inducement?.price).toBe(110);
    expect(s.daily?.target).toBe(78);
    expect(s.daily?.invalidation).toBe(121);
    expect(s.daily?.legType).toBe('STRONG');
    expect(s.sentence).toBe('Weekly bearish; daily bearish, price in premium; sell from POI A 112–114 toward 78 (17R); invalid on a close beyond 121.');
  });
});

describe('Journey 2 — structure inconclusive and no range', () => {
  it('stops at Daily with "leave the chart" and offers no POIs', () => {
    const daily = { structure: { status: 'INCONCLUSIVE' as const }, dealingRange: { status: 'INCONCLUSIVE' as const } };
    expect(nextStep('DAILY', daily, DEFS)).toBeUndefined();
    const gate = evaluateDaily(daily, DEFS);
    expect(gate.verdict).toBe('LEAVE_CHART');
    expect(gate.reason).toMatch(/^Leave the chart/);

    const full = fixtureDailyBearish({ structure: { status: 'INCONCLUSIVE' }, dealingRange: { status: 'INCONCLUSIVE' } });
    const s = summarize(add(fixtureDecomposition(), full), lookup(DEFS), DEFS);
    expect(s.verdict).toBe('LEAVE_CHART');
    expect(s.sentence).toMatch(/leave the chart/);
    expect(s.daily?.pois.filter((p) => p.valid)).toEqual([]);
  });
  it('structure inconclusive but a range exists → the flow continues', () => {
    expect(nextStep('DAILY', { structure: { status: 'INCONCLUSIVE' }, dealingRange: { status: 'IDENTIFIED', value: { high: 120, low: 80, currentPrice: 100 } } }, DEFS)).toBe('phase');
  });
});

describe('Journey 3 — sell POI in discount', () => {
  it('is rejected with the reason in plain words', () => {
    const daily = fixtureDailyBearish({ pois: { status: 'IDENTIFIED', value: { primary: fixturePoi({ high: 86, low: 84 }) } } });
    const s = summarize(add(fixtureDecomposition(), daily), lookup(DEFS), DEFS);
    expect(s.daily?.pois[0].valid).toBe(false);
    expect(s.daily?.pois[0].location).toBe('DISCOUNT');
    expect(s.daily?.pois[0].problems).toContain('A sell POI must be in premium; this one is in discount.');
    expect(s.verdict).toBe('OBSERVATION_ONLY');
  });
});

describe('Journey 4 — no POI with ≥3R to the draw', () => {
  it('is observation only, and no setup is offered', () => {
    const daily = fixtureDailyBearish({ targetInvalidation: { status: 'IDENTIFIED', value: { target: 111, invalidation: 121 } } });
    const gate = evaluateDaily(daily, DEFS);
    expect(gate.verdict).toBe('OBSERVATION_ONLY');
    expect(gate.reason).toMatch(/no POI has 3R or more/);
    const s = summarize(add(fixtureDecomposition(), daily), lookup(DEFS), DEFS);
    expect(s.daily?.pois.some((p) => p.valid)).toBe(false);
    expect(s.sentence).toMatch(/observation only/);
    expect(s.sentence).not.toMatch(/sell from/);
  });
});

describe('Journey 5 — weekly refreshed only', () => {
  it('leaves the daily layer untouched; each layer keeps its own as-of time', () => {
    let dec = fixtureDecomposition();
    dec = add(dec, fixtureWeeklyBearish(), '2026-11-20T00:00:00Z');
    dec = add(dec, fixtureDailyBearish(), '2026-11-22T00:00:00Z');
    const dailyBefore = latestLayer(dec, 'DAILY');
    const refreshed = add(dec, { ...fixtureWeeklyBearish(), trend: { status: 'INCONCLUSIVE' } }, '2026-11-23T00:00:00Z');

    expect(latestLayer(refreshed, 'DAILY')).toBe(dailyBefore);
    expect(layerHistory(refreshed, 'WEEKLY').map((l) => l.version)).toEqual([1, 2]);
    expect(layerHistory(refreshed, 'WEEKLY')[0].data).toEqual(fixtureWeeklyBearish()); // old version kept as it was
    expect(dec.layers).toHaveLength(2); // the original object is not mutated

    const s = summarize(refreshed, lookup(DEFS), DEFS);
    expect(s.weekly?.asOf).toBe('2026-11-23T00:00:00Z');
    expect(s.weekly?.bias).toBe('NEUTRAL');
    expect(s.daily?.asOf).toBe('2026-11-22T00:00:00Z');
    expect(s.daily?.version).toBe(1);
  });
});

describe('Journey 6 — backtest predictions locked', () => {
  it('locks each saved read, records the outcome once, then nothing can change; the sample counts toward the RQ', () => {
    let dec = fixtureDecomposition({ id: 'bt-1', mode: 'BACKTEST', researchQuestionId: 'RQ-2026-11' });
    dec = add(dec, fixtureWeeklyBearish());
    dec = add(dec, fixtureDailyBearish());
    expect(dec.layers.every((l) => l.lockedAt)).toBe(true);
    expect(researchSampleCount([dec], 'RQ-2026-11')).toBe(0);

    const done = recordOutcome(dec, { recordedAt: '2026-11-23T11:00:00Z', result: 'REACHED_TARGET', reactedPoiId: 'poi-a' });
    expect(() => add(done, fixtureDailyBearish())).toThrow(/predictions can no longer change/);
    expect(() => recordOutcome(done, { recordedAt: 'x', result: 'NEITHER' })).toThrow(/already recorded/);
    expect(researchSampleCount([done, fixtureDecomposition()], 'RQ-2026-11')).toBe(1);
    expect(researchSampleCount([done], 'RQ-OTHER')).toBe(0);
  });
  it('needs a daily read before an outcome, and outcomes are backtest-only', () => {
    const bt = add(fixtureDecomposition({ mode: 'BACKTEST' }), fixtureWeeklyBearish());
    expect(() => recordOutcome(bt, { recordedAt: 'x', result: 'NEITHER' })).toThrow(/daily read/);
    expect(() => recordOutcome(fixtureDecomposition(), { recordedAt: 'x', result: 'NEITHER' })).toThrow(/only on backtests/);
  });
});

describe('Journey 7 — definitions changed in HQ', () => {
  it('keeps old records on their old definitions version; new reads use the new one', () => {
    const v1: DecompositionDefinitions = { ...DEFS, version: 'decomp-defs-v1', minRToDraw: 20 };
    const old = add(fixtureDecomposition(), fixtureDailyBearish(), undefined, DEFS);
    const oldSummary = summarize(old, lookup(DEFS, v1), v1);
    expect(oldSummary.daily?.definitionsVersion).toBe(DEFS.version);
    expect(oldSummary.verdict).toBe('WATCH_POI'); // judged with the 3R it was read with
    expect(oldSummary.usesOlderDefinitions).toBe(true);

    const fresh = add(fixtureDecomposition({ id: 'dec-2' }), fixtureDailyBearish(), undefined, v1);
    const freshSummary = summarize(fresh, lookup(DEFS, v1), v1);
    expect(freshSummary.daily?.definitionsVersion).toBe('decomp-defs-v1');
    expect(freshSummary.verdict).toBe('OBSERVATION_ONLY'); // 17R and 19R are below 20R
    expect(freshSummary.usesOlderDefinitions).toBe(false);
  });
});

describe('Journey 8 — readiness', () => {
  const base = {
    lossesToday: 0, maxDailyLosses: 2, inSessionWindow: true, upcomingHighImpact: [], eventBufferMinutes: 30,
    openExposure: [], correlationGroups: PLACEHOLDER_CORRELATION_GROUPS,
  };
  it('halted → backtest only', () => {
    const r = readiness({ ...base, lossesToday: 2 });
    expect(r.verdict).toBe('BACKTEST_ONLY');
    expect(r.reasons[0]).toMatch(/Daily loss limit reached/);
  });
  it('out of window → wait', () => {
    expect(readiness({ ...base, inSessionWindow: false }).verdict).toBe('WAIT');
  });
  it('high-impact news inside the buffer → wait', () => {
    const r = readiness({ ...base, upcomingHighImpact: [{ title: 'CPI', minutesAway: 20 }, { title: 'FOMC', minutesAway: 300 }] });
    expect(r.verdict).toBe('WAIT');
    expect(r.reasons[0]).toBe('High-impact news soon: CPI in 20 min.');
  });
  it('correlated open exposure → caution, naming CORRELATED_OVEREXPOSURE', () => {
    const r = readiness({ ...base, openExposure: [{ asset: 'BTCUSD', direction: 'LONG' }], candidateAsset: 'ETHUSD' });
    expect(r.verdict).toBe('CAUTION');
    expect(r.reasons[0]).toMatch(/CORRELATED_OVEREXPOSURE/);
    expect(readiness({ ...base, openExposure: [{ asset: 'BTCUSD', direction: 'LONG' }], candidateAsset: 'EURUSD' }).verdict).toBe('READY');
  });
  it('all clear → ready', () => {
    expect(readiness(base)).toMatchObject({ verdict: 'READY' });
  });
});
