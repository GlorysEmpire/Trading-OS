export type PlanResearchDraft = { planId: string; asset: string; title: string; observation: string };
const key = 'tos-plan-research-draft';

export function queuePlanResearch(draft: PlanResearchDraft) {
  try { sessionStorage.setItem(key, JSON.stringify(draft)); return true; }
  catch { return false; }
}

export function consumePlanResearch(): PlanResearchDraft | undefined {
  try {
    const data = sessionStorage.getItem(key);
    if (!data) return undefined;
    sessionStorage.removeItem(key);
    return JSON.parse(data) as PlanResearchDraft;
  } catch { return undefined; }
}
