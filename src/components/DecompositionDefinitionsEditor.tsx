import React, { useEffect, useMemo, useState } from 'react';
import { ChevronDown, History, Lock, Save, Unlock } from 'lucide-react';
import { useDecompositionDefinitions } from '../context/DecompositionDefinitionsContext';
import { describeDefinitionChanges, validateDefinitions, type DecompositionDefinitions } from '../decomposition';

/**
 * Trading HQ → Decomposition: the definitions every structural record and
 * period plan is read with. Saving always creates a new version; records keep
 * the version they were read with.
 */
const TEXT_FIELDS: Array<{ key: keyof DecompositionDefinitions['text']; label: string; why: string }> = [
  { key: 'internalSwing', label: 'Internal swing', why: 'Internal liquidity and inducement are measured from these.' },
  { key: 'externalSwing', label: 'External swing', why: 'Trend and the dealing range come from the external swings.' },
  { key: 'bos', label: 'BOS', why: 'Separates a break of structure from a sweep.' },
  { key: 'choch', label: 'CHoCH (internal vs external)', why: 'Keeps internal shifts apart from external changes of character.' },
  { key: 'mss', label: 'MSS', why: 'Your market structure shift, as you define it.' },
  { key: 'equalHighsLows', label: 'Equal highs/lows', why: 'Equal highs and lows mark resting liquidity.' },
];

type NumKey = 'atrMultiple' | 'outerClosePct' | 'maxBodyOverlapPct' | 'strongMin' | 'weakMax';
const LEG_FIELDS: Array<{ key: NumKey; label: string; unit: string; step: number }> = [
  { key: 'atrMultiple', label: 'Leg range at least', unit: '× ATR(20)', step: 0.1 },
  { key: 'outerClosePct', label: 'Most candles close in the outer', unit: '% of their range', step: 1 },
  { key: 'maxBodyOverlapPct', label: 'Body overlap below', unit: '%', step: 1 },
  { key: 'strongMin', label: 'Strong when criteria met ≥', unit: 'of 4', step: 1 },
  { key: 'weakMax', label: 'Weak when criteria met ≤', unit: 'of 4', step: 1 },
];

const field = 'w-full rounded-lg bg-raised px-3 py-2 text-sm text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-accent/60';

export const DecompositionDefinitionsEditor: React.FC = () => {
  const { current, currentRow, history, loading, notice, save } = useDecompositionDefinitions();
  const [draft, setDraft] = useState<DecompositionDefinitions>(current);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string>();
  const [savedMsg, setSavedMsg] = useState<string>();
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => { setDraft(current); }, [current]);

  const changes = useMemo(() => describeDefinitionChanges(current, draft), [current, draft]);
  const problems = useMemo(() => validateDefinitions(draft), [draft]);

  const setText = (k: keyof DecompositionDefinitions['text'], v: string) => setDraft((d) => ({ ...d, text: { ...d.text, [k]: v } }));
  const setLeg = (k: NumKey, v: number) => setDraft((d) => ({ ...d, strongLeg: { ...d.strongLeg, [k]: v } }));
  const setNum = (k: 'equalHighsLowsAtr' | 'equilibriumBandPct' | 'minRToDraw', v: number) => setDraft((d) => ({ ...d, [k]: v }));

  const onSave = async () => {
    setSaving(true); setError(undefined); setSavedMsg(undefined);
    try {
      await save(draft, reason);
      setReason('');
      setSavedMsg('Saved as a new version. Records already saved keep the version they were read with.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="tos-card p-5 text-sm text-ink-3">Loading definitions…</div>;

  return (
    <div className="space-y-5">
      <div className="tos-card p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-semibold text-ink">Market decomposition definitions</h3>
            <p className="text-xs text-ink-3 mt-0.5">Every structural record and plan names the version it was read with. Changing them never rewrites old records.</p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-raised px-2.5 py-1 ring-1 ring-inset ring-line text-ink-2"><History className="h-3.5 w-3.5" /> {current.version}</span>
            {current.locked
              ? <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/12 px-2.5 py-1 text-emerald-300 ring-1 ring-inset ring-emerald-400/25"><Lock className="h-3.5 w-3.5" /> Locked</span>
              : <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1 text-amber-300 ring-1 ring-inset ring-amber-400/25"><Unlock className="h-3.5 w-3.5" /> Placeholders, not locked</span>}
          </div>
        </div>
        {notice && <p className="rounded-lg bg-amber-500/10 px-3 py-2 text-xs text-amber-300 ring-1 ring-inset ring-amber-400/20">{notice}</p>}
      </div>

      <div className="tos-card p-5 space-y-4">
        <h4 className="tos-label">Definitions</h4>
        {TEXT_FIELDS.map((f) => (
          <label key={f.key} className="block">
            <span className="text-sm font-medium text-ink">{f.label}</span>
            <span className="block text-[11px] text-ink-3 mb-1.5">{f.why}</span>
            <textarea rows={2} className={`${field} resize-none`} value={draft.text[f.key]} onChange={(e) => setText(f.key, e.target.value)} />
          </label>
        ))}
      </div>

      <div className="tos-card p-5 space-y-4">
        <div>
          <h4 className="tos-label">Strong or weak leg</h4>
          <p className="text-[11px] text-ink-3 mt-1">The app works out leg strength from these four criteria. Values are placeholders for backtesting.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {LEG_FIELDS.map((f) => (
            <label key={f.key} className="flex items-center justify-between gap-3 rounded-xl bg-raised px-3 py-2 ring-1 ring-inset ring-line">
              <span className="text-sm text-ink-2">{f.label}</span>
              <span className="flex items-center gap-1.5">
                <input type="number" step={f.step} className="w-20 rounded-md bg-well px-2 py-1 text-right text-sm tabular-nums text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-accent/60"
                  value={draft.strongLeg[f.key]} onChange={(e) => setLeg(f.key, Number(e.target.value))} />
                <span className="text-xs text-ink-3 whitespace-nowrap">{f.unit}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className="tos-card p-5 space-y-3">
        <h4 className="tos-label">Levels and R</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {([['equalHighsLowsAtr', 'Equal highs/lows within', '× ATR', 0.01], ['equilibriumBandPct', 'Equilibrium band around 50%', '% of range', 1], ['minRToDraw', 'Minimum R from a POI to the draw', 'R', 0.5]] as const).map(([k, label, unit, step]) => (
            <label key={k} className="flex items-center justify-between gap-3 rounded-xl bg-raised px-3 py-2 ring-1 ring-inset ring-line">
              <span className="text-sm text-ink-2">{label}</span>
              <span className="flex items-center gap-1.5">
                <input type="number" step={step} className="w-20 rounded-md bg-well px-2 py-1 text-right text-sm tabular-nums text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-accent/60"
                  value={draft[k]} onChange={(e) => setNum(k, Number(e.target.value))} />
                <span className="text-xs text-ink-3 whitespace-nowrap">{unit}</span>
              </span>
            </label>
          ))}
          <label className="flex items-center justify-between gap-3 rounded-xl bg-raised px-3 py-2 ring-1 ring-inset ring-line">
            <span className="text-sm text-ink-2">Stop for R to the draw</span>
            <select className="rounded-md bg-well px-2 py-1 text-sm text-ink ring-1 ring-inset ring-line" value={draft.rStopBasis}
              onChange={(e) => setDraft((d) => ({ ...d, rStopBasis: e.target.value as DecompositionDefinitions['rStopBasis'] }))}>
              <option value="POI_FAR_EDGE">POI's far edge</option>
              <option value="INVALIDATION">The invalidation</option>
            </select>
          </label>
        </div>
        <p className="text-[11px] text-ink-3">The minimum R here is for decomposition gates. Your live grade rules (A+ 5R, B+ 3R) stay in Grades.</p>
      </div>

      <div className="tos-card p-5 space-y-3">
        <label className="flex items-center gap-2.5 text-sm text-ink">
          <input type="checkbox" checked={draft.locked} onChange={(e) => setDraft((d) => ({ ...d, locked: e.target.checked }))} className="h-4 w-4 accent-teal-500" />
          Lock these definitions (they stop being placeholders)
        </label>
        {changes.length > 0 && (
          <div className="rounded-xl bg-raised p-3 ring-1 ring-inset ring-line">
            <div className="tos-label mb-1.5">What changes in the next version</div>
            <ul className="space-y-0.5 text-sm text-ink-2">{changes.map((c) => <li key={c}>· {c}</li>)}</ul>
          </div>
        )}
        {problems.length > 0 && <p className="text-sm text-amber-300">{problems.join(' ')}</p>}
        <input className={field} placeholder="Why are you changing them? (kept with the version)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <div className="flex flex-wrap items-center gap-3">
          <button onClick={onSave} disabled={saving || !changes.length || problems.length > 0 || !reason.trim() || !currentRow}
            className="tos-cta inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold disabled:opacity-40">
            <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save as new version'}
          </button>
          {changes.length > 0 && <button onClick={() => setDraft(current)} className="text-sm text-ink-3 hover:text-ink">Discard changes</button>}
        </div>
        {error && <p className="text-sm text-rose-300">{error}</p>}
        {savedMsg && <p className="text-sm text-emerald-300">{savedMsg}</p>}
      </div>

      {history.length > 0 && (
        <div className="tos-card p-5">
          <button onClick={() => setShowHistory((v) => !v)} className="flex w-full items-center justify-between text-sm font-semibold text-ink">
            Version history ({history.length}) <ChevronDown className={`h-4 w-4 transition ${showHistory ? 'rotate-180' : ''}`} />
          </button>
          {showHistory && (
            <ul className="mt-3 divide-y divide-line">
              {history.map((r) => (
                <li key={r.id} className="flex flex-wrap items-baseline justify-between gap-2 py-2 text-sm">
                  <span className="font-medium text-ink">{r.definitions.version}{r.isActive ? <span className="ml-2 text-xs text-accent">in use</span> : null}{r.definitions.locked ? <span className="ml-2 text-xs text-emerald-300">locked</span> : null}</span>
                  <span className="text-xs text-ink-3">{new Date(r.updatedAt).toLocaleDateString()} · {r.changedReason || 'No reason recorded'}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
