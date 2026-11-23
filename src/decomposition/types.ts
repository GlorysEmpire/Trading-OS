/**
 * Market Decomposition — the M0 contract.
 *
 * Every other milestone (HQ definitions, data layer, stepper, desk link,
 * backtest link, readiness) depends only on these types and the pure logic
 * next to them. No UI, no database, no network here.
 *
 * Principles carried in the types:
 * - Prices are numbers.
 * - Every step has a status: IDENTIFIED / INCONCLUSIVE / NOT_APPLICABLE.
 * - A layer refresh writes a new layer version; old versions are kept.
 * - Every layer records the definitions version it was read with.
 */

export type StepStatus = 'IDENTIFIED' | 'INCONCLUSIVE' | 'NOT_APPLICABLE';

/** One answered step. `value` is only meaningful when status is IDENTIFIED. */
export interface Step<T> {
  status: StepStatus;
  value?: T;
  /** Optional plain-language note from the trader. */
  note?: string;
}

/** Structural timeframe layers, in order of work (Monthly → Weekly → Daily → 4H). */
export type LayerTimeframe = 'MONTHLY' | 'WEEKLY' | 'DAILY' | 'H4';
export const LAYER_ORDER: LayerTimeframe[] = ['MONTHLY', 'WEEKLY', 'DAILY', 'H4'];

export type DecompositionMode = 'LIVE' | 'BACKTEST';

export type Trend = 'BULLISH' | 'BEARISH';
export type Bias = Trend | 'NEUTRAL';
export type Location = 'PREMIUM' | 'DISCOUNT' | 'EQUILIBRIUM';
export type PoiSide = 'SELL' | 'BUY';

export interface PriceRange {
  high: number;
  low: number;
}

export type PoiKind = 'FVG' | 'ORDER_BLOCK' | 'BREAKER' | 'SUPPLY_DEMAND' | 'OTHER';

/** A point of interest: a price zone. `high` > `low`. */
export interface Poi {
  id: string;
  label: string;
  kind: PoiKind;
  side: PoiSide;
  high: number;
  low: number;
  /** Already traded into since it formed. */
  mitigated: boolean;
  /** Sits beyond the inducement (price must take the inducement first). */
  beyondInducement: boolean;
}

export type LiquidityKind =
  | 'INTERNAL_HIGH'
  | 'INTERNAL_LOW'
  | 'EQUAL_HIGHS'
  | 'EQUAL_LOWS'
  | 'EXTERNAL_HIGH'
  | 'EXTERNAL_LOW';

export interface LiquidityLevel {
  id: string;
  kind: LiquidityKind;
  price: number;
  swept: boolean;
  /** Trader's own name for it (stays editable). */
  label?: string;
}

// ---- Layer 1: Weekly context --------------------------------------------

export interface WeeklyLayer {
  timeframe: 'WEEKLY';
  /** Trend from the last external BOS. Gating: inconclusive → HTF neutral, Daily carries the read. */
  trend: Step<{ trend: Trend; lastExternalBos: number }>;
  /** HTF dealing range and where price sits in it. */
  dealingRange: Step<PriceRange & { currentPrice: number }>;
  /** Draw on liquidity both ways. */
  draw: Step<{ above?: number; below?: number }>;
  /** Unmitigated HTF POIs. */
  pois: Step<Poi[]>;
}

/** Monthly context: same questions as Weekly, one timeframe up. */
export type MonthlyLayer = Omit<WeeklyLayer, 'timeframe'> & { timeframe: 'MONTHLY' };

// ---- Layer 2: Daily read -------------------------------------------------

export type Phase = 'EXPANSION' | 'RETRACEMENT' | 'RANGE';
export type LegType = 'STRONG' | 'WEAK' | 'INCONCLUSIVE';
export type Depth = 'SHALLOW' | 'DEEP';

/** The four strong-leg criteria (v0.3 §3.5). Thresholds live in the definitions. */
export interface LegCriteria {
  /** Leg range ≥ N × ATR. */
  rangeVsAtr: boolean;
  /** Most candles close in the outer part of their range. */
  closesInOuterPart: boolean;
  /** Body overlap below the threshold. */
  lowBodyOverlap: boolean;
  /** At least one unmitigated FVG in the leg. */
  unmitigatedFvg: boolean;
}

export interface DailyLayer {
  timeframe: 'DAILY';
  /** 1. Trend, last BOS, internal vs external. Gating (with dealing range). */
  structure: Step<{ trend: Trend; lastBos: number; bosKind: 'INTERNAL' | 'EXTERNAL' }>;
  /** 2. Dealing range: BOS leg high/low, and the current price for location. Gating (with structure). */
  dealingRange: Step<PriceRange & { currentPrice: number }>;
  /** 3. Phase. RANGE sends the read to the Wyckoff/RDM branch. */
  phase: Step<Phase>;
  /** 4. Leg type, from the four criteria. */
  leg: Step<LegCriteria>;
  /** 5. Last 1–3 daily candles. */
  candles: Step<{ read: 'EXPANSION' | 'REJECTION' | 'INDECISION'; closeLocation: 'HIGH' | 'MID' | 'LOW'; liquidityEvent: boolean }>;
  /** 6. Liquidity map, and which level is the inducement. */
  liquidity: Step<{ levels: LiquidityLevel[]; inducementId?: string }>;
  /** 7. Depth expectation: intent first, then where liquidity sits. */
  depth: Step<Depth>;
  /** 8. POI A (primary) and B (backup). Gating: none valid with ≥ min R to the draw → observation only. */
  pois: Step<{ primary?: Poi; backup?: Poi }>;
  /** 9. Target (next external liquidity) and invalidation (close beyond the swing that made the BOS). */
  targetInvalidation: Step<{ target: number; invalidation: number }>;
}

// ---- Layer 3: 4H narrative --------------------------------------------------

export interface H4Layer {
  timeframe: 'H4';
  /** Does the 4H agree with the Daily? A conflict is resolved in favour of the Daily. */
  alignment: Step<'ALIGNED' | 'CONFLICT'>;
  /** 4H structure: trend, last BOS, internal vs external. */
  structure: Step<{ trend: Trend; lastBos: number; bosKind: 'INTERNAL' | 'EXTERNAL' }>;
  /** Wyckoff development. AR is an analytical event only, never an entry trigger. */
  wyckoff: Step<{ phase: string; events: string[] }>;
  /** POIs refined on the 4H. */
  pois: Step<Poi[]>;
}

export type LayerData = MonthlyLayer | WeeklyLayer | DailyLayer | H4Layer;

// ---- Records ---------------------------------------------------------------

/** One saved version of a layer. Append-only: never edited, a refresh adds a new one. */
export interface LayerVersion<L extends LayerData = LayerData> {
  id: string;
  decompositionId: string;
  timeframe: L['timeframe'];
  /** 1, 2, 3… per decomposition and timeframe. */
  version: number;
  /** When the chart was read (ISO). In BACKTEST mode, the replay time. */
  asOf: string;
  /** Trading HQ definitions version used for this read. */
  definitionsVersion: string;
  createdAt: string;
  data: L;
  /** BACKTEST only: when the prediction was locked (before stepping replay forward). */
  lockedAt?: string;
}

export interface BacktestOutcome {
  recordedAt: string;
  /** What price did, in plain words. */
  result: 'REACHED_TARGET' | 'HIT_INVALIDATION' | 'NEITHER';
  /** Which POI (if any) price reacted from. */
  reactedPoiId?: string;
  notes?: string;
}

/** One decomposition: an asset at an as-of time, in a mode, with its layer versions. */
export interface Decomposition {
  id: string;
  /** Asset Desk id. */
  deskId: string;
  symbol: string;
  mode: DecompositionMode;
  createdAt: string;
  layers: LayerVersion[];
  /** BACKTEST only; may be set once, after every layer is locked. */
  outcome?: BacktestOutcome;
  /** BACKTEST only: research question the sample counts toward. */
  researchQuestionId?: string;
}

// ---- Definitions (placeholders until Quadri locks them in Trading HQ) ------

export interface DecompositionDefinitions {
  /** Stored with every layer version. */
  version: string;
  /** False until the trader locks the real values. */
  locked: boolean;
  text: {
    internalSwing: string;
    externalSwing: string;
    bos: string;
    choch: string;
    mss: string;
    equalHighsLows: string;
  };
  strongLeg: {
    atrMultiple: number;
    outerClosePct: number;
    maxBodyOverlapPct: number;
    /** Criteria met (of 4) to call a leg strong. */
    strongMin: number;
    /** Criteria met at or below this → weak. Between → inconclusive. */
    weakMax: number;
  };
  equalHighsLowsAtr: number;
  /** Width of the equilibrium band around 50%, as % of the range (0 = exact midpoint). */
  equilibriumBandPct: number;
  /** Minimum R from a POI to the draw for the plan to be tradeable. */
  minRToDraw: number;
  /** How R to the draw is measured from a POI: stop at the POI's far edge, or at the layer's invalidation. */
  rStopBasis: 'POI_FAR_EDGE' | 'INVALIDATION';
}

// ---- Derived results ---------------------------------------------------------

export type LayerVerdict =
  /** Steps still to answer. */
  | 'INCOMPLETE'
  /** Gate: structure inconclusive and no range. */
  | 'LEAVE_CHART'
  /** Gate: no valid POI with enough R to the draw. */
  | 'OBSERVATION_ONLY'
  /** A valid plan: wait for price at the POI. */
  | 'WATCH_POI'
  /** Weekly only: read complete (bias may be neutral). */
  | 'CONTEXT_READY';

export interface GateResult {
  verdict: LayerVerdict;
  /** Plain-language reason, shown to the trader. */
  reason: string;
  /** The step that stopped the flow, if any. */
  stoppedAt?: string;
}

export interface PoiCheck {
  poi: Poi;
  role: 'PRIMARY' | 'BACKUP';
  location: Location;
  /** R from the POI to the draw (target), or undefined when it can't be measured. */
  rToDraw?: number;
  valid: boolean;
  /** Plain-language reasons it was rejected (empty when valid). */
  problems: string[];
}

// ---- Two-part decomposition (M0.1) ---------------------------------------------
//
// Structural Record: the long-term story (Monthly/Weekly/Daily/4H), built in
// the backtesting block, versioned append-only, new version only when the
// structure changes. Daily Record: one per asset per trading day, built in
// the sessions, pointing at the structural version it was built on. Setups
// and trades will link to a Daily Record + POI.

/** The structural map of one asset (same shape and rules as a Decomposition). */
export type StructuralRecord = Decomposition;

/** An exact, immutable point in a structural record's history. */
export interface StructuralVersionRef {
  structuralRecordId: string;
  /** Number of layer versions saved when the ref was taken (grows by one per saved layer). */
  revision: number;
  /** The exact layer version used for each timeframe. */
  layerIds: Partial<Record<LayerTimeframe, string>>;
}

export type StructuralChangeReason =
  | 'DAILY_BOS'
  | 'DAILY_CHOCH'
  | 'H4_BOS'
  | 'H4_CHOCH'
  | 'POI_MITIGATED'
  | 'POI_INVALIDATED';

/** The morning gate: did structure change overnight (body close, or a POI used up)? */
export interface MorningCheck {
  answeredAt: string;
  structureChanged: boolean;
  /** Required when structureChanged is true. */
  reasons: StructuralChangeReason[];
  note?: string;
}

export type MorningGateNext = 'BUILD_STRUCTURE' | 'ANSWER_MORNING_CHECK' | 'UPDATE_STRUCTURE' | 'START_DAILY';

/** Today's read, built inside the structural story. */
export interface DailyRead {
  /** Previous daily candle: formation, close, liquidity event. */
  priorCandle: Step<{ read: 'EXPANSION' | 'REJECTION' | 'INDECISION'; closeLocation: 'HIGH' | 'MID' | 'LOW'; liquidityEvent: boolean }>;
  /** Liquidity swept, rejected or still outstanding today; which level is the inducement. */
  liquidity: Step<{ levels: LiquidityLevel[]; inducementId?: string }>;
  /** Impulse strength → retracement expectation. */
  depth: Step<Depth>;
  /** Will today's move be internal (inside the range) or reach external liquidity? */
  expectation: Step<'INTERNAL' | 'EXTERNAL'>;
  /** POI A (primary) and B (backup). */
  pois: Step<{ primary?: Poi; backup?: Poi }>;
  /** Today's draw (target) and invalidation. */
  draw: Step<{ target: number; invalidation: number }>;
  /** Entry models planned at the POIs (Trading HQ model ids). */
  entryModels: Step<Array<{ poiId: string; modelId: string }>>;
  /** Which session the plan is for (NY time windows from Trading HQ). */
  session: Step<{ session: string }>;
}

export interface DailyRecord {
  id: string;
  deskId: string;
  symbol: string;
  /** New York trading day, YYYY-MM-DD. */
  tradingDay: string;
  mode: DecompositionMode;
  createdAt: string;
  /** The structural version this day was built on. Never moves after the record starts. */
  structuralVersionRef: StructuralVersionRef;
  morningCheck: MorningCheck;
  definitionsVersion: string;
  read: Partial<DailyRead>;
}
