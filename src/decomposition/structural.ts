/**
 * Structural Record (M0.1): the long-term map of one asset, Monthly → Weekly →
 * Daily → 4H. Built on the M0 version rules (appendLayerVersion): append-only,
 * and a new version is saved only when the structure actually changed.
 */
import type {
  GateResult, H4Layer, LayerData, LayerTimeframe, LayerVersion, MorningCheck, MorningGateNext, StructuralRecord, StructuralVersionRef,
} from './types';
import { LAYER_ORDER } from './types';
import { appendLayerVersion, isIdentified, latestLayer } from './logic';

/** Stable JSON (sorted keys) so equal content compares equal whatever the key order. */
function canonical(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(canonical).join(',')}]`;
  if (v && typeof v === 'object') {
    return `{${Object.keys(v as object).filter((k) => (v as Record<string, unknown>)[k] !== undefined).sort()
      .map((k) => `${JSON.stringify(k)}:${canonical((v as Record<string, unknown>)[k])}`).join(',')}}`;
  }
  return JSON.stringify(v);
}

/** True when `data` differs from the latest saved version of its timeframe. */
export function structureChanged(rec: StructuralRecord, data: LayerData): boolean {
  const latest = latestLayer(rec, data.timeframe);
  return !latest || canonical(latest.data) !== canonical(data);
}

/**
 * Saves the layers that changed, as new versions. Layers whose content is the
 * same as their latest version are skipped. Throws if nothing changed: the
 * existing map stays in use.
 */
export function updateStructure(
  rec: StructuralRecord,
  layers: Array<{ id: string; asOf: string; data: LayerData }>,
  meta: { createdAt: string; definitionsVersion: string },
): StructuralRecord {
  const changed = layers
    .filter((l) => structureChanged(rec, l.data))
    .sort((a, b) => LAYER_ORDER.indexOf(a.data.timeframe) - LAYER_ORDER.indexOf(b.data.timeframe));
  if (!changed.length) throw new Error('No structural change: keep using the existing map.');
  return changed.reduce((acc, l) => appendLayerVersion(acc, { id: l.id, asOf: l.asOf, data: l.data, ...meta }), rec);
}

/** A pointer to the structure exactly as it is now. */
export function currentStructuralRef(rec: StructuralRecord): StructuralVersionRef {
  const layerIds: StructuralVersionRef['layerIds'] = {};
  for (const tf of LAYER_ORDER) {
    const l = latestLayer(rec, tf);
    if (l) layerIds[tf] = l.id;
  }
  return { structuralRecordId: rec.id, revision: rec.layers.length, layerIds };
}

/** The layer versions a ref points at (not the latest ones). */
export function resolveStructural(rec: StructuralRecord, ref: StructuralVersionRef): Partial<Record<LayerTimeframe, LayerVersion>> {
  if (ref.structuralRecordId !== rec.id) throw new Error('This reference belongs to another structural record.');
  const out: Partial<Record<LayerTimeframe, LayerVersion>> = {};
  for (const tf of LAYER_ORDER) {
    const id = ref.layerIds[tf];
    if (!id) continue;
    const l = rec.layers.find((x) => x.id === id);
    if (!l) throw new Error(`The ${tf.toLowerCase()} layer this reference points at is missing.`);
    out[tf] = l;
  }
  return out;
}

/** True when the structure moved on after the ref was taken. */
export function isStructureNewer(rec: StructuralRecord, ref: StructuralVersionRef): boolean {
  return rec.layers.length > ref.revision;
}

/** 4H: a conflict with the Daily is noted and the Daily wins. Never a hard stop. */
export function evaluateH4(h: Partial<Omit<H4Layer, 'timeframe'>>): GateResult {
  const missing = (['alignment', 'structure', 'wyckoff', 'pois'] as const).find((k) => !h[k]);
  if (missing) return { verdict: 'INCOMPLETE', reason: '4H steps still to answer.', stoppedAt: missing };
  if (isIdentified(h.alignment) && h.alignment.value === 'CONFLICT') {
    return { verdict: 'CONTEXT_READY', reason: '4H conflicts with the Daily: the Daily wins. Reduce the target or wait for the 4H to align.' };
  }
  return { verdict: 'CONTEXT_READY', reason: '4H narrative recorded.' };
}

// ---- Morning gate -------------------------------------------------------------

export const MORNING_QUESTION = 'Did structure change overnight? A body-close BOS or CHoCH on the Daily or 4H, or a POI mitigated or invalidated.';

/**
 * What must happen before today's Daily Record can start:
 * no map → build it; no answer → ask; changed and not yet updated → update first; else start.
 */
export function morningGate(rec: StructuralRecord | undefined, check: MorningCheck | undefined): { next: MorningGateNext; reason: string } {
  if (!rec || !latestLayer(rec, 'DAILY')) {
    return { next: 'BUILD_STRUCTURE', reason: 'Build the structural map first (at least its Daily layer), in the backtesting block. The daily read sits inside that story.' };
  }
  if (!check) return { next: 'ANSWER_MORNING_CHECK', reason: MORNING_QUESTION };
  if (check.structureChanged) {
    if (!check.reasons.length) return { next: 'ANSWER_MORNING_CHECK', reason: 'Say what changed overnight: a BOS or CHoCH on the Daily or 4H, or a POI mitigated or invalidated.' };
    const updated = rec.layers.some((l) => l.createdAt >= check.answeredAt);
    if (!updated) {
      return { next: 'UPDATE_STRUCTURE', reason: `Structure changed overnight (${check.reasons.map((r) => r.toLowerCase().replace('_', ' ')).join(', ')}). Update the structural map first, then start today's read.` };
    }
  }
  return { next: 'START_DAILY', reason: check.structureChanged ? 'Structural map updated. Start today\'s read.' : 'No overnight change. Use the existing map.' };
}
