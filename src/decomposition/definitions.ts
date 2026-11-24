import type { DecompositionDefinitions, ReadinessSettings } from './types';
import { PLACEHOLDER_CORRELATION_GROUPS, PLACEHOLDER_EVENT_BUFFER_MINUTES } from './readiness';

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
  readiness: { eventBufferMinutes: PLACEHOLDER_EVENT_BUFFER_MINUTES, correlationGroups: PLACEHOLDER_CORRELATION_GROUPS },
};

/** The readiness settings to use (older versions without them get the defaults). */
export const readinessSettings = (d: DecompositionDefinitions): ReadinessSettings => d.readiness ?? PLACEHOLDER_DEFINITIONS.readiness!;

/** Correlation groups as one line each, members comma-separated (for the editor). */
export const groupsToText = (g: string[][]) => g.map((x) => x.join(', ')).join('\n');
export const textToGroups = (t: string): string[][] => t.split('\n').map((l) => l.split(',').map((m) => m.trim().toUpperCase()).filter(Boolean)).filter((g) => g.length > 0);

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
  const r = readinessSettings(d);
  if (!(Number.isInteger(r.eventBufferMinutes) && r.eventBufferMinutes >= 0 && r.eventBufferMinutes <= 240)) problems.push('News buffer must be a whole number of minutes, 0 to 240.');
  if (r.correlationGroups.some((g) => g.length < 2)) problems.push('Each correlation group needs at least two assets.');
  return problems;
}

// ---- Versioned definitions in Trading HQ (M1) -----------------------------------

/** The definitions version name for a Trading HQ row version. */
export const definitionsVersionName = (rowVersion: number) => `decomp-defs-v${rowVersion}`;

/** Plain list of what differs between two definition blocks (for the "what changed" preview). */
export function describeDefinitionChanges(before: DecompositionDefinitions, after: DecompositionDefinitions): string[] {
  const out: string[] = [];
  const textLabels: Record<keyof DecompositionDefinitions['text'], string> = {
    internalSwing: 'Internal swing', externalSwing: 'External swing', bos: 'BOS', choch: 'CHoCH', mss: 'MSS', equalHighsLows: 'Equal highs/lows',
  };
  for (const k of Object.keys(textLabels) as Array<keyof DecompositionDefinitions['text']>) {
    if (before.text[k].trim() !== after.text[k].trim()) out.push(`${textLabels[k]} definition reworded`);
  }
  const num = (label: string, a: number, b: number, unit = '') => { if (a !== b) out.push(`${label}: ${a}${unit} → ${b}${unit}`); };
  num('Strong leg ATR multiple', before.strongLeg.atrMultiple, after.strongLeg.atrMultiple, '×');
  num('Outer close zone', before.strongLeg.outerClosePct, after.strongLeg.outerClosePct, '%');
  num('Max body overlap', before.strongLeg.maxBodyOverlapPct, after.strongLeg.maxBodyOverlapPct, '%');
  num('Strong leg needs', before.strongLeg.strongMin, after.strongLeg.strongMin, ' of 4');
  num('Weak leg at or below', before.strongLeg.weakMax, after.strongLeg.weakMax, ' of 4');
  num('Equal highs/lows tolerance', before.equalHighsLowsAtr, after.equalHighsLowsAtr, '× ATR');
  num('Equilibrium band', before.equilibriumBandPct, after.equilibriumBandPct, '%');
  num('Minimum R to the draw', before.minRToDraw, after.minRToDraw, 'R');
  const rb = readinessSettings(before), ra = readinessSettings(after);
  num('News buffer', rb.eventBufferMinutes, ra.eventBufferMinutes, ' min');
  if (groupsToText(rb.correlationGroups) !== groupsToText(ra.correlationGroups)) out.push('Correlation groups changed');
  if (before.rStopBasis !== after.rStopBasis) out.push(`R measured with the stop at ${after.rStopBasis === 'INVALIDATION' ? 'the invalidation' : "the POI's far edge"}`);
  if (before.locked !== after.locked) out.push(after.locked ? 'Locked' : 'Unlocked (placeholder again)');
  return out;
}

/**
 * The next version of the definitions, ready to save as a new Trading HQ
 * row. Refuses invalid values and a save with nothing changed. The version
 * name follows the HQ row version, so every record can name exactly what it used.
 */
export function prepareDefinitionsRevision(current: DecompositionDefinitions, edited: DecompositionDefinitions, nextRowVersion: number): DecompositionDefinitions {
  const next = { ...edited, version: definitionsVersionName(nextRowVersion) };
  const problems = validateDefinitions(next);
  if (problems.length) throw new Error(problems.join(' '));
  if (!describeDefinitionChanges(current, next).length) throw new Error('Nothing changed, so no new version was saved.');
  return next;
}

/** Looks up any saved version (old records keep theirs); the in-code placeholder is always known. */
export function definitionsResolver(history: DecompositionDefinitions[]): (version: string) => DecompositionDefinitions | undefined {
  const byVersion = new Map(history.map((d) => [d.version, d]));
  return (version) => byVersion.get(version) ?? (version === PLACEHOLDER_DEFINITIONS.version ? PLACEHOLDER_DEFINITIONS : undefined);
}
