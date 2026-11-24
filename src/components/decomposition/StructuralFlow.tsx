import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDecompositionData } from '../../context/DecompositionDataContext';
import { useDecompositionDefinitions } from '../../context/DecompositionDefinitionsContext';
import { latestLayer, structureChanged, type StructuralRecord } from '../../decomposition';
import { ANALYSIS_LAYERS, ANALYSIS_TIMEFRAMES, analysisDatesValid, analysisGate, projectAnalysis, type Analysis, type AnalysisLayerId, type AnalysisTimeframe, type Assessment } from '../../decomposition/analysis';
import { useLocalDraft } from '../../utils/useLocalDraft';
import { AnalysisInputs, AnalysisText } from './AnalysisInputs';
import { Choice, GateNote, StepFrame } from './ui';
import { AnalysisSummary } from './AnalysisSummary';
import { VerdictPill } from './SummaryCard';

const LABEL: Record<AnalysisTimeframe, string> = { MONTHLY: 'Monthly', WEEKLY: 'Weekly', DAILY: 'Daily' };
const assessments: Array<[Assessment, string]> = [['OBSERVED', 'Record observation'], ['UNCERTAIN', 'Mark uncertain'], ['NOT_APPLICABLE', 'Not applicable']];
type Draft = {
  reads: Partial<Record<AnalysisTimeframe, Analysis>>;
  timeframe: AnalysisTimeframe;
  layer: number;
  expert: boolean;
};

export interface BacktestSetup { asOf: string; researchQuestionId?: string; onSaved: (rec: StructuralRecord) => void }

export function StructuralFlow({ deskId, symbol, onClose, backtest }: { deskId: string; symbol: string; onClose: () => void; backtest?: BacktestSetup }) {
  const { user } = useAuth();
  const { mapFor, saveStructure, saveBacktest, notice } = useDecompositionData();
  const { current: definitions } = useDecompositionDefinitions();
  const previous = backtest ? undefined : mapFor(deskId);
  const draftKey = JSON.stringify(['tos-analysis-v1', user?.id, deskId, backtest?.asOf ?? 'LIVE', backtest?.researchQuestionId]);
  const { draft, update, clear, localError } = useLocalDraft<Draft>(draftKey, () => ({ reads: {}, timeframe: 'MONTHLY', layer: 0, expert: false }));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [summary, setSummary] = useState(false);
  const { timeframe, layer, expert } = draft;
  const prior = (tf: AnalysisTimeframe) => latestSaved(previous, tf)?.data;
  const analysisFor = (tf: AnalysisTimeframe) => draft.reads[tf] ?? prior(tf)?.analysis ?? {};
  const analysis = analysisFor(timeframe);
  const step = ANALYSIS_LAYERS[layer] ?? ANALYSIS_LAYERS[0];
  const fields = analysis[step.id];
  const cutoff = backtest?.asOf ?? new Date().toISOString();
  const gate = timeframe === 'DAILY' ? analysisGate(analysis, definitions) : undefined;
  const ready = ANALYSIS_TIMEFRAMES.flatMap((tf) => {
    const read = draft.reads[tf];
    if (!read || !analysisDatesValid(read, cutoff)) return [];
    const finished = ANALYSIS_LAYERS.every(({ id }) => read[id]?.assessment);
    const stopped = tf === 'DAILY' && analysisGate(read, definitions)?.verdict === 'LEAVE_CHART';
    if (!finished && !stopped) return [];
    const data = projectAnalysis(tf, read, definitions, prior(tf));
    return previous && !structureChanged(previous, data) ? [] : [{ asOf: cutoff, data }];
  });
  const backtestReady = !backtest || ready.some(({ data }) => data.timeframe === 'DAILY');

  const edit = <K extends AnalysisLayerId>(id: K, patch: Partial<NonNullable<Analysis[K]>>) => {
    const read = { ...analysis, [id]: { ...analysis[id], ...patch } };
    update((current) => ({ ...current, reads: { ...current.reads, [timeframe]: read } }));
  };
  const go = (tf: AnalysisTimeframe, index: number) => {
    setSummary(false);
    update((current) => ({ ...current, timeframe: tf, layer: index }));
  };
  const next = () => {
    if (!fields?.assessment) return;
    if (layer === ANALYSIS_LAYERS.length - 1 || (gate?.verdict === 'LEAVE_CHART' && layer === 2)) setSummary(true);
    else go(timeframe, layer + 1);
  };
  const save = async () => {
    if (saving || !ready.length || !backtestReady || notice) return;
    setSaving(true);
    setMessage('');
    try {
      const input = { deskId, symbol, definitionsVersion: definitions.version, layers: ready };
      if (backtest) {
        const saved = await saveBacktest({ ...input, researchQuestionId: backtest.researchQuestionId });
        clear();
        backtest.onSaved(saved);
      } else {
        await saveStructure(input);
        const pending = Object.fromEntries(Object.entries(draft.reads).filter(([tf]) => !ready.some(({ data }) => data.timeframe === tf)));
        if (Object.keys(pending).length) update((current) => ({ ...current, reads: pending }));
        else clear();
        onClose();
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'The analysis could not be saved.');
    } finally { setSaving(false); }
  };
  const invalidDates = (step.id === 'S1' || step.id === 'S8') && !analysisDatesValid(analysis, cutoff);
  const title = backtest ? `${symbol} · Replay ${backtest.asOf.slice(0, 10)}` : `${symbol} · Structural analysis`;
  const choose = <div className="space-y-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
      <Choice value={timeframe} onChange={(tf) => go(tf, 0)} options={ANALYSIS_TIMEFRAMES.map((tf) => [tf, LABEL[tf]])} />
      <button className="tos-secondary" aria-pressed={expert} onClick={() => update((current) => ({ ...current, expert: !current.expert }))}>Expert mode</button>
    </div>
    <nav aria-label="Analytical layers" className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
      {ANALYSIS_LAYERS.map((item, index) => <button type="button" key={item.id} className="tos-step" onClick={() => go(timeframe, index)}
        aria-current={!summary && step.id === item.id ? 'step' : undefined}>
        <span className="font-mono">{item.id}</span> {item.title}{analysis[item.id]?.assessment && <span className="sr-only"> answered</span>}
      </button>)}
    </nav>
    <p className="text-xs text-ink-3" role="status">{localError ? 'Local autosave is unavailable.' : 'Draft saved in this browser as you edit.'}</p>
  </div>;

  if (summary) return <StepFrame title={title} stepLabel="Structural summary" progress={1} question={`What does the ${LABEL[timeframe].toLowerCase()} evidence support?`}
    why="Review the observations and the decisions they support before publishing a new version." onClose={onClose}
    onBack={() => setSummary(false)} onNext={save} nextLabel={saving ? 'Saving…' : backtest ? 'Lock prediction' : 'Save structural analysis'}
    nextDisabled={!ready.length || !backtestReady || saving || !!notice}>
    {choose}
    {gate && <div className="space-y-1"><VerdictPill verdict={gate.verdict} /><p className="text-sm text-ink-2">{gate.reason}</p></div>}
    <AnalysisSummary analysis={analysis} />
    <p className="text-sm text-ink-2">{ready.length ? `Ready to publish: ${ready.map(({ data }) => LABEL[data.timeframe as AnalysisTimeframe]).join(', ')}.` : 'Record or mark each layer before publishing an updated timeframe.'}</p>
    {!backtestReady && <p className="text-sm text-ink-2">A replay needs a Daily read before it can be locked.</p>}
    {(notice || message) && <p role="alert" className="text-sm text-rose-300">{message || notice}</p>}
  </StepFrame>;

  return <StepFrame title={title} stepLabel={`${LABEL[timeframe]} · ${step.id} ${step.title}`} progress={(layer + 1) / ANALYSIS_LAYERS.length} question={step.question}
    why={step.purpose} onClose={onClose} onBack={layer ? () => go(timeframe, layer - 1) : undefined}
    onNext={next} nextLabel={layer === 7 || (layer === 2 && gate?.verdict === 'LEAVE_CHART') ? 'Review analysis' : 'Next layer'}
    nextDisabled={!fields?.assessment || !!invalidDates}>
    {choose}
    {!expert && <GateNote title="What to look for">{step.guide}</GateNote>}
    {!prior(timeframe)?.analysis && prior(timeframe) && <p className="text-sm text-ink-2">The previous version uses the legacy framework. Its record remains in history while you build this read.</p>}
    <AnalysisText label="Chart or source observation" value={fields?.observation} change={(observation) => edit(step.id, { observation })} area />
    <AnalysisInputs key={`${timeframe}:${step.id}`} id={step.id} value={analysis} edit={edit} cutoff={cutoff} />
    <div className="grid gap-3 sm:grid-cols-2">
      <AnalysisText label="Interpretation" value={fields?.interpretation} change={(interpretation) => edit(step.id, { interpretation })} area />
      <AnalysisText label="Hypothesis to test" value={fields?.hypothesis} change={(hypothesis) => edit(step.id, { hypothesis })} area />
    </div>
    {invalidDates && <p role="alert" className="text-sm text-rose-300">Complete dated source details and use only evidence available by the read time.</p>}
    <Choice value={fields?.assessment} onChange={(assessment) => edit(step.id, { assessment })} options={assessments} />
    {layer === 2 && gate?.verdict === 'LEAVE_CHART' && <GateNote title="Pause the Daily read">{gate.reason} You can save the observation and return when the structure is clearer.</GateNote>}
    <button type="button" className="tos-secondary" onClick={() => setSummary(true)}>View structural summary</button>
  </StepFrame>;
}

function latestSaved(record: StructuralRecord | undefined, timeframe: AnalysisTimeframe) {
  return record && latestLayer(record, timeframe);
}
