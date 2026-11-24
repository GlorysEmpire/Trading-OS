import { describe, expect, it } from 'vitest';
import { ANALYSIS_LAYERS, ANALYSIS_TIMEFRAMES, analysisDatesValid, analysisGate, confirmedBreak, legEvidence, projectAnalysis, rangeEvidence, swingTrend } from './analysis';
import { fixtureDailyBearish, fixtureDecomposition, fixturePeriodRead } from './fixtures';
import { appendLayerVersion, isIdentified } from './logic';
import { currentStructuralRef } from './structural';
import { linkedPlanOptions } from './planLinks';
import { PLACEHOLDER_DEFINITIONS } from './definitions';
import type { PeriodPlan } from './types';

const cutoff = '2026-11-24T12:00:00Z';

describe('structured analysis and execution linkage', () => {
  it('uses the same eight sections across the three analytical timeframes', () => {
    expect(ANALYSIS_TIMEFRAMES).toEqual(['MONTHLY', 'WEEKLY', 'DAILY']);
    expect(ANALYSIS_LAYERS.map(({ title }) => title)).toEqual(['Swing Points', 'Structure', 'Dealing Range', 'Legs', 'Liquidity', 'POIs', 'Wyckoff', 'External Data']);
    for (const timeframe of ANALYSIS_TIMEFRAMES) {
      const observation = { S3: { high: 130, low: 90, price: 125, assessment: 'OBSERVED' as const } };
      const result = projectAnalysis(timeframe, observation, PLACEHOLDER_DEFINITIONS);
      expect(result.timeframe).toBe(timeframe);
      expect(result).toMatchObject({ analysis: observation, dealingRange: { status: 'IDENTIFIED', value: { high: 130, low: 90, currentPrice: 125 } } });
    }
  });

  it('does not infer a break from a sweep or close on the swing', () => {
    expect(confirmedBreak({ event: 'SWEEP', direction: 'BULLISH', scope: 'EXTERNAL', level: 100, close: 99 })).toBeUndefined();
    expect(confirmedBreak({ event: 'BOS', direction: 'BULLISH', scope: 'EXTERNAL', level: 100, close: 100 })).toBeUndefined();
    expect(confirmedBreak({ event: 'CHOCH', direction: 'BULLISH', scope: 'EXTERNAL', level: 100, close: 102 })).toMatchObject({ trend: 'BULLISH', lastBos: 100 });
    expect(analysisGate({ S2: { assessment: 'UNCERTAIN' }, S3: { assessment: 'UNCERTAIN' } }, PLACEHOLDER_DEFINITIONS)?.verdict).toBe('LEAVE_CHART');
  });

  it('calculates swings, equilibrium and direction-neutral retracement from observations', () => {
    expect(swingTrend([
      { id: '1', kind: 'HIGH', price: 150, date: '2026-11-01' }, { id: '2', kind: 'LOW', price: 105, date: '2026-11-02' },
      { id: '3', kind: 'HIGH', price: 135, date: '2026-11-03' }, { id: '4', kind: 'LOW', price: 95, date: '2026-11-04' },
    ])).toBe('BEARISH');
    expect(rangeEvidence({ high: 130, low: 90, price: 131 })).toEqual({ width: 40, midpoint: 110, location: 'Outside' });
    expect(legEvidence({ start: 130, end: 90, correction: 100, atr: 20 })).toEqual({ distance: 40, correction: 25, atrMultiple: 2 });
    expect(analysisDatesValid({ S8: { facts: [{ id: '1', source: 'Release', fact: 'value', date: '2026-11-24T13:00' }] } }, cutoff)).toBe(false);
  });

  it('leaves old versions intact and links only current eligible POIs', () => {
    const defs = PLACEHOLDER_DEFINITIONS;
    const legacy = fixtureDailyBearish();
    const map = appendLayerVersion(fixtureDecomposition(), { id: 'daily-v1', data: legacy, asOf: cutoff, createdAt: cutoff, definitionsVersion: defs.version });
    const plan: PeriodPlan = {
      id: 'plan', deskId: map.deskId, cadence: 'DAY', mode: 'LIVE', createdAt: cutoff, structuralVersionRef: currentStructuralRef(map),
      definitionsVersion: defs.version, gate: { answeredAt: cutoff, structureChanged: false, reasons: [] }, read: fixturePeriodRead(),
      candle: { symbol: map.symbol, feed: 'BINANCE', openTime: '2026-11-24T00:00:00Z', closeTime: '2026-11-25T00:00:00Z' },
    };
    const args = { plans: [plan], map, current: defs, definitionsFor: () => defs, deskId: map.deskId, feed: 'BINANCE', at: cutoff };
    expect(linkedPlanOptions(args).map(({ link }) => link.poiId)).toEqual(['poi-a', 'poi-b']);
    expect(linkedPlanOptions({ ...args, feed: 'OTHER' })).toEqual([]);
    expect(linkedPlanOptions({ ...args, at: plan.candle.closeTime! })).toEqual([]);
    const next = appendLayerVersion(map, { id: 'daily-v2', data: projectAnalysis('DAILY', {}, defs, legacy), asOf: cutoff, createdAt: cutoff, definitionsVersion: defs.version });
    expect(next.layers[0].data).toEqual(legacy);
    expect(isIdentified(legacy.candles)).toBe(true);
    expect(linkedPlanOptions({ ...args, map: next })).toEqual([]);
  });
});
