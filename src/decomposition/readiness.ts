/**
 * Layer 0 — Readiness ("Can I trade now?"). Not part of decomposition; it
 * lives on Today (M6). Pure: callers pass the current state in.
 */

export type ReadinessVerdict = 'READY' | 'WAIT' | 'CAUTION' | 'BACKTEST_ONLY';

export interface ReadinessInput {
  lossesToday: number;
  maxDailyLosses: number;
  /** Is a session window open right now (NY time)? */
  inSessionWindow: boolean;
  /** High-impact events still ahead today, with minutes until each. */
  upcomingHighImpact: Array<{ title: string; minutesAway: number }>;
  /** Minutes before a high-impact event that count as "too close". */
  eventBufferMinutes: number;
  /** Open trades: asset and direction. */
  openExposure: Array<{ asset: string; direction: 'LONG' | 'SHORT' }>;
  /** The asset being considered, if any. */
  candidateAsset?: string;
  /** Groups of assets that move together (editable config, not market data). */
  correlationGroups: string[][];
}

export interface Readiness {
  verdict: ReadinessVerdict;
  /** Plain-language reasons, most important first. */
  reasons: string[];
}

/** Placeholder groups from the focus rotation. To be made editable in Trading HQ. */
export const PLACEHOLDER_CORRELATION_GROUPS: string[][] = [
  ['BTC', 'ETH'],
  ['NAS', 'NAS100', 'GER40', 'JP225'],
  ['XAU', 'GOLD', 'XAG', 'SILVER'],
  ['GBPUSD', 'GU', 'EURUSD', 'EU'],
  ['USDCAD', 'USDCHF', 'USDJPY'],
];

const norm = (s: string) => s.toUpperCase().replace(/[^A-Z0-9]/g, '');

/** True when two symbols are in the same correlation group (or are the same asset). */
export function correlated(a: string, b: string, groups: string[][]): boolean {
  const A = norm(a);
  const B = norm(b);
  if (A === B) return true;
  const hit = (sym: string, member: string) => sym === norm(member) || sym.startsWith(norm(member));
  return groups.some((g) => g.some((m) => hit(A, m)) && g.some((m) => hit(B, m)));
}

export function readiness(input: ReadinessInput): Readiness {
  if (input.lossesToday >= input.maxDailyLosses) {
    return { verdict: 'BACKTEST_ONLY', reasons: [`Daily loss limit reached (${input.lossesToday} of ${input.maxDailyLosses}). Live trading is closed for today; backtesting is fine.`] };
  }
  const reasons: string[] = [];
  let verdict: ReadinessVerdict = 'READY';
  if (!input.inSessionWindow) {
    verdict = 'WAIT';
    reasons.push('No session window is open. Sub-5M execution waits for the next window.');
  }
  const soon = input.upcomingHighImpact.filter((e) => e.minutesAway >= 0 && e.minutesAway <= input.eventBufferMinutes);
  if (soon.length) {
    verdict = 'WAIT';
    reasons.push(`High-impact news soon: ${soon.map((e) => `${e.title} in ${e.minutesAway} min`).join(', ')}.`);
  }
  if (input.candidateAsset) {
    const clash = input.openExposure.filter((o) => correlated(o.asset, input.candidateAsset!, input.correlationGroups));
    if (clash.length) {
      if (verdict === 'READY') verdict = 'CAUTION';
      reasons.push(`Open exposure on ${clash.map((c) => `${c.asset} ${c.direction.toLowerCase()}`).join(', ')} moves with ${input.candidateAsset}. Another trade would risk CORRELATED_OVEREXPOSURE.`);
    }
  }
  if (verdict === 'READY') reasons.push(`Session open, ${input.maxDailyLosses - input.lossesToday} of ${input.maxDailyLosses} losses left, no correlated exposure.`);
  return { verdict, reasons };
}
