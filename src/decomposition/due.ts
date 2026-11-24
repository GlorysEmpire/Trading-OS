/**
 * What's due now (M3, UX rule 1): only the plans and reviews that are due,
 * driven by the focus rotation. Nothing else is listed. Pure.
 */
import type { Cadence, PeriodCandle, PeriodPlan, StructuralRecord } from './types';
import { latestLayer } from './logic';
import { candleFor, candleLabel, previousCandle, type FeedProfile } from './feeds';

export type DueKind = 'REVIEW' | 'BUILD_STRUCTURE' | 'PLAN';

export interface DueItem {
  kind: DueKind;
  deskId: string;
  symbol: string;
  cadence?: Cadence;
  /** The candle the plan is for (PLAN) or was for (REVIEW). */
  candle?: PeriodCandle;
  /** REVIEW: the plan to review. */
  planId?: string;
}

export interface DueGroup {
  key: string;
  /** e.g. "Weekly plan due: BTC, ETH" */
  title: string;
  items: DueItem[];
}

export interface DueInput {
  now: string;
  /** Desks in today's focus rotation. */
  focusDesks: Array<{ id: string; symbol: string }>;
  structural: StructuralRecord[];
  plans: PeriodPlan[];
  profileFor: (deskId: string) => FeedProfile;
}

const WORD: Record<Cadence, string> = { MONTH: 'Monthly', WEEK: 'Weekly', DAY: 'Daily' };
const LAST: Record<Cadence, string> = { MONTH: "last month's", WEEK: "last week's", DAY: "yesterday's" };
const short = (s: string) => s.replace(/(USDT|USD)$/i, '') || s;

export function dueNow(input: DueInput): DueGroup[] {
  const groups = new Map<string, DueGroup>();
  const add = (key: string, title: (names: string) => string, item: DueItem, name: string) => {
    const g = groups.get(key) ?? { key, title: '', items: [] };
    g.items.push(item);
    (g as DueGroup & { _names?: string[] })._names = [...((g as DueGroup & { _names?: string[] })._names ?? []), name];
    g.title = title(((g as DueGroup & { _names?: string[] })._names ?? []).join(', '));
    groups.set(key, g);
  };
  const live = input.plans.filter((p) => p.mode === 'LIVE');

  // 1. Reviews of any closed, unreviewed plan (any asset, not only today's focus).
  for (const p of live) {
    if (p.review || !p.candle.closeTime || Date.parse(p.candle.closeTime) > Date.parse(input.now)) continue;
    const profile = input.profileFor(p.deskId);
    const prev = previousCandle(p.cadence, input.now, profile, p.candle.symbol);
    const isLast = prev.openTime === p.candle.openTime;
    const key = `REVIEW:${p.cadence}:${isLast ? 'last' : p.candle.openTime}`;
    add(key, (names) => isLast ? `Review ${LAST[p.cadence]}${p.cadence === 'DAY' ? ' daily' : ''} plan: ${names}` : `Review the ${WORD[p.cadence].toLowerCase()} plan for ${candleLabel(p.cadence, p.candle, profile)}: ${names}`,
      { kind: 'REVIEW', deskId: p.deskId, symbol: p.candle.symbol, cadence: p.cadence, candle: p.candle, planId: p.id }, short(p.candle.symbol));
  }

  // 2. Focus assets: build the map first, else the plans not yet made for the current candles.
  for (const desk of input.focusDesks) {
    const rec = input.structural.find((r) => r.deskId === desk.id && r.mode === 'LIVE' && latestLayer(r, 'DAILY'));
    if (!rec) {
      add('BUILD_STRUCTURE', (names) => `Build the structural map: ${names}`, { kind: 'BUILD_STRUCTURE', deskId: desk.id, symbol: desk.symbol }, short(desk.symbol));
      continue;
    }
    const profile = input.profileFor(desk.id);
    for (const cadence of ['MONTH', 'WEEK', 'DAY'] as Cadence[]) {
      const candle = candleFor(cadence, input.now, profile, desk.symbol);
      const has = live.some((p) => p.deskId === desk.id && p.cadence === cadence && p.candle.feed === candle.feed && Date.parse(p.candle.openTime) === Date.parse(candle.openTime));
      if (!has) add(`PLAN:${cadence}`, (names) => `${WORD[cadence]} plan due: ${names}`, { kind: 'PLAN', deskId: desk.id, symbol: desk.symbol, cadence, candle }, short(desk.symbol));
    }
  }

  const order = (k: string) => (k.startsWith('REVIEW') ? 0 : k === 'BUILD_STRUCTURE' ? 1 : k === 'PLAN:MONTH' ? 2 : k === 'PLAN:WEEK' ? 3 : 4);
  return [...groups.values()].sort((a, b) => order(a.key) - order(b.key)).map(({ key, title, items }) => ({ key, title, items }));
}
