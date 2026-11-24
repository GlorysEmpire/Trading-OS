import { useId } from 'react';
import type { LayerTimeframe } from '../../decomposition';

const layers = [
  { title: 'Higher-timeframe context', read: 'Identify the latest external break, its dealing range, outstanding liquidity and unmitigated zones on Monthly and Weekly.', example: 'If the Weekly break is inconclusive, leave that timeframe neutral and carry the read on Daily.' },
  { title: 'Daily structure and range', read: 'Mark the last body close beyond a swing and the high and low of the leg that made it.', example: 'A wick through a swing with a close back inside is a sweep. If both structure and range are inconclusive, the existing gate stops the read.' },
  { title: 'Phase and leg quality', read: 'Distinguish expansion, retracement and range. Compare the swing with your Trading HQ criteria for leg quality.', example: 'Overlapping bodies can weaken an otherwise large-looking leg. A range calls for the Wyckoff or RDM read.' },
  { title: 'Candlestick evidence', read: 'Read the body, wicks and close location on the last completed candles, then check what liquidity they interacted with.', example: 'A long upper wick is useful context. Check whether it actually took a marked high and where the candle closed.' },
  { title: 'Liquidity and inducement', read: 'Separate internal levels from external targets, mark swept levels and identify the first obvious internal level in the retracement path.', example: 'Equal highs inside the range and the external swing high play different roles. Mark both independently.' },
  { title: 'Retracement depth', read: 'Combine leg intent with the location of unswept liquidity and the candidate zone.', example: 'A strong leg may support a shallow expectation. Revisit it when the relevant liquidity sits deeper in the range.' },
  { title: 'Points of interest', read: 'Compare primary and backup zones against location, mitigation, inducement and room to the draw.', example: 'A previously mitigated zone can remain on your chart as context. Record it accurately and let the existing checks assess it.' },
  { title: 'Target and invalidation', read: 'Record the external draw and the specific price or condition that invalidates the read.', example: 'Write the body-close condition at the structural level so it can be checked objectively at review.' },
] as const;

export function layerForStep(timeframe: LayerTimeframe, key: string) {
  if (timeframe === 'MONTHLY' || timeframe === 'WEEKLY') return 0;
  switch (key) {
    case 'phase': case 'leg': return 2;
    case 'candles': return 3;
    case 'liquidity': return 4;
    case 'depth': return 5;
    case 'pois': return 6;
    case 'targetInvalidation': return 7;
    default: return 1;
  }
}

export function LayerGuide({ active }: { active?: number }) {
  const heading = useId();
  const shown = typeof active === 'number' ? layers.slice(active, active + 1) : layers;
  return (
    <section className={active === undefined ? 'tos-card p-4 sm:p-5' : 'rounded-lg border border-line bg-raised px-3 py-2'} aria-labelledby={heading}>
      <h2 id={heading} className="tos-label mb-2">{active === undefined ? 'The eight layers of a market read' : 'Field guide'}</h2>
      <div className={active === undefined ? 'grid gap-x-5 sm:grid-cols-2' : ''}>
        {shown.map((layer) => (
          <details key={layer.title} className="border-t border-line py-2 text-sm">
            <summary className="cursor-pointer font-medium text-ink">{layer.title}</summary>
            <p className="mt-2 text-ink-2">{layer.read}</p>
            <p className="mt-1.5 text-ink-3">{layer.example}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
