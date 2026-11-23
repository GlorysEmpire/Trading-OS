/**
 * M0.2 process tests: period plans (Monthly / Weekly / Daily) on one template.
 * Parent-plan link, missing parent notice (never blocks), period boundary from
 * the chart's candle open, two review scores, accuracy rollup.
 * Prices and candle times are synthetic fixtures.
 */
import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_DEFINITIONS as DEFS, accuracyRollup, answerPeriodStep, candleOpenFor, evaluatePeriodPlan, nextPeriodStep, parentNotice,
  periodKey, periodStepsFor, reviewPeriodPlan, startPeriodPlan, unlocksSetups, updateStructure,
  type Cadence, type PeriodCandle, type PeriodGateCheck, type PeriodPlan, type ReviewScore, type StructuralRecord,
} from './index';
import { fixtureDailyBearish, fixtureDecomposition, fixtureH4Aligned, fixturePeriodRead, fixturePoi, fixtureWeeklyBearish } from './fixtures';

const META = { definitionsVersion: DEFS.version };
const map = (): StructuralRecord => updateStructure(fixtureDecomposition({ id: 'struct-1' }), [
  { id: 'w1', asOf: '2026-11-22T17:30:00Z', data: fixtureWeeklyBearish() },
  { id: 'd1', asOf: '2026-11-22T17:30:00Z', data: fixtureDailyBearish() },
  { id: 'h1', asOf: '2026-11-22T17:30:00Z', data: fixtureH4Aligned() },
], { ...META, createdAt: '2026-11-22T18:00:00Z' });

const noChange: PeriodGateCheck = { answeredAt: '2026-11-23T05:00:00Z', structureChanged: false, reasons: [] };
const candle = (cadence: Cadence, openTime: string, closeTime?: string): PeriodCandle => ({ symbol: 'FIXTURE-ASSET', feed: 'FIXTURE-FEED', openTime, ...(closeTime ? { closeTime } : {}) });

const MONTH = candle('MONTH', '2026-11-01T00:00:00Z', '2026-12-01T00:00:00Z');
const WEEK = candle('WEEK', '2026-11-23T00:00:00Z', '2026-11-30T00:00:00Z');
const DAY = candle('DAY', '2026-11-23T00:00:00Z', '2026-11-24T00:00:00Z');

const start = (cadence: Cadence, c: PeriodCandle, parent?: PeriodPlan, gate: PeriodGateCheck = noChange) =>
  startPeriodPlan({ id: `${cadence}-1`, cadence, candle: c, createdAt: '2026-11-23T05:05:00Z', structural: map(), gate, parent, ...META });

const fill = (plan: PeriodPlan) => {
  const read = fixturePeriodRead();
  return periodStepsFor(plan.cadence).reduce((p, s) => answerPeriodStep(p, s.key, read[s.key] as never), plan);
};

describe('Journey 12 — the plan chain: Structural → Monthly → Weekly → Daily', () => {
  it('each plan references the structural version and its parent plan', () => {
    const month = fill(start('MONTH', MONTH));
    const week = fill(start('WEEK', WEEK, month));
    const day = fill(start('DAY', DAY, week));
    expect(month.parentPlanId).toBeUndefined();
    expect(week.parentPlanId).toBe(month.id);
    expect(day.parentPlanId).toBe(week.id);
    for (const p of [month, week, day]) expect(p.structuralVersionRef).toEqual({ structuralRecordId: 'struct-1', revision: 3, layerIds: { WEEKLY: 'w1', DAILY: 'd1', H4: 'h1' } });
    expect(parentNotice(day, week)).toBeUndefined();
  });
  it('rejects a parent of the wrong cadence, another asset, or a later period', () => {
    const month = start('MONTH', MONTH);
    expect(() => start('DAY', DAY, month)).toThrow(/parent must be a weekly plan/);
    const other = { ...start('WEEK', WEEK), deskId: 'desk-2' };
    expect(() => start('DAY', DAY, other)).toThrow(/another asset/);
    const laterWeek = start('WEEK', candle('WEEK', '2026-11-30T00:00:00Z'));
    expect(() => start('DAY', DAY, laterWeek)).toThrow(/later period/);
  });
  it('still needs a structural map first (P0)', () => {
    expect(() => startPeriodPlan({ id: 'x', cadence: 'WEEK', candle: WEEK, createdAt: 'x', structural: undefined, gate: noChange, ...META }))
      .toThrow(/Build the structural map first/);
    expect(() => startPeriodPlan({ id: 'x', cadence: 'WEEK', candle: WEEK, createdAt: 'x', structural: map(), gate: undefined, ...META }))
      .toThrow(/Has structure changed since the last plan/);
  });
});

describe('Journey 13 — a missing parent shows a notice and never blocks', () => {
  it('a daily plan without a weekly plan works and still unlocks setups', () => {
    const day = fill(start('DAY', DAY));
    expect(parentNotice(day, undefined)).toBe('No weekly plan yet.');
    expect(evaluatePeriodPlan(map(), day, DEFS).verdict).toBe('WATCH_POI');
    expect(unlocksSetups(map(), day, DEFS)).toBe(true);
  });
  it('a weekly plan without a monthly plan says so; a monthly plan needs no parent', () => {
    expect(parentNotice(start('WEEK', WEEK), undefined)).toBe('No monthly plan yet.');
    expect(parentNotice(start('MONTH', MONTH), undefined)).toBeUndefined();
  });
  it('a higher plan that no longer stands is shown, not enforced', () => {
    const week = start('WEEK', WEEK);
    const day = fill(start('DAY', DAY, week, { ...noChange, higherPlanStands: false }));
    expect(parentNotice(day, week)).toMatch(/weekly plan no longer stands/);
    expect(unlocksSetups(map(), day, DEFS)).toBe(true);
  });
});

describe('Journey 14 — period boundary from the symbol\'s own candle open', () => {
  // Synthetic chart opens: a UTC-midnight feed and a feed that opens its day at 22:00 UTC.
  const utcOpens = ['2026-11-22T00:00:00Z', '2026-11-23T00:00:00Z', '2026-11-24T00:00:00Z'];
  const fx22Opens = ['2026-11-22T22:00:00Z', '2026-11-23T22:00:00Z'];
  it('a moment belongs to the latest candle the chart opened, not the NY trading day', () => {
    // 02:00 UTC on Nov 24 is still Nov 23 in New York, but the UTC-open chart has opened Nov 24's candle.
    expect(candleOpenFor('2026-11-24T02:00:00Z', utcOpens)).toBe('2026-11-24T00:00:00Z');
    // 23:00 UTC on Nov 23: the 22:00-open feed is already on its next daily candle.
    expect(candleOpenFor('2026-11-23T23:00:00Z', fx22Opens)).toBe('2026-11-23T22:00:00Z');
    expect(candleOpenFor('2026-11-23T21:00:00Z', fx22Opens)).toBe('2026-11-22T22:00:00Z');
    expect(candleOpenFor('2026-11-21T00:00:00Z', utcOpens)).toBeUndefined();
  });
  it('each plan stores symbol, feed and candle open, and is keyed by them', () => {
    const day = start('DAY', DAY);
    expect(day.candle).toEqual(DAY);
    expect(periodKey('DAY', day.candle)).toBe('FIXTURE-ASSET|FIXTURE-FEED|DAY|2026-11-23T00:00:00.000Z');
    expect(periodKey('DAY', { ...DAY, feed: 'OTHER' })).not.toBe(periodKey('DAY', DAY));
    expect(() => start('DAY', { ...DAY, feed: ' ' })).toThrow(/symbol, the data feed and the candle open time/);
  });
});

describe('Journey 15 — period review at the candle close, two separate scores', () => {
  const review = (prediction: ReviewScore, process: ReviewScore, savedAt = '2026-11-24T00:30:00Z') => ({ savedAt, prediction, process, lesson: '  Waited for the inducement.  ' });
  it('records prediction and process accuracy separately, plus one lesson', () => {
    const reviewed = reviewPeriodPlan(fill(start('DAY', DAY)), review('WRONG', 'CORRECT'));
    expect(reviewed.review).toEqual({ savedAt: '2026-11-24T00:30:00Z', prediction: 'WRONG', process: 'CORRECT', lesson: 'Waited for the inducement.' });
  });
  it('is due only after the candle closes, needs a lesson, and is append-only once saved', () => {
    const plan = fill(start('DAY', DAY));
    expect(() => reviewPeriodPlan(plan, review('CORRECT', 'CORRECT', '2026-11-23T20:00:00Z'))).toThrow(/has not closed yet/);
    expect(() => reviewPeriodPlan(plan, { ...review('CORRECT', 'CORRECT'), lesson: ' ' })).toThrow(/one lesson/);
    const saved = reviewPeriodPlan(plan, review('PARTLY', 'CORRECT'));
    expect(() => reviewPeriodPlan(saved, review('CORRECT', 'CORRECT'))).toThrow(/cannot change/);
    expect(() => answerPeriodStep(saved, 'narrative', { status: 'IDENTIFIED', value: 'rewritten' })).toThrow(/can no longer change/);
  });
});

describe('Journey 16 — accuracy rollup per cadence and per asset', () => {
  it('counts reviewed plans only, keeping prediction and process apart', () => {
    const mk = (cadence: Cadence, symbol: string, prediction: ReviewScore, process: ReviewScore, n: number): PeriodPlan => ({
      ...start(cadence, { ...(cadence === 'DAY' ? DAY : WEEK), symbol }, undefined),
      id: `${cadence}-${symbol}-${n}`,
      review: { savedAt: 'x', prediction, process, lesson: 'l' },
    });
    const plans = [
      mk('DAY', 'BTCUSD', 'CORRECT', 'CORRECT', 1),
      mk('DAY', 'BTCUSD', 'WRONG', 'CORRECT', 2),
      mk('DAY', 'XAUUSD', 'PARTLY', 'WRONG', 3),
      mk('WEEK', 'BTCUSD', 'CORRECT', 'PARTLY', 4),
      start('DAY', DAY), // not reviewed: ignored
    ];
    const r = accuracyRollup(plans);
    expect(r.byCadence.DAY).toEqual({
      reviewed: 3,
      prediction: { CORRECT: 1, PARTLY: 1, WRONG: 1, pct: 50 },
      process: { CORRECT: 2, PARTLY: 0, WRONG: 1, pct: 66.7 },
    });
    expect(r.byCadence.WEEK?.prediction.pct).toBe(100);
    expect(r.byCadence.WEEK?.process.pct).toBe(50);
    expect(r.byCadence.MONTH).toBeUndefined();
    expect(r.byAsset.BTCUSD.DAY).toMatchObject({ reviewed: 2, prediction: { pct: 50 }, process: { pct: 100 } });
    expect(r.byAsset.XAUUSD.DAY).toMatchObject({ reviewed: 1, prediction: { pct: 50 }, process: { pct: 0 } });
  });
});

describe('one template at every cadence; only Day plans unlock setups', () => {
  it('Month and Week ask P1–P7; Day adds the Asia range, timing and entry models', () => {
    expect(periodStepsFor('MONTH').map((s) => s.code)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5', 'P6', 'P7']);
    expect(periodStepsFor('WEEK').map((s) => s.key)).toEqual(periodStepsFor('MONTH').map((s) => s.key));
    expect(periodStepsFor('DAY').map((s) => s.key)).toEqual(['previousCandle', 'liquidity', 'asiaRange', 'periodType', 'draw', 'formation', 'invalidation', 'timing', 'entryModels', 'narrative']);
    expect(periodStepsFor('DAY').every((s) => s.why.length > 0 && s.why.length <= 90)).toBe(true);
  });
  it('a complete weekly plan is context only; a complete daily plan with a valid POI unlocks setups', () => {
    const week = fill(start('WEEK', WEEK));
    expect(evaluatePeriodPlan(map(), week, DEFS).verdict).toBe('CONTEXT_READY');
    expect(unlocksSetups(map(), week, DEFS)).toBe(false);
    const day = fill(start('DAY', DAY));
    expect(nextPeriodStep(day)).toBeUndefined();
    expect(evaluatePeriodPlan(map(), day, DEFS)).toMatchObject({ verdict: 'WATCH_POI', reason: 'Wait for price at POI A (17R to the draw).' });
  });
  it('the Day plan reuses the M0 gates: a sell POI in discount is rejected, an unfinished plan unlocks nothing', () => {
    const read = fixturePeriodRead();
    const bad = periodStepsFor('DAY').reduce((p, s) => answerPeriodStep(p, s.key, (s.key === 'formation'
      ? { status: 'IDENTIFIED', value: { primary: fixturePoi({ high: 86, low: 84 }) } }
      : read[s.key]) as never), start('DAY', DAY));
    expect(evaluatePeriodPlan(map(), bad, DEFS)).toMatchObject({ verdict: 'OBSERVATION_ONLY' });
    const half = answerPeriodStep(start('DAY', DAY), 'previousCandle', read.previousCandle);
    expect(unlocksSetups(map(), half, DEFS)).toBe(false);
  });
});
