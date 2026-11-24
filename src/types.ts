/**
 * TRADING OS - CORE TYPES & DOMAIN MODELS
 * Adhering strictly to configurable methodology & versioned rules.
 */

export type AssetCategory = 'CRYPTO' | 'INDICES' | 'METALS' | 'FX' | 'EQUITIES' | 'OTHER';

export type BiasType = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'ACCUMULATION' | 'DISTRIBUTION' | 'RE-ACCUMULATION';

export interface LiquidityZone {
  id: string;
  level: string;
  /** The trader's own name for the kind of liquidity (e.g. "Bull liquidity",
   * "Inducement"). Free text; older zones hold BSL / SSL / EQH / EQL / RANGE_*. */
  type: string;
  status: 'UNTOUCHED' | 'SWEPT' | 'ENGINEERED';
  notes: string;
}

/** A level that comes from outside the chart: a cost basis, a big option
 * strike, a liquidation cluster. Context for the ladder, never a signal. */
export interface ExternalLevel {
  id: string;
  label: string;
  kind: string;
  /** Price or range as typed, e.g. "75.6k" or "59.5–62.6k". */
  price: string;
  source: string;
  /** ISO timestamp of when the level was true. */
  asOf: string;
  staleAfterHours?: number;
  enteredBy: ContextEntryBy;
  confirmedAt?: string;
  note?: string;
}

export interface ActivePOI {
  id: string;
  name: string;
  priceRange: string;
  timeframe: string;
  type: string;
  active: boolean;
}

export interface Scenario {
  id: string;
  label: 'Scenario A' | 'Scenario B' | 'Scenario C';
  probability: 'PRIMARY' | 'SECONDARY' | 'INVALIDATION';
  thesis: string;
  confirmationConditions: string[];
  invalidationConditions: string[];
  /** POIs from the structural map this scenario trades from (links, not retyped prices). */
  poiIds?: string[];
}

export interface AssetChartScreenshot {
  id: string;
  title: string;
  timeframe: string;
  url: string;
  caption?: string;
  uploadedAt: string;
  category?: 'BIAS' | 'EXECUTION' | 'WYCKOFF' | 'LIQUIDITY' | 'GENERAL';
  /** Where on the desk this chart is shown alongside the text: the current
   * narrative, or one HTF structure timeframe. Unset = Charts tab only. */
  placement?: DeskChartPlacement;
}

export type DeskChartPlacement = 'narrative' | 'monthly' | 'weekly' | 'daily' | 'h4';

/** Who put a value on the desk. AI drafts stay marked until the trader confirms. */
export type ContextEntryBy = 'MANUAL' | 'AI_DRAFT' | 'PROVIDER';

/** The trader's read of a lane against the desk narrative. Context, never a signal. */
export type ContextLaneState = 'SUPPORTS' | 'AGAINST' | 'NEUTRAL';

/** One external-context value on a desk, always with its source and as-of time. */
export interface ContextField {
  id: string;
  label: string;
  value: string;
  /** Short free-text note on how it changed, e.g. "-21% since Nov 2". */
  changeNote?: string;
  source: string;
  /** ISO timestamp of when the value was true (not when it was typed). */
  asOf: string;
  /** Grey the value out once it is older than this many hours. Unset = never. */
  staleAfterHours?: number;
  enteredBy: ContextEntryBy;
  /** Set when the trader confirms an AI draft or provider value. */
  confirmedAt?: string;
  /** The value this one replaced, kept for "changed since". */
  previous?: { value: string; asOf: string };
  /** The trader's own note on what this field means and how to read it. */
  conceptNote?: string;
}

/** A row of the context strip: spot demand, leverage, forced, macro… All editable. */
export interface ContextLane {
  id: string;
  name: string;
  /** The question the lane answers, e.g. "Is real buying showing up?". */
  question?: string;
  state?: ContextLaneState;
  stateBy?: ContextEntryBy;
  fields: ContextField[];
  /** Lane that lists the desk's linked Calendar events instead of fields. */
  kind?: 'FIELDS' | 'EVENTS';
}

export interface AssetDeskData {
  id: string;
  symbol: string;
  name: string;
  category: AssetCategory;
  currentBias: BiasType;
  tradingViewSymbol: string;
  htfStructure: {
    monthly: string;
    weekly: string;
    daily: string;
    h4: string;
  };
  currentNarrative: string;
  liquidityZones: LiquidityZone[];
  activePOIs: ActivePOI[];
  wyckoffDevelopment: {
    phase: string;
    eventsIdentified: string[];
    notes: string; // Critical note: AR = Automatic Reaction (analytical event, not an entry trigger)
  };
  externalContext: {
    etfFlows?: string;
    openInterest?: string;
    fundingRate?: string;
    liquidations?: string;
    yields10Y?: string;
    dxy?: string;
    macroNews?: string;
    updatedAt: string;
    /** Market Context lanes (v2). When present they are the source of truth;
     * the flat legacy fields above are kept untouched for old readers. */
    version?: 2;
    lanes?: ContextLane[];
  };
  scenarios: Scenario[];
  researchNotes: string;
  quickLevels: {
    high24h: string;
    low24h: string;
    keySustainedLevel: string;
  };
  charts?: AssetChartScreenshot[];
  /** Levels from outside the chart, shown in the levels ladder. */
  externalLevels?: ExternalLevel[];
  /** Levels closer than this % of price are flagged as confluence (default 1). */
  confluenceBandPct?: number;
  /** A price typed in for the ladder's "price now" row, with when it was true. */
  referencePrice?: { value: string; asOf: string };
  /** Whether this instrument appears in the Dashboard's Market Watch —
   * opt-in so the watch only shows what's actively being monitored, not
   * every configured instrument. */
  watchlisted?: boolean;
}

export interface RiskRules {
  riskPerSetupPct: number;
  maxDailyLosses: number;
  noReEntry: boolean;
  noAdding: boolean;
  scratchCountsAsLoss: boolean;
  /** Not yet confirmed as a formal rule — leave unset rather than inventing a number. */
  maxOpenTrades?: number;
}

export interface SetupGradeRule {
  grade: string;
  minR: number;
  description: string;
  /** Earliest R at which moving the stop to breakeven is allowed for this grade
   * (A+ = 5, B+ = 3). A structural reason is always allowed. Unset = no R rule. */
  breakevenAtR?: number;
}

/** One day of the weekly focus rotation (drives the weekly watchlist). */
export interface FocusDay {
  day: string; // 'Monday' … 'Sunday'
  assets: string[];
  activity: string; // e.g. 'Trade + Backtest', 'Backtest / Research'
}

/** How the stop was moved to breakeven on a trade, if it was. */
export interface BreakevenRecord {
  movedAtR: number;
  /** New structure formed a new invalidation zone beyond the entry. */
  structural: boolean;
  note?: string;
}

export interface ExecutionModel {
  id: string;
  name: string;
  description: string;
  keyCriteria: string[];
}

/** A trading session window, defined in New York time (America/New_York).
 * Local times are always derived from the NY times, never stored. */
export interface SessionWindow {
  id: string;
  name: string;
  nyStart: string;
  nyEnd: string;
  /** @deprecated Legacy stored Lagos times (fixed +5h, wrong in US winter). Ignored. */
  lagosStart?: string;
  /** @deprecated See lagosStart. */
  lagosEnd?: string;
  activeDays: string[];
  notes?: string;
}

export interface MistakeCode {
  code: string;
  label: string;
  category: 'RISK' | 'PSYCHOLOGY' | 'EXECUTION' | 'MANAGEMENT';
  description: string;
}

/** The research methodology's workflow stages are intentionally NOT
 * editable here — they're the same 5 fixed values as ResearchQuestion's
 * `status` union (OBSERVATION/HYPOTHESIS/BACKTEST/VALIDATION/LOCKED_RULE)
 * elsewhere in the app, so renaming them here wouldn't actually change
 * anything in Research Engine. minSamples and notes are real, editable
 * methodology. */
export interface ResearchFramework {
  workflow: string[];
  minSamples: number;
  notes: string;
}

export interface TradingHQConfig {
  version: string;
  updatedAt: string;
  riskRules: RiskRules;
  setupGrades: SetupGradeRule[];
  executionModels: ExecutionModel[];
  sessions: SessionWindow[];
  processChecks: string[]; // ['Session', 'Grade', 'Risk', 'Management', 'Structure']
  mistakeCodes: MistakeCode[];
  researchFramework: ResearchFramework;
  focusRotation: FocusDay[];
  notes: string;
}

export interface ProcessScore {
  session: boolean;
  grade: boolean;
  risk: boolean;
  management: boolean;
  structure: boolean;
  score: number; // 0 to 5
}

export interface Trade {
  id: string;
  date: string;
  timestamp: number;
  asset: string;
  direction: 'LONG' | 'SHORT';
  timeframe: string;
  session: string;
  modelId: string;
  setupGrade: string;
  narrative: string;
  setupReasoning: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  exitPrice?: number;
  plannedR: number;
  realizedR?: number;
  status: 'OPEN' | 'CLOSED' | 'PENDING' | 'CANCELLED';
  outcome?: 'WIN' | 'LOSS' | 'SCRATCH';
  processScore: ProcessScore;
  processCategory?: 'GOOD_PROCESS_WIN' | 'GOOD_PROCESS_LOSS' | 'BAD_PROCESS_WIN' | 'BAD_PROCESS_LOSS';
  violations: string[];
  mistakeCodes: string[];
  screenshots: {
    before?: string;
    during?: string;
    after?: string;
    additional?: Array<{ id: string; url: string; title: string }>;
  };
  notesDuring: string;
  reflectionAfter: string;
  linkedPsychologyId?: string;
  linkedResearchQuestionId?: string;
  configVersionUsed: string;
  /** Risk setting captured when this trade was opened for capital estimates. */
  riskPercentAtEntry?: number;
  /** The trading accounts this trade was taken on. One decision, one Journal
   * entry, one set of stats; each account's balance moves by its own result. */
  accountIds?: string[];
  /** Actual money result per account (in that account's currency), if entered
   * at close. Accounts without one use risk % × R as an estimate. */
  pnlByAccount?: Record<string, number>;
  /** Risk taken on each account when the trade was opened: % of that
   * account's balance and the money amount. Used for the money estimate. */
  riskByAccount?: Record<string, AccountRisk>;
  /** Older single-account fields (read only; new trades use the two above). */
  accountId?: string;
  pnlAmount?: number;
  /** When the trade was closed and locked (ms epoch). Closed trades without
   * this field predate locking — they're still treated as locked. */
  closedAt?: number;
  /** When the trade was entered (ISO). Session scoring uses this, in NY time.
   * Older trades without it fall back to `timestamp` (when it was logged). */
  entryAt?: string;
  breakeven?: BreakevenRecord;
  /** The pending setup this trade was converted from, if any. */
  fromSetupId?: string;
  /** Set when a trade is voided instead of deleted (duplicate entry, logged by
   * mistake). A voided trade stays visible in the Journal with its reason,
   * but is excluded from performance stats. */
  voided?: { at: number; reason: string };
}

/** One logged change to a locked trade. Append-only: the database grants
 * insert + select only, so an amendment can never be edited or removed. */
export interface TradeAmendmentChange {
  field: string;
  from: unknown;
  to: unknown;
}

export interface TradeAmendment {
  id: string;
  tradeId: string;
  kind: 'AMEND' | 'VOID';
  reason: string;
  changes: TradeAmendmentChange[];
  createdAt: string;
}

export interface ResearchQuestion {
  id: string;
  code: string;
  title: string;
  hypothesis: string;
  initialAsset: string;
  scheduledDay: string;
  status: 'OBSERVATION' | 'HYPOTHESIS' | 'BACKTEST' | 'VALIDATION' | 'LOCKED_RULE';
  sampleCount: number;
  targetSamples: number;
  findings: string;
  lockedRuleText?: string;
  createdAt: string;
}

export interface BacktestSample {
  id: string;
  researchQuestionId: string;
  asset: string;
  date: string;
  marketRegime: string;
  narrative: string;
  setupModel: string;
  direction: 'LONG' | 'SHORT';
  entry: number;
  stop: number;
  target: number;
  result: 'WIN' | 'LOSS' | 'SCRATCH';
  realizedR: number;
  isValidSetup: boolean;
  evidence: string;
  screenshot?: string;
  outcomeScreenshot?: string;
  screenshots?: Array<{ id: string; url: string; title: string }>;
  notes: string;
  /** Set when the sample was created from a backtest decomposition (M5). */
  decompositionRecordId?: string;
}

export interface PsychologyEntry {
  id: string;
  timestamp: number;
  date: string;
  session: string;
  emotionalState: 'CALM' | 'FOCUSED' | 'HESITANT' | 'FOMO' | 'FRUSTRATED' | 'EUPHORIC' | 'FATIGUED';
  confidenceLevel: number; // 1-10
  fearLevel: number; // 1-10
  thoughts: string;
  hesitationNotes?: string;
  recurringPatternObserved?: string;
  linkedTradeId?: string;
  linkedAsset?: string;
  keyLesson: string;
}

export interface OperationalCalendarEvent {
  id: string;
  title: string;
  type: 'NEWS' | 'TRADING_SESSION' | 'BACKTEST' | 'RESEARCH' | 'REVIEW' | 'PERSONAL';
  date: string; // YYYY-MM-DD
  time: string;
  timeZone?: 'Africa/Lagos' | 'America/New_York';
  assetOrCurrency?: string;
  impact?: 'HIGH' | 'MEDIUM' | 'LOW';
  completed?: boolean;
  reminderMinutesBefore?: number;
  notes?: string;
}

export interface AlertRule {
  id: string;
  title: string;
  type: 'POI' | 'LIQUIDITY' | 'SESSION' | 'RISK_LIMIT' | 'NEWS' | 'MACRO';
  asset?: string;
  conditionText: string;
  triggered: boolean;
  triggeredAt?: string;
  active: boolean;
}

export interface PerformanceStats {
  totalTrades: number;
  totalR: number;
  todayR: number;
  weeklyR: number;
  monthlyR: number;
  winRate: number;
  expectancy: number;
  maxDrawdownR: number;
  consecutiveLosses: number;
  avgRWin: number;
  avgRLoss: number;
  goodProcessLossPct: number;
  badProcessWinPct: number;
  lossCountToday: number;
  riskStatus: 'NORMAL' | 'WARNING' | 'MAX_LOSS_HALT';
}

/** What the day's trades actually show, computed from the Journal (never typed in).
 * Saved with each debrief as a snapshot of the evidence it was written against. */
export interface DailyEvidence {
  date: string;
  tradesTaken: number;
  closedTrades: number;
  openTrades: number;
  /** Average process score (0–5) across the day's trades; null if none. */
  processAvg: number | null;
  gradeCounts: Record<string, number>;
  totalR: number;
  wins: number;
  losses: number;
  scratches: number;
  /** Losses as counted by the daily-halt rule (scratches count if scratchCountsAsLoss). */
  lossCount: number;
  maxDailyLosses: number;
  halted: boolean;
  mistakeCodeCounts: Record<string, number>;
  /** Trades with at least one mistake code. */
  ruleBreakTrades: number;
  /** Trades that broke an HQ rule check at entry (e.g. planned R below minimum). */
  violationTrades: number;
  voidedCount: number;
  tradeIds: string[];
}

/** The daily debrief template, digitized as is:
 * process avg · trades taken · A+/B+ count · rule breaks (from evidence) ·
 * presence quality · yesterday's 1% upgrade executed Y/N · today's 1% upgrade
 * for tomorrow — plus tomorrow's single assignment from the evening routine. */
export interface DailyDebrief {
  date: string;
  presenceQuality: string;
  /** YES/NO for the previous debrief's upgrade; NA when there wasn't one. */
  previousUpgradeExecuted: 'YES' | 'NO' | 'NA' | null;
  previousUpgradeText?: string;
  previousUpgradeDate?: string;
  upgradeForTomorrow: string;
  tomorrowAssignment: string;
  evidence: DailyEvidence;
  createdAt: string;
  updatedAt: string;
}

/** The week's evidence, computed from the Journal and the week's debriefs. */
export interface WeeklyEvidence {
  weekStart: string; // Monday, YYYY-MM-DD
  weekEnd: string; // Sunday
  tradesTaken: number;
  closedTrades: number;
  processAvg: number | null;
  /** Process average per day, Monday first; null where no trades. */
  processByDay: Array<{ date: string; processAvg: number | null; trades: number; totalR: number }>;
  gradeCounts: Record<string, number>;
  mistakeCodeCounts: Record<string, number>;
  mostCommonMistake: string | null;
  totalR: number;
  wins: number;
  losses: number;
  scratches: number;
  haltDays: number;
  ruleBreakTrades: number;
  tradingDays: number;
  debriefsWritten: number;
  tradingDaysWithoutDebrief: string[];
  /** Daily 1% upgrades checked in the week's debriefs. */
  upgradesYes: number;
  upgradesNo: number;
}

export interface WatchlistEntry {
  day: string;
  asset: string;
  /** One-sentence bias for next week. */
  bias: string;
  keyLevels: string;
}

/** The weekly review template, digitized as is: process avg · most common
 * mistake code · A+ vs B+ (evidence) · biggest process leak · watchlist
 * (now the focus rotation, one-sentence bias + key levels each) ·
 * red-folder events next week · personal/energy notes · one upgrade. */
export interface WeeklyReview {
  weekStart: string;
  biggestLeak: string;
  personalNotes: string;
  redFolderEvents: string;
  watchlist: WatchlistEntry[];
  upgradeForNextWeek: string;
  /** Whether last week's upgrade held; NA when there wasn't one. */
  previousUpgradeExecuted: 'YES' | 'NO' | 'NA' | null;
  previousUpgradeText?: string;
  evidence: WeeklyEvidence;
  createdAt: string;
  updatedAt: string;
}


/** A planned setup on an Asset Desk, waiting for its entry to trigger.
 * When it triggers it converts into a Journal trade with all its details;
 * if it never does, it's marked invalidated or expired (never deleted), which
 * keeps a record of the setups that didn't happen. */
export interface PendingSetup {
  id: string;
  deskId: string;
  asset: string;
  direction: 'LONG' | 'SHORT';
  timeframe: string;
  modelId: string;
  setupGrade: string;
  entryPrice: number;
  stopPrice: number;
  targetPrice: number;
  plannedR: number;
  narrative: string;
  setupReasoning: string;
  screenshots: string[];
  /** Optional last day (YYYY-MM-DD) the setup is valid. */
  validUntil?: string;
  status: 'PENDING' | 'TRIGGERED' | 'INVALIDATED' | 'EXPIRED';
  resolution?: { at: string; reason?: string; tradeId?: string };
  /** Accounts the setup is planned for; can be changed when it triggers. */
  accountIds?: string[];
  /** Older single-account field (read only). */
  accountId?: string;
  /** Trading HQ version when the setup was planned. */
  configVersionAtPlan: string;
  createdAt: string;
  updatedAt: string;
}

export type TradingAccountKind = 'PROP_CHALLENGE' | 'PROP_FUNDED' | 'PERSONAL' | 'DEMO' | 'OTHER';

/** A deposit (+), withdrawal or payout (−), or fee (−) on an account. */
export interface AccountAdjustment {
  id: string;
  /** YYYY-MM-DD */
  date: string;
  amount: number;
  note: string;
}

export interface AccountRisk {
  pct: number;
  amount: number;
}

/** How a prop firm measures its loss limits. */
export interface PropRules {
  /** Firm name / programme, e.g. "FundingPips 2-step". */
  programme?: string;
  /** Max loss in one day, % (e.g. 5). */
  dailyLossPct?: number;
  /** What the daily % is taken from: the starting balance, or the balance at the start of each day. */
  dailyLossBasis?: 'STARTING_BALANCE' | 'DAY_START_BALANCE';
  /** Max total loss / drawdown, % (e.g. 10). */
  maxLossPct?: number;
  /** STATIC: floor = starting balance − max %. TRAILING: floor follows the highest balance reached. */
  maxLossType?: 'STATIC' | 'TRAILING';
  /** TRAILING only: the floor stops rising once it reaches the starting balance. */
  trailingLocksAtStart?: boolean;
  /** Profit target, % (e.g. 8). */
  profitTargetPct?: number;
  /** Minimum trading days, if the firm has one. */
  minTradingDays?: number;
}

export interface TradingAccount {
  id: string;
  name: string;
  kind: TradingAccountKind;
  broker: string;
  currency: string;
  startingBalance: number;
  adjustments: AccountAdjustment[];
  notes: string;
  /** Risk allowed per trade on this account, % of balance (e.g. 3). Unset = Trading HQ's. */
  riskPct?: number;
  /** Prop firm rules; only for prop accounts. */
  propRules?: PropRules;
  archivedAt?: string;
  createdAt: string;
}
