/** M5 process tests: journey 6 end to end — locked predictions → outcome once → sample → RQ count. Synthetic fixtures. */
import { describe, expect, it } from 'vitest';
import { PLACEHOLDER_DEFINITIONS as DEFS, backtestState, closeBacktest, researchSampleCount, sampleFromBacktest, updateStructure } from './index';
import { fixtureDailyBearish, fixtureDecomposition, fixturePoi, fixtureWeeklyBearish } from './fixtures';

const replay = (daily = fixtureDailyBearish()) => updateStructure(fixtureDecomposition({ id: 'bt-1', mode: 'BACKTEST', researchQuestionId: 'RQ-2026-11', symbol: 'FIXTURE-ASSET' }), [
  { id: 'w', asOf: '2026-03-02T00:00:00Z', data: fixtureWeeklyBearish() },
  { id: 'd', asOf: '2026-03-02T00:00:00Z', data: daily },
], { createdAt: '2026-11-24T18:30:00Z', definitionsVersion: DEFS.version });

describe('Journey 6 end to end: backtest → sample → research count', () => {
  it('locks the read on save, records the outcome once against it, and builds the sample from it', () => {
    let bt = fixtureDecomposition({ mode: 'BACKTEST' });
    expect(backtestState(bt)).toBe('NEEDS_READ');
    bt = replay();
    expect(bt.layers.every((l) => l.lockedAt)).toBe(true);
    expect(backtestState(bt)).toBe('AWAITING_OUTCOME');

    const done = closeBacktest(bt, { recordedAt: '2026-11-24T19:00:00Z', result: 'REACHED_TARGET', reactedPoiId: 'poi-a', depthReached: 'SHALLOW', candlesToOutcome: 6 });
    expect(backtestState(done)).toBe('DONE');
    expect(done.outcome?.predictionLayerId).toBe('d');
    expect(() => closeBacktest(done, { recordedAt: 'x', result: 'NEITHER' })).toThrow(/already recorded/);
    expect(() => updateStructure(done, [{ id: 'd2', asOf: 'x', data: fixtureDailyBearish({ targetInvalidation: { status: 'IDENTIFIED', value: { target: 60, invalidation: 121 } } }) }], { createdAt: 'x', definitionsVersion: DEFS.version }))
      .toThrow(/predictions can no longer change/);

    const sample = sampleFromBacktest(done, DEFS);
    expect(sample).toMatchObject({
      researchQuestionId: 'RQ-2026-11', asset: 'FIXTURE-ASSET', date: '2026-03-02', direction: 'SHORT', entry: 112, stop: 114, target: 78,
      result: 'WIN', realizedR: 17, isValidSetup: true, marketRegime: 'retracement', decompositionRecordId: 'bt-1',
    });
    expect(sample.narrative).toMatch(/sell from POI A 112–114 toward 78/);
    expect(sample.evidence).toMatch(/Locked Daily read v1.*depth shallow after 6 daily candles/);
    expect(researchSampleCount([done, bt], 'RQ-2026-11')).toBe(1);
  });
  it('hit invalidation = −1R from the POI price reacted at; neither = scratch', () => {
    const loss = sampleFromBacktest(closeBacktest(replay(), { recordedAt: 'x', result: 'HIT_INVALIDATION', reactedPoiId: 'poi-b' }), DEFS);
    expect(loss).toMatchObject({ result: 'LOSS', realizedR: -1, entry: 116, stop: 118 });
    expect(sampleFromBacktest(closeBacktest(replay(), { recordedAt: 'x', result: 'NEITHER' }), DEFS)).toMatchObject({ result: 'SCRATCH', realizedR: 0 });
  });
  it('a read that said "observe only" is kept as a sample but not a valid setup', () => {
    const bt = replay(fixtureDailyBearish({ pois: { status: 'IDENTIFIED', value: { primary: fixturePoi({ high: 86, low: 84 }) } } }));
    expect(sampleFromBacktest(closeBacktest(bt, { recordedAt: 'x', result: 'NEITHER' }), DEFS).isValidSetup).toBe(false);
  });
  it('needs a recorded outcome', () => {
    expect(() => sampleFromBacktest(replay(), DEFS)).toThrow(/Record the backtest outcome first/);
  });
});
