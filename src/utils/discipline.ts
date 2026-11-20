/**
 * Discipline: streaks, the process calendar and badges.
 *
 * Everything here rewards PROCESS, never outcome (Trading HQ: a good-process
 * loss beats a bad-process win). Wins in a row is reported as information
 * only. All values are derived from the journal, debriefs and backtests, so
 * nothing new is stored and nothing can drift from the evidence.
 */
import type { BacktestSample, DailyDebrief, Trade } from '../types';
import { addDays } from './weekly';

export type DayState = 'NONE' | 'BROKEN' | 'PARTIAL' | 'CLEAN';

export interface DisciplineDay {
  date: string;
  state: DayState;
  trades: number;
  avgProcess: number;
}

const live = (t: Trade) => !t.voided && (t.status === 'OPEN' || t.status === 'CLOSED');
const byTime = (a: Trade, b: Trade) => (a.closedAt ?? a.timestamp) - (b.closedAt ?? b.timestamp) || a.id.localeCompare(b.id);
const score = (t: Trade) => t.processScore?.score ?? 0;

/** A trade breaks a rule when it carries a mistake code or a rule violation. */
export function breaksRule(t: Trade): boolean {
  return (t.mistakeCodes?.length ?? 0) > 0 || (t.violations?.length ?? 0) > 0;
}

/** One entry per trading day that has trades, oldest first. */
export function disciplineDays(trades: Trade[]): DisciplineDay[] {
  const map = new Map<string, Trade[]>();
  for (const t of trades.filter(live)) {
    const list = map.get(t.date) ?? [];
    list.push(t);
    map.set(t.date, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, list]) => {
      const avg = list.reduce((s, t) => s + score(t), 0) / list.length;
      const state: DayState = list.some(breaksRule) ? 'BROKEN' : list.every((t) => score(t) >= 5) ? 'CLEAN' : 'PARTIAL';
      return { date, state, trades: list.length, avgProcess: Math.round(avg * 10) / 10 };
    });
}

/** Days in a row (counting back from the latest trading day) with no rule broken.
 * Days without trades neither add nor break. */
export function disciplineStreak(days: DisciplineDay[]): { current: number; best: number } {
  let best = 0;
  let run = 0;
  for (const d of days) {
    run = d.state === 'BROKEN' ? 0 : run + 1;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

/** Closed trades in a row at full process (5/5). */
export function planKeptStreak(trades: Trade[]): { current: number; best: number } {
  const closed = trades.filter((t) => live(t) && t.status === 'CLOSED').sort(byTime);
  let best = 0;
  let run = 0;
  for (const t of closed) {
    run = score(t) >= 5 && !breaksRule(t) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return { current: run, best };
}

/** Wins in a row — information only, never rewarded. */
export function winStreak(trades: Trade[]): number {
  const closed = trades.filter((t) => live(t) && t.status === 'CLOSED').sort(byTime);
  let run = 0;
  for (const t of closed) run = t.outcome === 'WIN' ? run + 1 : 0;
  return run;
}

/** Consecutive days with a debrief, ending today or yesterday (today may not be written yet). */
export function debriefStreak(debriefs: DailyDebrief[], today: string): { current: number; best: number } {
  const dates = new Set(debriefs.map((d) => d.date));
  let current = 0;
  let day = dates.has(today) ? today : addDays(today, -1);
  while (dates.has(day)) {
    current++;
    day = addDays(day, -1);
  }
  const sorted = [...dates].sort();
  let best = 0;
  let run = 0;
  let prev = '';
  for (const d of sorted) {
    run = prev && addDays(prev, 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
    prev = d;
  }
  return { current, best: Math.max(best, current) };
}

/** The last `weeks` weeks as columns of 7 days (Mon–Sun), ending with this week. */
export function processCalendar(days: DisciplineDay[], today: string, weeks = 16): Array<Array<{ date: string; state: DayState | 'FUTURE'; trades: number; avgProcess: number }>> {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const dow = (new Date(`${today}T12:00:00Z`).getUTCDay() + 6) % 7; // Monday = 0
  const start = addDays(today, -dow - (weeks - 1) * 7);
  const out = [];
  for (let w = 0; w < weeks; w++) {
    const col = [];
    for (let d = 0; d < 7; d++) {
      const date = addDays(start, w * 7 + d);
      const rec = byDate.get(date);
      col.push({ date, state: date > today ? ('FUTURE' as const) : rec?.state ?? ('NONE' as const), trades: rec?.trades ?? 0, avgProcess: rec?.avgProcess ?? 0 });
    }
    out.push(col);
  }
  return out;
}

/** Today's discipline, 0–100: average process of today's trades (5/5 = 100),
 * minus a step for each rule broken. 100 on a day without trades. */
export function disciplineToday(trades: Trade[], today: string): { pct: number; trades: number } {
  const list = trades.filter((t) => live(t) && t.date === today);
  if (!list.length) return { pct: 100, trades: 0 };
  const avg = list.reduce((s, t) => s + score(t), 0) / list.length;
  const broken = list.filter(breaksRule).length;
  return { pct: Math.max(0, Math.round((avg / 5) * 100 - broken * 15)), trades: list.length };
}

// ---- Badges ---------------------------------------------------------------

export type Tier = 'bronze' | 'silver' | 'gold';
export const TIER_LABEL: Record<Tier, string> = { bronze: 'Bronze', silver: 'Silver', gold: 'Gold' };

export interface BadgeDef {
  id: string;
  mono: string;
  name: string;
  /** What one unit of progress is, in plain words. */
  rule: string;
  unit: string;
  thresholds: [number, number, number];
  /** Badges built on a Trading HQ mistake code only show while that code exists. */
  code?: string;
}

export const BADGES: BadgeDef[] = [
  { id: 'plan-keeper', mono: 'PK', name: 'Plan Keeper', rule: 'Closed trades in a row at 5/5 process', unit: 'trades', thresholds: [5, 10, 25] },
  { id: 'walked-away', mono: 'WA', name: 'Walked Away', rule: 'Days you stopped at the daily loss limit', unit: 'days', thresholds: [1, 3, 7] },
  { id: 'iron-stop', mono: 'IS', name: 'Iron Stop', rule: 'Closed trades in a row with no early breakeven', unit: 'trades', thresholds: [5, 10, 20], code: 'BE_EARLY' },
  { id: 'no-revenge', mono: 'NR', name: 'No Revenge', rule: 'Trades in a row with no re-entry', unit: 'trades', thresholds: [10, 25, 50], code: 'REENTRY' },
  { id: 'session-sniper', mono: 'SS', name: 'Session Sniper', rule: 'Trades in a row inside your session rules', unit: 'trades', thresholds: [10, 25, 50], code: 'OUT_WINDOW' },
  { id: 'honest-ledger', mono: 'HL', name: 'Honest Ledger', rule: 'Days in a row with a written debrief', unit: 'days', thresholds: [3, 7, 15] },
  { id: 'stoic', mono: 'GL', name: 'Stoic', rule: 'Losses taken with every rule followed', unit: 'losses', thresholds: [3, 10, 25] },
  { id: 'patient-hunter', mono: 'A+', name: 'Patient Hunter', rule: 'Weeks where every trade was A+', unit: 'weeks', thresholds: [1, 3, 6] },
  { id: 'researcher', mono: 'RQ', name: 'Researcher', rule: 'Backtest samples logged in one month', unit: 'samples', thresholds: [5, 12, 25] },
];

export interface BadgeState {
  def: BadgeDef;
  /** Best value reached (badges are never taken away). */
  value: number;
  tier: Tier | null;
  next: { tier: Tier; target: number } | null;
}

function bestRun<T>(items: T[], ok: (x: T) => boolean): number {
  let best = 0;
  let run = 0;
  for (const x of items) {
    run = ok(x) ? run + 1 : 0;
    best = Math.max(best, run);
  }
  return best;
}

/** Best values for every badge metric. */
export function badgeValues(trades: Trade[], debriefs: DailyDebrief[], samples: BacktestSample[], maxDailyLosses: number, today: string, topGrade = 'A+'): Record<string, number> {
  const all = trades.filter(live).sort(byTime);
  const closed = all.filter((t) => t.status === 'CLOSED');
  const codes = (t: Trade) => t.mistakeCodes ?? [];

  // Walked away: days that reached the loss limit and had no trade logged after it.
  let walked = 0;
  const byDay = new Map<string, Trade[]>();
  for (const t of all) byDay.set(t.date, [...(byDay.get(t.date) ?? []), t]);
  for (const list of byDay.values()) {
    const sorted = [...list].sort((a, b) => a.timestamp - b.timestamp);
    let losses = 0;
    let hitAt = -1;
    sorted.forEach((t, i) => {
      if (t.status === 'CLOSED' && (t.outcome === 'LOSS' || t.outcome === 'SCRATCH')) {
        losses++;
        if (losses === maxDailyLosses && hitAt < 0) hitAt = i;
      }
    });
    if (hitAt >= 0 && hitAt === sorted.length - 1) walked++;
  }

  // Patient hunter: Monday-start weeks with ≥2 trades, all A+.
  const weeks = new Map<string, Trade[]>();
  for (const t of all) {
    const dow = (new Date(`${t.date}T12:00:00Z`).getUTCDay() + 6) % 7;
    const wk = addDays(t.date, -dow);
    weeks.set(wk, [...(weeks.get(wk) ?? []), t]);
  }
  const aplusWeeks = [...weeks.values()].filter((l) => l.length >= 2 && l.every((t) => t.setupGrade === topGrade)).length;

  const months = new Map<string, number>();
  for (const s of samples) months.set(s.date.slice(0, 7), (months.get(s.date.slice(0, 7)) ?? 0) + 1);

  return {
    'plan-keeper': planKeptStreak(trades).best,
    'walked-away': walked,
    'iron-stop': bestRun(closed, (t) => !codes(t).includes('BE_EARLY')),
    'no-revenge': bestRun(all, (t) => !codes(t).includes('REENTRY')),
    'session-sniper': bestRun(all, (t) => !codes(t).includes('OUT_WINDOW')),
    'honest-ledger': debriefStreak(debriefs, today).best,
    stoic: closed.filter((t) => t.processCategory === 'GOOD_PROCESS_LOSS').length,
    'patient-hunter': aplusWeeks,
    researcher: Math.max(0, ...months.values()),
  };
}

/** Fits the badge set to a trader's own system (Trading HQ): code-based badges
 * use the trader's wording and drop out when the code is removed; the patience
 * badge names their top grade. Defaults are Quadri's system. */
export function badgeDefsFor(hq?: { mistakeCodes?: Array<{ code: string; label: string }>; setupGrades?: Array<{ grade: string }> }): BadgeDef[] {
  if (!hq) return BADGES;
  const codes = new Map((hq.mistakeCodes ?? []).map((m) => [m.code, m.label]));
  const top = hq.setupGrades?.[0]?.grade ?? 'A+';
  return BADGES.filter((b) => !b.code || codes.has(b.code)).map((b) => {
    if (b.code) return { ...b, rule: `Trades in a row without “${codes.get(b.code)}”` };
    if (b.id === 'patient-hunter') return { ...b, mono: top.slice(0, 2), rule: `Weeks where every trade was ${top}` };
    return b;
  });
}

export function badgeStates(values: Record<string, number>, defs: BadgeDef[] = BADGES): BadgeState[] {
  const tiers: Tier[] = ['bronze', 'silver', 'gold'];
  return defs.map((def) => {
    const value = values[def.id] ?? 0;
    let tier: Tier | null = null;
    def.thresholds.forEach((th, i) => { if (value >= th) tier = tiers[i]; });
    const nextIndex = def.thresholds.findIndex((th) => value < th);
    return { def, value, tier, next: nextIndex >= 0 ? { tier: tiers[nextIndex], target: def.thresholds[nextIndex] } : null };
  });
}

/** Keys like "plan-keeper:gold" for every tier reached — used to spot new unlocks. */
export function earnedKeys(states: BadgeState[]): string[] {
  const tiers: Tier[] = ['bronze', 'silver', 'gold'];
  return states.flatMap((s) => (s.tier ? tiers.slice(0, tiers.indexOf(s.tier) + 1).map((t) => `${s.def.id}:${t}`) : []));
}
