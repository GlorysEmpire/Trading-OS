/**
 * Pure decomposition logic (M0). No UI, no storage, no clock: callers pass
 * in everything, including the definitions to apply.
 */
import type {
  Bias, DailyLayer, Decomposition, DecompositionDefinitions, Depth, GateResult, LayerData, LayerTimeframe,
  LayerVersion, LegCriteria, LegType, LiquidityLevel, Location, Poi, PoiCheck, PriceRange, Step, Trend, WeeklyLayer,
  BacktestOutcome,
} from './types';

// ---- Price math -------------------------------------------------------------

export const isIdentified = <T>(s: Step<T> | undefined): s is Step<T> & { value: T } => s?.status === 'IDENTIFIED' && s.value !== undefined;

const finite = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n);

export function validRange(r: PriceRange | undefined): r is PriceRange {
  return !!r && finite(r.high) && finite(r.low) && r.high > r.low;
}

/** The 50% of a dealing range. */
export function equilibrium(range: PriceRange): number {
  return (range.high + range.low) / 2;
}

/** Where a price sits in the range. The band widens equilibrium around 50% (in % of range). */
export function locationOf(price: number, range: PriceRange, bandPct = 0): Location {
  const pct = ((price - range.low) / (range.high - range.low)) * 100;
  if (pct > 50 + bandPct) return 'PREMIUM';
  if (pct < 50 - bandPct) return 'DISCOUNT';
  return 'EQUILIBRIUM';
}

/** Leg type from the four criteria and the definitions' thresholds. */
export function legTypeOf(criteria: LegCriteria, defs: DecompositionDefinitions): LegType {
  const met = [criteria.rangeVsAtr, criteria.closesInOuterPart, criteria.lowBodyOverlap, criteria.unmitigatedFvg].filter(Boolean).length;
  if (met >= defs.strongLeg.strongMin) return 'STRONG';
  if (met <= defs.strongLeg.weakMax) return 'WEAK';
  return 'INCONCLUSIVE';
}

/**
 * R from a POI to the draw. Entry at the POI's near edge (the edge price
 * reaches first), stop at its far edge or at the invalidation, per definitions.
 * Undefined when it can't be measured (target on the wrong side, no risk).
 */
export function rToDraw(poi: Poi, target: number, invalidation: number | undefined, defs: DecompositionDefinitions): number | undefined {
  const sell = poi.side === 'SELL';
  const entry = sell ? poi.low : poi.high;
  const stop = defs.rStopBasis === 'INVALIDATION' && finite(invalidation) ? invalidation : sell ? poi.high : poi.low;
  const risk = sell ? stop - entry : entry - stop;
  const reward = sell ? entry - target : target - entry;
  if (!(risk > 0) || !(reward > 0)) return undefined;
  return Math.round((reward / risk) * 100) / 100;
}

// ---- POI checks ----------------------------------------------------------------

/** Validates a POI against location, mitigation, inducement and R to the draw. */
export function checkPoi(
  poi: Poi,
  role: 'PRIMARY' | 'BACKUP',
  ctx: { range?: PriceRange; trend?: Trend; inducementIdentified: boolean; target?: number; invalidation?: number },
  defs: DecompositionDefinitions,
): PoiCheck {
  const problems: string[] = [];
  let location: Location = 'EQUILIBRIUM';
  if (!(finite(poi.high) && finite(poi.low) && poi.high > poi.low)) problems.push('The POI needs a high above its low.');
  if (validRange(ctx.range)) {
    location = locationOf((poi.high + poi.low) / 2, ctx.range, defs.equilibriumBandPct);
    if (poi.side === 'SELL' && location !== 'PREMIUM') problems.push(`A sell POI must be in premium; this one is in ${location.toLowerCase()}.`);
    if (poi.side === 'BUY' && location !== 'DISCOUNT') problems.push(`A buy POI must be in discount; this one is in ${location.toLowerCase()}.`);
  } else {
    problems.push('No dealing range, so premium or discount cannot be judged.');
  }
  if (ctx.trend && ((ctx.trend === 'BEARISH' && poi.side === 'BUY') || (ctx.trend === 'BULLISH' && poi.side === 'SELL'))) {
    problems.push(`A ${poi.side.toLowerCase()} POI goes against the ${ctx.trend.toLowerCase()} daily structure.`);
  }
  if (poi.mitigated) problems.push('The POI is already mitigated.');
  if (ctx.inducementIdentified && !poi.beyondInducement) problems.push('The POI sits before the inducement, not beyond it.');
  let r: number | undefined;
  if (finite(ctx.target)) {
    r = rToDraw(poi, ctx.target, ctx.invalidation, defs);
    if (r === undefined) problems.push('R to the draw cannot be measured: the target is on the wrong side of the POI.');
    else if (r < defs.minRToDraw) problems.push(`Only ${r}R to the draw; the minimum is ${defs.minRToDraw}R.`);
  } else {
    problems.push('No target, so R to the draw cannot be measured.');
  }
  return { poi, role, location, rToDraw: r, valid: problems.length === 0, problems };
}

// ---- Depth expectation -------------------------------------------------------

/**
 * Suggested depth (a hypothesis the trader confirms): intent from the leg
 * first, then liquidity. Unswept internal liquidity beyond the nearest POI,
 * in the retracement direction, points deep even after a strong leg.
 */
export function depthExpectation(
  leg: LegType | undefined,
  side: 'SELL' | 'BUY' | undefined,
  levels: LiquidityLevel[],
  nearestPoi: Poi | undefined,
): { depth?: Depth; reason: string } {
  if (side && nearestPoi) {
    const beyond = levels.filter((l) => !l.swept && (side === 'SELL'
      ? (l.kind === 'INTERNAL_HIGH' || l.kind === 'EQUAL_HIGHS') && l.price > nearestPoi.high
      : (l.kind === 'INTERNAL_LOW' || l.kind === 'EQUAL_LOWS') && l.price < nearestPoi.low));
    if (beyond.length) return { depth: 'DEEP', reason: `Unswept internal liquidity sits beyond the nearest POI (${beyond.map((l) => l.price).join(', ')}), so price may go deep to take it.` };
  }
  if (leg === 'STRONG') return { depth: 'SHALLOW', reason: 'Strong leg and no untaken internal liquidity beyond the nearest POI: expect a shallow retracement.' };
  if (leg === 'WEAK') return { depth: 'DEEP', reason: 'Weak leg: expect a deeper retracement.' };
  return { reason: 'Leg type is inconclusive; judge depth from the liquidity map.' };
}

// ---- Gates -----------------------------------------------------------------------

export type DraftWeekly = Partial<Omit<WeeklyLayer, 'timeframe'>>;
export type DraftDaily = Partial<Omit<DailyLayer, 'timeframe'>>;

/** Weekly is never a hard stop: inconclusive makes the HTF neutral and the Daily carries the read. */
export function weeklyBias(w: DraftWeekly): Bias {
  return isIdentified(w.trend) ? w.trend.value.trend : 'NEUTRAL';
}

export function evaluateWeekly(w: DraftWeekly): GateResult {
  const missing = WEEKLY_KEYS.find((k) => !w[k]);
  if (missing) return { verdict: 'INCOMPLETE', reason: 'Weekly steps still to answer.', stoppedAt: missing };
  if (weeklyBias(w) === 'NEUTRAL') return { verdict: 'CONTEXT_READY', reason: 'Weekly structure is inconclusive: the higher timeframe is neutral and the Daily carries the read.' };
  return { verdict: 'CONTEXT_READY', reason: `Weekly context is ${weeklyBias(w).toLowerCase()}.` };
}

export const WEEKLY_KEYS = ['trend', 'dealingRange', 'draw', 'pois'] as const;
export const DAILY_KEYS = ['structure', 'dealingRange', 'phase', 'leg', 'candles', 'liquidity', 'depth', 'pois', 'targetInvalidation'] as const;

/** All POI checks for a daily read (primary first). */
export function dailyPoiChecks(d: DraftDaily, defs: DecompositionDefinitions): PoiCheck[] {
  if (!isIdentified(d.pois)) return [];
  const ctx = {
    range: isIdentified(d.dealingRange) ? d.dealingRange.value : undefined,
    trend: isIdentified(d.structure) && !(isIdentified(d.phase) && d.phase.value === 'RANGE') ? d.structure.value.trend : undefined,
    inducementIdentified: isIdentified(d.liquidity) && !!d.liquidity.value.inducementId,
    target: isIdentified(d.targetInvalidation) ? d.targetInvalidation.value.target : undefined,
    invalidation: isIdentified(d.targetInvalidation) ? d.targetInvalidation.value.invalidation : undefined,
  };
  const out: PoiCheck[] = [];
  if (d.pois.value.primary) out.push(checkPoi(d.pois.value.primary, 'PRIMARY', ctx, defs));
  if (d.pois.value.backup) out.push(checkPoi(d.pois.value.backup, 'BACKUP', ctx, defs));
  return out;
}

/**
 * The Daily gates, applied in step order so the flow stops at the first one that fails:
 * 1. Structure inconclusive and no dealing range → leave the chart.
 * 2. No valid POI with ≥ min R to the draw → observation only.
 */
export function evaluateDaily(d: DraftDaily, defs: DecompositionDefinitions): GateResult {
  if (d.structure && d.dealingRange && !isIdentified(d.structure) && !isIdentified(d.dealingRange)) {
    return { verdict: 'LEAVE_CHART', reason: 'Leave the chart: the daily structure is inconclusive and there is no dealing range.', stoppedAt: 'dealingRange' };
  }
  const missing = DAILY_KEYS.find((k) => !d[k]);
  if (missing) return { verdict: 'INCOMPLETE', reason: 'Daily steps still to answer.', stoppedAt: missing };
  if (!isIdentified(d.targetInvalidation)) {
    return { verdict: 'OBSERVATION_ONLY', reason: 'Observation only: no target, so there is no draw to measure R to.', stoppedAt: 'targetInvalidation' };
  }
  const checks = dailyPoiChecks(d, defs);
  if (!checks.length) return { verdict: 'OBSERVATION_ONLY', reason: 'Observation only: no POI identified.', stoppedAt: 'pois' };
  if (!checks.some((c) => c.valid)) {
    const first = checks[0];
    return { verdict: 'OBSERVATION_ONLY', reason: `Observation only: no POI has ${defs.minRToDraw}R or more to the draw with every rule met. ${first.role === 'PRIMARY' ? 'POI A' : 'POI B'}: ${first.problems[0]}`, stoppedAt: 'pois' };
  }
  const best = checks.find((c) => c.valid)!;
  return { verdict: 'WATCH_POI', reason: `Wait for price at ${best.role === 'PRIMARY' ? 'POI A' : 'POI B'} (${best.rToDraw}R to the draw).` };
}

/** The next step to ask, or undefined when the layer is finished or stopped by a gate. */
export function nextStep(timeframe: LayerTimeframe, draft: DraftWeekly | DraftDaily, defs: DecompositionDefinitions): string | undefined {
  if (timeframe === 'WEEKLY') return WEEKLY_KEYS.find((k) => !(draft as DraftWeekly)[k]);
  const d = draft as DraftDaily;
  if (evaluateDaily(d, defs).verdict === 'LEAVE_CHART') return undefined;
  return DAILY_KEYS.find((k) => !d[k]);
}

// ---- Versions (append-only) ------------------------------------------------------

export function latestLayer<T extends LayerTimeframe>(dec: Decomposition, timeframe: T): LayerVersion<Extract<LayerData, { timeframe: T }>> | undefined {
  const list = dec.layers.filter((l) => l.timeframe === timeframe).sort((a, b) => b.version - a.version);
  return list[0] as LayerVersion<Extract<LayerData, { timeframe: T }>> | undefined;
}

export function layerHistory(dec: Decomposition, timeframe: LayerTimeframe): LayerVersion[] {
  return dec.layers.filter((l) => l.timeframe === timeframe).sort((a, b) => a.version - b.version);
}

/**
 * Adds a new version of one layer, leaving every other layer and every past
 * version untouched. In BACKTEST mode a version is a locked prediction the
 * moment it is saved, and nothing can be added once the outcome is recorded.
 */
export function appendLayerVersion(
  dec: Decomposition,
  input: { id: string; asOf: string; createdAt: string; definitionsVersion: string; data: LayerData },
): Decomposition {
  if (dec.mode === 'BACKTEST' && dec.outcome) throw new Error('This backtest is closed: the outcome is recorded, so its predictions can no longer change.');
  const version = Math.max(0, ...layerHistory(dec, input.data.timeframe).map((l) => l.version)) + 1;
  const layer: LayerVersion = {
    id: input.id,
    decompositionId: dec.id,
    timeframe: input.data.timeframe,
    version,
    asOf: input.asOf,
    definitionsVersion: input.definitionsVersion,
    createdAt: input.createdAt,
    data: input.data,
    ...(dec.mode === 'BACKTEST' ? { lockedAt: input.createdAt } : {}),
  };
  return { ...dec, layers: [...dec.layers, layer] };
}

/** BACKTEST only, once, after a daily prediction exists. */
export function recordOutcome(dec: Decomposition, outcome: BacktestOutcome): Decomposition {
  if (dec.mode !== 'BACKTEST') throw new Error('Outcomes are recorded only on backtests.');
  if (dec.outcome) throw new Error('The outcome is already recorded and cannot be changed.');
  if (!latestLayer(dec, 'DAILY')) throw new Error('Lock a daily read before recording what price did.');
  if (dec.layers.some((l) => !l.lockedAt)) throw new Error('Every prediction must be locked before the outcome.');
  return { ...dec, outcome };
}

/** A backtest counts toward its research question once its outcome is recorded. */
export function countsTowardResearch(dec: Decomposition, researchQuestionId: string): boolean {
  return dec.mode === 'BACKTEST' && !!dec.outcome && dec.researchQuestionId === researchQuestionId;
}

export function researchSampleCount(decs: Decomposition[], researchQuestionId: string): number {
  return decs.filter((d) => countsTowardResearch(d, researchQuestionId)).length;
}
