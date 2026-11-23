/** Unit tests for the M0 pure logic. Prices are synthetic fixtures. */
import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_DEFINITIONS as DEFS, STEPS, correlated, depthExpectation, equilibrium, evaluateDaily, evaluateWeekly, legTypeOf,
  locationOf, nextStep, rToDraw, stepsFor, validateDefinitions, weeklyBias, PLACEHOLDER_CORRELATION_GROUPS,
} from './index';
import { fixtureDailyBearish, fixturePoi, fixtureWeeklyBearish } from './fixtures';

describe('price math', () => {
  it('equilibrium and location, with an optional band', () => {
    const r = { high: 120, low: 80 };
    expect(equilibrium(r)).toBe(100);
    expect(locationOf(110, r)).toBe('PREMIUM');
    expect(locationOf(90, r)).toBe('DISCOUNT');
    expect(locationOf(100, r)).toBe('EQUILIBRIUM');
    expect(locationOf(101, r, 5)).toBe('EQUILIBRIUM');
    expect(locationOf(103, r, 5)).toBe('PREMIUM');
  });
  it('R to the draw for sells and buys, stop at the far edge or the invalidation', () => {
    expect(rToDraw(fixturePoi(), 78, 121, DEFS)).toBe(17);
    expect(rToDraw(fixturePoi(), 78, 121, { ...DEFS, rStopBasis: 'INVALIDATION' })).toBe(3.78);
    expect(rToDraw(fixturePoi({ side: 'BUY', high: 88, low: 86 }), 120, 79, DEFS)).toBe(16);
    expect(rToDraw(fixturePoi(), 130, 121, DEFS)).toBeUndefined();
  });
  it('leg type from the criteria and thresholds', () => {
    const c = (n: number) => ({ rangeVsAtr: n > 0, closesInOuterPart: n > 1, lowBodyOverlap: n > 2, unmitigatedFvg: n > 3 });
    expect([0, 1, 2, 3, 4].map((n) => legTypeOf(c(n), DEFS))).toEqual(['WEAK', 'WEAK', 'INCONCLUSIVE', 'STRONG', 'STRONG']);
    expect(legTypeOf(c(3), { ...DEFS, strongLeg: { ...DEFS.strongLeg, strongMin: 4 } })).toBe('INCONCLUSIVE');
  });
});

describe('depth expectation', () => {
  const poi = fixturePoi();
  it('strong leg with nothing beyond the POI → shallow', () => {
    expect(depthExpectation('STRONG', 'SELL', [{ id: 'a', kind: 'INTERNAL_HIGH', price: 110, swept: false }], poi).depth).toBe('SHALLOW');
  });
  it('unswept internal liquidity beyond the nearest POI → deep, even after a strong leg', () => {
    const r = depthExpectation('STRONG', 'SELL', [{ id: 'a', kind: 'EQUAL_HIGHS', price: 117, swept: false }], poi);
    expect(r.depth).toBe('DEEP');
    expect(r.reason).toMatch(/117/);
  });
  it('swept levels do not count; weak leg → deep; inconclusive → no suggestion', () => {
    expect(depthExpectation('STRONG', 'SELL', [{ id: 'a', kind: 'EQUAL_HIGHS', price: 117, swept: true }], poi).depth).toBe('SHALLOW');
    expect(depthExpectation('WEAK', 'SELL', [], poi).depth).toBe('DEEP');
    expect(depthExpectation('INCONCLUSIVE', undefined, [], undefined).depth).toBeUndefined();
  });
});

describe('gates and step order', () => {
  it('weekly is never a hard stop', () => {
    expect(evaluateWeekly({}).verdict).toBe('INCOMPLETE');
    const neutral = { ...fixtureWeeklyBearish(), trend: { status: 'INCONCLUSIVE' as const } };
    expect(weeklyBias(neutral)).toBe('NEUTRAL');
    expect(evaluateWeekly(neutral)).toMatchObject({ verdict: 'CONTEXT_READY', reason: expect.stringMatching(/Daily carries the read/) });
  });
  it('asks one step at a time, in order', () => {
    expect(nextStep('WEEKLY', {}, DEFS)).toBe('trend');
    expect(nextStep('DAILY', {}, DEFS)).toBe('structure');
    const { targetInvalidation: _t, ...rest } = fixtureDailyBearish();
    expect(nextStep('DAILY', rest, DEFS)).toBe('targetInvalidation');
    expect(nextStep('DAILY', fixtureDailyBearish(), DEFS)).toBeUndefined();
  });
  it('flags a mitigated POI, a POI before the inducement, and a POI against structure', () => {
    const d = fixtureDailyBearish({ pois: { status: 'IDENTIFIED', value: {
      primary: fixturePoi({ mitigated: true }),
      backup: fixturePoi({ id: 'b', beyondInducement: false, side: 'BUY' }),
    } } });
    const gate = evaluateDaily(d, DEFS);
    expect(gate.verdict).toBe('OBSERVATION_ONLY');
    expect(gate.reason).toMatch(/already mitigated/);
  });
  it('a missing target is observation only', () => {
    expect(evaluateDaily(fixtureDailyBearish({ targetInvalidation: { status: 'INCONCLUSIVE' } }), DEFS).verdict).toBe('OBSERVATION_ONLY');
  });
  it('a range phase drops the trend-side check (range branch)', () => {
    const d = fixtureDailyBearish({ phase: { status: 'IDENTIFIED', value: 'RANGE' }, pois: { status: 'IDENTIFIED', value: { primary: fixturePoi({ side: 'BUY', high: 88, low: 86 }) } }, targetInvalidation: { status: 'IDENTIFIED', value: { target: 120, invalidation: 79 } } });
    expect(evaluateDaily(d, DEFS).verdict).toBe('WATCH_POI');
  });
});

describe('steps and definitions', () => {
  it('has one question per step for every layer key, Weekly before Daily', () => {
    expect(stepsFor('WEEKLY').map((s) => s.key)).toEqual(['trend', 'dealingRange', 'draw', 'pois']);
    expect(stepsFor('DAILY').map((s) => s.key)).toEqual(['structure', 'dealingRange', 'phase', 'leg', 'candles', 'liquidity', 'depth', 'pois', 'targetInvalidation']);
    expect(STEPS.findIndex((s) => s.timeframe === 'DAILY')).toBe(4);
    expect(STEPS.every((s) => s.question.endsWith('?'))).toBe(true);
  });
  it('placeholder definitions are valid but unlocked; bad values are named', () => {
    expect(DEFS.locked).toBe(false);
    expect(validateDefinitions(DEFS)).toEqual([]);
    expect(validateDefinitions({ ...DEFS, minRToDraw: 0, strongLeg: { ...DEFS.strongLeg, weakMax: 3 } })).toEqual([
      'The weak-leg ceiling must be below the strong-leg minimum.',
      'Minimum R to the draw must be above 0.',
    ]);
  });
});

describe('correlation', () => {
  it('matches symbols in the same group, including broker suffixes', () => {
    expect(correlated('BTCUSDT', 'ETH', PLACEHOLDER_CORRELATION_GROUPS)).toBe(true);
    expect(correlated('XAUUSD', 'XAGUSD', PLACEHOLDER_CORRELATION_GROUPS)).toBe(true);
    expect(correlated('NAS100', 'NAS100', [])).toBe(true);
    expect(correlated('BTCUSD', 'USDJPY', PLACEHOLDER_CORRELATION_GROUPS)).toBe(false);
  });
});
