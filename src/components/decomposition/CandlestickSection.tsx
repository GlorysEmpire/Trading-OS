import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useDecompositionData } from '../../context/DecompositionDataContext';
import {
  candleAnatomy, candleDraftKey, candleObservation, candleStages, composeCandleNarrative, priorCandles, sameCandle, savedCandleInput,
  type CandleAnswers, type CandleDraft, type CandleInput, type CandleObservation, type CandlestickRead,
} from '../../decomposition/candlestick';
import { candleLabel, currentOrUpcomingCandle, type FeedProfile } from '../../decomposition/feeds';
import { isIdentified, latestLayer } from '../../decomposition/logic';
import { answeredNotebookPrompts, formatNotebookText, NOTEBOOK_TIMEFRAME_LABELS } from '../../decomposition/notebookQuestions';
import { CADENCE_TIMEFRAME } from '../../decomposition/plans';
import type { Cadence, LayerData, LayerVersion, PeriodCandle, PeriodPlan } from '../../decomposition/types';
import type { AssetDeskData } from '../../types';
import { useLocalDraft } from '../../utils/useLocalDraft';
import { AnalysisText } from './AnalysisInputs';
import { CandleEvidence } from './CandleEvidence';
import { fmtPrice, levelKindLabel, PriceField } from './ui';

const OPTIONS: Partial<Record<keyof CandleAnswers, string[]>> = {
  classification: ['Expansion', 'Retracement', 'Rejection', 'Indecision'],
  expectedDelivery: ['Expansion', 'Retracement'],
  direction: ['Bullish', 'Bearish'],
  sequence: ['High first', 'Low first'],
};

export function CandlestickSection({ desk, cadence, now }: { desk: AssetDeskData; cadence: Cadence; now: string }) {
  const { user } = useAuth();
  const { plans, mapFor, profileFor, loading } = useDecompositionData();
  if (loading) return null;
  const profile = profileFor(desk.id, desk.category);
  const target = currentOrUpcomingCandle(cadence, now, profile, desk.symbol);
  const key = candleDraftKey(user?.id, desk.id, cadence, target, profile);
  const deskPlans = plans.filter((plan) => plan.deskId === desk.id && plan.cadence === cadence && plan.mode === 'LIVE');
  const plan = deskPlans.find((entry) => sameCandle(entry.candle, target));
  const map = mapFor(desk.id);
  const timeframe = CADENCE_TIMEFRAME[cadence];
  const parentLayerId = plan?.structuralVersionRef.layerIds[timeframe];
  const layer = map && (map.layers.find((entry) => entry.id === parentLayerId) ?? latestLayer(map, timeframe));
  return <CandleEditor key={key} storageKey={key} cadence={cadence} profile={profile} target={target} plan={plan} deskPlans={deskPlans} layer={layer} />;
}

function CandleEditor({ storageKey, cadence, profile, target, plan, deskPlans, layer }: {
  storageKey: string; cadence: Cadence; profile: FeedProfile; target: PeriodCandle; plan?: PeriodPlan; deskPlans: PeriodPlan[]; layer?: LayerVersion;
}) {
  const { saveCandlestick, notice } = useDecompositionData();
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const heading = useRef<HTMLHeadingElement>(null);
  const focusOnStep = useRef(false);
  const sectionId = useId();
  const previous = useMemo(() => priorCandles(cadence, target, profile), [cadence, target, profile]);
  const published = plan?.read.candlestickDecomposition;
  const { draft, update, clear, localError } = useLocalDraft<CandleDraft>(storageKey, () => {
    const inputPlans = plan ? [plan, ...deskPlans.filter(({ id }) => id !== plan.id)] : deskPlans;
    return { stage: 0, inputs: previous.map((candle) => savedCandleInput(candle, inputPlans)), answers: published?.answers ?? {}, narrative: published?.narrative };
  });
  const { stage, inputs, answers } = draft;
  const step = candleStages[stage];
  const cutoff = new Date(Math.min(Date.now(), Date.parse(target.openTime))).toISOString();
  const observations = previous.map((candle, index) => candleObservation(candle, inputs[index], cutoff));
  const earlier = observations[0].evidence;
  const invalid = observations.some(({ evidence, volume }, index) =>
    (!evidence && Object.values(inputs[index].prices).some((price) => price !== undefined))
    || (volume !== undefined && (!Number.isFinite(volume) || volume < 0)));
  const narrative = draft.narrative ?? composeCandleNarrative(answers);
  const finished = draft.finished ?? published;
  const locked = !!plan?.review || Date.now() >= Date.parse(target.closeTime ?? '');

  useEffect(() => {
    if (!focusOnStep.current || !editing) return;
    focusOnStep.current = false;
    heading.current?.focus();
  }, [stage, editing]);

  const edit = (field: keyof CandleAnswers, value: string) => update((current) => ({ ...current, answers: { ...current.answers, [field]: value } }));
  const changeInput = (index: number, patch: Partial<CandleInput>) => update((current) => ({
    ...current, inputs: current.inputs.map((input, position) => position === index ? { ...input, ...patch } : input),
  }));
  const go = (next: number) => {
    setMessage('');
    focusOnStep.current = true;
    update((current) => ({ ...current, stage: next }));
  };
  const save = async () => {
    const asOf = new Date().toISOString();
    if (saving || locked || !(Date.parse(asOf) < Date.parse(target.closeTime ?? '')) || !earlier || invalid || !narrative.trim() || !answers.invalidation?.trim()) return;
    const read = { asOf, observations, answers, narrative: narrative.trim(), structureLayerId: layer?.id };
    update((current) => ({ ...current, finished: read }));
    setMessage('');
    if (plan) {
      setSaving(true);
      try {
        await saveCandlestick(plan, read);
        clear();
        setEditing(false);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'The narrative could not be attached to the plan.');
      } finally {
        setSaving(false);
      }
    } else {
      setEditing(false);
    }
  };

  return <section className="mx-4 mb-3 rounded-lg border border-line bg-raised px-3 py-2" aria-label={`${NOTEBOOK_TIMEFRAME_LABELS[CADENCE_TIMEFRAME[cadence]]} Candlestick Decomposition`}>
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div>
        <h4 className="text-sm font-semibold text-ink">Candlestick Decomposition</h4>
        <p className="text-xs text-ink-3">{candleLabel(cadence, target, profile)} · {target.feed}</p>
      </div>
      {!locked && <button type="button" aria-expanded={editing} aria-controls={sectionId} disabled={saving} className="tos-secondary text-xs"
        onClick={() => { focusOnStep.current = !editing; setEditing(!editing); }}>
        {editing ? 'Close candle analysis' : `${finished ? 'Edit' : 'Open'} candle analysis`}
      </button>}
    </div>
    {!editing && finished && <>
      <CandlestickNarrative read={finished} />
      {draft.finished && draft.finished.asOf !== published?.asOf && <p className="mt-2 text-xs text-ink-3">Saved in this browser. {plan ? 'Reopen to attach it to the plan.' : 'It will be included when you save the matching period plan.'}</p>}
    </>}
    <div id={sectionId} hidden={!editing}>
      {editing && <fieldset disabled={saving} className="mt-3 min-w-0 space-y-4 border-t border-line pt-4">
        <legend className="sr-only">Candle decomposition</legend>
        <header className="space-y-1">
          <p className="tos-label">Step {stage + 1} of {candleStages.length}</p>
          <h5 ref={heading} tabIndex={-1} className="scroll-mt-24 text-base font-semibold text-ink">C{stage + 1} · {step.title}</h5>
          <p className="text-xs text-ink-2">Previous completed candle · {candleLabel(cadence, previous[0], profile)}</p>
        </header>
        {stage === 0 && <>
          <CandleEvidence label="Previous candle OHLC" prices={inputs[0].prices} change={(prices) => changeInput(0, { prices })} showMetrics={false} />
          {earlier && <AnatomyEvidence candle={earlier.prices} />}
        </>}
        {stage === 1 && <EvidenceValues items={[[ 'Candle direction', directionLabel(earlier?.metrics.direction) ]]} />}
        {stage === 2 && <StructuralReference layer={layer?.data} section="S5" />}
        {stage === 3 && <StructuralReference layer={layer?.data} section="S6" />}
        {stage === 4 && <>
          <MomentumEvidence cadence={cadence} profile={profile} inputs={inputs} observations={observations} change={changeInput} />
          <StructuralReference layer={layer?.data} section="S8" />
          <StructuralReference layer={layer?.data} section="S2" />
        </>}
        {stage === 5 && <>
          <StructuralReference layer={layer?.data} section="S5" />
          <StructuralReference layer={layer?.data} section="S6" />
        </>}
        {step.questions.map(([field, question, label]) => (
          <CandleQuestion key={field} field={field} label={label} question={question} value={answers[field]} onChange={(value) => edit(field, value)} />
        ))}
        {step.outputs.map(([field, label]) => (
          <AnalysisText key={field} area label={label} value={answers[field]} change={(value) => edit(field, value)} />
        ))}
        {stage === 6 && <>
          <label className="block text-sm text-ink">
            Candle narrative
            <textarea className="tos-input mt-1" rows={7} value={narrative} onChange={(event) => {
              const value = event.target.value;
              update((current) => ({ ...current, narrative: value }));
            }} />
          </label>
          {draft.narrative !== undefined && <button type="button" onClick={() => update((current) => ({ ...current, narrative: undefined }))} className="tos-secondary">Use stage conclusions</button>}
          {(!earlier || invalid) && <p className="text-sm text-ink-2">{!earlier ? 'Record the previous completed candle OHLC in C1.' : 'Complete or clear the comparison OHLC and use nonnegative volume in C5.'}</p>}
        </>}
        {(message || localError || (plan && notice)) && <p role="alert" className="text-sm text-rose-300">{message || (plan && notice) || 'This browser could not autosave your draft.'}</p>}
        <div className="flex items-center justify-between gap-2 border-t border-line pt-3">
          {stage > 0 ? <button type="button" className="tos-secondary" onClick={() => go(stage - 1)}>Back</button> : <span />}
          {stage < candleStages.length - 1
            ? <button type="button" className="tos-primary" onClick={() => go(stage + 1)}>Next: {candleStages[stage + 1].title}</button>
            : <button type="button" onClick={save} disabled={locked || !earlier || invalid || !narrative.trim() || !answers.invalidation?.trim() || !!(plan && notice)}
              className="tos-primary disabled:opacity-40">{saving ? 'Saving…' : 'Save candle narrative'}</button>}
        </div>
      </fieldset>}
    </div>
  </section>;
}

export function CandlestickNarrative({ read }: { read: CandlestickRead }) {
  const invalidation = read.answers.invalidation?.trim();
  return <div className="mt-2 rounded-lg border border-line bg-panel p-3">
    <h5 className="text-sm font-semibold text-ink">Candle narrative</h5>
    <p className="mt-1 whitespace-pre-wrap break-words text-sm text-ink-2">{read.narrative}</p>
    {invalidation && !read.narrative.includes(invalidation) && <p className="mt-2 text-sm text-ink-2"><strong>Invalidation</strong> {invalidation}</p>}
  </div>;
}

function CandleQuestion({ field, question, label, value, onChange }: {
  field: keyof CandleAnswers; question: string; label?: string; value?: string; onChange: (value: string) => void;
}) {
  const options = OPTIONS[field];
  return <label className="block space-y-1 text-sm text-ink">
    {label && <span className="block font-semibold">{label}</span>}
    <span className="block">{question}</span>
    {options
      ? <select className="tos-input" value={value ?? ''} onChange={(event) => onChange(event.target.value)}>
        <option value="">Select</option>
        {options.map((option) => <option key={option}>{option}</option>)}
      </select>
      : <textarea className="tos-input" rows={2} placeholder="Enter your observation…" value={value ?? ''} onChange={(event) => onChange(event.target.value)} />}
  </label>;
}

function EvidenceValues({ items }: { items: Array<[string, string]> }) {
  return <dl className="grid grid-cols-2 gap-2 rounded-lg border border-line bg-panel p-3 text-sm sm:grid-cols-3">
    {items.map(([label, value]) => <div key={label}><dt className="text-ink-3">{label}</dt><dd className="font-mono text-ink">{value}</dd></div>)}
  </dl>;
}

const percent = (value?: number) => value === undefined ? '—' : `${value.toFixed(1)}%`;
const directionLabel = (direction?: string) => direction === 'Up' ? 'Bullish' : direction === 'Down' ? 'Bearish' : direction ?? '—';

function AnatomyEvidence({ candle }: { candle: NonNullable<CandleObservation['evidence']>['prices'] }) {
  const anatomy = candleAnatomy(candle);
  if (!anatomy) return null;
  const eq = candle.close > anatomy.equilibrium ? 'above EQ' : candle.close < anatomy.equilibrium ? 'below EQ' : 'at EQ';
  return <EvidenceValues items={[
    ['Relative body', percent(anatomy.bodyPercent)], ['Upper wick', fmtPrice(anatomy.upperWick)], ['Lower wick', fmtPrice(anatomy.lowerWick)],
    ['Lower quartile', fmtPrice(anatomy.lowerQuartile)], ['Candle EQ', fmtPrice(anatomy.equilibrium)], ['Upper quartile', fmtPrice(anatomy.upperQuartile)],
    ['Close in range', `${percent(anatomy.closePercent)} · ${eq}`], ['Directional progress retained', percent(anatomy.retainedPercent)],
  ]} />;
}

function MomentumEvidence({ cadence, profile, inputs, observations, change }: {
  cadence: Cadence; profile: FeedProfile; inputs: CandleInput[]; observations: CandleObservation[]; change: (index: number, patch: Partial<CandleInput>) => void;
}) {
  // Keep partial prices visible while the user is entering the comparison OHLC.
  return <div className="space-y-3">
    <h6 className="text-sm font-semibold text-ink">Last three completed candles</h6>
    {observations.map((observation, index) => {
      const metrics = observation.evidence?.metrics;
      const baseline = observations[index + 1]?.volume;
      const ratio = observation.volume !== undefined && observation.volume >= 0 && baseline !== undefined && baseline > 0 ? observation.volume / baseline : undefined;
      return <div key={observation.candle.openTime} className="space-y-2 rounded-lg border border-line bg-panel p-3">
        <p className="text-sm font-semibold text-ink">{candleLabel(cadence, observation.candle, profile)}</p>
        <EvidenceValues items={[
          ['Relative body', percent(metrics?.bodyPercent)], ['Directional delivery', directionLabel(metrics?.direction)],
          ['Relative volume', ratio === undefined ? '—' : `${ratio.toFixed(2)}× prior candle`],
        ]} />
        <PriceField label="Volume" value={observation.volume} onChange={(volume) => change(index, { volume })} />
        {index > 0 && <CandleEvidence label="OHLC" prices={inputs[index].prices} change={(prices) => change(index, { prices })} showMetrics={false} />}
      </div>;
    })}
  </div>;
}

function StructuralReference({ layer, section }: { layer?: LayerData; section: 'S2' | 'S5' | 'S6' | 'S8' }) {
  const empty = section === 'S8' ? <p className="text-sm text-ink-2">No saved S8 observations for this timeframe.</p> : null;
  if (!layer || layer.timeframe === 'H4') return empty;
  const source = layer.analysis?.[section];
  const prompts = answeredNotebookPrompts(section, source?.answers);
  const items = prompts.map(({ id, label }) => [formatNotebookText(label, NOTEBOOK_TIMEFRAME_LABELS[layer.timeframe]), source?.answers?.[id] ?? '']);
  if (source?.observation) items.push(['Observation', source.observation]);
  if (source?.interpretation) items.push(['Interpretation', source.interpretation]);
  if (section === 'S8') {
    for (const fact of layer.analysis?.S8?.facts ?? []) if (fact.fact) items.push([fact.source || 'External data', fact.fact]);
  }
  if (section === 'S5') {
    if (layer.timeframe === 'DAILY' && isIdentified(layer.liquidity)) {
      for (const level of layer.liquidity.value.levels) items.push([level.label || levelKindLabel(level.kind), `${fmtPrice(level.price)} · ${level.swept ? 'swept' : 'outstanding'}`]);
    }
    if (layer.timeframe !== 'DAILY' && isIdentified(layer.draw)) {
      const { above, below } = layer.draw.value;
      if (above !== undefined) items.push(['Draw above', fmtPrice(above)]);
      if (below !== undefined) items.push(['Draw below', fmtPrice(below)]);
    }
  }
  if (section === 'S6') {
    const zones = layer.timeframe === 'DAILY'
      ? isIdentified(layer.pois) ? [layer.pois.value.primary, layer.pois.value.backup] : []
      : isIdentified(layer.pois) ? layer.pois.value : [];
    for (const zone of zones) if (zone) items.push([zone.label, `${fmtPrice(zone.low)}–${fmtPrice(zone.high)} · ${zone.mitigated ? 'mitigated' : 'unmitigated'}`]);
  }
  if (section === 'S2') {
    const structure = layer.timeframe === 'DAILY' ? layer.structure : layer.trend;
    if (isIdentified<{ trend: string }>(structure)) items.push(['Structural trend', structure.value.trend.toLowerCase()]);
  }
  if (!items.length) return empty;
  return <details className="rounded-lg border border-line bg-panel p-3">
    <summary className="cursor-pointer text-sm font-medium text-ink">{section} · {{ S2: 'Structure', S5: 'Liquidity', S6: 'POIs', S8: 'External Data' }[section]}</summary>
    <dl className="mt-2 space-y-2 text-sm">
      {items.map(([label, value], index) => <div key={`${label}-${index}`}>
        <dt className="font-medium text-ink">{label}</dt>
        <dd className="whitespace-pre-wrap break-words text-ink-2">{value}</dd>
      </div>)}
    </dl>
  </details>;
}
