import React, { useMemo, useState } from 'react';
import {
  backtestState, dailyPoiChecks, latestLayer, sampleFromBacktest, summarize,
  type BacktestOutcome, type DailyLayer, type Depth, type StructuralRecord,
} from '../../decomposition';
import { useDecompositionData } from '../../context/DecompositionDataContext';
import { useDecompositionDefinitions } from '../../context/DecompositionDefinitionsContext';
import { useTrading } from '../../context/TradingContext';
import { Choice, GateNote, PickList, StepFrame } from './ui';
import { SummaryCard } from './SummaryCard';
import { StructuralFlow } from './StructuralFlow';

/**
 * Backtest link (M5): pick the research question and the replay date, read
 * the chart blind (Weekly → Daily), lock the predictions, then record what
 * price did. The outcome becomes a research sample linked to the record.
 */
export const BacktestFlow: React.FC<{ deskId: string; symbol: string; onClose: () => void; onSaved: (rec: StructuralRecord) => void }> = ({ deskId, symbol, onClose, onSaved }) => {
  const { researchQuestions } = useTrading();
  const open = researchQuestions.filter((q) => q.status !== 'LOCKED_RULE');
  const [rqId, setRqId] = useState<string | undefined>(open.length === 1 ? open[0].id : undefined);
  const [date, setDate] = useState('');
  const [started, setStarted] = useState(false);
  const today = new Date().toISOString().slice(0, 10);
  const asOf = date ? new Date(`${date}T12:00:00Z`).toISOString() : '';

  if (started && asOf) return <StructuralFlow deskId={deskId} symbol={symbol} onClose={onClose} backtest={{ asOf, researchQuestionId: rqId, onSaved }} />;

  return (
    <StepFrame title={`${symbol} · Backtest`} stepLabel="Set up the replay" progress={0.02}
      question="Which question, and which day are you replaying?"
      why="Read the chart only up to that day. Predictions lock when you save, before you step the replay forward."
      onClose={onClose} onNext={() => setStarted(true)} nextLabel="Start the read" nextDisabled={!date || date > today}>
      <div className="space-y-1.5">
        <div className="text-sm font-semibold text-ink">Research question</div>
        <PickList items={open} selectedId={rqId} onPick={(q) => setRqId(q.id === rqId ? undefined : q.id)} empty="No open research questions. The sample is still saved, unlinked."
          render={(q) => <span><b className="text-ink">{q.code}</b> · {q.title} <span className="text-ink-3">({q.sampleCount}/{q.targetSamples})</span></span>} />
      </div>
      <label className="block space-y-1.5">
        <span className="text-sm font-semibold text-ink">Replay date</span>
        <input type="date" value={date} max={today} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl bg-raised px-3 py-2.5 text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-accent/60" />
        <span className="block text-xs text-ink-3">The last daily candle you can see on the replay.</span>
      </label>
    </StepFrame>
  );
};

/** Record what price did after the locked read; creates the research sample. */
export const OutcomeFlow: React.FC<{ record: StructuralRecord; onClose: () => void }> = ({ record, onClose }) => {
  const { closeBacktestRecord, notice } = useDecompositionData();
  const { current: defs, definitionsFor } = useDecompositionDefinitions();
  const { addBacktestSample, backtestSamples, researchQuestions } = useTrading();
  const [result, setResult] = useState<BacktestOutcome['result']>();
  const [poi, setPoi] = useState<string>();
  const [depth, setDepth] = useState<Depth>();
  const [candles, setCandles] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();

  const daily = latestLayer(record, 'DAILY');
  const layerDefs = (daily && definitionsFor(daily.definitionsVersion)) || defs;
  const summary = useMemo(() => summarize(record, definitionsFor, defs), [record, definitionsFor, defs]);
  const checks = daily ? dailyPoiChecks(daily.data as DailyLayer, layerDefs) : [];
  const state = backtestState(record);
  const linked = backtestSamples.some((s) => s.decompositionRecordId === record.id);
  const rq = researchQuestions.find((q) => q.id === record.researchQuestionId);
  const n = candles.trim() === '' ? undefined : Number(candles);
  const nOk = n === undefined || (Number.isInteger(n) && n >= 0);

  const createSample = async (rec: StructuralRecord) => {
    await addBacktestSample(sampleFromBacktest(rec, layerDefs));
  };

  const save = async () => {
    setSaving(true); setMessage(undefined);
    try {
      const closed = await closeBacktestRecord(record, {
        result: result!, ...(poi && poi !== 'none' ? { reactedPoiId: poi } : {}), ...(depth ? { depthReached: depth } : {}),
        ...(n !== undefined ? { candlesToOutcome: n } : {}), ...(notes.trim() ? { notes: notes.trim() } : {}),
      });
      try { await createSample(closed); } catch (e) {
        setMessage(`Outcome saved. The research sample was not: ${e instanceof Error ? e.message : 'unknown error'} Open it again to retry.`);
        return;
      }
      onClose();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save.'); } finally { setSaving(false); }
  };

  const retry = async () => {
    setSaving(true); setMessage(undefined);
    try { await createSample(record); onClose(); } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not create the sample.'); } finally { setSaving(false); }
  };

  const title = `${record.symbol} · Backtest outcome${daily ? ` · ${daily.asOf.slice(0, 10)}` : ''}`;
  const lockedCard = (
    <div className="space-y-2">
      <div className="tos-label">Locked read{rq ? ` · ${rq.code}` : ''}</div>
      <SummaryCard summary={summary} />
    </div>
  );

  if (state === 'NEEDS_READ') {
    return (
      <StepFrame title={title} stepLabel="Outcome" progress={1} question="No locked Daily read yet." why="An outcome is only recorded against a locked prediction." onClose={onClose}>
        <GateNote title="Read first.">Finish the Daily read for this backtest; it locks when saved.</GateNote>
      </StepFrame>
    );
  }

  if (state === 'DONE') {
    return (
      <StepFrame title={title} stepLabel="Closed" progress={1} question={linked ? 'Outcome recorded and sampled.' : 'Outcome recorded; the sample is missing.'}
        why={linked ? 'This backtest is closed. It cannot change.' : 'Create the research sample from the locked read and the recorded outcome.'}
        onClose={onClose} onNext={linked ? onClose : retry} nextLabel={linked ? 'Done' : saving ? 'Creating…' : 'Create sample'} nextDisabled={saving}>
        {lockedCard}
        <p className="text-sm text-ink-2">Result: <b className="text-ink">{RESULT_LABEL[record.outcome!.result]}</b></p>
        {message && <GateNote title="Not saved">{message}</GateNote>}
      </StepFrame>
    );
  }

  return (
    <StepFrame title={title} stepLabel="After stepping the replay forward" progress={1}
      question="What did price do?" why="Recorded once against the locked read. It becomes a research sample; nothing is retyped."
      onClose={onClose} onNext={save} nextLabel={saving ? 'Saving…' : 'Save outcome'} nextDisabled={!result || !nOk || saving || !!notice}>
      {lockedCard}
      <div className="space-y-1.5"><div className="text-sm font-semibold text-ink">1. Result</div>
        <Choice value={result} onChange={setResult} options={Object.entries(RESULT_LABEL) as Array<[BacktestOutcome['result'], string]>} /></div>
      {checks.length > 0 && (
        <div className="space-y-1.5"><div className="text-sm font-semibold text-ink">2. Price reacted from</div>
          <Choice value={poi} onChange={setPoi} options={[...checks.map((c): [string, string] => [c.poi.id, c.role === 'PRIMARY' ? 'POI A' : 'POI B']), ['none', 'Neither']]} /></div>
      )}
      <div className="space-y-1.5"><div className="text-sm font-semibold text-ink">3. Retracement depth</div>
        <Choice value={depth} onChange={setDepth} options={[['SHALLOW', 'Shallow'], ['DEEP', 'Deep']]} /></div>
      <label className="block space-y-1.5"><span className="text-sm font-semibold text-ink">4. Daily candles to the outcome <span className="font-normal text-ink-3">(optional)</span></span>
        <input inputMode="numeric" value={candles} onChange={(e) => setCandles(e.target.value)} placeholder="e.g. 4" className="w-full rounded-xl bg-raised px-3 py-2.5 text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-accent/60" />
        {!nOk && <span className="block text-xs text-amber-300">A whole number, 0 or more.</span>}</label>
      <label className="block space-y-1.5"><span className="text-sm font-semibold text-ink">Note <span className="font-normal text-ink-3">(optional)</span></span>
        <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="One line." className="w-full rounded-xl bg-raised px-3 py-2.5 text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-accent/60" /></label>
      {notice && <GateNote title="Can't save yet">{notice}</GateNote>}
      {message && <GateNote title="Not saved">{message}</GateNote>}
    </StepFrame>
  );
};

export const RESULT_LABEL: Record<BacktestOutcome['result'], string> = {
  REACHED_TARGET: 'Reached the target',
  HIT_INVALIDATION: 'Hit the invalidation',
  NEITHER: 'Neither',
};
