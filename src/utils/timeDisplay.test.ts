import { describe, expect, it } from 'vitest';
import { formatTradingTime, fromZoneInput, toZoneInput, zoneLabel } from './timeDisplay';

describe('time display', () => {
  const instant = new Date('2026-11-20T14:30:00Z'); // 09:30 NY (EST), 15:30 Lagos

  it('formats in New York with a short label', () => {
    expect(formatTradingTime(instant, { zone: 'America/New_York' })).toBe('Nov 20, 09:30 NY');
    expect(formatTradingTime(instant, { zone: 'Africa/Lagos' })).toBe('Nov 20, 15:30 Lagos');
    expect(formatTradingTime(instant, { zone: 'America/New_York', date: false })).toBe('09:30 NY');
    expect(formatTradingTime(undefined)).toBe('');
  });

  it('labels zones plainly', () => {
    expect(zoneLabel('America/New_York')).toBe('NY');
    expect(zoneLabel('America/Los_Angeles')).toBe('Los Angeles');
  });

  it('round-trips a datetime-local value in each zone, across daylight saving', () => {
    expect(toZoneInput(instant, 'America/New_York')).toBe('2026-11-20T09:30');
    expect(fromZoneInput('2026-11-20T09:30', 'America/New_York')?.toISOString()).toBe('2026-11-20T14:30:00.000Z');
    expect(fromZoneInput('2026-11-20T15:30', 'Africa/Lagos')?.toISOString()).toBe('2026-11-20T14:30:00.000Z');
    // Summer (EDT, UTC-4)
    expect(fromZoneInput('2026-07-01T09:30', 'America/New_York')?.toISOString()).toBe('2026-07-01T13:30:00.000Z');
    expect(fromZoneInput('not a date', 'America/New_York')).toBeNull();
  });
});
