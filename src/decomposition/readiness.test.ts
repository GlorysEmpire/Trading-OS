import { describe, expect, it } from 'vitest';
import { highImpactAhead } from './readiness';

describe('M6 — highImpactAhead', () => {
  it('keeps only high-impact events still ahead, soonest first', () => {
    const now = new Date('2026-11-24T14:00:00Z');
    const r = highImpactAhead([
      { title: 'FOMC', at: new Date('2026-11-24T19:00:00Z'), impact: 'HIGH' },
      { title: 'CPI', at: new Date('2026-11-24T14:20:00Z'), impact: 'HIGH' },
      { title: 'Old', at: new Date('2026-11-24T13:00:00Z'), impact: 'HIGH' },
      { title: 'Minor', at: new Date('2026-11-24T14:10:00Z'), impact: 'LOW' },
      { title: 'No time', impact: 'HIGH' },
    ], now);
    expect(r).toEqual([{ title: 'CPI', minutesAway: 20 }, { title: 'FOMC', minutesAway: 300 }]);
  });
});
