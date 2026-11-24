import React, { useState } from 'react';
import { CADENCE_LABEL, candleClosed, isIdentified, type PeriodPlan, type ReviewScore } from '../../decomposition';
import { useDecompositionData } from '../../context/DecompositionDataContext';
import { Choice, GateNote, StepFrame, fmtPrice } from './ui';
import { useTrading } from '../../context/TradingContext';
import { formatTradingTime } from '../../utils/timeDisplay';

/** Review at the candle close, in under a minute: the plan beside three taps. */
export const ReviewFlow: React.FC<{ plan: PeriodPlan; onClose: () => void }> = ({ plan, onClose }) => {
  const { saveReview, notice } = useDecompositionData();
  const { timeView } = useTrading();
  const [prediction, setPrediction] = useState<ReviewScore>();
  const [process, setProcess] = useState<ReviewScore>();
  const [lesson, setLesson] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string>();
  const r = plan.read;
  const closed = candleClosed(plan.candle, new Date().toISOString());
  const label = CADENCE_LABEL[plan.cadence];

  const save = async () => {
    if (!closed || plan.review || !prediction || !process || !lesson.trim() || saving) return;
    setSaving(true); setMessage(undefined);
    try {
      await saveReview(plan, { savedAt: new Date().toISOString(), prediction, process, lesson });
      onClose();
    } catch (e) { setMessage(e instanceof Error ? e.message : 'Could not save.'); } finally { setSaving(false); }
  };

  const scores: Array<[ReviewScore, string]> = [['CORRECT', 'Correct'], ['PARTLY', 'Partly'], ['WRONG', 'Wrong']];
  return (
    <StepFrame title={`${plan.candle.symbol} · ${label} plan review`} stepLabel="At the candle close" progress={1}
      question="How did the plan do?" why="Prediction and process are scored apart: a wrong forecast with the right process is not a failed analysis."
      onClose={onClose} onNext={save} nextLabel={saving ? 'Saving…' : 'Save review'} nextDisabled={!closed || !!plan.review || !prediction || !process || !lesson.trim() || saving || !!notice}>
      <div className="rounded-2xl bg-well p-4 ring-1 ring-inset ring-line space-y-2 text-sm">
        <div className="tos-label">The plan</div>
        <p className="text-base text-ink">{r.narrative?.value || 'No narrative written.'}</p>
        <div className="grid grid-cols-2 gap-2 text-ink-2">
          {isIdentified(r.draw) && <span>Draw: <b className="text-ink">{fmtPrice(r.draw.value.target)}</b> ({r.draw.value.kind.toLowerCase()})</span>}
          {isIdentified(r.invalidation) && <span>Wrong if: <b className="text-ink">{r.invalidation.value.rule}</b></span>}
          {isIdentified(r.formation) && r.formation.value.primary && <span>POI A: <b className="text-ink">{fmtPrice(r.formation.value.primary.low)}–{fmtPrice(r.formation.value.primary.high)}</b></span>}
          {isIdentified(r.formation) && r.formation.value.backup && <span>POI B: <b className="text-ink">{fmtPrice(r.formation.value.backup.low)}–{fmtPrice(r.formation.value.backup.high)}</b></span>}
        </div>
      </div>
      {plan.review ? (
        <div className="rounded-lg border border-line p-3 text-sm">
          <p>Prediction {plan.review.prediction.toLowerCase()} · Process {plan.review.process.toLowerCase()}</p>
          <p className="mt-1 text-ink-2">{plan.review.lesson}</p>
        </div>
      ) : !closed ? (
        <GateNote title="Not yet.">The review opens when this candle closes{plan.candle.closeTime ? ` (${formatTradingTime(plan.candle.closeTime, { view: timeView })})` : ''}.</GateNote>
      ) : <>
        <div className="space-y-1.5"><div className="text-sm font-semibold text-ink">1. Prediction</div><p className="text-xs text-ink-3">Did price reach the draw, form the expected high/low, behave as expected?</p>
          <Choice value={prediction} onChange={setPrediction} options={scores} /></div>
        <div className="space-y-1.5"><div className="text-sm font-semibold text-ink">2. Process</div><p className="text-xs text-ink-3">With only what you knew then: structure, range, inducement and POIs read correctly?</p>
          <Choice value={process} onChange={setProcess} options={scores} /></div>
        <label className="block space-y-1.5"><span className="text-sm font-semibold text-ink">One lesson</span>
          <input value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="One line." className="w-full rounded-xl bg-raised px-3 py-2.5 text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-accent/60" />
        </label>
      </>}
      {notice && <GateNote title="Can't save yet">{notice}</GateNote>}
      {message && <GateNote title="Not saved">{message}</GateNote>}
    </StepFrame>
  );
};
