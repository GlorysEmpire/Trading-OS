import type { Trade } from '../types';
import type { CapitalSettings } from '../lib/capitalStore';

export interface CapitalSummary {
  currentBalance: number;
  netProfit: number;
  closedTrades: number;
  estimatedTrades: number;
}

/** R is multiplied by the risk percentage recorded when the trade was opened.
 * Older trades without a snapshot use today's HQ rate and are marked estimated. */
export function calculateCapital(
  settings: CapitalSettings,
  trades: Trade[],
  fallbackRiskPct: number,
): CapitalSummary {
  const closed = trades.filter(t => t.status === 'CLOSED' && !t.voided && Number.isFinite(t.realizedR));
  closed.sort((a, b) => (a.closedAt ?? a.timestamp) - (b.closedAt ?? b.timestamp) || a.id.localeCompare(b.id));
  let balance = settings.startingCapital;
  let estimatedTrades = 0;
  for (const trade of closed) {
    const savedRisk = trade.riskPercentAtEntry;
    const riskPct = savedRisk !== undefined ? savedRisk : fallbackRiskPct;
    if (savedRisk === undefined) estimatedTrades++;
    if (!Number.isFinite(riskPct) || riskPct < 0) continue;
    balance += balance * riskPct / 100 * (trade.realizedR ?? 0);
  }
  return {
    currentBalance: Math.round(balance * 100) / 100,
    netProfit: Math.round((balance - settings.startingCapital) * 100) / 100,
    closedTrades: closed.length,
    estimatedTrades,
  };
}
