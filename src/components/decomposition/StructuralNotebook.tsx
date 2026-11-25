import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ArrowLeft, ArrowRight, Info, X } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useDecompositionData } from '../../context/DecompositionDataContext';
import { useDecompositionDefinitions } from '../../context/DecompositionDefinitionsContext';
import { ANALYSIS_LAYERS, ANALYSIS_TIMEFRAMES, hasManualAnswers, projectManualAnalysis, type Analysis, type AnalysisTimeframe } from '../../decomposition/analysis';
import { latestLayer } from '../../decomposition/logic';
import { formatNotebookText, questionsForNotebookLayer, NOTEBOOK_TIMEFRAME_LABELS } from '../../decomposition/notebookQuestions';
import { structureChanged } from '../../decomposition/structural';
import { useLocalDraft } from '../../utils/useLocalDraft';
import { Choice } from './ui';

type NotebookDraft = {
  reads: Partial<Record<AnalysisTimeframe, Analysis>>;
  timeframe: AnalysisTimeframe;
  layer: number;
};

export function StructuralNotebook({ deskId, symbol, bitcoin, initialTimeframe = 'WEEKLY', onClose }: {
  deskId: string;
  symbol: string;
  bitcoin: boolean;
  initialTimeframe?: AnalysisTimeframe;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const { mapFor, saveStructure, notice } = useDecompositionData();
  const { current: definitions } = useDecompositionDefinitions();
  const previous = mapFor(deskId);
  const draftKey = JSON.stringify(['tos-analysis-v1', user?.id, deskId, 'LIVE', undefined]);
  const { draft, update, clear, localError } = useLocalDraft<NotebookDraft>(draftKey, () => ({ reads: {}, timeframe: initialTimeframe, layer: 0 }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const focusHeading = useRef(false);
  const id = useId();

  const { timeframe, layer } = draft;
  const step = ANALYSIS_LAYERS[layer] ?? ANALYSIS_LAYERS[0];
  const next = ANALYSIS_LAYERS[layer + 1];
  const questions = questionsForNotebookLayer(step.id, bitcoin);
  const timeframeLabel = NOTEBOOK_TIMEFRAME_LABELS[timeframe];
  const prior = (tf: AnalysisTimeframe) => previous && latestLayer(previous, tf)?.data;
  const read = draft.reads[timeframe] ?? prior(timeframe)?.analysis ?? {};

  const pending = ANALYSIS_TIMEFRAMES.flatMap((tf) => {
    const analysis = draft.reads[tf];
    const saved = prior(tf);
    if (!analysis || (!hasManualAnswers(analysis) && !hasManualAnswers(saved?.analysis))) return [];
    const data = projectManualAnalysis(tf, analysis, definitions, saved);
    return previous && !structureChanged(previous, data) ? [] : [data];
  });

  useEffect(() => {
    if (!focusHeading.current) return;
    focusHeading.current = false;
    heading.current?.focus();
  }, [timeframe, layer]);

  const go = (tf: AnalysisTimeframe, index: number, focus = false) => {
    if (saving || (tf === timeframe && index === layer)) return;
    focusHeading.current = focus;
    setError('');
    update((current) => ({ ...current, timeframe: tf, layer: index }));
  };

  const edit = (prompt: string, value: string) => {
    update((current) => {
      const analysis = current.reads[timeframe] ?? prior(timeframe)?.analysis ?? {};
      const section = analysis[step.id];
      const answers = { ...section?.answers };
      if (value) answers[prompt] = value;
      else delete answers[prompt];
      return { ...current, reads: { ...current.reads, [timeframe]: { ...analysis, [step.id]: { ...section, answers } } } };
    });
  };

  const save = async () => {
    if (saving || notice || !pending.length) return;
    setSaving(true);
    setError('');
    try {
      const asOf = new Date().toISOString();
      await saveStructure({ deskId, symbol, definitionsVersion: definitions.version, layers: pending.map((data) => ({ asOf, data })) });
      const remaining = Object.fromEntries(Object.entries(draft.reads).filter(([tf]) => !pending.some(({ timeframe: saved }) => saved === tf)));
      if (Object.keys(remaining).length) update((current) => ({ ...current, reads: remaining, layer: 0 }));
      else clear();
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the analysis.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-2xl p-4 sm:p-6">
      <div className="tos-card">
        <header className="flex items-start justify-between gap-3 px-4 pt-5 sm:px-6">
          <div>
            <h1 className="text-xl font-semibold text-ink sm:text-2xl">{symbol}</h1>
            <p className="text-sm text-ink-2">Market Decomposition</p>
          </div>
          <button type="button" aria-label="Close" disabled={saving} onClick={onClose} className="grid h-9 w-9 place-items-center rounded-lg text-ink-2 hover:bg-raised hover:text-ink disabled:opacity-40">
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>
        <fieldset disabled={saving} className="min-w-0 space-y-3 px-4 py-4 sm:px-6">
          <legend className="sr-only">Timeframe and layer</legend>
          <Choice value={timeframe} onChange={(tf) => go(tf, 0)} options={ANALYSIS_TIMEFRAMES.map((tf) => [tf, NOTEBOOK_TIMEFRAME_LABELS[tf]])} size="sm" />
          <nav aria-label="Analytical layers" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {ANALYSIS_LAYERS.map((item, index) => (
              <button key={item.id} type="button" className="tos-step" aria-current={step.id === item.id ? 'step' : undefined} onClick={() => go(timeframe, index, true)}>
                <span className="font-mono">{item.id}</span> {item.title}
              </button>
            ))}
          </nav>
        </fieldset>
        <section aria-labelledby={`${id}-layer`} className="space-y-4 border-t border-line px-4 py-5 sm:px-6" key={`${timeframe}:${step.id}`}>
          <InfoLine label={`${step.id}: ${step.title}`} purpose={questions.purpose}>
            <h2 id={`${id}-layer`} ref={heading} tabIndex={-1} className="scroll-mt-24 text-lg font-semibold text-ink">{step.id}: {step.title}</h2>
          </InfoLine>
          {questions.question && (
            <InfoLine label={formatNotebookText(questions.question.label, timeframeLabel)} purpose={questions.question.purpose}>
              <p className="text-sm font-semibold text-ink">{formatNotebookText(questions.question.label, timeframeLabel)}</p>
            </InfoLine>
          )}
          {questions.prompts.map((prompt) => {
            const label = formatNotebookText(prompt.label, timeframeLabel);
            const inputId = `${id}-${prompt.id}`;
            return (
              <div key={prompt.id} className="space-y-1">
                <InfoLine label={label} purpose={formatNotebookText(prompt.purpose, timeframeLabel)}>
                  <label htmlFor={inputId} className="text-sm font-semibold text-ink">{label}</label>
                </InfoLine>
                <textarea id={inputId} className="tos-input min-h-20 resize-y" rows={3} placeholder="Enter your observation…"
                  disabled={saving} value={read[step.id]?.answers?.[prompt.id] ?? ''} onChange={(event) => edit(prompt.id, event.target.value)} />
              </div>
            );
          })}
          {(error || notice || localError) && <p role="alert" className="text-sm text-rose-300">{error || notice || 'This browser could not autosave the draft.'}</p>}
        </section>
        <footer className="flex flex-wrap items-center gap-2 border-t border-line px-4 py-3 sm:px-6">
          {layer > 0 && (
            <button type="button" className="tos-secondary inline-flex items-center gap-1" disabled={saving} onClick={() => go(timeframe, layer - 1, true)}>
              <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back
            </button>
          )}
          <span className="text-xs text-ink-2">Step {layer + 1} of {ANALYSIS_LAYERS.length}</span>
          {next ? (
            <button type="button" className="tos-cta ml-auto inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold" onClick={() => go(timeframe, layer + 1, true)}>
              Next: {next.title} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          ) : (
            <button type="button" className="tos-cta ml-auto rounded-lg px-3 py-2 text-sm font-semibold disabled:opacity-40" disabled={saving || !!notice || !pending.length} onClick={save}>
              {saving ? 'Saving…' : 'Save analysis'}
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}

function InfoLine({ label, purpose, children }: { label: string; purpose: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const infoId = useId();
  return (
    <div>
      <div className="flex items-center gap-1">
        {children}
        <button type="button" aria-label={`Information about ${label}`} aria-controls={infoId} aria-expanded={open}
          className="grid size-8 shrink-0 place-items-center rounded-lg text-ink-2 hover:bg-raised hover:text-ink"
          onClick={() => setOpen(!open)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false); }}>
          <Info className="size-4" aria-hidden="true" />
        </button>
      </div>
      <p id={infoId} hidden={!open} className="mt-1 rounded-lg border border-line bg-raised px-3 py-2 text-sm text-ink-2">{purpose}</p>
    </div>
  );
}
