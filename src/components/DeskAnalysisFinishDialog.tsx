import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Flag, RotateCcw, X } from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import type { AssetDeskData } from '../types';
import type { DeskAnalysisHistory, DeskAnalysisOutcome, DeskAnalysisScope } from '../lib/deskAnalysisHistoryStore';

const SCOPE_LABEL: Record<DeskAnalysisScope, string> = {
  all: 'analysis', narrative: 'narrative', monthly: 'monthly structure',
  weekly: 'weekly structure', daily: 'daily structure', h4: '4H structure',
};

export const DeskAnalysisFinishDialog: React.FC<{
  desk: AssetDeskData;
  scope: DeskAnalysisScope;
  onClose: () => void;
  onSaved: (entry: DeskAnalysisHistory) => void;
}> = ({ desk, scope, onClose, onSaved }) => {
  const { resolveDeskAnalysis } = useTrading();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [choice, setChoice] = useState<'complete' | 'invalidated' | 'reset' | null>(null);
  const [targetHit, setTargetHit] = useState(false);
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);

  const save = async () => {
    if (!choice) return;
    if (choice === 'invalidated' && !note.trim()) {
      setError('Add a short note about what invalidated the analysis.');
      return;
    }
    const outcome: DeskAnalysisOutcome = choice === 'reset'
      ? 'RESET' : choice === 'invalidated'
        ? 'INVALIDATED' : targetHit ? 'TARGET_HIT' : 'COMPLETED';
    setError(null);
    setSaving(true);
    try {
      const entry = await resolveDeskAnalysis(desk.id, scope, outcome, note.trim());
      onSaved(entry);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the analysis. Nothing was cleared.');
      setSaving(false);
    }
  };

  return createPortal(
    <dialog
      ref={dialogRef}
      aria-labelledby="finish-analysis-title"
      onCancel={event => { event.preventDefault(); if (!saving) onClose(); }}
      onClick={event => { if (event.target === dialogRef.current && !saving) onClose(); }}
      className="w-[calc(100%-2rem)] max-w-md rounded-2xl border border-line bg-panel p-0 text-ink shadow-2xl backdrop:bg-black/75"
    >
      <div className="p-5 sm:p-6 space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-widest text-cyan-400 font-semibold">{desk.symbol} · Current analysis</p>
            <h2 id="finish-analysis-title" className="text-xl font-semibold mt-1">Finish {SCOPE_LABEL[scope]}</h2>
          </div>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Close" className="rounded-lg p-1.5 text-ink-3 hover:bg-raised hover:text-ink disabled:opacity-50"><X className="w-4 h-4" /></button>
        </div>

        <p className="text-sm text-ink-3 leading-relaxed">
          This version will be saved in History. Then {scope === 'all' ? 'the active desk analysis' : `only the active ${SCOPE_LABEL[scope]}`} will be cleared so you can begin the next one.
        </p>

        <div className="grid grid-cols-2 gap-2" role="group" aria-label="How did the analysis end?">
          <button type="button" onClick={() => setChoice('complete')}
            aria-pressed={choice === 'complete'}
            className={`rounded-xl border p-3 text-left transition ${choice === 'complete' ? 'border-emerald-500 bg-emerald-950/30' : 'border-line bg-raised hover:border-emerald-700'}`}>
            <Check className="w-4 h-4 text-emerald-400 mb-3" />
            <span className="block text-sm font-semibold">Complete</span>
            <span className="block text-xs text-ink-3 mt-1">The idea played out.</span>
          </button>
          <button type="button" onClick={() => setChoice('invalidated')}
            aria-pressed={choice === 'invalidated'}
            className={`rounded-xl border p-3 text-left transition ${choice === 'invalidated' ? 'border-amber-500 bg-amber-950/30' : 'border-line bg-raised hover:border-amber-700'}`}>
            <Flag className="w-4 h-4 text-amber-400 mb-3" />
            <span className="block text-sm font-semibold">Invalidated</span>
            <span className="block text-xs text-ink-3 mt-1">The thesis no longer holds.</span>
          </button>
        </div>

        {choice === 'complete' && (
          <label className="flex items-center gap-3 rounded-lg border border-line bg-raised px-3 py-2.5 text-sm cursor-pointer">
            <input type="checkbox" checked={targetHit} onChange={event => setTargetHit(event.target.checked)} className="accent-emerald-500" />
            Target was hit
          </label>
        )}
        {choice && (
          <label className="block text-xs text-ink-3">
            {choice === 'invalidated' ? 'What invalidated it?' : choice === 'complete' ? 'What happened? (optional)' : 'Why start fresh? (optional)'}
            <textarea
              value={note} onChange={event => setNote(event.target.value)}
              rows={2} autoFocus={choice === 'invalidated'}
              placeholder={choice === 'invalidated' ? 'For example, the higher timeframe structure broke…' : 'A brief note for future reference'}
              className="block mt-1.5 w-full rounded-lg border border-line bg-raised p-3 text-sm text-ink outline-none focus:border-cyan-500 resize-y"
            />
          </label>
        )}
        {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}

        <div className="flex items-center justify-between gap-3 pt-1">
          <button type="button" onClick={() => { setChoice('reset'); setTargetHit(false); setError(null); }}
            className={`inline-flex items-center gap-1.5 text-xs ${choice === 'reset' ? 'text-cyan-300' : 'text-ink-3 hover:text-ink'}`}>
            <RotateCcw className="w-3.5 h-3.5" /> Just start fresh
          </button>
          <button type="button" onClick={save} disabled={!choice || saving}
            className="rounded-lg bg-sky-600 hover:bg-sky-500 disabled:opacity-40 px-4 py-2.5 text-sm font-semibold text-white">
            {saving ? 'Saving…' : 'Save & start new'}
          </button>
        </div>
      </div>
    </dialog>,
    document.body,
  );
};
