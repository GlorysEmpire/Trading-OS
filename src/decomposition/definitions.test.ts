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

describe('readiness settings (Trading HQ)', () => {
  it('older versions without them get the defaults', async () => {
    const { PLACEHOLDER_DEFINITIONS, readinessSettings } = await import('./definitions');
    const old = { ...PLACEHOLDER_DEFINITIONS, readiness: undefined };
    expect(readinessSettings(old).eventBufferMinutes).toBe(30);
    expect(readinessSettings(old).correlationGroups.length).toBeGreaterThan(0);
  });
  it('a changed buffer or group is listed as a change and saved as a new version', async () => {
    const { PLACEHOLDER_DEFINITIONS: p, describeDefinitionChanges, prepareDefinitionsRevision } = await import('./definitions');
    const edited = { ...p, readiness: { eventBufferMinutes: 45, correlationGroups: [['BTC', 'ETH', 'SOL']] } };
    const changes = describeDefinitionChanges(p, edited);
    expect(changes).toContain('News buffer: 30 min → 45 min');
    expect(changes).toContain('Correlation groups changed');
    expect(prepareDefinitionsRevision(p, edited, 2).version).toBe('decomp-defs-v2');
  });
  it('refuses a silly buffer and one-asset groups', async () => {
    const { PLACEHOLDER_DEFINITIONS: p, validateDefinitions } = await import('./definitions');
    expect(validateDefinitions({ ...p, readiness: { eventBufferMinutes: -5, correlationGroups: [] } }).join(' ')).toMatch(/News buffer/);
    expect(validateDefinitions({ ...p, readiness: { eventBufferMinutes: 30, correlationGroups: [['BTC']] } }).join(' ')).toMatch(/at least two/);
  });
  it('groups round-trip through the editor text', async () => {
    const { groupsToText, textToGroups } = await import('./definitions');
    expect(textToGroups(' btc, eth \n\nxau,xag')).toEqual([['BTC', 'ETH'], ['XAU', 'XAG']]);
    expect(textToGroups(groupsToText([['BTC', 'ETH']]))).toEqual([['BTC', 'ETH']]);
  });
});
