import { measureCandle, recordCompletedCandle, type Ohlc, type RecordedCandle } from './candleEvidence';
import { previousCandle, type FeedProfile } from './feeds';
import type { Cadence, PeriodCandle, PeriodPlan } from './types';

export const candleStages = [
  {
    title: 'Candle Anatomy',
    questions: [
      ['body', 'What does the body tell us about price delivery?'],
      ['wicks', 'What do the upper and lower wicks tell us?'],
      ['closeEq', 'Where did the candle close relative to its EQ?'],
      ['retained', 'How much directional progress was retained?'],
    ],
    outputs: [['anatomy', 'Candle anatomy conclusion']],
  },
  {
    title: 'Candle Classification',
    questions: [
      ['classification', 'What type of candle is it?'],
      ['sustainedDelivery', 'Was price able to sustain its delivery?'],
      ['expansionOrRejection', 'Was it primarily an expansion candle with rejection or a rejection candle?'],
    ],
    outputs: [['classificationReasoning', 'Candle classification and reasoning']],
  },
  {
    title: 'Liquidity Interaction',
    questions: [
      ['swept', 'What liquidity did the candle sweep?'],
      ['broken', 'What liquidity did it break and close beyond?'],
      ['outstandingLiquidity', 'What liquidity remains outstanding?'],
      ['liquidityOpposition', 'What does its closing position tell us about the opposition encountered after taking liquidity?'],
    ],
    outputs: [['liquidity', 'Liquidity interaction conclusion']],
  },
  {
    title: 'POI Interaction',
    questions: [
      ['respectedOrBroken', 'Which POIs did the candle respect or break?'],
      ['createdPoi', 'Did the candle lead to the creation of a new POI?'],
      ['opposingPoi', 'Could a broken POI now serve as an opposing POI?', 'Potential breakers or iFVGs'],
      ['currentReaction', 'Has the current candle already reacted to any of these POIs?'],
      ['continuationPoi', 'Which POI could facilitate continued delivery?'],
      ['outstandingPois', 'Which outstanding POIs could remain unmitigated as a result?'],
    ],
    outputs: [['pois', 'POI interaction conclusion']],
  },
  {
    title: 'Momentum and Participation',
    questions: [
      ['acceleration', 'Is directional momentum accelerating or decelerating?'],
      ['bodyComparison', 'What do the relative body sizes suggest?'],
      ['effortResult', 'What does the volume tell us relative to the price movement achieved? (Effort versus result.)'],
      ['exhaustionOrOpposition', 'Are we seeing exhaustion or simply increased opposition?'],
      ['control', 'Which side remains structurally in control?'],
    ],
    outputs: [
      ['momentum', 'Momentum assessment'], ['opposition', 'Opposition assessment'],
      ['exhaustion', 'Exhaustion assessment'], ['structuralControl', 'Structural control assessment'],
    ],
  },
  {
    title: 'Expected Candle Delivery',
    questions: [
      ['expectedDelivery', 'Are we expecting expansion or retracement?', 'Expected delivery'],
      ['direction', 'Bullish or bearish?', 'Direction'],
      ['sequence', 'Which extreme do we expect to form first?', 'Formation sequence'],
      ['high', 'Where could the high form? Has it potentially formed already?', 'High formation'],
      ['low', 'Where could the low form based on outstanding liquidity and opposing POIs?', 'Low formation'],
      ['primary', 'What is our immediate draw on liquidity?', 'Primary objective'],
      ['extended', 'Where could price deliver if momentum is sustained?', 'Extended objective'],
      ['interruption', "Could the previous candle's wick contain opposing demand or supply?", 'Potential interruption'],
      ['expectedClose', 'Where do we expect the candle to close relative to its full range?', 'Expected close'],
      ['alternative', 'What other delivery should we remain open to?', 'Alternative scenario'],
    ],
    outputs: [['delivery', 'Expected candle formation and delivery']],
  },
  { title: 'Candle Narrative', questions: [], outputs: [['invalidation', 'Invalidation']] },
] as const;

type CandleField = typeof candleStages[number]['questions'][number][0] | typeof candleStages[number]['outputs'][number][0];
export type CandleAnswers = Partial<Record<CandleField, string>>;
export type CandleInput = { prices: Partial<Ohlc>; volume?: number };
export type CandleObservation = { candle: PeriodCandle; evidence?: RecordedCandle; volume?: number };
export type CandlestickRead = {
  asOf: string;
  observations: CandleObservation[];
  answers: CandleAnswers;
  narrative: string;
  structureLayerId?: string;
};
export type CandleDraft = {
  stage: number;
  inputs: CandleInput[];
  answers: CandleAnswers;
  narrative?: string;
  finished?: CandlestickRead;
};

export function candleAnatomy(prices: Ohlc) {
  const metrics = measureCandle(prices);
  if (!metrics) return undefined;
  const { low, high, open, close } = prices;
  const extreme = close > open ? high - open : close < open ? open - low : 0;
  return {
    ...metrics,
    lowerQuartile: low + metrics.range / 4,
    equilibrium: low + metrics.range / 2,
    upperQuartile: low + metrics.range * 0.75,
    closePercent: metrics.range > 0 ? (close - low) / metrics.range * 100 : undefined,
    retainedPercent: extreme > 0 ? metrics.body / extreme * 100 : undefined,
  };
}

export function priorCandles(cadence: Cadence, target: PeriodCandle, profile: FeedProfile) {
  const previous = previousCandle(cadence, target.openTime, profile, target.symbol);
  const second = previousCandle(cadence, previous.openTime, profile, target.symbol);
  return [previous, second, previousCandle(cadence, second.openTime, profile, target.symbol)];
}

export function sameCandle(a: PeriodCandle, b: PeriodCandle) {
  return a.symbol === b.symbol && a.feed === b.feed && Date.parse(a.openTime) === Date.parse(b.openTime);
}

export function candleDraftKey(userId: string | undefined, deskId: string, cadence: Cadence, candle: PeriodCandle, profile: FeedProfile) {
  return JSON.stringify(['tos-candlestick-v1', userId, deskId, cadence, candle.symbol, candle.feed, candle.openTime, profile.zone, profile.time, profile.calendar]);
}

export function completedCandleDraft(key: string): CandlestickRead | undefined {
  try { return (JSON.parse(localStorage.getItem(key) ?? 'null') as CandleDraft | null)?.finished; }
  catch { return undefined; }
}

export function candleReadMatchesPeriod(read: CandlestickRead, period: PeriodCandle) {
  const cutoff = Math.min(Date.parse(read.asOf), Date.parse(period.openTime));
  return !!read.observations[0]?.evidence && Date.parse(read.asOf) < Date.parse(period.closeTime ?? '')
    && read.observations.every(({ candle }) => candle.symbol === period.symbol && candle.feed === period.feed
      && Date.parse(candle.openTime) < Date.parse(candle.closeTime ?? '') && Date.parse(candle.closeTime ?? '') <= cutoff);
}

export function savedCandleInput(candle: PeriodCandle, plans: PeriodPlan[]): CandleInput {
  let volume: number | undefined;
  for (const { read } of plans) {
    const observation = read.candlestickDecomposition?.observations.find((entry) => sameCandle(entry.candle, candle));
    volume ??= observation?.volume;
    if (observation?.evidence) return { prices: observation.evidence.prices, volume };
    const evidence = [read.completedCandle, read.comparisonCandle].find((entry) => entry && sameCandle(entry.candle, candle));
    if (evidence) return { prices: evidence.prices, volume };
  }
  return { prices: {}, volume };
}

export function candleObservation(candle: PeriodCandle, input: CandleInput, cutoff: string): CandleObservation {
  return { candle, evidence: recordCompletedCandle(candle, input.prices, cutoff), volume: input.volume };
}

export function composeCandleNarrative(answers: CandleAnswers) {
  const summary: Array<[string, Array<string | undefined>]> = [
    ['Previous candle behaviour', [answers.classificationReasoning || answers.classification, answers.anatomy]],
    ['Current market conditions', [answers.liquidity, answers.pois, answers.momentum, answers.opposition, answers.exhaustion, answers.structuralControl]],
    ['Expected candle delivery', [answers.delivery || [answers.expectedDelivery, answers.direction].filter(Boolean).join(' · '), answers.sequence, answers.interruption]],
    ['High formation', [answers.high]], ['Low formation', [answers.low]],
    ['Primary objective', [answers.primary]], ['Extended objective', [answers.extended]],
    ['Expected closing location', [answers.expectedClose]], ['Alternative scenario', [answers.alternative]],
    ['Invalidation', [answers.invalidation]],
  ];
  return summary.flatMap(([label, parts]) => {
    const phrases = parts.flatMap((part) => part?.trim() ? [part.trim()] : []);
    const value = phrases.map((phrase, index) => index === phrases.length - 1 || /[.!?]$/.test(phrase) ? phrase : `${phrase}.`).join(' ');
    return value ? [`${label}: ${value}`] : [];
  }).join('\n');
}
