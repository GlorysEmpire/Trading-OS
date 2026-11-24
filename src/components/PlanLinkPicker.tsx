import { useTrading } from '../context/TradingContext';
import { useDecompositionData } from '../context/DecompositionDataContext';
import { useDecompositionDefinitions } from '../context/DecompositionDefinitionsContext';
import { linkedPlanOptions } from '../decomposition/planLinks';
import type { AssetDeskData, PlanLink } from '../types';

export function PlanLinkPicker({ desk, at, value, change }: {
  desk?: AssetDeskData; at: string; value?: PlanLink; change: (value: PlanLink | undefined, narrative?: string) => void;
}) {
  const { plans, mapFor, profileFor } = useDecompositionData();
  const { current, definitionsFor } = useDecompositionDefinitions();
  const options = desk ? linkedPlanOptions({ plans, map: mapFor(desk.id), current, definitionsFor,
    deskId: desk.id, feed: profileFor(desk.id, desk.category).feed, at }) : [];
  const selected = options.find((item) => item.link.planId === value?.planId && item.link.poiId === value.poiId);
  return <div className="space-y-1">
    <label className="block text-sm text-ink-2">Daily plan and point of interest
      <select className="tos-input mt-1" value={selected?.poi.id ?? (value ? 'retained' : '')} onChange={(event) => {
        const option = options.find((item) => item.poi.id === event.target.value);
        change(option?.link, option?.plan.read.narrative?.value);
      }}>
        <option value="">Manual entry · no source plan</option>
        {value && !selected && <option value="retained">Existing link · {value.poiLabel}</option>}
        {options.map(({ poi, plan }) => <option key={poi.id} value={poi.id}>{plan.candle.symbol} · {poi.label} · {poi.low}–{poi.high}</option>)}
      </select>
    </label>
    {!options.length && !value && <p className="text-xs text-ink-3">No current daily plan with an eligible POI for this desk and time.</p>}
  </div>;
}

export function PlanLinkButton({ link }: { link: PlanLink }) {
  const { setActiveTab } = useTrading();
  const { requestPlanView } = useDecompositionData();
  return <button type="button" className="text-sm font-medium text-accent hover:underline" onClick={() => {
    requestPlanView(link.planId);
    setActiveTab('decomposition');
  }}>Source plan · {link.poiLabel}</button>;
}
