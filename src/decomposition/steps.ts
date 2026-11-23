import type { LayerTimeframe } from './types';

/** One question per step, in the order of work (Weekly → Daily). The stepper (M3) renders these. */
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

export const stepsFor = (timeframe: LayerTimeframe) => STEPS.filter((s) => s.timeframe === timeframe);
export const stepDef = (timeframe: LayerTimeframe, key: string) => STEPS.find((s) => s.timeframe === timeframe && s.key === key);
