import { describe, expect, it } from 'vitest';
import { buildLadder, gapPct, kindOptions, nearestLevels, parsePriceRange } from './levelsLadder';
import type { AssetDeskData, ExternalLevel } from '../types';

const ext = (id: string, label: string, kind: string, price: string, extra: Partial<ExternalLevel> = {}): ExternalLevel =>
  ({ id, label, kind, price, source: 'Manual', asOf: '2026-11-16T08:00:00Z', enteredBy: 'MANUAL', ...extra });

const desk = (over: Partial<AssetDeskData> = {}): AssetDeskData => ({
  id: 'd', symbol: 'BTC', name: 'Bitcoin', category: 'CRYPTO', currentBias: 'BEARISH', tradingViewSymbol: '',
  htfStructure: { monthly: '', weekly: '', daily: '', h4: '' }, currentNarrative: '',
  liquidityZones: [], activePOIs: [], wyckoffDevelopment: { phase: '', eventsIdentified: [], notes: '' },
  externalContext: { updatedAt: '' }, scenarios: [], researchNotes: '',
  quickLevels: { high24h: '', low24h: '', keySustainedLevel: '' }, ...over,
});

describe('parsePriceRange', () => {
  it.each([
    ['81,800', 81800, 81800],
    ['$94,800', 94800, 94800],
    ['75.6k', 75600, 75600],
    ['~49k', 49000, 49000],
    ['68–72.5k', 68000, 72500],
    ['59.5-62.6k', 59500, 62600],
    ['81,800 – 83,200', 81800, 83200],
    ['62k to 66k', 62000, 66000],
    ['2,448.50', 2448.5, 2448.5],
    ['1.0850', 1.085, 1.085],
    ['81.8k inducement', 81800, 81800],
    ['500-1k', 500, 1000],
  ])('%s', (text, low, high) => {
    expect(parsePriceRange(text)).toEqual({ low, high });
  });
  it.each(['', 'above the high', '75k, 76k, 77k', undefined])('refuses %s', (text) => {
    expect(parsePriceRange(text)).toBeNull();
  });
});

describe('gapPct', () => {
  it('is 0 for overlapping ranges', () => {
    expect(gapPct({ low: 68000, high: 72500 }, { low: 70000, high: 70000 })).toBe(0);
  });
  it('measures the gap against price', () => {
    expect(gapPct({ low: 75600, high: 75600 }, { low: 75500, high: 75500 })).toBeCloseTo(0.132, 2);
  });
});

describe('buildLadder', () => {
  const d = desk({
    liquidityZones: [
      { id: 'l1', level: '61,900', type: 'Bull liquidity', status: 'UNTOUCHED', notes: "Last week's low" },
      { id: 'l2', level: '57.5k', type: 'Bull liquidity', status: 'UNTOUCHED', notes: '' },
      { id: 'l3', level: 'above the high', type: 'BSL', status: 'UNTOUCHED', notes: 'Unclear' },
    ],
    activePOIs: [
      { id: 'p1', name: '4H FVG', priceRange: '70k', timeframe: '4H', type: 'FVG', active: true },
      { id: 'p2', name: '4H FVG', priceRange: '68k', timeframe: '4H', type: 'FVG', active: true },
    ],
    externalLevels: [
      ext('e1', 'STH cost basis', 'Cost basis', '75.6k'),
      ext('e2', 'Former bid block', 'On-chain block', '68–72.5k'),
      ext('e3', 'Liquidation cluster', 'Liquidation cluster', '59.5–62.6k'),
      ext('e4', 'Realized Price', 'Cost basis', '54.1k', { asOf: '2026-11-02T08:00:00Z', staleAfterHours: 168 }),
      ext('e5', 'True Market Mean', 'Cost basis', '77.5k', { enteredBy: 'AI_DRAFT' }),
    ],
    referencePrice: { value: '64,410', asOf: '2026-11-16T08:00:00Z' },
  });
  const ladder = buildLadder(d, new Date('2026-11-16T12:00:00Z'));
  const row = (key: string) => ladder.rows.find((r) => r.key === key)!;

  it('sorts by price, highest first, and sets aside what it cannot read', () => {
    expect(ladder.rows.map((r) => r.id)).toEqual(['e5', 'e1', 'e2', 'p1', 'p2', 'e3', 'l1', 'l2', 'e4']);
    expect(ladder.unpriced.map((r) => r.id)).toEqual(['l3']);
  });
  it('flags different kinds that overlap', () => {
    expect(row('poi:p1').confluence).toEqual(['Former bid block 68–72.5k']);
    expect(row('external:e2').confluence).toEqual(['4H FVG 70k', '4H FVG 68k']);
    expect(row('liquidity:l1').confluence).toEqual(['Liquidation cluster 59.5–62.6k']);
  });
  it('does not flag two levels of the same kind, or distant levels', () => {
    expect(row('poi:p2').confluence).toEqual(['Former bid block 68–72.5k']);
    expect(row('liquidity:l2').confluence).toEqual([]);
    expect(row('external:e1').confluence).toEqual([]);
  });
  it('marks stale levels and unconfirmed AI drafts', () => {
    expect(row('external:e4').stale).toBe(true);
    expect(row('external:e1').stale).toBe(false);
    expect(row('external:e5').aiDraft).toBe(true);
  });
  it('places the price-now row and finds the nearest levels', () => {
    expect(ladder.referenceIndex).toBe(5);
    const near = nearestLevels(ladder);
    expect(near.above?.id).toBe('p2');
    expect(near.below?.id).toBe('e3');
  });
  it('widens with the band', () => {
    const wide = buildLadder({ ...d, confluenceBandPct: 5 }, new Date('2026-11-16T12:00:00Z'));
    const e1 = wide.rows.find((r) => r.key === 'external:e1')!.confluence;
    expect(e1).toContain('Former bid block 68–72.5k');
    expect(e1).not.toContain('True Market Mean 77.5k'); // same kind (cost basis)
    expect(wide.rows.find((r) => r.key === 'liquidity:l2')!.confluence).not.toContain("Last week's low 61,900"); // same kind
  });
});

describe('kindOptions', () => {
  it('offers the suggestions plus kinds already in use, without duplicates', () => {
    const opts = kindOptions([desk({ liquidityZones: [
      { id: 'a', level: '1', type: 'bull liquidity', status: 'UNTOUCHED', notes: '' },
      { id: 'b', level: '1', type: 'Weekly high', status: 'UNTOUCHED', notes: '' },
      { id: 'c', level: '1', type: 'EQH', status: 'UNTOUCHED', notes: '' },
    ] })], 'liquidity');
    expect(opts.filter((o) => o.toLowerCase() === 'bull liquidity')).toHaveLength(1);
    expect(opts).toContain('Weekly high');
    expect(opts.filter((o) => o === 'Equal highs')).toHaveLength(1);
  });
});
