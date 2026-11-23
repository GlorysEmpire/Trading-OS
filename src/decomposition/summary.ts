import type { Bias, Decomposition, DecompositionDefinitions, Depth, GateResult, LayerVerdict, LegType, LiquidityLevel, Location, Phase, PoiCheck } from './types';
import {
  dailyPoiChecks, depthExpectation, evaluateDaily, evaluateWeekly, isIdentified, latestLayer, legTypeOf, locationOf, validRange, weeklyBias,
} from './logic';

/** Everything the summary card and the Asset Desk show. Read-only: derived from the latest layer versions. */
export interface DecompositionSummary {
  decompositionId: string;
  symbol: string;
  mode: Decomposition['mode'];
  weekly?: {
    version: number;
    asOf: string;
    definitionsVersion: string;
    bias: Bias;
    location?: Location;
    drawAbove?: number;
    drawBelow?: number;
    gate: GateResult;
  };
  daily?: {
    version: number;
    asOf: string;
    definitionsVersion: string;
    bias: Bias;
    location?: Location;
    equilibrium?: number;
    phase?: Phase;
    legType?: LegType;
    depth?: Depth;
    suggestedDepth?: Depth;
    inducement?: LiquidityLevel;
    pois: PoiCheck[];
    target?: number;
    invalidation?: number;
    gate: GateResult;
  };
  /** The overall state, driven by the daily read when there is one. */
  verdict: LayerVerdict;
  reason: string;
  /** One plain sentence: the bias and plan, built from the extracted data. */
  sentence: string;
  /** True when a layer used definitions other than the current ones (they're kept, not reinterpreted). */
  usesOlderDefinitions: boolean;
}

const fmt = (n: number) => (Math.abs(n) >= 1000 ? n.toLocaleString('en-US', { maximumFractionDigits: 2 }) : String(Math.round(n * 100000) / 100000));
const lower = (s: string) => s.toLowerCase();

/**
 * Builds the summary. `definitionsFor` returns the definitions block of a
 * given version; each layer is evaluated with the version it was read with.
 */
export function summarize(
  dec: Decomposition,
  definitionsFor: (version: string) => DecompositionDefinitions | undefined,
  current: DecompositionDefinitions,
): DecompositionSummary {
  const w = latestLayer(dec, 'WEEKLY');
  const d = latestLayer(dec, 'DAILY');
  const out: DecompositionSummary = {
    decompositionId: dec.id, symbol: dec.symbol, mode: dec.mode,
    verdict: 'INCOMPLETE', reason: 'Nothing read yet.', sentence: '', usesOlderDefinitions: false,
  };

  if (w) {
    const defs = definitionsFor(w.definitionsVersion) ?? current;
    const wd = w.data;
    out.weekly = {
      version: w.version, asOf: w.asOf, definitionsVersion: w.definitionsVersion,
      bias: weeklyBias(wd),
      location: isIdentified(wd.dealingRange) && validRange(wd.dealingRange.value) ? locationOf(wd.dealingRange.value.currentPrice, wd.dealingRange.value, defs.equilibriumBandPct) : undefined,
      drawAbove: isIdentified(wd.draw) ? wd.draw.value.above : undefined,
      drawBelow: isIdentified(wd.draw) ? wd.draw.value.below : undefined,
      gate: evaluateWeekly(wd),
    };
    out.verdict = out.weekly.gate.verdict;
    out.reason = out.weekly.gate.reason;
  }

  if (d) {
    const defs = definitionsFor(d.definitionsVersion) ?? current;
    const dd = d.data;
    const range = isIdentified(dd.dealingRange) && validRange(dd.dealingRange.value) ? dd.dealingRange.value : undefined;
    const legType = isIdentified(dd.leg) ? legTypeOf(dd.leg.value, defs) : undefined;
    const levels = isIdentified(dd.liquidity) ? dd.liquidity.value.levels : [];
    const inducement = isIdentified(dd.liquidity) ? levels.find((l) => l.id === dd.liquidity.value!.inducementId) : undefined;
    const pois = dailyPoiChecks(dd, defs);
    const gate = evaluateDaily(dd, defs);
    const primary = isIdentified(dd.pois) ? dd.pois.value.primary : undefined;
    out.daily = {
      version: d.version, asOf: d.asOf, definitionsVersion: d.definitionsVersion,
      bias: isIdentified(dd.structure) ? dd.structure.value.trend : 'NEUTRAL',
      location: range ? locationOf(dd.dealingRange.value!.currentPrice, range, defs.equilibriumBandPct) : undefined,
      equilibrium: range ? (range.high + range.low) / 2 : undefined,
      phase: isIdentified(dd.phase) ? dd.phase.value : undefined,
      legType,
      depth: isIdentified(dd.depth) ? dd.depth.value : undefined,
      suggestedDepth: depthExpectation(legType, primary?.side, levels, primary).depth,
      inducement,
      pois,
      target: isIdentified(dd.targetInvalidation) ? dd.targetInvalidation.value.target : undefined,
      invalidation: isIdentified(dd.targetInvalidation) ? dd.targetInvalidation.value.invalidation : undefined,
      gate,
    };
    out.verdict = gate.verdict;
    out.reason = gate.reason;
  }

  out.usesOlderDefinitions = [w, d].some((l) => l && l.definitionsVersion !== current.version);
  out.sentence = sentence(out);
  return out;
}

function sentence(s: DecompositionSummary): string {
  const parts: string[] = [];
  if (s.weekly) parts.push(s.weekly.bias === 'NEUTRAL' ? 'Weekly neutral' : `Weekly ${lower(s.weekly.bias)}`);
  const d = s.daily;
  if (!d) return parts.length ? `${parts.join('; ')}.` : 'No read yet.';
  if (d.gate.verdict === 'LEAVE_CHART') return `${[...parts, 'daily structure inconclusive with no range'].join('; ')}: leave the chart.`;
  parts.push(`daily ${d.bias === 'NEUTRAL' ? 'neutral' : lower(d.bias)}${d.location ? `, price in ${lower(d.location)}` : ''}`);
  const best = d.pois.find((p) => p.valid);
  if (best) {
    const verb = best.poi.side === 'SELL' ? 'sell' : 'buy';
    parts.push(`${verb} from ${best.role === 'PRIMARY' ? 'POI A' : 'POI B'} ${fmt(best.poi.low)}–${fmt(best.poi.high)} toward ${fmt(d.target!)} (${best.rToDraw}R)`);
    if (d.invalidation !== undefined) parts.push(`invalid on a close beyond ${fmt(d.invalidation)}`);
  } else if (d.gate.verdict === 'OBSERVATION_ONLY') {
    parts.push('observation only');
  }
  const text = parts.join('; ');
  return text.charAt(0).toUpperCase() + text.slice(1) + '.';
}
