import type { LayerTimeframe } from './types';

/** One question per step. STEPS is the M0 Weekly → Daily order; STRUCTURAL_STEPS adds Monthly and 4H. */
export interface StepDef {
  key: string;
  timeframe: LayerTimeframe;
  /** The single question this step answers. */
  question: string;
  /** Short help: what to look for. Definitions are shown from Trading HQ beside it. */
  help: string;
  /** A gating step can stop the flow. */
  gating: boolean;
  /** What "not identified" means here, in plain words. */
  ifNotIdentified: string;
}

export const STEPS: StepDef[] = [
  { key: 'trend', timeframe: 'WEEKLY', gating: true, question: 'What is the weekly trend from the last external BOS?', help: 'Find the last body close beyond an external swing. Its direction is the weekly trend.', ifNotIdentified: 'The higher timeframe is neutral; the Daily carries the read.' },
  { key: 'dealingRange', timeframe: 'WEEKLY', gating: false, question: 'What is the weekly dealing range, and where is price in it?', help: 'High and low of the leg that made the last BOS, plus the current price.', ifNotIdentified: 'No weekly premium/discount read.' },
  { key: 'draw', timeframe: 'WEEKLY', gating: false, question: 'Where is the draw on liquidity, above and below?', help: 'The nearest external liquidity each way.', ifNotIdentified: 'No weekly draw recorded.' },
  { key: 'pois', timeframe: 'WEEKLY', gating: false, question: 'Which weekly POIs are still unmitigated?', help: 'Zones price has not traded back into since they formed.', ifNotIdentified: 'No weekly POIs recorded.' },

  { key: 'structure', timeframe: 'DAILY', gating: true, question: 'What is the daily structure: trend, last BOS, internal or external?', help: 'Body close beyond a swing. A wick through and close back inside is a sweep, not a BOS.', ifNotIdentified: 'If there is also no dealing range, leave the chart.' },
  { key: 'dealingRange', timeframe: 'DAILY', gating: true, question: 'What is the daily dealing range, and where is price in it?', help: 'High and low of the leg that made the BOS. Equilibrium is its 50%.', ifNotIdentified: 'If the structure is also inconclusive, leave the chart.' },
  { key: 'phase', timeframe: 'DAILY', gating: false, question: 'Is price expanding, retracing or ranging?', help: 'A range sends the read to the Wyckoff / RDM branch.', ifNotIdentified: 'Phase left open.' },
  { key: 'leg', timeframe: 'DAILY', gating: false, question: 'Is the last leg strong or weak?', help: 'Tick the criteria the leg meets. The thresholds come from your definitions.', ifNotIdentified: 'Leg type left open.' },
  { key: 'candles', timeframe: 'DAILY', gating: false, question: 'What do the last 1–3 daily candles say?', help: 'Expansion, rejection or indecision; where they closed; any liquidity event.', ifNotIdentified: 'Candle read left open.' },
  { key: 'liquidity', timeframe: 'DAILY', gating: false, question: 'Where is the liquidity, and which level is the inducement?', help: 'Internal highs/lows, equal highs/lows, swept or not. The inducement is the first obvious internal point in the retracement path.', ifNotIdentified: 'No liquidity map.' },
  { key: 'depth', timeframe: 'DAILY', gating: false, question: 'Do you expect a shallow or a deep retracement?', help: 'Intent first (leg type), then where the liquidity sits. A suggestion is shown; you decide.', ifNotIdentified: 'Depth left open.' },
  { key: 'pois', timeframe: 'DAILY', gating: true, question: 'Which POI is A (primary) and which is B (backup)?', help: 'Premium for sells, discount for buys, unmitigated, beyond the inducement.', ifNotIdentified: 'Observation only: no setup without a POI.' },
  { key: 'targetInvalidation', timeframe: 'DAILY', gating: true, question: 'What is the target, and what invalidates the read?', help: 'Target: next external liquidity. Invalidation: a close beyond the swing that made the BOS.', ifNotIdentified: 'Observation only: no draw to measure R to.' },
];

const MONTHLY_STEPS: StepDef[] = [
  { key: 'trend', timeframe: 'MONTHLY', gating: false, question: 'What is the monthly trend from the last external BOS?', help: 'The last body close beyond an external monthly swing.', ifNotIdentified: 'Monthly neutral; the Weekly carries the context.' },
  { key: 'dealingRange', timeframe: 'MONTHLY', gating: false, question: 'What is the monthly dealing range, and where is price in it?', help: 'High and low of the leg that made the last BOS, plus the current price.', ifNotIdentified: 'No monthly premium/discount read.' },
  { key: 'draw', timeframe: 'MONTHLY', gating: false, question: 'Where is the monthly draw on liquidity, above and below?', help: 'The nearest external liquidity each way.', ifNotIdentified: 'No monthly draw recorded.' },
  { key: 'pois', timeframe: 'MONTHLY', gating: false, question: 'Which monthly POIs are still unmitigated?', help: 'Zones price has not traded back into since they formed.', ifNotIdentified: 'No monthly POIs recorded.' },
];

const H4_STEPS: StepDef[] = [
  { key: 'alignment', timeframe: 'H4', gating: false, question: 'Does the 4H agree with the Daily?', help: 'If they conflict, the Daily wins: reduce the target or wait.', ifNotIdentified: 'Alignment left open.' },
  { key: 'structure', timeframe: 'H4', gating: false, question: 'What is the 4H structure: trend, last BOS, internal or external?', help: 'Keep internal shifts separate from external CHoCH.', ifNotIdentified: '4H structure left open.' },
  { key: 'wyckoff', timeframe: 'H4', gating: false, question: 'What Wyckoff phase and events do you see on the 4H?', help: 'AR is an analytical event only, never an entry trigger.', ifNotIdentified: 'No Wyckoff read.' },
  { key: 'pois', timeframe: 'H4', gating: false, question: 'Which POIs does the 4H refine?', help: 'Tighter zones inside the Daily POIs.', ifNotIdentified: 'Daily POIs stand as they are.' },
];

/** The structural flow (backtesting block): Monthly → Weekly → Daily → 4H. */
export const STRUCTURAL_STEPS: StepDef[] = [...MONTHLY_STEPS, ...STEPS, ...H4_STEPS];

/** Today's read (sessions), one question per step, after the morning gate. */
export interface DailyReadStepDef { key: string; question: string; help: string; gating: boolean }
export const DAILY_READ_STEPS: DailyReadStepDef[] = [
  { key: 'priorCandle', gating: false, question: 'How did the previous daily candle form and close?', help: 'Expansion, rejection or indecision; close high, mid or low; any liquidity event.' },
  { key: 'liquidity', gating: false, question: 'Which liquidity was swept, rejected, or is still outstanding?', help: 'Mark the inducement: the first obvious internal point in today\'s path.' },
  { key: 'depth', gating: false, question: 'From the impulse, do you expect a shallow or deep retracement?', help: 'Intent first, then where the liquidity sits.' },
  { key: 'expectation', gating: false, question: 'Is today about internal or external liquidity?', help: 'Inside the range, or reaching for the external draw.' },
  { key: 'pois', gating: true, question: 'Which POI is A, and which is B, for today?', help: 'Premium for sells, discount for buys, unmitigated, beyond the inducement.' },
  { key: 'draw', gating: true, question: "What is today's draw, and what invalidates the read?", help: 'The draw sets the R available from each POI.' },
  { key: 'entryModels', gating: false, question: 'Which entry model will you look for at each POI?', help: 'Models from Trading HQ. An untested model is UNTESTED_MODEL.' },
  { key: 'session', gating: false, question: 'Which session is this plan for?', help: 'Session windows are New York time.' },
];

export const stepsFor = (timeframe: LayerTimeframe) => STRUCTURAL_STEPS.filter((s) => s.timeframe === timeframe);
export const stepDef = (timeframe: LayerTimeframe, key: string) => STRUCTURAL_STEPS.find((s) => s.timeframe === timeframe && s.key === key);
