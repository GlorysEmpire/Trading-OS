import { Trade, PerformanceStats, TradingHQConfig, ProcessScore } from '../types';
import { traderDateString, daysBetweenDateStrings } from './traderTime';

/**
 * Calculates planned R based on direction
 */
export function calculatePlannedR(
  direction: 'LONG' | 'SHORT',
  entry: number,
  stop: number,
  target: number
): number {
  if (direction === 'LONG') {
    const riskDistance = entry - stop;
    if (riskDistance <= 0) return 0;
    const rewardDistance = target - entry;
    return Number((rewardDistance / riskDistance).toFixed(2));
  } else {
    const riskDistance = stop - entry;
    if (riskDistance <= 0) return 0;
    const rewardDistance = entry - target;
    return Number((rewardDistance / riskDistance).toFixed(2));
  }
}

/**
 * Calculates realized R based on direction and actual exit price
 */
export function calculateRealizedR(
  direction: 'LONG' | 'SHORT',
  entry: number,
  stop: number,
  exit: number
): number {
  if (direction === 'LONG') {
    const riskDistance = entry - stop;
    if (riskDistance <= 0) return 0;
    const realizedDiff = exit - entry;
    return Number((realizedDiff / riskDistance).toFixed(2));
  } else {
    const riskDistance = stop - entry;
    if (riskDistance <= 0) return 0;
    const realizedDiff = entry - exit;
    return Number((realizedDiff / riskDistance).toFixed(2));
  }
}

/**
 * Validates trade parameters against active Trading HQ rules
 */
export function evaluateRiskViolations(
  trade: Partial<Trade>,
  config: TradingHQConfig,
  currentDayLossCount: number
): string[] {
  const violations: string[] = [];

  if (trade.plannedR !== undefined && trade.plannedR < 3.0) {
    violations.push(`Planned R (${trade.plannedR}R) is below minimum threshold of 3.0R.`);
  }

  if (currentDayLossCount >= config.riskRules.maxDailyLosses) {
    violations.push(`Max daily loss limit of ${config.riskRules.maxDailyLosses} hit. Trading halted.`);
  }

  if (trade.setupGrade === 'A+' && trade.plannedR !== undefined && trade.plannedR < 5.0) {
    violations.push('A+ setup grade strictly requires ≥5.0R or structural ≥3.0R confluence.');
  }

  return violations;
}

/**
 * Compute performance analytics across a collection of trades
 */
export function computePerformanceStats(trades: Trade[], config: TradingHQConfig): PerformanceStats {
  const closedTrades = trades.filter((t) => t.status === 'CLOSED');

  if (closedTrades.length === 0) {
    return {
      totalTrades: 0,
      totalR: 0,
      todayR: 0,
      weeklyR: 0,
      monthlyR: 0,
      winRate: 0,
      expectancy: 0,
      maxDrawdownR: 0,
      consecutiveLosses: 0,
      avgRWin: 0,
      avgRLoss: 0,
      goodProcessLossPct: 0,
      badProcessWinPct: 0,
      lossCountToday: 0,
      riskStatus: 'NORMAL',
    };
  }

  const todayStr = traderDateString();

  let totalR = 0;
  let todayR = 0;
  let weeklyR = 0;
  let monthlyR = 0;
  let wins = 0;
  let winRSums = 0;
  let losses = 0;
  let lossRSums = 0;
  let lossCountToday = 0;
  let currentLossStreak = 0;

  let peakR = 0;
  let maxDrawdownR = 0;
  let runningR = 0;

  let goodProcessLossCount = 0;
  let badProcessWinCount = 0;
  let scratchCount = 0;

  // Sort by the trade's actual date (then logged time as a tiebreaker for
  // same-day trades) — not by `timestamp` (when it was entered into the
  // system). Those two can diverge for any backfilled/imported trade, which
  // would otherwise silently corrupt the equity curve the drawdown is
  // computed from.
  const sorted = [...closedTrades].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? -1 : 1;
    return a.timestamp - b.timestamp;
  });

  sorted.forEach((trade) => {
    const r = trade.realizedR || 0;
    totalR += r;
    runningR += r;

    if (runningR > peakR) {
      peakR = runningR;
    }
    const currentDd = peakR - runningR;
    if (currentDd > maxDrawdownR) {
      maxDrawdownR = currentDd;
    }

    if (trade.date === todayStr) {
      todayR += r;
      if (r < 0 || (config.riskRules.scratchCountsAsLoss && r === 0)) {
        lossCountToday++;
      }
    }

    // Age in calendar days from the trade's own date to today, in the
    // trader's timezone — not elapsed wall-clock time since it was logged.
    const tradeAgeDays = daysBetweenDateStrings(trade.date, todayStr);
    if (tradeAgeDays >= 0 && tradeAgeDays <= 7) {
      weeklyR += r;
    }
    if (tradeAgeDays >= 0 && tradeAgeDays <= 30) {
      monthlyR += r;
    }

    if (r > 0) {
      wins++;
      winRSums += r;
      currentLossStreak = 0;
      if (trade.processScore && trade.processScore.score < 4) {
        badProcessWinCount++;
      }
    } else if (r < 0) {
      losses++;
      lossRSums += Math.abs(r);
      currentLossStreak++;
      if (trade.processScore && trade.processScore.score >= 4) {
        goodProcessLossCount++;
      }
    } else {
      // Scratch (realizedR === 0): per Trading HQ's own scratchCountsAsLoss
      // rule — the same rule JournalView uses to label the outcome
      // 'SCRATCH' as not a win — a scratch either continues the loss streak
      // or, if the rule is off, breaks it (it's not a loss, but it's not a
      // win either). Scratches never affect avgRLoss (0R has no magnitude),
      // but they do count toward the good-process-loss rate when the rule
      // treats them as loss-like, via the separate lossLikeCount below.
      scratchCount++;
      if (config.riskRules.scratchCountsAsLoss) {
        currentLossStreak++;
        if (trade.processScore && trade.processScore.score >= 4) {
          goodProcessLossCount++;
        }
      } else {
        currentLossStreak = 0;
      }
    }
  });

  const winRate = closedTrades.length > 0 ? Number(((wins / closedTrades.length) * 100).toFixed(1)) : 0;
  const avgRWin = wins > 0 ? Number((winRSums / wins).toFixed(2)) : 0;
  const avgRLoss = losses > 0 ? Number((lossRSums / losses).toFixed(2)) : 1;

  // Expectancy formula: (WinRate * AvgWin) - (LossRate * AvgLoss)
  const winRateDec = wins / closedTrades.length;
  const lossRateDec = losses / closedTrades.length;
  const expectancy = Number((winRateDec * avgRWin - lossRateDec * avgRLoss).toFixed(2));

  let riskStatus: 'NORMAL' | 'WARNING' | 'MAX_LOSS_HALT' = 'NORMAL';
  if (lossCountToday >= config.riskRules.maxDailyLosses) {
    riskStatus = 'MAX_LOSS_HALT';
  } else if (lossCountToday === config.riskRules.maxDailyLosses - 1) {
    riskStatus = 'WARNING';
  }

  const lossLikeCount = losses + (config.riskRules.scratchCountsAsLoss ? scratchCount : 0);
  const goodProcessLossPct = lossLikeCount > 0 ? Number(((goodProcessLossCount / lossLikeCount) * 100).toFixed(1)) : 0;
  const badProcessWinPct = wins > 0 ? Number(((badProcessWinCount / wins) * 100).toFixed(1)) : 0;

  return {
    totalTrades: closedTrades.length,
    totalR: Number(totalR.toFixed(2)),
    todayR: Number(todayR.toFixed(2)),
    weeklyR: Number(weeklyR.toFixed(2)),
    monthlyR: Number(monthlyR.toFixed(2)),
    winRate,
    expectancy,
    maxDrawdownR: Number(maxDrawdownR.toFixed(2)),
    consecutiveLosses: currentLossStreak,
    avgRWin,
    avgRLoss,
    goodProcessLossPct,
    badProcessWinPct,
    lossCountToday,
    riskStatus,
  };
}

/**
 * Determine Process Category string
 */
export function determineProcessCategory(score: ProcessScore, outcome?: 'WIN' | 'LOSS' | 'SCRATCH'): 'GOOD_PROCESS_WIN' | 'GOOD_PROCESS_LOSS' | 'BAD_PROCESS_WIN' | 'BAD_PROCESS_LOSS' {
  const isGood = score.score >= 4;
  const isWin = outcome === 'WIN';
  if (isGood && isWin) return 'GOOD_PROCESS_WIN';
  if (isGood && !isWin) return 'GOOD_PROCESS_LOSS';
  if (!isGood && isWin) return 'BAD_PROCESS_WIN';
  return 'BAD_PROCESS_LOSS';
}
