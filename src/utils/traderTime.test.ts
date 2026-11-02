import { describe, it, expect } from 'vitest';
import {
  traderDateString,
  daysBetweenDateStrings,
  traderNowMinutes,
  isSessionActiveAt,
  getActiveSession,
  nyTimeIn,
  zoneOffsetMinutes,
  timeframeMinutes,
  evaluateSessionCheck,
} from './traderTime';
import type { SessionWindow } from '../types';

function makeSession(overrides: Partial<SessionWindow> & { nyStart: string; nyEnd: string }): SessionWindow {
  return {
    id: 'sess-test',
    name: 'Test Session',
    activeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    notes: '',
    ...overrides,
  };
}

describe('traderDateString', () => {
  it('formats a known UTC instant as a YYYY-MM-DD string in the trader timezone (Africa/Lagos, UTC+1, no DST)', () => {
    // 2026-10-21T23:30:00Z is 2026-10-22T00:30 in Africa/Lagos (UTC+1)
    const date = new Date('2026-10-21T23:30:00Z');
    expect(traderDateString(date)).toBe('2026-10-22');
  });

  it('keeps the same calendar day when still before midnight Lagos time', () => {
    // 2026-10-21T20:00:00Z is 2026-10-21T21:00 in Africa/Lagos
    const date = new Date('2026-10-21T20:00:00Z');
    expect(traderDateString(date)).toBe('2026-10-21');
  });
});

describe('daysBetweenDateStrings', () => {
  it('returns 0 for the same date', () => {
    expect(daysBetweenDateStrings('2026-10-21', '2026-10-21')).toBe(0);
  });
  it('returns a positive count when b is after a', () => {
    expect(daysBetweenDateStrings('2026-10-21', '2026-10-28')).toBe(7);
  });
  it('returns a negative count when b is before a', () => {
    expect(daysBetweenDateStrings('2026-10-21', '2026-10-14')).toBe(-7);
  });
  it('handles a month boundary correctly', () => {
    expect(daysBetweenDateStrings('2026-10-25', '2026-11-02')).toBe(8);
  });
});

describe('traderNowMinutes', () => {
  it('converts a known UTC instant to minutes-since-midnight in the trader timezone', () => {
    // 2026-10-21T10:15:00Z -> 11:15 Africa/Lagos -> 11*60+15 = 675
    const date = new Date('2026-10-21T10:15:00Z');
    expect(traderNowMinutes(date)).toBe(11 * 60 + 15);
  });
});

// HQ sessions (2026-11-02): London 00:00–05:00 NY, New York 07:00–12:00 NY.
const london = makeSession({ id: 'sess-london', name: 'London', nyStart: '00:00', nyEnd: '05:00', activeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] });
const newYork = makeSession({ id: 'sess-new-york', name: 'New York', nyStart: '07:00', nyEnd: '12:00', activeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'] });

describe('zoneOffsetMinutes / nyTimeIn (US daylight saving)', () => {
  it('knows NY is UTC-4 in October (EDT) and UTC-5 in November (EST)', () => {
    expect(zoneOffsetMinutes(new Date('2026-10-28T12:00:00Z'), 'America/New_York')).toBe(-240);
    expect(zoneOffsetMinutes(new Date('2026-11-02T12:00:00Z'), 'America/New_York')).toBe(-300);
    expect(zoneOffsetMinutes(new Date('2026-11-02T12:00:00Z'), 'Africa/Lagos')).toBe(60);
  });

  it('maps the NY session to Lagos time correctly on both sides of the Nov 1 change', () => {
    expect(nyTimeIn('07:00', 'Africa/Lagos', new Date('2026-10-28T12:00:00Z'))).toBe('12:00');
    expect(nyTimeIn('07:00', 'Africa/Lagos', new Date('2026-11-02T12:00:00Z'))).toBe('13:00');
    expect(nyTimeIn('00:00', 'Africa/Lagos', new Date('2026-11-02T12:00:00Z'))).toBe('06:00');
  });
});

describe('isSessionActiveAt (judged in NY time)', () => {
  it('is active at 13:30 Lagos on Mon 2 Nov 2026 (08:30 NY EST)', () => {
    expect(isSessionActiveAt(newYork, new Date('2026-11-02T12:30:00Z'))).toBe(true);
  });

  it('moves with US DST: 16:30 UTC is after the window in October but inside it in November', () => {
    // 28 Oct 16:30Z = 12:30 NY EDT -> just after the window
    expect(isSessionActiveAt(newYork, new Date('2026-10-28T16:30:00Z'))).toBe(false);
    // 2 Nov 16:30Z = 11:30 NY EST -> still inside
    expect(isSessionActiveAt(newYork, new Date('2026-11-02T16:30:00Z'))).toBe(true);
  });

  it('treats the end as exclusive and the start as inclusive', () => {
    expect(isSessionActiveAt(london, new Date('2026-11-02T05:00:00Z'))).toBe(true); // 00:00 NY
    expect(isSessionActiveAt(london, new Date('2026-11-02T10:00:00Z'))).toBe(false); // 05:00 NY
  });

  it('respects active days in NY terms', () => {
    // Sat 7 Nov 2026 13:00Z = 08:00 NY Saturday
    expect(isSessionActiveAt(newYork, new Date('2026-11-07T13:00:00Z'))).toBe(false);
  });

  it('handles a window crossing NY midnight, crediting the after-midnight part to the previous day', () => {
    const late = makeSession({ nyStart: '22:00', nyEnd: '02:00', activeDays: ['Friday'] });
    // Sat 7 Nov 01:00 NY (06:00Z) belongs to Friday's session
    expect(isSessionActiveAt(late, new Date('2026-11-07T06:00:00Z'))).toBe(true);
    // Sun 8 Nov 01:00 NY belongs to Saturday's — inactive
    expect(isSessionActiveAt(late, new Date('2026-11-08T06:00:00Z'))).toBe(false);
  });

  it('a zero-length window is never active', () => {
    expect(isSessionActiveAt(makeSession({ nyStart: '09:00', nyEnd: '09:00' }), new Date('2026-11-02T14:00:00Z'))).toBe(false);
  });
});

describe('getActiveSession', () => {
  it('picks the window containing the moment, or none in the gap', () => {
    expect(getActiveSession([london, newYork], new Date('2026-11-02T08:00:00Z'))?.name).toBe('London'); // 03:00 NY
    expect(getActiveSession([london, newYork], new Date('2026-11-02T13:00:00Z'))?.name).toBe('New York'); // 08:00 NY
    expect(getActiveSession([london, newYork], new Date('2026-11-02T11:00:00Z'))).toBeUndefined(); // 06:00 NY gap
  });
});

describe('timeframeMinutes', () => {
  it('parses the app\'s timeframe labels', () => {
    expect(timeframeMinutes('1M')).toBe(1);
    expect(timeframeMinutes('3m')).toBe(3);
    expect(timeframeMinutes('5M')).toBe(5);
    expect(timeframeMinutes('15M')).toBe(15);
    expect(timeframeMinutes('1H')).toBe(60);
    expect(timeframeMinutes('4H')).toBe(240);
    expect(timeframeMinutes('Daily')).toBe(1440);
  });
});

describe('evaluateSessionCheck (OUT_WINDOW rule)', () => {
  const gap = new Date('2026-11-02T11:00:00Z'); // 06:00 NY, between windows
  const inside = new Date('2026-11-02T13:00:00Z'); // 08:00 NY

  it('flags a sub-5M entry outside every window', () => {
    const r = evaluateSessionCheck([london, newYork], gap, '1M');
    expect(r.outWindow).toBe(true);
    expect(r.pass).toBe(false);
  });

  it('does not restrict 5M and above', () => {
    expect(evaluateSessionCheck([london, newYork], gap, '5M').outWindow).toBe(false);
    expect(evaluateSessionCheck([london, newYork], gap, '15M').pass).toBe(true);
  });

  it('passes a sub-5M entry inside a window and names it', () => {
    const r = evaluateSessionCheck([london, newYork], inside, '1M');
    expect(r.pass).toBe(true);
    expect(r.session?.name).toBe('New York');
  });
});
