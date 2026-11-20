import { describe, expect, it } from 'vitest';
import { badgeDefsFor, badgeStates, badgeValues, debriefStreak, disciplineDays, disciplineStreak, disciplineToday, earnedKeys, planKeptStreak, processCalendar, winStreak } from './discipline';
import type { DailyDebrief, Trade } from '../types';

let n = 0;
const trade = (over: Partial<Trade>): Trade => ({
  id: `t${++n}`, date: '2026-11-10', timestamp: Date.parse('2026-11-10T14:00:00Z') + n, asset: 'BTC', direction: 'LONG', timeframe: '15M', session: 'New York',
  modelId: 'm', setupGrade: 'A+', narrative: '', setupReasoning: '', entryPrice: 100, stopPrice: 90, targetPrice: 150, plannedR: 5,
  status: 'CLOSED', outcome: 'WIN', processScore: { score: 5 } as Trade['processScore'],
  violations: [], mistakeCodes: [], screenshots: {}, notesDuring: '', reflectionAfter: '', configVersionUsed: 'v1', ...over,
});

describe('streaks', () => {
  it('counts discipline days and resets on a broken rule', () => {
    const trades = [
      trade({ date: '2026-11-09' }),
      trade({ date: '2026-11-10', mistakeCodes: ['REENTRY'] }),
      trade({ date: '2026-11-11' }),
      trade({ date: '2026-11-12', processScore: { score: 4 } as Trade['processScore'] }),
    ];
    const days = disciplineDays(trades);
    expect(days.map((d) => d.state)).toEqual(['CLEAN', 'BROKEN', 'CLEAN', 'PARTIAL']);
    expect(disciplineStreak(days)).toEqual({ current: 2, best: 2 });
  });
  it('plan kept counts 5/5 closed trades; wins in a row is separate', () => {
    const trades = [trade({}), trade({ outcome: 'LOSS' }), trade({ processScore: { score: 3 } as Trade['processScore'] }), trade({}), trade({})];
    expect(planKeptStreak(trades)).toEqual({ current: 2, best: 2 });
    expect(winStreak(trades)).toBe(3);
  });
  it('ignores voided trades', () => {
    expect(disciplineDays([trade({ mistakeCodes: ['X'], voided: { at: 1, reason: 'dup' } })])).toEqual([]);
  });
  it('debrief streak can end yesterday', () => {
    const d = (date: string) => ({ date } as DailyDebrief);
    expect(debriefStreak([d('2026-11-17'), d('2026-11-18'), d('2026-11-19')], '2026-11-20')).toEqual({ current: 3, best: 3 });
    expect(debriefStreak([d('2026-11-10'), d('2026-11-11')], '2026-11-20').current).toBe(0);
  });
  it('today is 100 with no trades and drops for broken rules', () => {
    expect(disciplineToday([], '2026-11-10').pct).toBe(100);
    expect(disciplineToday([trade({}), trade({ mistakeCodes: ['BE_EARLY'] })], '2026-11-10').pct).toBe(85);
  });
  it('builds 16 Monday-first weeks ending this week', () => {
    const cal = processCalendar([], '2026-11-20');
    expect(cal).toHaveLength(16);
    expect(cal[15][0].date).toBe('2026-11-16');
    expect(cal[15][4].state).toBe('NONE');
    expect(cal[15][5].state).toBe('FUTURE');
  });
});

describe('badges', () => {
  it('reaches tiers from best runs and never on outcome alone', () => {
    const trades = Array.from({ length: 6 }, () => trade({ outcome: 'LOSS', processCategory: 'GOOD_PROCESS_LOSS' }));
    const states = badgeStates(badgeValues(trades, [], [], 2, '2026-11-20'));
    const get = (id: string) => states.find((s) => s.def.id === id)!;
    expect(get('plan-keeper').tier).toBe('bronze');
    expect(get('stoic').tier).toBe('bronze');
    expect(get('stoic').next).toEqual({ tier: 'silver', target: 10 });
    expect(earnedKeys(states)).toContain('stoic:bronze');
    expect(earnedKeys(states)).not.toContain('stoic:silver');
  });
  it('counts a walk-away when the loss limit is the last trade of the day', () => {
    const trades = [trade({ outcome: 'LOSS' }), trade({ outcome: 'LOSS' })];
    expect(badgeValues(trades, [], [], 2, '2026-11-20')['walked-away']).toBe(1);
    expect(badgeValues([...trades, trade({})], [], [], 2, '2026-11-20')['walked-away']).toBe(0);
  });
  it("fits the trader's own system", () => {
    const defs = badgeDefsFor({ mistakeCodes: [{ code: 'REENTRY', label: 'Revenge re-entry' }], setupGrades: [{ grade: 'A' }] });
    expect(defs.find((d) => d.id === 'iron-stop')).toBeUndefined();
    expect(defs.find((d) => d.id === 'no-revenge')!.rule).toContain('Revenge re-entry');
    expect(defs.find((d) => d.id === 'patient-hunter')!.rule).toContain('was A');
  });
});
