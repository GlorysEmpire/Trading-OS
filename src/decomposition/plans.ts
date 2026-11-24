/**
 * Period plans (M0.2): Monthly, Weekly and Daily plans on one template
 * (plan v0.5, P0–P8). Built on M0/M0.1 pieces, unchanged:
 * - the structural gate reuses morningGate / currentStructuralRef / resolveStructural;
 * - the Day plan's POI and R gates reuse evaluateDaily (checkPoi, rToDraw);
 * - versions stay append-only on the Structural Record.
 */
import type {
  Cadence, DailyLayer, DayExtras, DecompositionDefinitions, GateResult, PeriodCandle, PeriodGateCheck, PeriodPlan, PeriodRead, PeriodReview,
  ReviewScore, StructuralRecord,
} from './types';
import { evaluateDaily, latestLayer, type DraftDaily } from './logic';
import { currentStructuralRef, morningGate, resolveStructural } from './structural';

export const CADENCE_LABEL: Record<Cadence, string> = { MONTH: 'monthly', WEEK: 'weekly', DAY: 'daily' };
export const CADENCE_TIMEFRAME = { MONTH: 'MONTHLY', WEEK: 'WEEKLY', DAY: 'DAILY' } as const;

/** The cadence one level up: Day → Week → Month → none. */
export function parentCadence(c: Cadence): Cadence | undefined {
  return c === 'DAY' ? 'WEEK' : c === 'WEEK' ? 'MONTH' : undefined;
}

// ---- Period boundaries --------------------------------------------------------

/**
 * Which candle a moment belongs to: the latest candle open at or before it,
 * from the symbol's own chart (feed). Not the NY trading day: a crypto daily
 * on a UTC-open feed and an FX daily on a 17:00 NY-open feed split differently.
 */
export function candleOpenFor(at: string, chartOpens: string[]): string | undefined {
  const t = Date.parse(at);
  let best: string | undefined;
  for (const o of chartOpens) {
    const ot = Date.parse(o);
    if (Number.isFinite(ot) && ot <= t && (best === undefined || ot > Date.parse(best))) best = o;
  }
  return best;
}

/** One plan per symbol, feed, cadence and candle. */
export function periodKey(cadence: Cadence, c: PeriodCandle): string {
  return `${c.symbol.toUpperCase()}|${c.feed.toUpperCase()}|${cadence}|${new Date(c.openTime).toISOString()}`;
}

/** True when the candle has closed (so the review is due). Unknown close → not due. */
export function candleClosed(c: PeriodCandle, now: string): boolean {
  return !!c.closeTime && Date.parse(now) >= Date.parse(c.closeTime);
}

// ---- Steps (one template; Day adds three) --------------------------------------

export type PeriodStepKey = keyof PeriodRead | keyof DayExtras;

export interface PeriodStepDef { key: PeriodStepKey; code: string; question: string; why: string; dayOnly?: boolean; gating?: boolean }

/** In process order. `why` is the one-line "why this matters" shown under each question. */
export const PERIOD_STEPS: PeriodStepDef[] = [
  { key: 'previousCandle', code: 'P1', question: 'How did the previous candle form and close?', why: 'Its close and the high/low it took set the tone for this candle.' },
  { key: 'liquidity', code: 'P2', question: 'Which liquidity was swept, rejected or left outstanding?', why: 'Price runs toward what is left and away from what is taken.' },
  { key: 'asiaRange', code: 'D2', question: 'What is the Asia/Tokyo range?', why: 'Its high and low are often the first liquidity taken in London or NY.', dayOnly: true },
  { key: 'periodType', code: 'P3', question: 'Will this candle expand toward the draw or retrace to a POI first?', why: 'It decides whether you wait for a POI or expect continuation.' },
  { key: 'draw', code: 'P4', question: 'What is the draw for this period?', why: 'The target every POI is measured against.' },
  { key: 'formation', code: 'P5', question: 'Where is the period\'s extreme expected to form: POI A, POI B, shallow or deep?', why: 'This is the best place to participate, with the inducement in front of it.', gating: true },
  { key: 'invalidation', code: 'P6', question: 'What price action proves this plan wrong?', why: 'Knowing where you are wrong keeps the plan honest.', gating: true },
  { key: 'timing', code: 'D7', question: 'In which NY-time window is price likely to reach the POI?', why: 'Trades are only taken inside your session windows.', dayOnly: true },
  { key: 'entryModels', code: 'D7', question: 'Which entry model will you look for at each POI?', why: 'An untested model used live is UNTESTED_MODEL.', dayOnly: true },
  { key: 'narrative', code: 'P7', question: 'Say the plan in one sentence.', why: 'If it doesn\'t fit in a sentence, it isn\'t clear yet.' },
];

export const periodStepsFor = (c: Cadence) => PERIOD_STEPS.filter((s) => c === 'DAY' || !s.dayOnly);

export function nextPeriodStep(plan: PeriodPlan): PeriodStepKey | undefined {
  return periodStepsFor(plan.cadence).find((s) => !plan.read[s.key])?.key;
}

export function answerPeriodStep<K extends PeriodStepKey>(plan: PeriodPlan, key: K, step: (PeriodRead & DayExtras)[K]): PeriodPlan {
  if (plan.review) throw new Error('This plan has been reviewed; it can no longer change.');
  return { ...plan, read: { ...plan.read, [key]: step } };
}

// ---- P0 gate and starting a plan --------------------------------------------------

/** P0, structure part: reuses the M0.1 morning gate. */
export function periodGate(structural: StructuralRecord | undefined, check: PeriodGateCheck | undefined, cadence: Cadence): { ok: boolean; reason: string } {
  const native = structural && latestLayer(structural, CADENCE_TIMEFRAME[cadence]);
  if (cadence !== 'DAY' && native) {
    if (!check) return { ok: false, reason: 'Has structure changed since the last plan?' };
    if (!check.structureChanged) return { ok: true, reason: `Use the existing ${CADENCE_LABEL[cadence]} map.` };
    if (!check.reasons.length || Date.parse(native.createdAt) < Date.parse(check.answeredAt)) return { ok: false, reason: `Update the ${CADENCE_LABEL[cadence]} structural map first.` };
    return { ok: true, reason: 'Structural map updated.' };
  }
  const g = morningGate(structural, check);
  if (g.next === 'START_DAILY') return { ok: true, reason: check?.structureChanged ? 'Structural map updated.' : 'No structural change since the last plan. Use the existing map.' };
  if (g.next === 'ANSWER_MORNING_CHECK' && !check) return { ok: false, reason: 'Has structure changed since the last plan? A body-close BOS or CHoCH, or a POI mitigated or invalidated.' };
  return { ok: false, reason: g.reason.replace("today's read", `the ${CADENCE_LABEL[cadence]} plan`).replace('The daily read sits', 'Every plan sits') };
}

/** Plain notices shown on a plan. They never block. */
export function parentNotice(plan: PeriodPlan, parent: PeriodPlan | undefined): string | undefined {
  const up = parentCadence(plan.cadence);
  if (!up) return undefined;
  if (!parent) return `No ${CADENCE_LABEL[up]} plan yet.`;
  if (plan.gate.higherPlanStands === false) return `The ${CADENCE_LABEL[up]} plan no longer stands; read this ${CADENCE_LABEL[plan.cadence]} plan on its own until it is redone.`;
  return undefined;
}

export function startPeriodPlan(input: {
  id: string;
  cadence: Cadence;
  candle: PeriodCandle;
  createdAt: string;
  structural: StructuralRecord | undefined;
  gate: PeriodGateCheck | undefined;
  parent?: PeriodPlan;
  definitionsVersion: string;
}): PeriodPlan {
  const g = periodGate(input.structural, input.gate, input.cadence);
  if (!g.ok) throw new Error(g.reason);
  const rec = input.structural!;
  const p = input.parent;
  if (p) {
    if (p.cadence !== parentCadence(input.cadence)) throw new Error(`A ${CADENCE_LABEL[input.cadence]} plan's parent must be a ${CADENCE_LABEL[parentCadence(input.cadence) ?? input.cadence]} plan.`);
    if (p.deskId !== rec.deskId) throw new Error('The parent plan is for another asset.');
    if (p.candle.feed !== input.candle.feed || p.mode !== rec.mode) throw new Error('The parent plan must use the same feed and mode.');
    if (Date.parse(p.candle.openTime) > Date.parse(input.candle.openTime)) throw new Error('The parent plan is for a later period.');
  }
  if (!input.candle.symbol.trim() || !input.candle.feed.trim() || !Number.isFinite(Date.parse(input.candle.openTime))) {
    throw new Error('A plan needs the symbol, the data feed and the candle open time from the chart.');
  }
  return {
    id: input.id,
    deskId: rec.deskId,
    cadence: input.cadence,
    candle: input.candle,
    mode: rec.mode,
    createdAt: input.createdAt,
    structuralVersionRef: currentStructuralRef(rec),
    ...(p ? { parentPlanId: p.id } : {}),
    gate: input.gate!,
    definitionsVersion: input.definitionsVersion,
    read: {},
  };
}

// ---- Evaluation ---------------------------------------------------------------

/** The plan laid over its structural Daily layer, in the M0 Daily shape (so M0 gates apply). */
export function periodAsDaily(structural: StructuralRecord, plan: PeriodPlan): DraftDaily {
  const base = resolveStructural(structural, plan.structuralVersionRef).DAILY?.data as DailyLayer | undefined;
  if (!base) throw new Error('This plan has no structural Daily layer to build on.');
  const r = plan.read;
  const pc = r.previousCandle;
  const f = r.formation;
  const d = r.draw;
  const inv = r.invalidation;
  return {
    structure: base.structure,
    dealingRange: base.dealingRange,
    phase: base.phase,
    leg: base.leg,
    candles: pc && (pc.status === 'IDENTIFIED' && pc.value
      ? { status: 'IDENTIFIED', value: { read: pc.value.read === 'INSIDE' ? 'INDECISION' : pc.value.read, closeLocation: pc.value.closeLocation, liquidityEvent: pc.value.took !== 'NONE' } }
      : { status: pc.status }),
    liquidity: r.liquidity && (r.liquidity.status === 'IDENTIFIED' && r.liquidity.value
      ? { status: 'IDENTIFIED', value: { levels: r.liquidity.value.levels, inducementId: r.liquidity.value.inducementId } }
      : { status: r.liquidity.status }),
    depth: f && (f.status === 'IDENTIFIED' && f.value?.depth ? { status: 'IDENTIFIED', value: f.value.depth } : { status: f.status === 'IDENTIFIED' ? 'INCONCLUSIVE' : f.status }),
    pois: f && (f.status === 'IDENTIFIED' && f.value ? { status: 'IDENTIFIED', value: { primary: f.value.primary, backup: f.value.backup } } : { status: f.status }),
    targetInvalidation: d && inv && (d.status === 'IDENTIFIED' && d.value && inv.status === 'IDENTIFIED' && inv.value
      ? { status: 'IDENTIFIED', value: { target: d.value.target, invalidation: inv.value.price } }
      : { status: 'INCONCLUSIVE' }),
  };
}

/**
 * Day plan: M0 Daily gates (leave the chart / observation only / watch POI).
 * Month and Week plans give context only: complete or not, never a trade gate.
 */
export function evaluatePeriodPlan(structural: StructuralRecord, plan: PeriodPlan, defs: DecompositionDefinitions): GateResult {
  const missing = nextPeriodStep(plan);
  if (plan.cadence !== 'DAY') {
    return missing
      ? { verdict: 'INCOMPLETE', reason: `${CADENCE_LABEL[plan.cadence]} plan steps still to answer.`, stoppedAt: missing }
      : { verdict: 'CONTEXT_READY', reason: `The ${CADENCE_LABEL[plan.cadence]} plan is set. Daily plans read inside it.` };
  }
  const g = evaluateDaily(periodAsDaily(structural, plan), defs);
  if (g.verdict === 'WATCH_POI' && missing) return { verdict: 'INCOMPLETE', reason: 'Daily plan steps still to answer.', stoppedAt: missing };
  return g;
}

/** Only a complete Day plan with a valid POI unlocks setups. */
export function unlocksSetups(structural: StructuralRecord, plan: PeriodPlan, defs: DecompositionDefinitions): boolean {
  return plan.cadence === 'DAY' && evaluatePeriodPlan(structural, plan, defs).verdict === 'WATCH_POI';
}

// ---- P8 review and accuracy ------------------------------------------------------

/** Saves the review at the candle close. Once saved it never changes. */
export function reviewPeriodPlan(plan: PeriodPlan, review: PeriodReview): PeriodPlan {
  if (plan.review) throw new Error('This plan is already reviewed; a saved review cannot change.');
  if (!candleClosed(plan.candle, review.savedAt)) throw new Error('Review at the candle close: this candle has not closed yet.');
  if (!review.lesson.trim()) throw new Error('Write one lesson.');
  return { ...plan, review: { ...review, lesson: review.lesson.trim() } };
}

export interface AccuracyStats {
  reviewed: number;
  prediction: Record<ReviewScore, number> & { pct: number };
  process: Record<ReviewScore, number> & { pct: number };
}

const emptyStats = (): AccuracyStats => ({
  reviewed: 0,
  prediction: { CORRECT: 0, PARTLY: 0, WRONG: 0, pct: 0 },
  process: { CORRECT: 0, PARTLY: 0, WRONG: 0, pct: 0 },
});

/** % = (correct + half of partly) / reviewed. Prediction and process are kept separate. */
function finish(s: AccuracyStats): AccuracyStats {
  const pct = (x: Record<ReviewScore, number>) => (s.reviewed ? Math.round(((x.CORRECT + x.PARTLY / 2) / s.reviewed) * 1000) / 10 : 0);
  s.prediction.pct = pct(s.prediction);
  s.process.pct = pct(s.process);
  return s;
}

/** Measured accuracy per cadence and per asset (symbol), from reviewed plans only. */
export function accuracyRollup(plans: PeriodPlan[]): { byCadence: Partial<Record<Cadence, AccuracyStats>>; byAsset: Record<string, Partial<Record<Cadence, AccuracyStats>>> } {
  const byCadence: Partial<Record<Cadence, AccuracyStats>> = {};
  const byAsset: Record<string, Partial<Record<Cadence, AccuracyStats>>> = {};
  for (const p of plans) {
    if (!p.review) continue;
    const sym = p.candle.symbol.toUpperCase();
    for (const s of [(byCadence[p.cadence] ??= emptyStats()), ((byAsset[sym] ??= {})[p.cadence] ??= emptyStats())]) {
      s.reviewed++;
      s.prediction[p.review.prediction]++;
      s.process[p.review.process]++;
    }
  }
  Object.values(byCadence).forEach((s) => finish(s!));
  Object.values(byAsset).forEach((m) => Object.values(m).forEach((s) => finish(s!)));
  return { byCadence, byAsset };
}
