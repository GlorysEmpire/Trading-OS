import { ANALYSIS_LAYERS } from '../../decomposition/analysis';

export function LayerGuide() {
  return <details className="tos-card px-4 py-3 sm:p-5">
    <summary className="cursor-pointer font-semibold text-ink">Methodology · the eight structural layers</summary>
    <dl className="mt-3 grid gap-3 sm:grid-cols-2">
      {ANALYSIS_LAYERS.map((layer) => <div key={layer.id}>
        <dt className="text-sm font-semibold">{layer.id} {layer.title}</dt>
        <dd className="mt-1 text-sm text-ink-2">{layer.purpose}</dd>
      </div>)}
    </dl>
  </details>;
}
