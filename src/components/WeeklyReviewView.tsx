import React, { useEffect, useMemo, useState } from 'react';
import { CalendarRange, ChevronLeft, ChevronRight, Save, RotateCcw, ArrowUpRight, AlertTriangle } from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import type { WatchlistEntry, WeeklyReview } from '../types';
import { traderDateString } from '../utils/traderTime';
import { addDays, computeWeeklyEvidence, findPreviousWeeklyReview, matchDesk, weekDates, weekStartOf } from '../utils/weekly';

const field = 'w-full bg-[#162130] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs outline-none focus:border-cyan-600';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

function fmtDay(date: string, opts: Intl.DateTimeFormatOptions = { weekday: 'short', day: 'numeric', month: 'short' }) {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString(undefined, { ...opts, timeZone: 'UTC' });
}
function weekLabel(start: string) {
  return `${fmtDay(start, { day: 'numeric', month: 'short' })} – ${fmtDay(addDays(start, 6), { day: 'numeric', month: 'short', year: 'numeric' })}`;
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

export const WeeklyReviewView: React.FC = () => {
  const { trades, debriefs, tradingHQ, assets, calendarEvents, weeklyReviews, weeklyReviewsLoading, weeklyReviewsError, saveWeeklyReview, setActiveTab, setDebriefDate } = useTrading();
  const today = traderDateString();
  const thisWeek = weekStartOf(today);
  const [weekStart, setWeekStart] = useState(thisWeek);
  const nextWeek = addDays(weekStart, 7);

  const live = useMemo(() => computeWeeklyEvidence(trades, debriefs, weekStart, tradingHQ), [trades, debriefs, weekStart, tradingHQ]);
  const saved = weeklyReviews.find((r) => r.weekStart === weekStart);
  const previous = findPreviousWeeklyReview(weeklyReviews, weekStart);
  const previousUpgrade = saved?.previousUpgradeText ?? previous?.upgradeForNextWeek;

  // Next week's watchlist rows come from the focus rotation.
  const baseWatchlist = useMemo<WatchlistEntry[]>(() => {
    const rotation = [...tradingHQ.focusRotation].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
    return rotation.flatMap((d) => d.assets.map((asset) => ({ day: d.day, asset, bias: '', keyLevels: '' })));
  }, [tradingHQ.focusRotation]);

  const [leak, setLeak] = useState('');
  const [personal, setPersonal] = useState('');
  const [redFolder, setRedFolder] = useState('');
  const [upgrade, setUpgrade] = useState('');
  const [executed, setExecuted] = useState<WeeklyReview['previousUpgradeExecuted']>(null);
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    setLeak(saved?.biggestLeak ?? '');
    setPersonal(saved?.personalNotes ?? '');
    setRedFolder(saved?.redFolderEvents ?? '');
    setUpgrade(saved?.upgradeForNextWeek ?? '');
    setExecuted(saved?.previousUpgradeExecuted ?? (previous?.upgradeForNextWeek ? null : 'NA'));
    // Keep any saved rows (even for assets no longer in the rotation), then add rotation rows not yet saved.
    const savedRows = saved?.watchlist ?? [];
    const merged = [
      ...savedRows,
      ...baseWatchlist.filter((b) => !savedRows.some((r) => r.day === b.day && r.asset === b.asset)),
    ].sort((a, b) => DAYS.indexOf(a.day) - DAYS.indexOf(b.day));
    setWatchlist(merged);
    setError(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [weekStart, saved?.updatedAt, previous?.weekStart, baseWatchlist]);
  useEffect(() => { setJustSaved(false); }, [weekStart]);

  const nextWeekDates = weekDates(nextWeek);
  const calendarRedFolder = calendarEvents
    .filter((e) => e.type === 'NEWS' && e.impact === 'HIGH' && nextWeekDates.includes(e.date))
    .sort((a, b) => (a.date + a.time < b.date + b.time ? -1 : 1));
  const addCalendarEvents = () => {
    const lines = calendarRedFolder.map((e) => `${fmtDay(e.date)} ${e.time} · ${e.title}${e.assetOrCurrency ? ` (${e.assetOrCurrency})` : ''}`);
    setRedFolder((prev) => [prev.trim(), ...lines.filter((l) => !prev.includes(l))].filter(Boolean).join('\n'));
  };

  const updateRow = (idx: number, patch: Partial<WatchlistEntry>) => setWatchlist((prev) => prev.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const grades = useMemo(() => {
    const order = tradingHQ.setupGrades.map((g) => g.grade);
    return [...order, ...Object.keys(live.gradeCounts).filter((g) => !order.includes(g))];
  }, [tradingHQ.setupGrades, live.gradeCounts]);

  const evidenceDrift = saved ? JSON.stringify(saved.evidence) !== JSON.stringify(live) : false;
  const canSave = leak.trim() !== '' && upgrade.trim() !== '' && executed !== null;

  const handleSave = async () => {
    setSaving(true); setError(null);
    try {
      await saveWeeklyReview({
        weekStart,
        biggestLeak: leak.trim(),
        personalNotes: personal.trim(),
        redFolderEvents: redFolder.trim(),
        watchlist: watchlist.map((r) => ({ ...r, bias: r.bias.trim(), keyLevels: r.keyLevels.trim() })),
        upgradeForNextWeek: upgrade.trim(),
        previousUpgradeExecuted: previousUpgrade ? executed : 'NA',
        previousUpgradeText: previousUpgrade || undefined,
        evidence: live,
      });
      setJustSaved(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save the weekly review.');
    } finally {
      setSaving(false);
    }
  };

  const mistakes = Object.entries(live.mistakeCodeCounts).sort((a, b) => b[1] - a[1]);
  const openDebrief = (date: string) => { setDebriefDate(date); setActiveTab('debrief'); };

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <CalendarRange className="w-4 h-4" /> Evidence → Pattern → One upgrade → Recommit
          </div>
          <h2 className="text-xl font-mono font-bold text-slate-100 mt-1">WEEKLY REVIEW</h2>
          <p className="text-[11px] font-mono text-slate-400 mt-0.5">{weekLabel(weekStart)}</p>
        </div>
        <div className="flex items-center gap-1.5 font-mono text-xs">
          <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-1.5 rounded border border-slate-700 text-slate-300 hover:text-white" title="Previous week"><ChevronLeft className="w-4 h-4" /></button>
          <button onClick={() => setWeekStart(addDays(weekStart, 7))} disabled={weekStart >= thisWeek} className="p-1.5 rounded border border-slate-700 text-slate-300 hover:text-white disabled:opacity-30" title="Next week"><ChevronRight className="w-4 h-4" /></button>
          {weekStart !== thisWeek && (
            <button onClick={() => setWeekStart(thisWeek)} className="flex items-center gap-1 px-2 py-1.5 rounded border border-slate-700 text-cyan-300"><RotateCcw className="w-3 h-3" /> THIS WEEK</button>
          )}
        </div>
      </div>

      {weeklyReviewsError && <p className="text-xs font-mono text-amber-400">{weeklyReviewsError}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* Evidence */}
        <section className="lg:col-span-2 bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">The week's evidence</h3>
            <span className="text-[10px] font-mono text-slate-500">Journal + debriefs</span>
          </div>
          <div>
            <Stat label="Process score avg" value={live.processAvg !== null ? `${live.processAvg}/5` : '—'} tone={live.processAvg === null ? 'text-slate-500' : live.processAvg >= 4 ? 'text-emerald-400' : 'text-amber-400'} />
            <Stat label="Most common mistake" value={live.mostCommonMistake ?? 'none'} tone={live.mostCommonMistake ? 'text-amber-400' : 'text-slate-500'} sub={live.mostCommonMistake ? `×${live.mistakeCodeCounts[live.mostCommonMistake]}` : undefined} />
            <Stat label="Grades" value={grades.map((g) => `${g} ${live.gradeCounts[g] || 0}`).join(' · ') || '—'} />
            <Stat label="Trades" value={live.tradesTaken} sub={`${live.tradingDays} trading day${live.tradingDays === 1 ? '' : 's'} · ${live.ruleBreakTrades} with a rule break`} />
            <Stat label="Week R" value={`${live.totalR > 0 ? '+' : ''}${live.totalR}R`} tone={live.totalR > 0 ? 'text-emerald-400' : live.totalR < 0 ? 'text-rose-400' : 'text-slate-100'} sub={`${live.wins}W · ${live.losses}L · ${live.scratches} scratch`} />
            <Stat label="Daily halt days" value={live.haltDays} tone={live.haltDays ? 'text-rose-400' : 'text-slate-100'} />
            <Stat label="Daily upgrades executed" value={live.upgradesYes + live.upgradesNo ? `${live.upgradesYes}/${live.upgradesYes + live.upgradesNo}` : '—'} sub="from the Y/N in this week's debriefs" />
            <Stat label="Debriefs" value={`${live.debriefsWritten}`} sub={`${live.tradingDays} trading day${live.tradingDays === 1 ? '' : 's'}`} />
          </div>

          {live.tradingDaysWithoutDebrief.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 p-2 rounded border border-amber-900/70 bg-amber-950/20 text-[10px] font-mono">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-amber-300">Traded, no debrief:</span>
              {live.tradingDaysWithoutDebrief.map((d) => (
                <button key={d} onClick={() => openDebrief(d)} className="px-1.5 py-0.5 rounded border border-slate-700 text-slate-200 hover:text-cyan-300">{fmtDay(d)}</button>
              ))}
            </div>
          )}

          <table className="w-full font-mono text-[11px]">
            <thead><tr className="text-slate-500 text-left"><th className="font-normal py-1">DAY</th><th className="font-normal">TRADES</th><th className="font-normal">PROCESS</th><th className="font-normal text-right">R</th></tr></thead>
            <tbody>
              {live.processByDay.map((d) => (
                <tr key={d.date} className="border-t border-slate-800/60">
                  <td className="py-1 text-slate-300">{fmtDay(d.date, { weekday: 'short' })}</td>
                  <td className="text-slate-400">{d.trades || '—'}</td>
                  <td className={d.processAvg === null ? 'text-slate-600' : d.processAvg >= 4 ? 'text-emerald-400' : 'text-amber-400'}>{d.processAvg !== null ? `${d.processAvg}/5` : '—'}</td>
                  <td className={`text-right ${d.totalR > 0 ? 'text-emerald-400' : d.totalR < 0 ? 'text-rose-400' : 'text-slate-600'}`}>{d.trades ? `${d.totalR}R` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex flex-wrap gap-1.5">
            {mistakes.length ? mistakes.map(([code, k]) => (
              <span key={code} className="px-2 py-0.5 rounded border bg-amber-950/60 border-amber-700 text-amber-300 font-mono text-[10px]">{code}{k > 1 ? ` ×${k}` : ''}</span>
            )) : <span className="text-[11px] font-mono text-slate-500">No mistake codes this week.</span>}
          </div>
        </section>

        {/* Reflection */}
        <section className="lg:col-span-3 bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">Pattern & upgrade</h3>
            {saved && <span className="text-[10px] font-mono text-emerald-400">saved {new Date(saved.updatedAt).toLocaleString()}</span>}
          </div>

          {evidenceDrift && (
            <p className="text-[11px] font-mono text-amber-300 p-2 rounded border border-amber-900/70 bg-amber-950/20">
              The week's trades or debriefs changed after this review was saved. Saving again records the current evidence.
            </p>
          )}

          <div className="space-y-1.5 p-3 rounded bg-[#131b26] border border-slate-800">
            <span className="text-[11px] font-mono text-slate-300 block">Last week's upgrade held?</span>
            {previousUpgrade ? (
              <>
                <p className="text-xs text-slate-200 font-sans">"{previousUpgrade}"</p>
                <div className="flex gap-2 pt-1">
                  {(['YES', 'NO'] as const).map((v) => (
                    <button key={v} type="button" onClick={() => setExecuted(v)} className={`px-3 py-1 rounded border font-mono text-[11px] font-bold ${executed === v ? (v === 'YES' ? 'bg-emerald-950/60 border-emerald-700 text-emerald-300' : 'bg-rose-950/50 border-rose-800 text-rose-300') : 'border-slate-700 text-slate-400'}`}>
                      {v === 'YES' ? 'Y' : 'N'}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-slate-500 font-sans">No earlier weekly review. Nothing to check yet.</p>
            )}
          </div>

          <label className="block space-y-1">
            <span className="text-[11px] font-mono text-slate-300">Biggest process leak</span>
            <textarea rows={2} value={leak} onChange={(e) => setLeak(e.target.value)} placeholder={live.mostCommonMistake ? `Most common this week: ${live.mostCommonMistake}. What's behind it?` : 'Where did the process break down most this week?'} className={`${field} resize-none`} />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-mono text-slate-300">Personal / energy notes</span>
            <textarea rows={2} value={personal} onChange={(e) => setPersonal(e.target.value)} placeholder="Shift pattern, sleep, focus, anything that shaped the week" className={`${field} resize-none`} />
          </label>

          <label className="block space-y-1">
            <span className="flex items-center justify-between text-[11px] font-mono text-slate-300">
              <span>Red-folder events next week <span className="text-slate-500">(one per line)</span></span>
              {calendarRedFolder.length > 0 && (
                <button type="button" onClick={addCalendarEvents} className="text-[10px] text-cyan-400 hover:text-cyan-300">+ {calendarRedFolder.length} from Calendar</button>
              )}
            </span>
            <textarea rows={3} value={redFolder} onChange={(e) => setRedFolder(e.target.value)} placeholder="e.g. Fri NFP 08:30 NY" className={`${field} resize-none font-mono`} />
          </label>

          <label className="block space-y-1">
            <span className="text-[11px] font-mono text-slate-300">One clear upgrade for next week <span className="text-slate-500">(only one)</span></span>
            <textarea rows={2} value={upgrade} onChange={(e) => setUpgrade(e.target.value)} placeholder="The single change that would most improve next week's process" className={`${field} resize-none`} />
            <button type="button" onClick={() => setActiveTab('trading-hq')} className="flex items-center gap-1 text-[10px] font-mono text-slate-400 hover:text-cyan-300">
              If this is a rule change, make it in Trading HQ so it's versioned <ArrowUpRight className="w-3 h-3" />
            </button>
          </label>
        </section>
      </div>

      {/* Watchlist for next week */}
      <section className="bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">Watchlist · {weekLabel(nextWeek)}</h3>
          <span className="text-[10px] font-mono text-slate-500">From the focus rotation in Trading HQ. Desk bias shown for reference.</span>
        </div>
        {watchlist.length === 0 ? (
          <p className="text-[11px] text-slate-500 font-sans">No focus rotation set. Add one in Trading HQ, section 8.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px] min-w-[760px]">
              <thead>
                <tr className="text-slate-500 text-left border-b border-slate-800">
                  <th className="py-1.5 font-normal w-24">DAY</th>
                  <th className="font-normal w-20">ASSET</th>
                  <th className="font-normal w-40">DESK NOW</th>
                  <th className="font-normal">ONE-SENTENCE BIAS</th>
                  <th className="font-normal w-56">KEY LEVELS</th>
                </tr>
              </thead>
              <tbody>
                {watchlist.map((row, idx) => {
                  const desk = matchDesk(assets, row.asset);
                  const showDay = idx === 0 || watchlist[idx - 1].day !== row.day;
                  return (
                    <tr key={`${row.day}-${row.asset}`} className={`${showDay ? 'border-t border-slate-800' : ''}`}>
                      <td className="py-1.5 text-slate-300 align-top">{showDay ? row.day.slice(0, 3) : ''}</td>
                      <td className="text-cyan-300 font-bold align-top pt-2">{row.asset}</td>
                      <td className="align-top pt-2 pr-2">
                        {desk ? (
                          <span title={desk.currentNarrative} className={`${/bear/i.test(desk.currentBias) ? 'text-rose-400' : /bull/i.test(desk.currentBias) ? 'text-emerald-400' : 'text-slate-400'}`}>
                            {desk.currentBias}
                          </span>
                        ) : (
                          <span className="text-slate-600">no desk</span>
                        )}
                      </td>
                      <td className="pr-2 py-1"><input value={row.bias} onChange={(e) => updateRow(idx, { bias: e.target.value })} placeholder={desk?.currentNarrative ? desk.currentNarrative.slice(0, 90) : 'One sentence'} className={`${field} font-sans`} /></td>
                      <td className="py-1"><input value={row.keyLevels} onChange={(e) => updateRow(idx, { keyLevels: e.target.value })} placeholder="e.g. 81.8k inducement · 75k bull liq" className={field} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="flex flex-wrap items-center justify-end gap-3">
        {error && <span className="text-[11px] font-mono text-rose-400">{error}</span>}
        {!canSave && <span className="text-[10px] font-mono text-slate-500">The leak, the upgrade{previousUpgrade ? ' and Y/N' : ''} are needed to save.</span>}
        {justSaved && <span className="text-[11px] font-mono text-emerald-400">Weekly review saved.</span>}
        <button onClick={handleSave} disabled={!canSave || saving || weeklyReviewsLoading} className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 text-white font-mono text-xs font-bold">
          <Save className="w-3.5 h-3.5" /> {saving ? 'SAVING…' : saved ? 'UPDATE REVIEW' : 'SAVE REVIEW'}
        </button>
      </div>

      {/* History */}
      <section className="bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-2">
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">Review history</h3>
        {weeklyReviews.length === 0 ? (
          <p className="text-[11px] text-slate-500 font-sans">No weekly reviews yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full font-mono text-[11px] min-w-[640px]">
              <thead><tr className="text-slate-500 text-left border-b border-slate-800"><th className="py-1.5 font-normal">WEEK</th><th className="font-normal">PROCESS</th><th className="font-normal">TRADES</th><th className="font-normal">R</th><th className="font-normal">TOP MISTAKE</th><th className="font-normal">UPGRADE</th></tr></thead>
              <tbody>
                {weeklyReviews.slice(0, 12).map((r) => (
                  <tr key={r.weekStart} onClick={() => setWeekStart(r.weekStart)} className={`border-b border-slate-800/60 cursor-pointer hover:bg-slate-800/30 ${r.weekStart === weekStart ? 'bg-cyan-950/20' : ''}`}>
                    <td className="py-1.5 text-slate-200">{weekLabel(r.weekStart)}</td>
                    <td className="text-slate-300">{r.evidence.processAvg !== null ? `${r.evidence.processAvg}/5` : '—'}</td>
                    <td className="text-slate-300">{r.evidence.tradesTaken}</td>
                    <td className={r.evidence.totalR > 0 ? 'text-emerald-400' : r.evidence.totalR < 0 ? 'text-rose-400' : 'text-slate-400'}>{r.evidence.totalR}R</td>
                    <td className="text-amber-300">{r.evidence.mostCommonMistake ?? '—'}</td>
                    <td className="text-slate-300 font-sans truncate max-w-[300px]">{r.upgradeForNextWeek}</td>
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
