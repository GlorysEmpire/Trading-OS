import type { DecompositionDefinitions } from './types';

/**
 * PLACEHOLDER definitions, taken from the v0.3 proposal (§3). Not locked.
 * Trading HQ stores the real, versioned block (M1); this is only the
 * starting value offered when no block exists yet. Logic never reads these
 * directly — it always receives the definitions to use as an argument.
 */
export const PLACEHOLDER_DEFINITIONS: DecompositionDefinitions = {
  version: 'decomp-defs-v0-placeholder',
  locked: false,
  text: {
    internalSwing: '3-candle fractal.',
    externalSwing: 'The extreme between two BOS (the high/low that produced a BOS).',
    bos: 'Body close beyond the swing. A wick through and a close back inside is a liquidity event (sweep), not a BOS.',
    choch: 'External CHoCH: body close beyond the external swing that produced the latest BOS. Internal CHoCH/IBOS: the same test on an internal swing.',
    mss: 'To be defined by the trader.',
    equalHighsLows: 'Highs or lows within the equal-highs/lows tolerance (× ATR).',
  },
  strongLeg: {
    atrMultiple: 1.5,
    outerClosePct: 25,
    maxBodyOverlapPct: 30,
    strongMin: 3,
    weakMax: 1,
  },
  equalHighsLowsAtr: 0.1,
  equilibriumBandPct: 0,
  minRToDraw: 3,
  rStopBasis: 'POI_FAR_EDGE',
};

/** Problems that make a definitions block unusable (empty = fine). */
export function validateDefinitions(d: DecompositionDefinitions): string[] {
  const problems: string[] = [];
  if (!d.version.trim()) problems.push('Definitions need a version name.');
  const { strongMin, weakMax, atrMultiple, outerClosePct, maxBodyOverlapPct } = d.strongLeg;
  if (!(strongMin >= 1 && strongMin <= 4)) problems.push('Strong leg needs between 1 and 4 criteria.');
  if (!(weakMax >= 0 && weakMax < strongMin)) problems.push('The weak-leg ceiling must be below the strong-leg minimum.');
  if (!(atrMultiple > 0)) problems.push('ATR multiple must be above 0.');
  if (!(outerClosePct > 0 && outerClosePct <= 50)) problems.push('Outer close zone must be between 0 and 50%.');
  if (!(maxBodyOverlapPct > 0 && maxBodyOverlapPct <= 100)) problems.push('Body overlap must be between 0 and 100%.');
  if (!(d.equalHighsLowsAtr > 0)) problems.push('Equal highs/lows tolerance must be above 0.');
  if (!(d.equilibriumBandPct >= 0 && d.equilibriumBandPct < 50)) problems.push('Equilibrium band must be between 0 and 50%.');
  if (!(d.minRToDraw > 0)) problems.push('Minimum R to the draw must be above 0.');
  return problems;
}
