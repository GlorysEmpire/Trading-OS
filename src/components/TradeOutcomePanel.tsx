import React, { useMemo, useState } from 'react';
import { Lock, PenLine, Ban, History, X, CheckCircle2 } from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import type { BreakevenRecord, ProcessScore, Trade, TradeAmendmentChange } from '../types';
import { calculateRealizedR } from '../utils/tradingCalculations';
import { applyAmendment, breakevenVerdict, diffEvidence, outcomeFromR, scoreProcess, type AmendablePatch } from '../utils/tradeIntegrity';

type Outcome = 'WIN' | 'LOSS' | 'SCRATCH';
const CHECK_KEYS = ['session', 'grade', 'risk', 'management', 'structure'] as const;
const DEFAULT_CHECK_LABELS = ['Session', 'Grade', 'Risk', 'Management', 'Structure'];

const field = 'w-full bg-[#162130] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-mono outline-none focus:border-cyan-600';

function fmt(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  if (typeof value === 'object') {
    const v = value as Record<string, unknown>;
    if ('score' in v) return `${v.score}/5`;
    if ('reason' in v) return `voided (${v.reason})`;
    return JSON.stringify(value);
  }
  return String(value);
}

function useCheckLabels() {
  const { tradingHQ } = useTrading();
  return CHECK_KEYS.map((_, i) => tradingHQ.processChecks?.[i] || DEFAULT_CHECK_LABELS[i]);
}

function ProcessChecks({ score, onToggle }: { score: ProcessScore; onToggle?: (key: typeof CHECK_KEYS[number]) => void }) {
  const labels = useCheckLabels();
  return (
    <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-[11px]">
      {CHECK_KEYS.map((key, i) => {
        const on = score[key];
        const cls = `px-2 py-1 rounded border text-left flex items-center justify-between ${on ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`;
        return onToggle ? (
          <button key={key} type="button" onClick={() => onToggle(key)} className={cls}>
            <span>{i + 1}. {labels[i]}</span><span>{on ? '✓' : '✗'}</span>
          </button>
        ) : (
          <div key={key} className={cls}><span>{i + 1}. {labels[i]}</span><span>{on ? '✓' : '✗'}</span></div>
        );
      })}
    </div>
  );
}

function MistakeCodePicker({ value, onChange, forced = [] }: { value: string[]; onChange: (codes: string[]) => void; forced?: string[] }) {
  const { tradingHQ } = useTrading();
  const toggle = (code: string) => {
    if (forced.includes(code)) return;
    onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code]);
  };
  if (!tradingHQ.mistakeCodes.length) return <p className="text-[11px] text-slate-500">No mistake codes defined in Trading HQ.</p>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tradingHQ.mistakeCodes.map((m) => (
        <button
          key={m.code}
          type="button"
          title={forced.includes(m.code) ? 'Set by a Trading HQ rule' : m.description}
          onClick={() => toggle(m.code)}
          className={`px-2 py-0.5 rounded border font-mono text-[10px] ${value.includes(m.code) || forced.includes(m.code) ? 'bg-amber-950/60 border-amber-700 text-amber-300' : 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'}`}
        >
          {m.code}{forced.includes(m.code) ? ' · rule' : ''}
        </button>
      ))}
    </div>
  );
}

interface BeDraft { moved: boolean; atR: string; structural: boolean; note: string }

function beDraftFrom(be?: BreakevenRecord): BeDraft {
  return be ? { moved: true, atR: String(be.movedAtR), structural: be.structural, note: be.note ?? '' } : { moved: false, atR: '', structural: false, note: '' };
}

function beRecordFrom(d: BeDraft): BreakevenRecord | undefined {
  if (!d.moved) return undefined;
  const r = Number(d.atR);
  if (d.atR.trim() === '' || !Number.isFinite(r)) return undefined;
  return { movedAtR: r, structural: d.structural, ...(d.note.trim() ? { note: d.note.trim() } : {}) };
}

/** Breakeven entry + the Trading HQ verdict for this trade's grade. */
function useBreakeven(trade: Trade, draft: BeDraft) {
  const { tradingHQ } = useTrading();
  const grade = tradingHQ.setupGrades.find((g) => g.grade === trade.setupGrade);
  const record = beRecordFrom(draft);
  const verdict = breakevenVerdict(record, grade);
  return { record, verdict, forced: verdict?.early ? ['BE_EARLY'] : [] };
}

function BreakevenFields({ draft, onChange, verdict }: { draft: BeDraft; onChange: (d: BeDraft) => void; verdict: { early: boolean; reason: string } | null }) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 font-mono text-[11px] text-slate-300 cursor-pointer">
        <input type="checkbox" checked={draft.moved} onChange={(e) => onChange({ ...draft, moved: e.target.checked })} className="accent-cyan-500" />
        Stop was moved to breakeven
      </label>
      {draft.moved && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pl-5">
          <label className="space-y-1"><span className="text-[10px] font-mono text-slate-400 block">MOVED AT (R)</span>
            <input type="number" step="0.1" value={draft.atR} onChange={(e) => onChange({ ...draft, atR: e.target.value })} className={field} placeholder="e.g. 3" />
          </label>
          <label className="flex items-center gap-2 font-mono text-[11px] text-slate-300 cursor-pointer sm:pt-4" title="New structure formed a new invalidation zone beyond the entry">
            <input type="checkbox" checked={draft.structural} onChange={(e) => onChange({ ...draft, structural: e.target.checked })} className="accent-cyan-500" />
            Structural reason
          </label>
          <label className="space-y-1"><span className="text-[10px] font-mono text-slate-400 block">NOTE {draft.structural ? '(what structure?)' : '(optional)'}</span>
            <input value={draft.note} onChange={(e) => onChange({ ...draft, note: e.target.value })} className={field} placeholder="e.g. 15M HL formed above entry" />
          </label>
        </div>
      )}
      {verdict && (
        <p className={`pl-5 font-mono text-[11px] ${verdict.early ? 'text-amber-300' : 'text-emerald-400'}`}>{verdict.reason}</p>
      )}
    </div>
  );
}

function ChangeList({ changes }: { changes: TradeAmendmentChange[] }) {
  return (
    <ul className="space-y-0.5 font-mono text-[11px]">
      {changes.map((c) => (
        <li key={c.field} className="text-slate-300">
          <span className="text-slate-500">{c.field}:</span> {fmt(c.from)} <span className="text-slate-500">→</span> <span className="text-cyan-300">{fmt(c.to)}</span>
        </li>
      ))}
    </ul>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-[#0f141d] border border-slate-700 rounded-lg max-w-xl w-full my-8 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-[#131a26]">
          <h3 className="font-mono text-sm font-bold text-slate-100 uppercase tracking-wide">{title}</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4 text-xs">{children}</div>
      </div>
    </div>
  );
}

function AmendModal({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  const { amendTrade, tradingHQ } = useTrading();
  const [exitPrice, setExitPrice] = useState(trade.exitPrice?.toString() ?? '');
  const [entryPrice, setEntryPrice] = useState(trade.entryPrice.toString());
  const [stopPrice, setStopPrice] = useState(trade.stopPrice.toString());
  const [targetPrice, setTargetPrice] = useState(trade.targetPrice.toString());
  const [date, setDate] = useState(trade.date);
  const [setupGrade, setSetupGrade] = useState(trade.setupGrade);
  const [outcome, setOutcome] = useState<'AUTO' | Outcome>('AUTO');
  const [checks, setChecks] = useState<ProcessScore>(trade.processScore);
  const [codes, setCodes] = useState<string[]>(trade.mistakeCodes);
  const [be, setBe] = useState<BeDraft>(beDraftFrom(trade.breakeven));
  const beState = useBreakeven(trade, be);
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const patch = useMemo<AmendablePatch>(() => {
    const p: AmendablePatch = {};
    const num = (s: string) => (s.trim() === '' ? NaN : Number(s));
    if (num(exitPrice) !== trade.exitPrice && Number.isFinite(num(exitPrice))) p.exitPrice = num(exitPrice);
    if (num(entryPrice) !== trade.entryPrice && Number.isFinite(num(entryPrice))) p.entryPrice = num(entryPrice);
    if (num(stopPrice) !== trade.stopPrice && Number.isFinite(num(stopPrice))) p.stopPrice = num(stopPrice);
    if (num(targetPrice) !== trade.targetPrice && Number.isFinite(num(targetPrice))) p.targetPrice = num(targetPrice);
    if (date !== trade.date) p.date = date;
    if (setupGrade !== trade.setupGrade) p.setupGrade = setupGrade;
    if (outcome !== 'AUTO' && outcome !== trade.outcome) p.outcome = outcome;
    if (CHECK_KEYS.some((k) => checks[k] !== trade.processScore[k])) p.processScore = scoreProcess(checks);
    const finalCodes = [...new Set([...codes, ...beState.forced])];
    if (JSON.stringify([...finalCodes].sort()) !== JSON.stringify([...trade.mistakeCodes].sort())) p.mistakeCodes = finalCodes;
    if (JSON.stringify(beState.record ?? null) !== JSON.stringify(trade.breakeven ?? null)) p.breakeven = beState.record;
    return p;
  }, [exitPrice, entryPrice, stopPrice, targetPrice, date, setupGrade, outcome, checks, codes, trade, beState.record, beState.forced]);

  const preview = useMemo(() => diffEvidence(trade, applyAmendment(trade, patch)), [trade, patch]);

  const submit = async () => {
    setSaving(true); setError(null);
    try { await amendTrade(trade.id, patch, reason); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save the amendment. The trade was not changed.'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Amend ${trade.asset} ${trade.direction} · ${trade.date}`} onClose={onClose}>
      <p className="text-slate-400 font-sans">
        This trade is locked. A correction is logged permanently with your reason. The original values stay visible in the history.
        The pre-trade narrative can't be amended; it was your commitment.
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 font-mono">
        <label className="space-y-1"><span className="text-[10px] text-slate-400 block">ENTRY</span><input type="number" step="any" value={entryPrice} onChange={(e) => setEntryPrice(e.target.value)} className={field} /></label>
        <label className="space-y-1"><span className="text-[10px] text-slate-400 block">STOP</span><input type="number" step="any" value={stopPrice} onChange={(e) => setStopPrice(e.target.value)} className={field} /></label>
        <label className="space-y-1"><span className="text-[10px] text-slate-400 block">TARGET</span><input type="number" step="any" value={targetPrice} onChange={(e) => setTargetPrice(e.target.value)} className={field} /></label>
        <label className="space-y-1"><span className="text-[10px] text-slate-400 block">EXIT</span><input type="number" step="any" value={exitPrice} onChange={(e) => setExitPrice(e.target.value)} className={field} /></label>
        <label className="space-y-1"><span className="text-[10px] text-slate-400 block">DATE</span><input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={field} /></label>
        <label className="space-y-1"><span className="text-[10px] text-slate-400 block">GRADE</span>
          <select value={setupGrade} onChange={(e) => setSetupGrade(e.target.value)} className={field}>
            {[...new Set([trade.setupGrade, ...tradingHQ.setupGrades.map((g) => g.grade)])].map((g) => <option key={g} value={g}>{g}</option>)}
          </select>
        </label>
        <label className="space-y-1 col-span-2"><span className="text-[10px] text-slate-400 block">OUTCOME</span>
          <select value={outcome} onChange={(e) => setOutcome(e.target.value as 'AUTO' | Outcome)} className={field}>
            <option value="AUTO">Keep / derive from R (currently {trade.outcome ?? '—'})</option>
            <option value="WIN">WIN</option><option value="LOSS">LOSS</option><option value="SCRATCH">SCRATCH / BREAKEVEN</option>
          </select>
        </label>
      </div>
      <div className="space-y-1.5"><span className="text-[10px] font-mono text-slate-400 block">PROCESS CHECKS</span>
        <ProcessChecks score={checks} onToggle={(k) => setChecks((prev) => ({ ...prev, [k]: !prev[k] }))} />
      </div>
      <div className="space-y-1.5"><span className="text-[10px] font-mono text-slate-400 block">BREAKEVEN</span>
        <BreakevenFields draft={be} onChange={setBe} verdict={beState.verdict} />
      </div>
      <div className="space-y-1.5"><span className="text-[10px] font-mono text-slate-400 block">MISTAKE CODES</span>
        <MistakeCodePicker value={codes} onChange={setCodes} forced={beState.forced} />
      </div>
      <label className="space-y-1 block"><span className="text-[10px] font-mono text-slate-400 block">REASON (REQUIRED)</span>
        <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Typed the exit wrong; MT5 history shows 2391.4" className={`${field} font-sans resize-none`} />
      </label>
      <div className="p-3 rounded bg-[#131b26] border border-slate-800 space-y-1">
        <span className="text-[10px] font-mono text-slate-400 block">WILL BE LOGGED</span>
        {preview.length ? <ChangeList changes={preview} /> : <p className="text-slate-500 font-mono text-[11px]">No changes yet.</p>}
      </div>
      {error && <p className="text-rose-400 font-mono text-[11px]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 rounded border border-slate-700 text-slate-300 font-mono">CANCEL</button>
        <button onClick={submit} disabled={saving || !preview.length || !reason.trim()} className="px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-mono font-bold">
          {saving ? 'LOGGING…' : 'LOG AMENDMENT'}
        </button>
      </div>
    </Modal>
  );
}

function VoidModal({ trade, onClose }: { trade: Trade; onClose: () => void }) {
  const { voidTrade } = useTrading();
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setSaving(true); setError(null);
    try { await voidTrade(trade.id, reason); onClose(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not void the trade.'); }
    finally { setSaving(false); }
  };
  return (
    <Modal title={`Void ${trade.asset} ${trade.direction} · ${trade.date}`} onClose={onClose}>
      <p className="text-slate-400 font-sans">
        Use this only for an entry that shouldn't exist, like a duplicate or a trade logged by mistake. A voided trade stays in your Journal
        with its reason, but it's left out of your stats. This can't be undone. A real trade you regret is a loss, not a void.
      </p>
      <label className="space-y-1 block"><span className="text-[10px] font-mono text-slate-400 block">REASON (REQUIRED)</span>
        <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Duplicate of the 09:42 XAUUSD entry" className={`${field} font-sans resize-none`} />
      </label>
      {error && <p className="text-rose-400 font-mono text-[11px]">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="px-3 py-1.5 rounded border border-slate-700 text-slate-300 font-mono">CANCEL</button>
        <button onClick={submit} disabled={saving || !reason.trim()} className="px-3 py-1.5 rounded bg-rose-700 hover:bg-rose-600 disabled:opacity-40 text-white font-mono font-bold">
          {saving ? 'VOIDING…' : 'VOID ENTRY'}
        </button>
      </div>
    </Modal>
  );
}

function CloseForm({ trade }: { trade: Trade }) {
  const { closeTrade, updateTrade } = useTrading();
  const [exit, setExit] = useState('');
  const [outcome, setOutcome] = useState<'AUTO' | Outcome>('AUTO');
  const [codes, setCodes] = useState<string[]>(trade.mistakeCodes);
  const [be, setBe] = useState<BeDraft>(beDraftFrom(trade.breakeven));
  const beState = useBreakeven(trade, be);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const exitNum = exit.trim() === '' ? NaN : Number(exit);
  const previewR = Number.isFinite(exitNum) ? calculateRealizedR(trade.direction, trade.entryPrice, trade.stopPrice, exitNum) : undefined;

  const toggleCheck = (key: typeof CHECK_KEYS[number]) =>
    updateTrade(trade.id, { processScore: scoreProcess({ ...trade.processScore, [key]: !trade.processScore[key] }) }).catch((e) => setError(e instanceof Error ? e.message : 'Could not save'));

  const submit = async () => {
    if (!window.confirm('Close and lock this trade? After this, the numbers, outcome, process score and mistake codes can only change through a logged amendment.')) return;
    if (be.moved && !beState.record) { setError('Enter the R at which the stop was moved to breakeven.'); return; }
    setSaving(true); setError(null);
    const finalCodes = [...new Set([...codes, ...beState.forced])];
    try { await closeTrade(trade.id, { exitPrice: exitNum, outcome: outcome === 'AUTO' ? undefined : outcome, processScore: trade.processScore, mistakeCodes: finalCodes, breakeven: beState.record }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not close the trade.'); }
    finally { setSaving(false); }
  };

  return (
    <div className="space-y-3">
      <div className="p-3 bg-[#131b26] border border-slate-800 rounded space-y-2">
        <span className="text-[11px] font-mono text-slate-300 font-bold uppercase block">Process checks ({trade.processScore.score}/5 passed)</span>
        <ProcessChecks score={trade.processScore} onToggle={toggleCheck} />
      </div>
      <div className="p-3 bg-[#131b26] border border-cyan-900/60 rounded space-y-3">
        <span className="text-[11px] font-mono text-cyan-300 font-bold uppercase block">Close trade</span>
        <div className="flex flex-wrap gap-2 font-mono text-[11px]">
          {([
            { label: 'HIT TP', price: trade.targetPrice, tone: 'border-emerald-800 text-emerald-300 hover:bg-emerald-950/40', be: false },
            { label: 'HIT SL', price: trade.stopPrice, tone: 'border-rose-800 text-rose-300 hover:bg-rose-950/40', be: false },
            { label: 'BREAKEVEN', price: trade.entryPrice, tone: 'border-slate-600 text-slate-200 hover:bg-slate-800/60', be: true },
          ] as const).map((b) => (
            <button
              key={b.label}
              type="button"
              onClick={() => {
                setExit(String(b.price));
                setOutcome('AUTO');
                // Exiting at entry means the stop was moved to breakeven: record at what R.
                if (b.be && !be.moved) setBe({ ...be, moved: true });
              }}
              className={`px-3 py-1 rounded border font-bold ${b.tone} ${exit === String(b.price) ? 'ring-1 ring-cyan-500' : ''}`}
            >
              {b.label} <span className="font-normal opacity-70">{b.price}</span>
            </button>
          ))}
          <button type="button" onClick={() => { setExit(''); setOutcome('AUTO'); }} className="px-3 py-1 rounded border border-slate-700 text-slate-400 hover:text-slate-200">
            MANUAL EXIT
          </button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
          <label className="space-y-1"><span className="text-[10px] text-slate-400 block">EXIT PRICE</span>
            <input type="number" step="any" value={exit} onChange={(e) => setExit(e.target.value)} placeholder="Actual fill" className={field} />
          </label>
          <div className="space-y-1"><span className="text-[10px] text-slate-400 block">REALIZED R</span>
            <div className="px-2.5 py-1.5 bg-[#162130] border border-slate-700 rounded text-slate-100 font-bold">{previewR !== undefined ? `${previewR}R → ${outcomeFromR(previewR)}` : '—'}</div>
          </div>
          <label className="space-y-1"><span className="text-[10px] text-slate-400 block">OUTCOME</span>
            <select value={outcome} onChange={(e) => setOutcome(e.target.value as 'AUTO' | Outcome)} className={field}>
              <option value="AUTO">From R</option><option value="WIN">WIN</option><option value="LOSS">LOSS</option><option value="SCRATCH">SCRATCH / BREAKEVEN</option>
            </select>
          </label>
        </div>
        <div className="space-y-1.5"><span className="text-[10px] font-mono text-slate-400 block">BREAKEVEN</span>
          <BreakevenFields draft={be} onChange={setBe} verdict={beState.verdict} />
        </div>
        <div className="space-y-1.5"><span className="text-[10px] font-mono text-slate-400 block">MISTAKE CODES (if any)</span>
          <MistakeCodePicker value={codes} onChange={setCodes} forced={beState.forced} />
        </div>
        {error && <p className="text-rose-400 font-mono text-[11px]">{error}</p>}
        <div className="flex justify-end">
          <button onClick={submit} disabled={saving || !Number.isFinite(exitNum)} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-mono text-xs font-bold">
            <Lock className="w-3.5 h-3.5" />{saving ? 'CLOSING…' : 'CLOSE & LOCK'}
          </button>
        </div>
      </div>
    </div>
  );
}

function LockedView({ trade }: { trade: Trade }) {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono">
        <div className="p-3 rounded bg-[#131b26] border border-slate-800"><span className="text-[10px] text-slate-400 block">EXIT PRICE</span><span className="text-slate-100 font-bold">{fmt(trade.exitPrice)}</span></div>
        <div className="p-3 rounded bg-[#131b26] border border-slate-800"><span className="text-[10px] text-slate-400 block">REALIZED R</span><span className={`font-bold ${(trade.realizedR ?? 0) > 0 ? 'text-emerald-400' : (trade.realizedR ?? 0) < 0 ? 'text-rose-400' : 'text-slate-100'}`}>{trade.realizedR !== undefined ? `${trade.realizedR}R` : '—'}</span></div>
        <div className="p-3 rounded bg-[#131b26] border border-slate-800"><span className="text-[10px] text-slate-400 block">OUTCOME</span><span className="text-slate-100 font-bold">{fmt(trade.outcome)}</span></div>
      </div>
      <div className="p-3 bg-[#131b26] border border-slate-800 rounded space-y-2">
        <span className="text-[11px] font-mono text-slate-300 font-bold uppercase block">Process checks ({trade.processScore.score}/5 passed)</span>
        <ProcessChecks score={trade.processScore} />
      </div>
      {trade.breakeven && (
        <p className="font-mono text-[11px] text-slate-300">
          <span className="text-slate-400">BREAKEVEN:</span> moved at {trade.breakeven.movedAtR}R{trade.breakeven.structural ? ' · structural' : ''}{trade.breakeven.note ? ` · ${trade.breakeven.note}` : ''}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5 font-mono text-[10px]">
        <span className="text-slate-400">MISTAKE CODES:</span>
        {trade.mistakeCodes.length ? trade.mistakeCodes.map((c) => <span key={c} className="px-2 py-0.5 rounded border bg-amber-950/60 border-amber-700 text-amber-300">{c}</span>) : <span className="text-slate-500">none</span>}
      </div>
    </div>
  );
}

/** Section 3 of a Journal trade: close-and-lock for open trades; read-only
 * evidence plus amend/void and the amendment history for locked trades. */
export const TradeOutcomePanel: React.FC<{ trade: Trade }> = ({ trade }) => {
  const { tradeAmendments, amendmentsError } = useTrading();
  const [modal, setModal] = useState<'amend' | 'void' | null>(null);
  const history = tradeAmendments[trade.id] ?? [];
  const locked = trade.status === 'CLOSED' || !!trade.voided;

  return (
    <div className="space-y-3">
      {trade.voided ? (
        <div className="flex items-start gap-2 p-2.5 rounded border border-rose-900 bg-rose-950/30 text-rose-300 font-mono text-[11px]">
          <Ban className="w-3.5 h-3.5 mt-0.5 shrink-0" />
          <span>VOIDED {new Date(trade.voided.at).toLocaleString()}: {trade.voided.reason}. Kept for the record, left out of stats.</span>
        </div>
      ) : locked ? (
        <div className="flex items-center gap-2 text-[11px] font-mono text-emerald-300">
          <CheckCircle2 className="w-3.5 h-3.5" />
          LOCKED{trade.closedAt ? ` · closed ${new Date(trade.closedAt).toLocaleString()}` : ''} · evaluated against HQ {trade.configVersionUsed}
        </div>
      ) : null}

      {locked ? <LockedView trade={trade} /> : <CloseForm trade={trade} />}

      <div className="flex flex-wrap items-center justify-end gap-2">
        {locked && !trade.voided && (
          <button onClick={() => setModal('amend')} className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 text-cyan-300 hover:text-cyan-200 font-mono text-[11px]">
            <PenLine className="w-3 h-3" /> AMEND
          </button>
        )}
        {!trade.voided && (
          <button onClick={() => setModal('void')} className="flex items-center gap-1 px-2.5 py-1 rounded border border-slate-700 text-slate-400 hover:text-rose-300 font-mono text-[11px]">
            <Ban className="w-3 h-3" /> VOID ENTRY
          </button>
        )}
      </div>

      {amendmentsError && locked && (
        <p className="text-[11px] font-mono text-amber-400">Amendment history unavailable: {amendmentsError}</p>
      )}

      {history.length > 0 && (
        <div className="p-3 rounded bg-[#0b1018] border border-slate-800 space-y-2">
          <span className="flex items-center gap-1.5 text-[11px] font-mono font-bold text-slate-300 uppercase"><History className="w-3.5 h-3.5" /> Amendment history ({history.length})</span>
          {history.map((a) => (
            <div key={a.id} className="border-l-2 border-slate-700 pl-2.5 space-y-1">
              <div className="font-mono text-[10px] text-slate-500">{new Date(a.createdAt).toLocaleString()} · <span className={a.kind === 'VOID' ? 'text-rose-400' : 'text-cyan-400'}>{a.kind}</span></div>
              <p className="text-slate-300 font-sans text-[11px]">"{a.reason}"</p>
              <ChangeList changes={a.changes} />
            </div>
          ))}
        </div>
      )}

      {modal === 'amend' && <AmendModal trade={trade} onClose={() => setModal(null)} />}
      {modal === 'void' && <VoidModal trade={trade} onClose={() => setModal(null)} />}
    </div>
  );
};
