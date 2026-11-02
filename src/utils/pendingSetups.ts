import type { PendingSetup, ProcessScore, Trade, TradingHQConfig } from '../types';
import { calculatePlannedR, evaluateRiskViolations } from './tradingCalculations';
import { evaluateSessionCheck, traderDateString } from './traderTime';
import { scoreProcess } from './tradeIntegrity';

export interface TriggerInput {
  /** When the entry filled. */
  entryAt: Date;
  /** Actual fill price, if different from the planned entry (slippage). */
  fillPrice?: number;
  /** Process checks confirmed in the trigger dialog (Session is overridden by the rule). */
  checks: Omit<ProcessScore, 'score'>;
}

export type NewTrade = Omit<Trade, 'id' | 'timestamp' | 'configVersionUsed'>;

/** The Journal trade a triggered setup becomes. Nothing is re-typed: prices,
 * grade, model, narrative and screenshots carry over. Session scoring uses
 * the entry time in NY time, exactly as for a manually logged trade. */
export function setupToTrade(setup: PendingSetup, input: TriggerInput, hq: TradingHQConfig, lossCountToday: number): NewTrade {
  if (setup.status !== 'PENDING') throw new Error('Only a pending setup can be triggered.');
  const entryPrice = input.fillPrice !== undefined && Number.isFinite(input.fillPrice) ? input.fillPrice : setup.entryPrice;
  const plannedR = calculatePlannedR(setup.direction, entryPrice, setup.stopPrice, setup.targetPrice);
  const session = evaluateSessionCheck(hq.sessions, input.entryAt, setup.timeframe);
  const violations = evaluateRiskViolations({ plannedR, setupGrade: setup.setupGrade }, hq, lossCountToday);
  if (session.outWindow) violations.push(`${setup.timeframe} entry outside the session windows (OUT_WINDOW).`);
  const processScore = scoreProcess({ ...input.checks, session: session.pass });
  const [first, ...rest] = setup.screenshots;
  return {
    date: traderDateString(input.entryAt),
    entryAt: input.entryAt.toISOString(),
    asset: setup.asset,
    direction: setup.direction,
    timeframe: setup.timeframe,
    session: session.session?.name ?? 'Outside windows',
    modelId: setup.modelId,
    setupGrade: setup.setupGrade,
    narrative: setup.narrative,
    setupReasoning: setup.setupReasoning,
    entryPrice,
    stopPrice: setup.stopPrice,
    targetPrice: setup.targetPrice,
    plannedR,
    status: 'OPEN',
    processScore,
    violations,
    mistakeCodes: session.outWindow ? ['OUT_WINDOW'] : [],
    screenshots: {
      before: first,
      additional: rest.length ? rest.map((url, i) => ({ id: `setup-${setup.id}-${i}`, url, title: `Setup chart ${i + 2}` })) : undefined,
    },
    notesDuring: entryPrice !== setup.entryPrice ? `Filled at ${entryPrice} (planned ${setup.entryPrice}).` : '',
    reflectionAfter: '',
    fromSetupId: setup.id,
  };
}

/** Pending setups past their valid-until date (shown, never auto-changed). */
export function isPastValidity(setup: PendingSetup, today: string): boolean {
  return setup.status === 'PENDING' && !!setup.validUntil && setup.validUntil < today;
}

export function setupStats(setups: PendingSetup[]) {
  const by = (s: PendingSetup['status']) => setups.filter((x) => x.status === s).length;
  const triggered = by('TRIGGERED');
  const resolved = triggered + by('INVALIDATED') + by('EXPIRED');
  return {
    pending: by('PENDING'),
    triggered,
    invalidated: by('INVALIDATED'),
    expired: by('EXPIRED'),
    triggerRate: resolved ? Math.round((triggered / resolved) * 100) : null,
  };
}
