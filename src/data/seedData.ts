import { ResearchQuestion, BacktestSample, PsychologyEntry, OperationalCalendarEvent, AlertRule } from '../types';

/**
 * Trading HQ and Asset Desks are now real, Supabase-backed data (see
 * src/lib/hqStore.ts and src/lib/assetDesksStore.ts) — they no longer come
 * from seed data here.
 *
 * Journal (trades), Backtesting, Psychology, Calendar, and Alerts are still
 * local-only (this week's scope is auth + Trading HQ + Asset Desks — the
 * rest follows per the MVP roadmap). Per the 2026-09-25 audit, all of the
 * previous fabricated history (fake BTC/ETH prices, invented trades,
 * invented psychology entries, invented news items) has been removed.
 * These arrays start empty or with only what's actually confirmed.
 */

export const INITIAL_TRADES: never[] = [];

// RQ-05 is real — it's this month's backtesting theme, already seeded on the
// Supabase side too (see the Next.js build's lib/seed.ts). RQ-06 in the
// previous version of this file was invented; it has been removed.
export const INITIAL_RESEARCH_QUESTIONS: ResearchQuestion[] = [
  {
    id: 'rq-05',
    code: 'RQ-05',
    title: 'Repeatability of AR/ST sub-cycle opportunities in Wyckoff ranges',
    hypothesis:
      'In a Wyckoff range, do AR → ST, ST → AR, and AR formation → climax/breakout each present repeatable trading opportunities? AR remains analytical context, not an execution requirement.',
    initialAsset: 'ETH',
    scheduledDay: 'Tuesday',
    status: 'BACKTEST',
    sampleCount: 0,
    targetSamples: 30,
    findings: 'No samples recorded yet.',
    createdAt: '2026-09-01',
  },
];

export const INITIAL_BACKTEST_SAMPLES: BacktestSample[] = [];
export const INITIAL_PSYCHOLOGY_ENTRIES: PsychologyEntry[] = [];

// Only the real, recurring structural items from the context handoff —
// no invented specific news releases or fabricated one-off events.
export const INITIAL_CALENDAR_EVENTS: OperationalCalendarEvent[] = [
  {
    id: 'cal-session-early',
    title: 'NY Early / London Overlap trading window (01:00–05:00 NY / 06:00–10:00 Lagos)',
    type: 'TRADING_SESSION',
    date: new Date().toISOString().split('T')[0],
    time: '01:00 - 05:00',
    impact: 'HIGH',
    completed: false,
    notes: 'Sub-5m execution only. 1% risk per setup, max 2 losses.',
  },
  {
    id: 'cal-session-am',
    title: 'NY AM trading window (07:00–11:00 NY / 12:00–16:00 Lagos)',
    type: 'TRADING_SESSION',
    date: new Date().toISOString().split('T')[0],
    time: '07:00 - 11:00',
    impact: 'HIGH',
    completed: false,
    notes: 'Sub-5m execution only. 1% risk per setup, max 2 losses.',
  },
  {
    id: 'cal-backtest-weekday',
    title: 'Backtesting / study window (weekdays)',
    type: 'BACKTEST',
    date: new Date().toISOString().split('T')[0],
    time: '18:30 - 20:00',
    assetOrCurrency: 'ETH',
    impact: 'MEDIUM',
    completed: false,
    notes: 'RQ-05 focus — ETH is the assigned Tuesday research asset.',
  },
];

export const INITIAL_ALERTS: AlertRule[] = [];
