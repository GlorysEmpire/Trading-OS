/** M1: definitions are versioned in Trading HQ, never hardcoded into records. */
import { describe, expect, it } from 'vitest';
import {
  PLACEHOLDER_DEFINITIONS as P, definitionsResolver, definitionsVersionName, describeDefinitionChanges, prepareDefinitionsRevision,
  summarize, appendLayerVersion,
} from './index';
import { fixtureDailyBearish, fixtureDecomposition } from './fixtures';

const v1 = { ...P, version: definitionsVersionName(1) };

describe('definitions revisions', () => {
  it('names versions after the Trading HQ row version', () => {
    expect(definitionsVersionName(3)).toBe('decomp-defs-v3');
  });
  it('a revision gets the next version name and says what changed', () => {
    const next = prepareDefinitionsRevision(v1, { ...v1, minRToDraw: 5, locked: true, text: { ...v1.text, mss: 'Body close beyond the swing that started the leg.' } }, 2);
    expect(next.version).toBe('decomp-defs-v2');
    expect(describeDefinitionChanges(v1, next)).toEqual(['MSS definition reworded', 'Minimum R to the draw: 3R → 5R', 'Locked']);
  });
  it('refuses invalid values and empty revisions, in plain words', () => {
    expect(() => prepareDefinitionsRevision(v1, { ...v1, minRToDraw: 0 }, 2)).toThrow('Minimum R to the draw must be above 0.');
    expect(() => prepareDefinitionsRevision(v1, { ...v1 }, 2)).toThrow('Nothing changed, so no new version was saved.');
  });
});

describe('Journey 7 through the HQ history', () => {
  it('a record read under v1 is still judged by v1 after v2 raises the minimum R', () => {
    const v2 = prepareDefinitionsRevision(v1, { ...v1, minRToDraw: 20 }, 2);
    const resolve = definitionsResolver([v1, v2]);
    const old = appendLayerVersion(fixtureDecomposition(), { id: 'l1', asOf: 'x', createdAt: 'x', definitionsVersion: v1.version, data: fixtureDailyBearish() });
    expect(summarize(old, resolve, v2)).toMatchObject({ verdict: 'WATCH_POI', usesOlderDefinitions: true });
    const fresh = appendLayerVersion(fixtureDecomposition({ id: 'd2' }), { id: 'l2', asOf: 'x', createdAt: 'x', definitionsVersion: v2.version, data: fixtureDailyBearish() });
    expect(summarize(fresh, resolve, v2).verdict).toBe('OBSERVATION_ONLY');
  });
  it('the in-code placeholder always resolves; unknown versions do not', () => {
    const resolve = definitionsResolver([v1]);
    expect(resolve(P.version)).toBe(P);
    expect(resolve('decomp-defs-v9')).toBeUndefined();
  });
});
