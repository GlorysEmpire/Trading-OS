/**
 * Backtest link (M5). A backtest is a Structural Record in BACKTEST mode,
 * read on replay. Each saved layer is a locked prediction (the database sets
 * locked_at on insert). The outcome is recorded once, against the locked
 * Daily read, and turns into a research sample. Pure.
 */
import type { BacktestSample } from '../types';
import type { BacktestOutcome, DailyLayer, Decomposition, DecompositionDefinitions } from './types';
import { dailyPoiChecks, evaluateDaily, isIdentified, latestLayer, recordOutcome } from './logic';
import { summarize } from './summary';

/** What can be done with a backtest right now. */
export function backtestState(rec: Decomposition): 'NEEDS_READ' | 'AWAITING_OUTCOME' | 'DONE' {
  if (rec.outcome) return 'DONE';
  return latestLayer(rec, 'DAILY') ? 'AWAITING_OUTCOME' : 'NEEDS_READ';
}

/** Records the outcome against the locked Daily read (once). */
export function closeBacktest(rec: Decomposition, outcome: Omit<BacktestOutcome, 'predictionLayerId'>): Decomposition {
  const daily = latestLayer(rec, 'DAILY');
  return recordOutcome(rec, { ...outcome, ...(daily ? { predictionLayerId: daily.id } : {}) });
}

/**
 * The research sample a closed backtest produces, from the locked read only
 * (nothing retyped): direction from the POI side, entry at its near edge,
 * stop at its far edge or the invalidation (per definitions), target = the
 * draw. Reached the target = a win at the planned R; hit invalidation = −1R;
 * neither = scratch. Valid setup only when the read said "watch the POI".
 */
export function sampleFromBacktest(rec: Decomposition, defs: DecompositionDefinitions): Omit<BacktestSample, 'id'> {
  if (rec.mode !== 'BACKTEST' || !rec.outcome) throw new Error('Record the backtest outcome first.');
  const o = rec.outcome;
  const layer = (o.predictionLayerId && rec.layers.find((l) => l.id === o.predictionLayerId)) || latestLayer(rec, 'DAILY');
  if (!layer || layer.timeframe !== 'DAILY') throw new Error('This backtest has no locked Daily read.');
  const d = layer.data as DailyLayer;
  const checks = dailyPoiChecks(d, defs);
  const chosen = checks.find((c) => c.poi.id === o.reactedPoiId) ?? checks.find((c) => c.valid) ?? checks[0];
  const gate = evaluateDaily(d, defs);
  const ti = isIdentified(d.targetInvalidation) ? d.targetInvalidation.value : undefined;
  const sell = chosen?.poi.side === 'SELL';
  const entry = chosen ? (sell ? chosen.poi.low : chosen.poi.high) : 0;
  const stop = chosen ? (defs.rStopBasis === 'INVALIDATION' && ti ? ti.invalidation : sell ? chosen.poi.high : chosen.poi.low) : 0;
  const result = o.result === 'REACHED_TARGET' ? 'WIN' : o.result === 'HIT_INVALIDATION' ? 'LOSS' : 'SCRATCH';
  const realizedR = result === 'WIN' ? chosen?.rToDraw ?? 0 : result === 'LOSS' ? -1 : 0;
  const s = summarize({ ...rec, layers: rec.layers.filter((l) => l.timeframe !== 'DAILY' || l.id === layer.id) }, () => defs, defs);
  const outcomeText = o.result === 'REACHED_TARGET' ? 'reached the target' : o.result === 'HIT_INVALIDATION' ? 'hit the invalidation' : 'did neither';
  return {
    researchQuestionId: rec.researchQuestionId ?? '',
    asset: rec.symbol,
    date: layer.asOf.slice(0, 10),
    marketRegime: isIdentified(d.phase) ? d.phase.value.toLowerCase() : 'not read',
    narrative: s.sentence,
    setupModel: 'Decomposition read (structural)',
    direction: sell ? 'SHORT' : 'LONG',
    entry,
    stop,
    target: ti?.target ?? 0,
    result,
    realizedR,
    isValidSetup: gate.verdict === 'WATCH_POI',
    evidence: `Locked Daily read v${layer.version} (as of ${layer.asOf}, definitions ${layer.definitionsVersion}). Price ${outcomeText}${o.depthReached ? `, depth ${o.depthReached.toLowerCase()}` : ''}${o.candlesToOutcome !== undefined ? ` after ${o.candlesToOutcome} daily candle${o.candlesToOutcome === 1 ? '' : 's'}` : ''}.`,
    notes: o.notes ?? '',
    decompositionRecordId: rec.id,
  };
}
