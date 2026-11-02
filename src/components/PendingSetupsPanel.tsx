import React, { useMemo, useState } from 'react';
import { Crosshair, Plus, Zap, Ban, Clock3, Pencil, ArrowUpRight, X, AlertTriangle, CheckSquare, Square } from 'lucide-react';
import { useTrading, type PendingSetupInput } from '../context/TradingContext';
import type { AssetDeskData, PendingSetup, ProcessScore } from '../types';
import { calculatePlannedR, evaluateRiskViolations } from '../utils/tradingCalculations';
import { evaluateSessionCheck, minutesInZone, minutesToHhmm, SESSION_TIMEZONE, traderDateString } from '../utils/traderTime';
import { computeDailyEvidence } from '../utils/debrief';
import { isPastValidity, setupStats } from '../utils/pendingSetups';
import { MultiImageDropzone, ImageThumbGrid } from './ImageUploadDropzone';
import { ImageViewerModal, type LightboxImage } from './ImageViewerModal';

const field = 'w-full bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-mono outline-none focus:border-cyan-600';
const TIMEFRAMES = ['1M', '3M', '5M', '15M', '30M', '1H', '4H', 'Daily'];
const CHECKS: Array<{ key: keyof Omit<ProcessScore, 'score'>; fallback: string }> = [
  { key: 'session', fallback: 'Session' },
  { key: 'grade', fallback: 'Grade' },
  { key: 'risk', fallback: 'Risk' },
  { key: 'management', fallback: 'Management' },
  { key: 'structure', fallback: 'Structure' },
];

const toLocalInput = (d: Date) => {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
const fmtDate = (iso: string) => new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

type Draft = {
  direction: 'LONG' | 'SHORT'; timeframe: string; modelId: string; setupGrade: string;
  entry: string; stop: string; target: string; narrative: string; reasoning: string; validUntil: string; screenshots: string[];
};

function SetupForm({ desk, initial, onDone }: { desk: AssetDeskData; initial?: PendingSetup; onDone: () => void }) {
  const { tradingHQ, addPendingSetup, updatePendingSetup } = useTrading();
  const [d, setD] = useState<Draft>(() => ({
    direction: initial?.direction ?? 'LONG',
    timeframe: initial?.timeframe ?? '15M',
    modelId: initial?.modelId ?? tradingHQ.executionModels[0]?.id ?? '',
    setupGrade: initial?.setupGrade ?? tradingHQ.setupGrades[0]?.grade ?? 'A+',
    entry: initial ? String(initial.entryPrice) : '',
    stop: initial ? String(initial.stopPrice) : '',
    target: initial ? String(initial.targetPrice) : '',
    narrative: initial?.narrative ?? '',
    reasoning: initial?.setupReasoning ?? '',
    validUntil: initial?.validUntil ?? '',
    screenshots: initial?.screenshots ?? [],
  }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<Draft>) => setD((prev) => ({ ...prev, ...patch }));

  const nums = { entry: Number(d.entry), stop: Number(d.stop), target: Number(d.target) };
  const pricesOk = [d.entry, d.stop, d.target].every((v) => v.trim() !== '') && Object.values(nums).every(Number.isFinite);
  const plannedR = pricesOk ? calculatePlannedR(d.direction, nums.entry, nums.stop, nums.target) : 0;
  const checks = pricesOk ? evaluateRiskViolations({ plannedR, setupGrade: d.setupGrade }, tradingHQ, 0) : [];

  const submit = async () => {
    if (!pricesOk) { setError('Entry, stop and target are needed.'); return; }
    if (plannedR <= 0) { setError('Check the stop and target against the direction: the planned R is not positive.'); return; }
    setSaving(true); setError(null);
    const input: PendingSetupInput = {
      deskId: desk.id, asset: desk.symbol, direction: d.direction, timeframe: d.timeframe, modelId: d.modelId, setupGrade: d.setupGrade,
      entryPrice: nums.entry, stopPrice: nums.stop, targetPrice: nums.target,
      narrative: d.narrative.trim(), setupReasoning: d.reasoning.trim(), screenshots: d.screenshots,
      ...(d.validUntil ? { validUntil: d.validUntil } : {}),
    };
    try {
      if (initial) await updatePendingSetup(initial.id, input); else await addPendingSetup(input);
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the setup.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 rounded-lg bg-raised border border-cyan-900/60 space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-mono font-bold text-cyan-300 uppercase">{initial ? 'Edit setup' : `New ${desk.symbol} setup`}</span>
        <button onClick={onDone} className="text-slate-500 hover:text-slate-200"><X className="w-4 h-4" /></button>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
        <div className="grid grid-cols-2 gap-1 bg-raised p-0.5 border border-slate-700 rounded col-span-2 sm:col-span-1">
          {(['LONG', 'SHORT'] as const).map((dir) => (
            <button key={dir} type="button" onClick={() => set({ direction: dir })} className={`py-1 rounded font-bold ${d.direction === dir ? (dir === 'LONG' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white') : 'text-slate-400'}`}>{dir}</button>
          ))}
        </div>
        <select value={d.timeframe} onChange={(e) => set({ timeframe: e.target.value })} className={field} title="Entry timeframe">
          {TIMEFRAMES.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={d.modelId} onChange={(e) => set({ modelId: e.target.value })} className={field}>
          {tradingHQ.executionModels.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
        </select>
        <select value={d.setupGrade} onChange={(e) => set({ setupGrade: e.target.value })} className={field}>
          {tradingHQ.setupGrades.map((g) => <option key={g.grade} value={g.grade}>{g.grade}</option>)}
        </select>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 font-mono">
        <label className="space-y-1"><span className="text-[10px] text-slate-400 block">Entry</span><input type="number" step="any" value={d.entry} onChange={(e) => set({ entry: e.target.value })} className={field} /></label>
        <label className="space-y-1"><span className="text-[10px] text-slate-400 block">Stop</span><input type="number" step="any" value={d.stop} onChange={(e) => set({ stop: e.target.value })} className={field} /></label>
        <label className="space-y-1"><span className="text-[10px] text-slate-400 block">Target</span><input type="number" step="any" value={d.target} onChange={(e) => set({ target: e.target.value })} className={field} /></label>
        <div className="space-y-1"><span className="text-[10px] text-slate-400 block">Planned R</span><div className={`px-2.5 py-1.5 rounded border border-slate-700 font-bold ${plannedR >= 3 ? 'text-emerald-400' : plannedR > 0 ? 'text-amber-400' : 'text-slate-500'}`}>{plannedR > 0 ? `${plannedR}R` : '—'}</div></div>
      </div>
      {checks.length > 0 && (
        <div className="space-y-1">
          {checks.map((c) => <p key={c} className="flex items-center gap-1.5 text-[11px] font-mono text-amber-300"><AlertTriangle className="w-3 h-3 shrink-0" /> {c}</p>)}
        </div>
      )}
      <textarea rows={2} value={d.narrative} onChange={(e) => set({ narrative: e.target.value })} placeholder="Narrative: why this setup, which POI and liquidity, the scenario it belongs to" className={`${field} font-sans resize-none`} />
      <input value={d.reasoning} onChange={(e) => set({ reasoning: e.target.value })} placeholder="Entry criteria / what must happen for the entry to trigger" className={`${field} font-sans`} />
      <div className="flex flex-wrap items-center gap-2 font-mono">
        <span className="text-[10px] text-slate-400">VALID UNTIL (optional)</span>
        <input type="date" value={d.validUntil} onChange={(e) => set({ validUntil: e.target.value })} className={`${field} w-auto`} />
      </div>
      <div className="space-y-1.5">
        <ImageThumbGrid images={d.screenshots} onRemove={(i) => set({ screenshots: d.screenshots.filter((_, j) => j !== i) })} />
        <MultiImageDropzone compact onAdd={(urls) => set({ screenshots: [...d.screenshots, ...urls] })} />
      </div>
      {error && <p className="text-[11px] font-mono text-rose-400">{error}</p>}
      <div className="flex justify-end">
        <button onClick={submit} disabled={saving} className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-mono font-bold">
          {saving ? 'SAVING…' : initial ? 'Save changes' : 'Add pending setup'}
        </button>
      </div>
    </div>
  );
}

function TriggerModal({ setup, onClose }: { setup: PendingSetup; onClose: () => void }) {
  const { tradingHQ, trades, triggerPendingSetup, setActiveTab } = useTrading();
  const [entryLocal, setEntryLocal] = useState(() => toLocalInput(new Date()));
  const [fill, setFill] = useState(String(setup.entryPrice));
  const [checks, setChecks] = useState<Omit<ProcessScore, 'score'>>({ session: true, grade: true, risk: true, management: true, structure: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const entryAt = useMemo(() => { const x = new Date(entryLocal); return Number.isNaN(x.getTime()) ? new Date() : x; }, [entryLocal]);
  const session = evaluateSessionCheck(tradingHQ.sessions, entryAt, setup.timeframe);
  const fillNum = Number(fill);
  const plannedR = Number.isFinite(fillNum) ? calculatePlannedR(setup.direction, fillNum, setup.stopPrice, setup.targetPrice) : setup.plannedR;
  const day = computeDailyEvidence(trades, traderDateString(entryAt), tradingHQ);
  const labels = CHECKS.map((c, i) => tradingHQ.processChecks?.[i] || c.fallback);

  const confirm = async () => {
    setSaving(true); setError(null);
    try {
      await triggerPendingSetup(setup.id, { entryAt, fillPrice: Number.isFinite(fillNum) ? fillNum : undefined, checks });
      setDone(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not move the setup to the Journal.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto" onClick={onClose}>
      <div className="bg-panel border border-slate-700 rounded-lg max-w-lg w-full my-8 text-xs" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-800 bg-panel">
          <span className="font-mono text-sm font-bold text-slate-100 uppercase flex items-center gap-2"><Zap className="w-4 h-4 text-emerald-400" /> Entry triggered · {setup.asset} {setup.direction}</span>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-200"><X className="w-4 h-4" /></button>
        </div>
        {done ? (
          <div className="p-5 space-y-3">
            <p className="text-emerald-300 font-mono">Moved to the Journal as an open trade, with all the setup's details and charts.</p>
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-1.5 rounded border border-slate-700 text-slate-300 font-mono">Close</button>
              <button onClick={() => { onClose(); setActiveTab('journal'); }} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-cyan-600 text-white font-mono font-bold">Open journal <ArrowUpRight className="w-3 h-3" /></button>
            </div>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 font-mono">
              <label className="space-y-1"><span className="text-[10px] text-slate-400 block">Entry time (your local time)</span><input type="datetime-local" value={entryLocal} onChange={(e) => setEntryLocal(e.target.value)} className={field} /></label>
              <label className="space-y-1"><span className="text-[10px] text-slate-400 block">Fill price</span><input type="number" step="any" value={fill} onChange={(e) => setFill(e.target.value)} className={field} /></label>
            </div>
            <div className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-[11px]">
              <span className={session.outWindow ? 'text-rose-300' : 'text-cyan-300'}>
                {session.session?.name ?? 'Outside windows'} · {minutesToHhmm(minutesInZone(entryAt, SESSION_TIMEZONE))} NY
                {session.outWindow ? ' · OUT_WINDOW' : ''}
              </span>
              <span className="text-slate-300">R {plannedR}{fillNum !== setup.entryPrice ? ` (planned ${setup.plannedR})` : ''}</span>
              <span className={day.halted ? 'text-rose-400' : 'text-slate-400'}>Losses that day {day.lossCount}/{day.maxDailyLosses}</span>
            </div>
            {day.halted && (
              <p className="flex items-start gap-1.5 p-2 rounded border border-rose-900 bg-rose-950/30 text-rose-300 font-mono text-[11px]">
                <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" /> The daily loss limit was already reached. If this entry really filled, it's still recorded, flagged as a rule break.
              </p>
            )}
            <div className="space-y-1.5">
              <span className="text-[10px] font-mono text-slate-400 block">Process checks at entry</span>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 font-mono text-[11px]">
                {CHECKS.map((c, i) => {
                  const on = c.key === 'session' ? session.pass : checks[c.key];
                  return (
                    <button
                      key={c.key}
                      type="button"
                      disabled={c.key === 'session'}
                      title={c.key === 'session' ? 'Set by the entry time and timeframe (NY-time session rule)' : undefined}
                      onClick={() => setChecks((prev) => ({ ...prev, [c.key]: !prev[c.key] }))}
                      className={`flex items-center gap-1 px-2 py-1 rounded border text-left ${on ? 'bg-emerald-950/50 border-emerald-800 text-emerald-300' : 'bg-slate-900 border-slate-800 text-slate-500'}`}
                    >
                      {on ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />} {labels[i]}
                    </button>
                  );
                })}
              </div>
            </div>
            {error && <p className="text-[11px] font-mono text-rose-400">{error}</p>}
            <div className="flex justify-end gap-2">
              <button onClick={onClose} className="px-3 py-1.5 rounded border border-slate-700 text-slate-300 font-mono">Cancel</button>
              <button onClick={confirm} disabled={saving} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-mono font-bold">
                <Zap className="w-3.5 h-3.5" /> {saving ? 'MOVING…' : 'Move to journal'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const PendingSetupsPanel: React.FC<{ desk: AssetDeskData }> = ({ desk }) => {
  const { pendingSetups, pendingSetupsError, resolvePendingSetup, tradingHQ, setActiveTab } = useTrading();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<PendingSetup | null>(null);
  const [triggering, setTriggering] = useState<PendingSetup | null>(null);
  const [resolving, setResolving] = useState<{ setup: PendingSetup; status: 'INVALIDATED' | 'EXPIRED' } | null>(null);
  const [reason, setReason] = useState('');
  const [resolveError, setResolveError] = useState<string | null>(null);
  const [lightbox, setLightbox] = useState<{ images: LightboxImage[]; index: number } | null>(null);

  const deskSetups = pendingSetups.filter((p) => p.deskId === desk.id);
  const pending = deskSetups.filter((p) => p.status === 'PENDING');
  const history = deskSetups.filter((p) => p.status !== 'PENDING');
  const stats = setupStats(deskSetups);
  const today = traderDateString();
  const modelName = (id: string) => tradingHQ.executionModels.find((m) => m.id === id)?.name ?? id;

  const submitResolve = async () => {
    if (!resolving) return;
    setResolveError(null);
    try { await resolvePendingSetup(resolving.setup.id, resolving.status, reason); setResolving(null); setReason(''); }
    catch (e) { setResolveError(e instanceof Error ? e.message : 'Could not update the setup.'); }
  };

  return (
    <div className="bg-panel border border-slate-800 rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
        <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-2"><Crosshair className="w-4 h-4 text-cyan-400" /> Pending setups · {desk.symbol}</span>
        <div className="flex items-center gap-3 text-[10px] font-mono text-slate-500">
          <span>{stats.triggered} triggered · {stats.invalidated} invalidated · {stats.expired} expired{stats.triggerRate !== null ? ` · ${stats.triggerRate}% trigger rate` : ''}</span>
          {!formOpen && !editing && (
            <button onClick={() => setFormOpen(true)} className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-cyan-300 hover:text-cyan-200"><Plus className="w-3 h-3" /> New setup</button>
          )}
        </div>
      </div>

      {pendingSetupsError && <p className="text-xs font-mono text-amber-400">{pendingSetupsError}</p>}
      {formOpen && <SetupForm desk={desk} onDone={() => setFormOpen(false)} />}
      {editing && <SetupForm desk={desk} initial={editing} onDone={() => setEditing(null)} />}

      {pending.length === 0 && !formOpen ? (
        <p className="text-xs font-mono text-slate-500">No pending setups on {desk.symbol}. Log one when you've marked a POI and are waiting for the entry.</p>
      ) : (
        <div className="space-y-3">
          {pending.map((p) => (
            <div key={p.id} className="p-3 rounded-lg bg-raised border border-slate-800 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2 font-mono text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`px-2 py-0.5 rounded font-bold ${p.direction === 'LONG' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-rose-950/60 text-rose-300 border border-rose-800'}`}>{p.direction}</span>
                  <span className="text-slate-200">@ {p.entryPrice}</span>
                  <span className="text-rose-400">SL {p.stopPrice}</span>
                  <span className="text-emerald-400">TP {p.targetPrice}</span>
                  <span className="text-cyan-300 font-bold">{p.plannedR}R</span>
                  <span className="text-purple-300">{p.setupGrade}</span>
                  <span className="text-slate-400">{modelName(p.modelId)} · {p.timeframe}</span>
                </div>
                <span className="text-[10px] text-slate-500">logged {fmtDate(p.createdAt)}{p.validUntil ? ` · valid until ${p.validUntil}` : ''}</span>
              </div>
              {isPastValidity(p, today) && (
                <p className="flex items-center gap-1.5 text-[11px] font-mono text-amber-300"><Clock3 className="w-3 h-3" /> Past its valid-until date. Mark it expired if it no longer applies.</p>
              )}
              {p.narrative && <p className="text-xs text-slate-200 font-sans">{p.narrative}</p>}
              {p.setupReasoning && <p className="text-[11px] text-slate-400 font-sans"><span className="font-mono text-slate-500">Trigger: </span>{p.setupReasoning}</p>}
              <ImageThumbGrid
                images={p.screenshots}
                onView={(i) => setLightbox({ images: p.screenshots.map((url, k) => ({ url, title: `${p.asset} ${p.direction} setup · ${k + 1}/${p.screenshots.length}`, timeframe: p.timeframe })), index: i })}
              />
              {resolving?.setup.id === p.id ? (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <input autoFocus value={reason} onChange={(e) => setReason(e.target.value)} placeholder={resolving.status === 'INVALIDATED' ? 'What invalidated it? (e.g. took 75k without revisiting the POI)' : 'Why did it expire?'} className={`${field} font-sans flex-1 min-w-[220px]`} />
                  <button onClick={submitResolve} className="px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white font-mono text-[11px] font-bold">MARK {resolving.status}</button>
                  <button onClick={() => { setResolving(null); setReason(''); setResolveError(null); }} className="text-slate-500 hover:text-slate-300"><X className="w-4 h-4" /></button>
                  {resolveError && <span className="text-[11px] font-mono text-rose-400 w-full">{resolveError}</span>}
                </div>
              ) : (
                <div className="flex flex-wrap items-center justify-end gap-2 pt-1 font-mono text-[11px]">
                  <button onClick={() => setEditing(p)} className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-slate-300 hover:text-ink"><Pencil className="w-3 h-3" /> Edit</button>
                  <button onClick={() => setResolving({ setup: p, status: 'EXPIRED' })} className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-amber-300"><Clock3 className="w-3 h-3" /> Expired</button>
                  <button onClick={() => setResolving({ setup: p, status: 'INVALIDATED' })} className="flex items-center gap-1 px-2 py-1 rounded border border-slate-700 text-slate-400 hover:text-rose-300"><Ban className="w-3 h-3" /> Invalidated</button>
                  <button onClick={() => setTriggering(p)} className="flex items-center gap-1 px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold"><Zap className="w-3 h-3" /> Entry triggered</button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-1.5 pt-2 border-t border-slate-800">
          <span className="text-[10px] font-mono text-slate-500 uppercase">Resolved</span>
          {history.slice(0, 20).map((p) => (
            <div key={p.id} className="flex flex-wrap items-center gap-2 text-[11px] font-mono py-1 border-b border-slate-800/50">
              <span className="text-slate-500 w-28">{p.resolution ? fmtDate(p.resolution.at) : ''}</span>
              <span className={p.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}>{p.direction}</span>
              <span className="text-slate-300">@ {p.entryPrice} · {p.plannedR}R · {p.setupGrade}</span>
              <span className={`px-1.5 py-0.5 rounded border text-[10px] ${p.status === 'TRIGGERED' ? 'border-emerald-800 text-emerald-300' : p.status === 'INVALIDATED' ? 'border-rose-900 text-rose-300' : 'border-amber-900 text-amber-300'}`}>{p.status}</span>
              {p.status === 'TRIGGERED' ? (
                <button onClick={() => setActiveTab('journal')} className="flex items-center gap-0.5 text-cyan-400 hover:text-cyan-300">in Journal <ArrowUpRight className="w-3 h-3" /></button>
              ) : (
                <span className="text-slate-400 font-sans truncate max-w-[360px]">{p.resolution?.reason}</span>
              )}
            </div>
          ))}
        </div>
      )}

      {triggering && <TriggerModal setup={triggering} onClose={() => setTriggering(null)} />}
      <ImageViewerModal
        images={lightbox?.images ?? []}
        currentIndex={lightbox?.index ?? 0}
        isOpen={!!lightbox}
        onClose={() => setLightbox(null)}
        onNavigate={(index) => setLightbox((prev) => (prev ? { ...prev, index } : prev))}
      />
    </div>
  );
};
