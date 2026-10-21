import { describe, it, expect } from 'vitest';
import {
  traderDateString,
  daysBetweenDateStrings,
  traderNowMinutes,
  isSessionActiveNow,
  getActiveSession,
} from './traderTime';
import type { SessionWindow } from '../types';

function makeSession(overrides: Partial<SessionWindow> & { lagosStart: string; lagosEnd: string }): SessionWindow {
  return {
    id: 'sess-test',
    name: 'Test Session',
    nyStart: '00:00',
    nyEnd: '00:00',
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

describe('isSessionActiveNow', () => {
  it('reports active for a plain same-day window when now is inside it', () => {
    const session = makeSession({ lagosStart: '10:00', lagosEnd: '17:00' });
    expect(isSessionActiveNow(session, 12 * 60)).toBe(true);
  });

  it('reports inactive for a plain same-day window when now is outside it', () => {
    const session = makeSession({ lagosStart: '10:00', lagosEnd: '17:00' });
    expect(isSessionActiveNow(session, 18 * 60)).toBe(false);
  });

  it('is active at the exact start minute and inactive at the exact end minute (half-open interval)', () => {
    const session = makeSession({ lagosStart: '10:00', lagosEnd: '17:00' });
    expect(isSessionActiveNow(session, 10 * 60)).toBe(true);
    expect(isSessionActiveNow(session, 17 * 60)).toBe(false);
  });

  it('handles a midnight-wrapping window (Tokyo: 23:00-05:00 Lagos) as active late at night', () => {
    const session = makeSession({ lagosStart: '23:00', lagosEnd: '05:00' });
    expect(isSessionActiveNow(session, 23 * 60 + 30)).toBe(true);
  });

  it('handles a midnight-wrapping window (Tokyo: 23:00-05:00 Lagos) as active just after midnight', () => {
    const session = makeSession({ lagosStart: '23:00', lagosEnd: '05:00' });
    expect(isSessionActiveNow(session, 2 * 60)).toBe(true);
  });

  it('handles a midnight-wrapping window (Tokyo: 23:00-05:00 Lagos) as inactive in the middle of the day', () => {
    const session = makeSession({ lagosStart: '23:00', lagosEnd: '05:00' });
    expect(isSessionActiveNow(session, 12 * 60)).toBe(false);
  });

  it('treats a zero-length window (start === end) as always inactive', () => {
    const session = makeSession({ lagosStart: '09:00', lagosEnd: '09:00' });
    expect(isSessionActiveNow(session, 9 * 60)).toBe(false);
    expect(isSessionActiveNow(session, 0)).toBe(false);
  });
});

describe('getActiveSession', () => {
  it('returns the session whose window currently contains the given time', () => {
    const sessions: SessionWindow[] = [
      makeSession({ id: 'sess-london', name: 'London', lagosStart: '05:00', lagosEnd: '10:00' }),
      makeSession({ id: 'sess-new-york', name: 'New York', lagosStart: '10:00', lagosEnd: '17:00' }),
      makeSession({ id: 'sess-tokyo', name: 'Tokyo', lagosStart: '23:00', lagosEnd: '05:00' }),
    ];
    expect(getActiveSession(sessions, 11 * 60)?.name).toBe('New York');
    expect(getActiveSession(sessions, 1 * 60)?.name).toBe('Tokyo');
  });

  it('returns undefined when no session window contains the given time', () => {
    const sessions: SessionWindow[] = [
      makeSession({ id: 'sess-gap', name: 'Gap', lagosStart: '10:00', lagosEnd: '11:00' }),
    ];
    expect(getActiveSession(sessions, 12 * 60)).toBeUndefined();
  });
});
