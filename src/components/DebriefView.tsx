import React, { useEffect, useMemo, useState } from 'react';
import { PageTitle } from './PageTitle';
import { ClipboardCheck, ChevronLeft, ChevronRight, Save, AlertTriangle, ShieldAlert, ArrowUpRight, RotateCcw } from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import type { DailyDebrief } from '../types';
import { traderDateString } from '../utils/traderTime';
import { computeDailyEvidence, evidenceChangedSince, findPreviousDebrief, tradingDatesWithoutDebrief } from '../utils/debrief';

const field = 'w-full bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs outline-none focus:border-cyan-600';

function shiftDate(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function prettyDate(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
}

function Stat({ label, value, tone = 'text-slate-100', sub }: { label: string; value: React.ReactNode; tone?: string; sub?: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-2 border-b border-slate-800/80 last:border-b-0">
      <span className="text-[11px] font-mono text-slate-400 uppercase tracking-wide">{label}</span>
      <span className="text-right">
        <span className={`font-mono text-sm font-bold ${tone}`}>{value}</span>
        {sub && <span className="block text-[10px] font-mono text-slate-500">{sub}</span>}
      </span>
    </div>
  );
}

export const DebriefView: React.FC = () => {
  const { trades, tradingHQ, debriefs, debriefsLoading, debriefsError, saveDebrief, debriefDate, setDebriefDate, setActiveTab } = useTrading();
  const today = traderDateString();
  const [date, setDate] = useState(debriefDate ?? today);
  useEffect(() => { if (debriefDate) { setDate(debriefDate); setDebriefDate(null); } }, [debriefDate, setDebriefDate]);

  const live = useMemo(() => computeDailyEvidence(trades, date, tradingHQ), [trades, date, tradingHQ]);
  const saved = debriefs.find((d) => d.date === date);
  const previous = findPreviousDebrief(debriefs, date);
  const dayTrades = trades.filter((t) => t.date === date);

  const [presence, setPresence] = useState('');
  const [executed, setExecuted] = useState<DailyDebrief['previousUpgradeExecuted']>(null);
  const [upgrade, setUpgrade] = useState('');
  const [assignment, setAssignment] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  // Load the form whenever the selected day (or its saved debrief) changes.
  useEffect(() => {
    setPresence(saved?.presenceQuality ?? '');
    setExecuted(saved?.previousUpgradeExecuted ?? (previous?.upgradeForTomorrow ? null : 'NA'));
    setUpgrade(saved?.upgradeForTomorrow ?? '');
    setAssignment(saved?.tomorrowAssignment ?? '');
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, saved?.updatedAt, previous?.date]);
  useEffect(() => { setJustSaved(false); }, [date]);

  const previousUpgrade = saved?.previousUpgradeText ?? previous?.upgradeForTomorrow;
  const previousUpgradeDate = saved?.previousUpgradeDate ?? previous?.date;
  const evidenceDrift = saved ? evidenceChangedSince(saved.evidence, live) : false;
  const missing = useMemo(() => tradingDatesWithoutDebrief(trades, debriefs, today).slice(0, 7), [trades, debriefs, today]);

  const grades = useMemo(() => {
    const order = tradingHQ.setupGrades.map((g) => g.grade);
    const extra = Object.keys(live.gradeCounts).filter((g) => !order.includes(g));
    return [...order, ...extra];
  }, [tradingHQ.setupGrades, live.gradeCounts]);

  const canSave = presence.trim() !== '' && upgrade.trim() !== '' && (executed !== null);

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await saveDebrief({
        date,
        presenceQuality: presence.trim(),
        previousUpgradeExecuted: previousUpgrade ? executed : 'NA',
        previousUpgradeText: previousUpgrade || undefined,
        previousUpgradeDate: previousUpgrade ? previousUpgradeDate : undefined,
        upgradeForTomorrow: upgrade.trim(),
        tomorrowAssignment: assignment.trim(),
        evidence: live,
      });
      setJustSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the debrief.');
    } finally {
      setSaving(false);
    }
  };

  const mistakeEntries = Object.entries(live.mistakeCodeCounts).sort((a, b) => b[1] - a[1]);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      {/* Header + day navigation */}
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <PageTitle icon={ClipboardCheck} title="Daily Debrief" description="Look at today's evidence, spot one pattern, and pick one small improvement for tomorrow." />
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <button onClick={() => setDate(shiftDate(date, -1))} className="p-1.5 rounded border border-slate-700 text-slate-300 hover:text-ink" title="Previous day"><ChevronLeft className="w-4 h-4" /></button>
          <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} className="bg-raised border border-slate-700 rounded px-2 py-1.5 text-slate-100 outline-none" />
          <button onClick={() => setDate(shiftDate(date, 1))} disabled={date >= today} className="p-1.5 rounded border border-slate-700 text-slate-300 hover:text-ink disabled:opacity-30" title="Next day"><ChevronRight className="w-4 h-4" /></button>
          {date !== today && (
            <button onClick={() => setDate(today)} className="flex items-center gap-1 px-2 py-1.5 rounded border border-slate-700 text-cyan-300"><RotateCcw className="w-3 h-3" /> Today</button>
          )}
        </div>
      </div>

      {debriefsError && <p className="text-xs font-mono text-amber-400">{debriefsError}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Evidence (computed) */}
        <section className="lg:col-span-2 bg-panel border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">Evidence · {prettyDate(date)}</h3>
            <span className="text-[10px] font-mono text-slate-500">from the Journal</span>
          </div>

          {live.halted && (
            <div className="flex items-center gap-2 p-2 rounded border border-rose-900 bg-rose-950/40 text-rose-300 font-mono text-[11px]">
              <ShieldAlert className="w-3.5 h-3.5 shrink-0" /> Daily halt reached ({live.lossCount}/{live.maxDailyLosses} losses).
            </div>
          )}
          {live.openTrades > 0 && (
            <div className="flex items-center gap-2 p-2 rounded border border-amber-900 bg-amber-950/30 text-amber-300 font-mono text-[11px]">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {live.openTrades} trade{live.openTrades > 1 ? 's' : ''} still open. Close {live.openTrades > 1 ? 'them' : 'it'} in the Journal so today's evidence is complete.
            </div>
          )}

          <div>
            <Stat label="Process score avg" value={live.processAvg !== null ? `${live.processAvg}/5` : '—'} tone={live.processAvg === null ? 'text-slate-500' : live.processAvg >= 4 ? 'text-emerald-400' : 'text-amber-400'} />
            <Stat label="Trades taken" value={live.tradesTaken} sub={live.voidedCount ? `${live.voidedCount} voided, not counted` : undefined} />
            <Stat
              label="Grades"
              value={grades.filter((g) => live.gradeCounts[g] || tradingHQ.setupGrades.some((s) => s.grade === g)).map((g) => `${g} ${live.gradeCounts[g] || 0}`).join(' · ') || '—'}
            />
            <Stat
              label="Rule breaks"
              value={live.ruleBreakTrades}
              tone={live.ruleBreakTrades ? 'text-amber-400' : 'text-slate-100'}
              sub={live.violationTrades ? `${live.violationTrades} entered against an HQ check` : undefined}
            />
            <Stat
              label="Day R"
              value={`${live.totalR > 0 ? '+' : ''}${live.totalR}R`}
              tone={live.totalR > 0 ? 'text-emerald-400' : live.totalR < 0 ? 'text-rose-400' : 'text-slate-100'}
              sub={`${live.wins}W · ${live.losses}L · ${live.scratches} scratch`}
            />
            <Stat label="Daily loss limit" value={`${live.lossCount}/${live.maxDailyLosses}`} tone={live.halted ? 'text-rose-400' : 'text-slate-100'} />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Mistake codes</span>
            <div className="flex flex-wrap gap-1.5">
              {mistakeEntries.length ? mistakeEntries.map(([code, n]) => (
                <span key={code} className="px-2 py-0.5 rounded border bg-amber-950/60 border-amber-700 text-amber-300 font-mono text-[10px]">{code}{n > 1 ? ` ×${n}` : ''}</span>
              )) : <span className="text-[11px] font-mono text-slate-500">none logged</span>}
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-mono text-slate-400 uppercase">Trades</span>
            {dayTrades.length === 0 ? (
              <p className="text-[11px] text-slate-500 font-sans">No trades logged on this day. A debrief still counts: presence, the upgrade, tomorrow's assignment.</p>
            ) : (
              <table className="w-full font-mono text-[11px]">
                <tbody>
                  {dayTrades.map((t) => (
                    <tr key={t.id} className={`border-b border-slate-800/60 ${t.voided ? 'opacity-40 line-through' : ''}`}>
                      <td className="py-1 text-slate-200">{t.asset}</td>
                      <td className={t.direction === 'LONG' ? 'text-emerald-400' : 'text-rose-400'}>{t.direction}</td>
                      <td className="text-purple-300">{t.setupGrade}</td>
                      <td className="text-slate-400">{t.processScore.score}/5</td>
                      <td className={`text-right ${(t.realizedR ?? 0) > 0 ? 'text-emerald-400' : (t.realizedR ?? 0) < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                        {t.status === 'OPEN' ? 'OPEN' : `${t.realizedR ?? 0}R`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {dayTrades.length > 0 && (
              <button onClick={() => setActiveTab('journal')} className="flex items-center gap-1 text-[11px] font-mono text-cyan-400 hover:text-cyan-300 pt-1">
                Open Journal <ArrowUpRight className="w-3 h-3" />
              </button>
            )}
          </div>
        </section>

        {/* Reflection (written) */}
        <section className="lg:col-span-3 bg-panel border border-slate-800 rounded-xl p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">Reflection</h3>
            {saved && <span className="text-[10px] font-mono text-emerald-400">saved {new Date(saved.updatedAt).toLocaleString()}</span>}
          </div>

          {evidenceDrift && (
            <p className="text-[11px] font-mono text-amber-300 p-2 rounded border border-amber-900/70 bg-amber-950/20">
              This day's trades changed after the debrief was written (a trade was closed, amended, added or voided). Saving again records the current evidence.
            </p>
          )}

          <label className="block space-y-1">
            <span className="text-[11px] font-mono text-slate-300">Presence quality <span className="text-slate-500">(one sentence)</span></span>
            <input value={presence} maxLength={240} onChange={(e) => setPresence(e.target.value)} placeholder="Where was my mind during the windows: in control or drifting?" className={field} />
          </label>

          <div className="space-y-1.5 p-3 rounded bg-raised border border-slate-800">
            <span className="text-[11px] font-mono text-slate-300 block">Last 1% upgrade executed?</span>
            {previousUpgrade ? (
              <>
                <p className="text-xs text-slate-200 font-sans">"{previousUpgrade}"</p>
                <p className="text-[10px] font-mono text-slate-500">set in the {previousUpgradeDate ? prettyDate(previousUpgradeDate) : ''} debrief</p>
                <div className="flex gap-2 pt-1">
                  {(['YES', 'NO'] as const).map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setExecuted(v)}
                      className={`px-3 py-1 rounded border font-mono text-[11px] font-bold ${executed === v ? (v === 'YES' ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300' : 'bg-rose-950/50 border-rose-800 text-rose-300') : 'border-slate-700 text-slate-400'}`}
                    >
                      {v === 'YES' ? 'Y' : 'N'}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-slate-500 font-sans">No earlier debrief with an upgrade. Nothing to check yet.</p>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-mono text-slate-300">Today's 1% upgrade for tomorrow <span className="text-slate-500">(only one)</span></span>
            <textarea rows={2} value={upgrade} onChange={(e) => setUpgrade(e.target.value)} placeholder="The single smallest correction that would have made today's process better" className={`${field} resize-none`} />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-mono text-slate-300">Tomorrow's single assignment <span className="text-slate-500">(optional)</span></span>
            <input value={assignment} onChange={(e) => setAssignment(e.target.value)} placeholder="e.g. 15 RQ-05 samples on ETH 1H" className={field} />
          </label>

          {error && <p className="text-[11px] font-mono text-rose-400">{error}</p>}
          <div className="flex items-center justify-end gap-3">
            {!canSave && <span className="text-[10px] font-mono text-slate-500">Presence, the upgrade{previousUpgrade ? ' and Y/N' : ''} are needed to save.</span>}
            {justSaved && <span className="text-[11px] font-mono text-emerald-400">Debrief saved.</span>}
            <button onClick={handleSave} disabled={!canSave || saving || debriefsLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white text-sm font-semibold">
              <Save className="w-3.5 h-3.5" /> {saving ? 'SAVING…' : saved ? 'Update debrief' : 'Save debrief'}
            </button>
          </div>
        </section>
      </div>

      {/* History */}
      <section className="bg-panel border border-slate-800 rounded-xl p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">Debrief history</h3>
          {missing.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
              <span className="text-slate-500">Trading days without a debrief:</span>
              {missing.map((d) => (
                <button key={d} onClick={() => setDate(d)} className="px-1.5 py-0.5 rounded border border-slate-700 text-slate-300 hover:text-cyan-300">{prettyDate(d)}</button>
              ))}
            </div>
          )}
        </div>
        {debriefs.length === 0 ? (
          <p className="text-[11px] text-slate-500 font-sans">No debriefs yet. The first one is the one above.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px] min-w-[640px]">
              <thead>
                <tr className="text-slate-500 text-left border-b border-slate-800">
                  <th className="py-1.5 font-normal">Date</th>
                  <th className="font-normal">Process</th>
                  <th className="font-normal">Trades</th>
                  <th className="font-normal">R</th>
                  <th className="font-normal">Last upgrade</th>
                  <th className="font-normal">Upgrade for next day</th>
                </tr>
              </thead>
              <tbody>
                {debriefs.slice(0, 30).map((d) => (
                  <tr key={d.date} onClick={() => setDate(d.date)} className={`border-b border-slate-800/60 cursor-pointer hover:bg-slate-800/30 ${d.date === date ? 'bg-cyan-950/20' : ''}`}>
                    <td className="py-1.5 text-slate-200">{prettyDate(d.date)}</td>
                    <td className="text-slate-300">{d.evidence.processAvg !== null ? `${d.evidence.processAvg}/5` : '—'}</td>
                    <td className="text-slate-300">{d.evidence.tradesTaken}</td>
                    <td className={d.evidence.totalR > 0 ? 'text-emerald-400' : d.evidence.totalR < 0 ? 'text-rose-400' : 'text-slate-400'}>{d.evidence.totalR}R</td>
                    <td className={d.previousUpgradeExecuted === 'YES' ? 'text-emerald-400' : d.previousUpgradeExecuted === 'NO' ? 'text-rose-400' : 'text-slate-500'}>
                      {d.previousUpgradeExecuted === 'NA' || !d.previousUpgradeExecuted ? '—' : d.previousUpgradeExecuted === 'YES' ? 'Y' : 'N'}
                    </td>
                    <td className="text-slate-300 font-sans truncate max-w-[320px]">{d.upgradeForTomorrow}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
