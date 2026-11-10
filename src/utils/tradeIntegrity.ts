import type { BreakevenRecord, ProcessScore, SetupGradeRule, Trade, TradeAmendmentChange } from '../types';
import { calculatePlannedR, calculateRealizedR, determineProcessCategory } from './tradingCalculations';

/**
 * Trade integrity rules — the code side of "never rewrite a trade after the
 * fact". Once a trade is closed (or voided), its evidence fields can only
 * change through a logged amendment with a reason. The database enforces the
 * same rule with a trigger (see supabase/migrations/20261029000000_trade_lock_amendments.sql),
 * so this file is the friendly front door, not the only guard.
 */

/** Fields that ARE the record of what happened. Keep in sync with the
 * `locked_keys` array in the trade-lock migration's trigger. */
export const EVIDENCE_FIELDS = [
  'date', 'asset', 'direction', 'timeframe', 'session', 'modelId', 'setupGrade',
  'narrative', 'setupReasoning', 'entryPrice', 'stopPrice', 'targetPrice', 'exitPrice',
  'plannedR', 'realizedR', 'status', 'outcome', 'processScore', 'processCategory',
  'mistakeCodes', 'violations', 'configVersionUsed', 'closedAt', 'voided',
  'entryAt', 'breakeven', 'riskPercentAtEntry',
] as const;

/** Documentation that can still be added to after a trade closes: a reflection
 * written that evening, an exit screenshot, links to a psychology entry or
 * research question. None of these change the trade's numbers or verdict. */
export const FREE_AFTER_CLOSE_FIELDS = [
  'reflectionAfter', 'notesDuring', 'screenshots', 'linkedPsychologyId', 'linkedResearchQuestionId',
] as const;

/** What an amendment may correct. Deliberately excludes the pre-trade
 * narrative/reasoning (that was the commitment — rewriting it later is exactly
 * what the lock exists to stop) and the bookkeeping fields. Derived fields
 * (plannedR, realizedR, processCategory, score) are recomputed, never typed. */
export type AmendablePatch = Partial<Pick<Trade,
  'date' | 'asset' | 'direction' | 'timeframe' | 'session' | 'modelId' | 'setupGrade' |
  'entryPrice' | 'stopPrice' | 'targetPrice' | 'exitPrice' | 'outcome' | 'processScore' | 'mistakeCodes' |
  'entryAt' | 'breakeven'
>>;

export function isTradeLocked(trade: Trade): boolean {
  return trade.status === 'CLOSED' || !!trade.voided;
}

/** Voided trades (duplicates, logged by mistake) stay visible but don't feed stats. */
export function isCountedTrade(trade: Trade): boolean {
  return !trade.voided;
}

export function scoreProcess(checks: Omit<ProcessScore, 'score'> | ProcessScore): ProcessScore {
  const { session, grade, risk, management, structure } = checks;
  const score = [session, grade, risk, management, structure].filter(Boolean).length;
  return { session, grade, risk, management, structure, score };
}

export function outcomeFromR(realizedR: number): 'WIN' | 'LOSS' | 'SCRATCH' {
  return realizedR > 0 ? 'WIN' : realizedR < 0 ? 'LOSS' : 'SCRATCH';
}

export interface CloseTradeInput {
  exitPrice: number;
  /** Set if the stop was moved to breakeven during the trade. */
  breakeven?: BreakevenRecord;
  /** Optional override, e.g. a tiny positive R the trader counts as a scratch. */
  outcome?: 'WIN' | 'LOSS' | 'SCRATCH';
  processScore: ProcessScore;
  mistakeCodes: string[];
}

export function buildClosedTrade(trade: Trade, input: CloseTradeInput, now = Date.now()): Trade {
  if (isTradeLocked(trade)) throw new Error('This trade is already closed — corrections go through an amendment.');
  if (!Number.isFinite(input.exitPrice)) throw new Error('Enter a valid exit price before closing the trade.');
  const realizedR = calculateRealizedR(trade.direction, trade.entryPrice, trade.stopPrice, input.exitPrice);
  const outcome = input.outcome ?? outcomeFromR(realizedR);
  const processScore = scoreProcess(input.processScore);
  return {
    ...trade,
    exitPrice: input.exitPrice,
    realizedR,
    outcome,
    processScore,
    processCategory: determineProcessCategory(processScore, outcome),
    mistakeCodes: [...input.mistakeCodes],
    ...(input.breakeven ? { breakeven: { ...input.breakeven } } : {}),
    status: 'CLOSED',
    closedAt: now,
  };
}

/** Apply a correction to a locked trade, recomputing every derived field so an
 * amendment can never leave R / outcome / category inconsistent. */
export function applyAmendment(trade: Trade, patch: AmendablePatch): Trade {
  const next: Trade = { ...trade, ...patch };
  next.plannedR = calculatePlannedR(next.direction, next.entryPrice, next.stopPrice, next.targetPrice);
  if (next.exitPrice !== undefined && Number.isFinite(next.exitPrice)) {
    next.realizedR = calculateRealizedR(next.direction, next.entryPrice, next.stopPrice, next.exitPrice);
  }
  const priceChanged = ['direction', 'entryPrice', 'stopPrice', 'exitPrice'].some((k) => k in patch);
  if (patch.outcome === undefined && priceChanged && next.realizedR !== undefined) {
    next.outcome = outcomeFromR(next.realizedR);
  }
  next.processScore = scoreProcess(next.processScore);
  if (next.outcome) next.processCategory = determineProcessCategory(next.processScore, next.outcome);
  return next;
}

/** Field-by-field list of what changed in the evidence, for the amendment log. */
export function diffEvidence(before: Trade, after: Trade): TradeAmendmentChange[] {
  const changes: TradeAmendmentChange[] = [];
  for (const field of EVIDENCE_FIELDS) {
    const from = (before as unknown as Record<string, unknown>)[field];
    const to = (after as unknown as Record<string, unknown>)[field];
    if (JSON.stringify(from) !== JSON.stringify(to)) changes.push({ field, from: from ?? null, to: to ?? null });
  }
  return changes;
}

/** Guard for plain updates: on a locked trade only documentation fields may change. */
export function assertFreeUpdate(trade: Trade, patch: Partial<Trade>) {
  if (!isTradeLocked(trade)) return;
  const blocked = Object.keys(patch).filter((k) => !(FREE_AFTER_CLOSE_FIELDS as readonly string[]).includes(k));
  if (blocked.length > 0) {
    throw new Error(`This trade is locked. ${blocked.join(', ')} can only change through an amendment with a reason.`);
  }
}

/** The breakeven rule by grade (Trading HQ 2026-11-02): BE is allowed at the
 * grade's `breakevenAtR` or later, or any time for a structural reason. Anything
 * else is BE_EARLY. Returns null when no BE move was recorded or the grade has
 * no R rule. */
export function breakevenVerdict(
  breakeven: BreakevenRecord | undefined,
  grade: SetupGradeRule | undefined,
): { early: boolean; reason: string } | null {
  if (!breakeven) return null;
  if (breakeven.structural) return { early: false, reason: 'Structural breakeven: allowed at any R.' };
  if (grade?.breakevenAtR === undefined) return null;
  if (breakeven.movedAtR + 1e-9 >= grade.breakevenAtR) {
    return { early: false, reason: `Moved at ${breakeven.movedAtR}R; ${grade.grade} allows breakeven from ${grade.breakevenAtR}R.` };
  }
  return { early: true, reason: `Moved at ${breakeven.movedAtR}R without a structural reason; ${grade.grade} only allows breakeven from ${grade.breakevenAtR}R → BE_EARLY.` };
}
