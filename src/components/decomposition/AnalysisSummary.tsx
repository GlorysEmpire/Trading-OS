import { ANALYSIS_LAYERS, type Analysis, type AnalysisTimeframe } from '../../decomposition/analysis';
import { formatNotebookText, notebookQuestions, NOTEBOOK_TIMEFRAME_LABELS } from '../../decomposition/notebookQuestions';
import { fmtPrice } from './ui';

export function AnalysisSummary({ analysis, timeframe }: { analysis: Analysis; timeframe?: AnalysisTimeframe }) {
  return <ul className="divide-y divide-line rounded-lg border border-line">
    {ANALYSIS_LAYERS.map(({ id, title }) => {
      const item = analysis[id];
      const prompts = timeframe ? notebookQuestions[id].prompts.filter((prompt) => item?.answers?.[prompt.id]?.trim()) : [];
      const details = id === 'S1' ? analysis.S1?.swings?.map((s) => `${s.kind.toLowerCase()} ${fmtPrice(s.price)}`).join(' · ')
        : id === 'S2' ? analysis.S2?.event
        : id === 'S3' && analysis.S3 ? `${fmtPrice(analysis.S3.low)} – ${fmtPrice(analysis.S3.high)}`
        : id === 'S5' ? analysis.S5?.levels?.length ? `${analysis.S5.levels.length} liquidity levels` : undefined
        : id === 'S6' ? [analysis.S6?.primary?.label, analysis.S6?.backup?.label].filter(Boolean).join(' · ')
        : id === 'S7' ? analysis.S7?.phase
        : id === 'S8' ? analysis.S8?.facts?.map((fact) => fact.source).filter(Boolean).join(' · ') : undefined;
      return <li key={id} className="grid gap-1 p-3 text-sm sm:grid-cols-[minmax(9rem,1fr)_2fr]">
        <div>
          <strong>{id} {title}</strong>
          {!prompts.length && <span className="block text-xs text-ink-3">{item?.assessment?.toLowerCase().replaceAll('_', ' ') ?? 'Unanswered'}</span>}
        </div>
        <div className="min-w-0 break-words text-ink-2">
          {timeframe && prompts.length > 0 && <dl className="mb-2 space-y-2">
            {prompts.map((prompt) => <div key={prompt.id}>
              <dt className="font-medium text-ink">{formatNotebookText(prompt.label, NOTEBOOK_TIMEFRAME_LABELS[timeframe])}</dt>
              <dd className="whitespace-pre-wrap">{item?.answers?.[prompt.id]}</dd>
            </div>)}
          </dl>}
          {details && <p>{details}</p>}
          {item?.observation && <p>Observation · {item.observation}</p>}
          {item?.interpretation && <p>Interpretation · {item.interpretation}</p>}
          {item?.hypothesis && <p>Hypothesis · {item.hypothesis}</p>}
        </div>
      </li>;
    })}
  </ul>;
}
