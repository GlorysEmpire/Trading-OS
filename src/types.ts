/**
 * TRADING OS - CORE TYPES & DOMAIN MODELS
 * Adhering strictly to configurable methodology & versioned rules.
 */

export type AssetCategory = 'CRYPTO' | 'INDICES' | 'METALS' | 'FX' | 'EQUITIES' | 'OTHER';

export type BiasType = 'BULLISH' | 'BEARISH' | 'NEUTRAL' | 'ACCUMULATION' | 'DISTRIBUTION' | 'RE-ACCUMULATION';

export interface LiquidityZone {
  id: string;
  level: string;
  type: 'BSL' | 'SSL' | 'EQH' | 'EQL' | 'RANGE_HIGH' | 'RANGE_LOW';
  status: 'UNTOUCHED' | 'SWEPT' | 'ENGINEERED';
  notes: string;
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
}

export interface AssetChartScreenshot {
  id: string;
  title: string;
  timeframe: string;
  url: string;
  caption?: string;
  uploadedAt: string;
  category?: 'BIAS' | 'EXECUTION' | 'WYCKOFF' | 'LIQUIDITY' | 'GENERAL';
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
  };
  scenarios: Scenario[];
  researchNotes: string;
  quickLevels: {
    high24h: string;
    low24h: string;
    keySustainedLevel: string;
  };
  charts?: AssetChartScreenshot[];
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
}

export interface ExecutionModel {
  id: string;
  name: string;
  description: string;
  keyCriteria: string[];
}

export interface SessionWindow {
  id: string;
  name: string;
  nyStart: string;
  nyEnd: string;
  lagosStart: string;
  lagosEnd: string;
  activeDays: string[];
  notes?: string;
}

export interface MistakeCode {
  code: string;
  label: string;
  category: 'RISK' | 'PSYCHOLOGY' | 'EXECUTION' | 'MANAGEMENT';
  description: string;
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
