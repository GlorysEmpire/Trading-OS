import { depthExpectation, evaluateDaily, isIdentified, legTypeOf, validRange } from './logic';
import type { DailyLayer, DecompositionDefinitions, LayerData, LiquidityLevel, Phase, Poi, Step, Trend } from './types';

export const ANALYSIS_TIMEFRAMES = ['MONTHLY', 'WEEKLY', 'DAILY'] as const;
export type AnalysisTimeframe = typeof ANALYSIS_TIMEFRAMES[number];
export const ANALYSIS_LAYERS = [
  { id: 'S1', title: 'Swing Points', question: 'Which highs and lows did price turn from?', purpose: 'Anchor the read to observable turns before naming a trend.', guide: 'Start with two confirmed swing highs and lows, oldest first. A possible turn at the right edge is still unconfirmed.' },
  { id: 'S2', title: 'Structure', question: 'Which swing did price challenge, and where did it close?', purpose: 'Distinguish a break or change of character from a liquidity sweep.', guide: 'Mark the reference swing and the completed candle close. A wick through the level by itself does not confirm a break.' },
  { id: 'S3', title: 'Dealing Range', question: 'What are the boundaries of the active range?', purpose: 'Locate price relative to the range that drove structure.', guide: 'Use the swing low and high of the active leg. The midpoint separates premium from discount. Price beyond the boundaries is outside this range.' },
  { id: 'S4', title: 'Legs', question: 'Which move was the impulse, and what has the pullback done?', purpose: 'Measure delivery and correction before judging intent.', guide: 'Record the impulse endpoints, the correction endpoint, and ATR if available. A strong or weak leg needs evidence from the configured criteria.' },
  { id: 'S5', title: 'Liquidity', question: 'What liquidity was taken, and what remains ahead?', purpose: 'Map outstanding levels, inducement and the potential draw.', guide: 'Label internal and external levels separately. Compare the first obvious internal level in the path with the external draw; mark sweeps only when you can see them.' },
  { id: 'S6', title: 'POIs', question: 'Where could price react, and what would invalidate that idea?', purpose: 'Define primary and backup zones and an explicit invalidation.', guide: 'Record zone bounds and mitigation. Check the zone against range location, inducement, draw and invalidation before making it actionable.' },
  { id: 'S7', title: 'Wyckoff', question: 'What does price and volume show around the range?', purpose: 'Separate observed events from a proposed Wyckoff phase.', guide: 'Describe events with comparative volume where it is available. AR is an analytical event. When volume or phase is ambiguous, keep the read uncertain.' },
  { id: 'S8', title: 'External Data', question: 'Which sourced information was available when you made this read?', purpose: 'Keep reported data and fundamental context separate from chart observations.', guide: 'Record the source, date and what was actually published. Explain its possible relevance separately. In replay, use information available by the replay date.' },
] as const;
export type AnalysisLayerId = typeof ANALYSIS_LAYERS[number]['id'];
export type Assessment = 'OBSERVED' | 'UNCERTAIN' | 'NOT_APPLICABLE';
type LayerNotes = { observation?: string; interpretation?: string; hypothesis?: string; assessment?: Assessment };
export type Swing = { id: string; kind: 'HIGH' | 'LOW'; price?: number; date?: string };
export type ExternalFact = { id: string; source?: string; date?: string; fact?: string };
export type Analysis = {
  S1?: LayerNotes & { swings?: Swing[] };
  S2?: LayerNotes & { event?: 'BOS' | 'CHOCH' | 'SWEEP' | 'NONE'; direction?: Trend; scope?: 'INTERNAL' | 'EXTERNAL'; level?: number; close?: number };
  S3?: LayerNotes & { high?: number; low?: number; price?: number };
  S4?: LayerNotes & { start?: number; end?: number; correction?: number; atr?: number; outerCloses?: boolean; lowOverlap?: boolean; fvg?: boolean; phase?: Phase };
  S5?: LayerNotes & { levels?: LiquidityLevel[]; inducementId?: string; target?: number };
  S6?: LayerNotes & { primary?: Poi; backup?: Poi; invalidation?: number };
  S7?: LayerNotes & { events?: string; phase?: string; volume?: number; baselineVolume?: number };
  S8?: LayerNotes & { facts?: ExternalFact[] };
};

const finite = (x: number | undefined): x is number => typeof x === 'number' && Number.isFinite(x);
const usable = (layer: LayerNotes | undefined) => layer?.assessment === 'OBSERVED';
const identified = <T,>(value: T | undefined): Step<T> => value === undefined ? { status: 'INCONCLUSIVE' } : { status: 'IDENTIFIED', value };
const readyPoi = (p: Poi | undefined): p is Poi => !!p?.label.trim() && finite(p.high) && finite(p.low) && p.high > p.low;

export function swingTrend(swings: Swing[] = []) {
  const pair = (kind: Swing['kind']) => swings.filter((s) => s.kind === kind && finite(s.price) && s.date)
    .sort((a, b) => a.date!.localeCompare(b.date!)).slice(-2);
  const highs = pair('HIGH');
  const lows = pair('LOW');
  if (highs.length < 2 || lows.length < 2 || highs[0].date === highs[1].date || lows[0].date === lows[1].date) return undefined;
  if (highs[1].price! > highs[0].price! && lows[1].price! > lows[0].price!) return 'BULLISH' as const;
  if (highs[1].price! < highs[0].price! && lows[1].price! < lows[0].price!) return 'BEARISH' as const;
  return 'MIXED' as const;
}

export function confirmedBreak(s: Analysis['S2']) {
  if (!s || (s.event !== 'BOS' && s.event !== 'CHOCH') || !s.direction || !s.scope || !finite(s.level) || !finite(s.close)) return undefined;
  if (!(s.direction === 'BULLISH' ? s.close > s.level : s.close < s.level)) return undefined;
  return { trend: s.direction, lastBos: s.level, bosKind: s.scope };
}

export function rangeEvidence(s: Analysis['S3']) {
  if (!s || !finite(s.high) || !finite(s.low) || !validRange({ high: s.high, low: s.low })) return undefined;
  const width = s.high - s.low;
  const midpoint = s.low + width / 2;
  const location = !finite(s.price) ? undefined : s.price > s.high || s.price < s.low ? 'Outside' : s.price === midpoint ? 'Equilibrium' : s.price > midpoint ? 'Premium' : 'Discount';
  return { width, midpoint, location };
}

export function legEvidence(s: Analysis['S4']) {
  if (!s || !finite(s.start) || !finite(s.end) || s.start === s.end) return undefined;
  const distance = Math.abs(s.end - s.start);
  const correction = finite(s.correction) ? (s.end - s.correction) / (s.end - s.start) * 100 : undefined;
  const atrMultiple = finite(s.atr) && s.atr > 0 ? distance / s.atr : undefined;
  return { distance, correction, atrMultiple };
}

/** New evidence stays on its own revision. Existing consumers read the compatible projection. */
export function projectAnalysis(timeframe: AnalysisTimeframe, analysis: Analysis, defs: DecompositionDefinitions, previous?: LayerData): LayerData {
  const { S1, S2, S3, S4, S5, S6 } = analysis;
  const br = usable(S2) ? confirmedBreak(S2) : undefined;
  const trend = usable(S1) ? swingTrend(S1?.swings) : undefined;
  const dealingRange = usable(S3) && rangeEvidence(S3) && finite(S3?.price)
    ? { high: S3.high!, low: S3.low!, currentPrice: S3.price } : undefined;
  const levels = usable(S5) ? (S5?.levels ?? []).filter((level) => finite(level.price)) : [];
  const inducementId = levels.find((level) => level.id === S5?.inducementId && !level.swept)?.id;
  const primary = usable(S6) && readyPoi(S6?.primary) ? S6.primary : undefined;
  const backup = usable(S6) && readyPoi(S6?.backup) ? S6.backup : undefined;
  const phase = usable(S4) ? S4?.phase : undefined;
  const evidence = legEvidence(S4);
  const leg = usable(S4) && evidence?.atrMultiple !== undefined && S4?.outerCloses !== undefined && S4.lowOverlap !== undefined && S4.fvg !== undefined
    ? { rangeVsAtr: evidence.atrMultiple >= defs.strongLeg.atrMultiple, closesInOuterPart: S4.outerCloses, lowBodyOverlap: S4.lowOverlap, unmitigatedFvg: S4.fvg }
    : undefined;
  const target = usable(S5) && finite(S5?.target) ? S5.target : undefined;
  const invalidation = usable(S6) && finite(S6?.invalidation) ? S6.invalidation : undefined;
  if (timeframe !== 'DAILY') {
    const above = levels.filter((l) => !l.swept && l.kind === 'EXTERNAL_HIGH' && (dealingRange === undefined || l.price > dealingRange.currentPrice)).sort((a, b) => a.price - b.price)[0]?.price;
    const below = levels.filter((l) => !l.swept && l.kind === 'EXTERNAL_LOW' && (dealingRange === undefined || l.price < dealingRange.currentPrice)).sort((a, b) => b.price - a.price)[0]?.price;
    return {
      timeframe, analysis,
      trend: identified(br?.bosKind === 'EXTERNAL' && (!trend || trend === br.trend) ? { trend: br.trend, lastExternalBos: br.lastBos } : undefined),
      dealingRange: identified(dealingRange), draw: identified(above !== undefined || below !== undefined ? { above, below } : undefined),
      pois: identified(primary || backup ? [primary, backup].filter(readyPoi) : undefined),
    };
  }
  return {
    timeframe, analysis, structure: identified(br), dealingRange: identified(dealingRange),
    phase: identified(phase), leg: identified(leg),
    candles: previous?.timeframe === 'DAILY' ? previous.candles ?? { status: 'INCONCLUSIVE' } : { status: 'INCONCLUSIVE' },
    liquidity: identified(levels.length ? { levels, inducementId } : undefined),
    depth: identified(depthExpectation(leg ? legTypeOf(leg, defs) : undefined, primary?.side, levels, primary).depth),
    pois: identified(primary || backup ? { primary, backup } : undefined),
    targetInvalidation: identified(target !== undefined && invalidation !== undefined ? { target, invalidation } : undefined),
  };
}

export function analysisGate(analysis: Analysis, defs: DecompositionDefinitions) {
  const projected = projectAnalysis('DAILY', analysis, defs) as DailyLayer;
  if (analysis.S2?.assessment && analysis.S3?.assessment && !isIdentified(projected.structure) && !isIdentified(projected.dealingRange)) {
    return evaluateDaily(projected, defs);
  }
  if (ANALYSIS_LAYERS.some(({ id }) => !analysis[id]?.assessment)) return undefined;
  return evaluateDaily(projected, defs);
}

export function analysisDatesValid(analysis: Analysis, cutoff: string) {
  return !(analysis.S1?.swings ?? []).some((s) => s.date && s.date > cutoff.slice(0, 10))
    && (analysis.S8?.facts ?? []).every((f) => f.date && f.source?.trim() && f.fact?.trim()
      && Number.isFinite(Date.parse(f.date + 'Z')) && Date.parse(f.date + 'Z') <= Date.parse(cutoff));
}
