import type { PlanLink } from '../types';
import { dailyPoiChecks, isIdentified } from './logic';
import { periodAsDaily, unlocksSetups } from './plans';
import { isStructureNewer } from './structural';
import type { DecompositionDefinitions, PeriodPlan, Poi, StructuralRecord } from './types';

export function linkedPlanOptions({
  plans, map, current, definitionsFor, deskId, feed, at,
}: {
  plans: PeriodPlan[]; map?: StructuralRecord; current: DecompositionDefinitions;
  definitionsFor: (version: string) => DecompositionDefinitions | undefined;
  deskId: string; feed: string; at: string;
}): Array<{ plan: PeriodPlan; poi: Poi; link: PlanLink }> {
  if (!map) return [];
  const instant = Date.parse(at);
  const plan = plans.find((item) => item.deskId === deskId && item.mode === 'LIVE' && item.cadence === 'DAY'
    && item.candle.feed === feed && !item.review && Date.parse(item.candle.openTime) <= instant
    && instant < Date.parse(item.candle.closeTime ?? ''));
  if (!plan || map.id !== plan.structuralVersionRef.structuralRecordId || isStructureNewer(map, plan.structuralVersionRef)) return [];
  const defs = definitionsFor(plan.definitionsVersion) ?? current;
  try {
    if (!unlocksSetups(map, plan, defs)) return [];
    const formation = isIdentified(plan.read.formation) ? plan.read.formation.value : undefined;
    const checks = dailyPoiChecks(periodAsDaily(map, plan), defs).filter((result) => result.valid && (result.rToDraw ?? 0) >= 3);
    return checks.flatMap(({ role }) => {
      const poi = role === 'PRIMARY' ? formation?.primary : formation?.backup;
      return poi ? [{ plan, poi, link: { planId: plan.id, poiId: poi.id, poiLabel: poi.label } }] : [];
    });
  } catch { return []; }
}
