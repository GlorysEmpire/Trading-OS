import type { AssetDeskData, DailyDebrief, Trade, TradingHQConfig, WeeklyEvidence, WeeklyReview } from '../types';
import { computeDailyEvidence } from './debrief';

/** Add days to a YYYY-MM-DD string (calendar math, timezone-free). */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The Monday that starts the week containing `date`. */
export function weekStartOf(date: string): string {
  const dow = new Date(`${date}T12:00:00Z`).getUTCDay(); // 0 = Sunday
  return addDays(date, -((dow + 6) % 7));
}

export function weekDates(weekStart: string): string[] {
  return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
}

export function computeWeeklyEvidence(
  trades: Trade[],
  debriefs: DailyDebrief[],
  weekStart: string,
  hq: Pick<TradingHQConfig, 'riskRules'>,
): WeeklyEvidence {
  const dates = weekDates(weekStart);
  const days = dates.map((d) => computeDailyEvidence(trades, d, hq));
  const weekTrades = trades.filter((t) => !t.voided && dates.includes(t.date));

  const sum = <K extends keyof (typeof days)[number]>(k: K) => days.reduce((a, d) => a + (d[k] as unknown as number), 0);
  const merge = (pick: (d: (typeof days)[number]) => Record<string, number>) =>
    days.reduce<Record<string, number>>((acc, d) => {
      for (const [k, v] of Object.entries(pick(d))) acc[k] = (acc[k] || 0) + v;
      return acc;
    }, {});

  const mistakeCodeCounts = merge((d) => d.mistakeCodeCounts);
  const mostCommonMistake = Object.entries(mistakeCodeCounts).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0] ?? null;
  const processSum = weekTrades.reduce((a, t) => a + (t.processScore?.score ?? 0), 0);

  const weekDebriefs = debriefs.filter((d) => dates.includes(d.date));
  const debriefDates = new Set(weekDebriefs.map((d) => d.date));
  const tradingDates = days.filter((d) => d.tradesTaken > 0).map((d) => d.date);

  return {
    weekStart,
    weekEnd: dates[6],
    tradesTaken: weekTrades.length,
    closedTrades: sum('closedTrades'),
    processAvg: weekTrades.length ? Number((processSum / weekTrades.length).toFixed(2)) : null,
    processByDay: days.map((d) => ({ date: d.date, processAvg: d.processAvg, trades: d.tradesTaken, totalR: d.totalR })),
    gradeCounts: merge((d) => d.gradeCounts),
    mistakeCodeCounts,
    mostCommonMistake,
    totalR: Number(sum('totalR').toFixed(2)),
    wins: sum('wins'),
    losses: sum('losses'),
    scratches: sum('scratches'),
    haltDays: days.filter((d) => d.halted).length,
    ruleBreakTrades: sum('ruleBreakTrades'),
    tradingDays: tradingDates.length,
    debriefsWritten: weekDebriefs.length,
    tradingDaysWithoutDebrief: tradingDates.filter((d) => !debriefDates.has(d)),
    upgradesYes: weekDebriefs.filter((d) => d.previousUpgradeExecuted === 'YES').length,
    upgradesNo: weekDebriefs.filter((d) => d.previousUpgradeExecuted === 'NO').length,
  };
}

export function findPreviousWeeklyReview(reviews: WeeklyReview[], weekStart: string): WeeklyReview | undefined {
  return reviews.filter((r) => r.weekStart < weekStart).sort((a, b) => (a.weekStart < b.weekStart ? 1 : -1))[0];
}

/** Match a focus-rotation name ("Gold", "NAS", "GU") to an Asset Desk, by
 * symbol or name, including common aliases. Returns undefined if no desk. */
const ALIASES: Record<string, string[]> = {
  GOLD: ['XAUUSD', 'XAU'],
  SILVER: ['XAGUSD', 'XAG'],
  NAS: ['NQ', 'NAS100', 'NASDAQ', 'US100', 'USTEC'],
  GU: ['GBPUSD'],
  EU: ['EURUSD'],
  GER40: ['DAX', 'DE40', 'GER30'],
  JP225: ['NIKKEI', 'NI225', 'JPN225'],
  BTC: ['BTCUSD', 'BTCUSDT', 'BITCOIN'],
  ETH: ['ETHUSD', 'ETHUSDT', 'ETHEREUM'],
};

export function matchDesk(assets: AssetDeskData[], name: string): AssetDeskData | undefined {
  const key = name.trim().toUpperCase();
  const candidates = new Set([key, ...(ALIASES[key] ?? []), ...Object.entries(ALIASES).filter(([, v]) => v.includes(key)).map(([k]) => k)]);
  return assets.find((a) => candidates.has(a.symbol.toUpperCase()) || candidates.has(a.name.toUpperCase()));
}
