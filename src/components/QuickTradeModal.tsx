import React, { useState, useMemo, useEffect } from 'react';
import { useTrading } from '../context/TradingContext';
import { calculatePlannedR, evaluateRiskViolations, determineProcessCategory } from '../utils/tradingCalculations';
import { traderDateString, evaluateSessionCheck, minutesInZone, minutesToHhmm, SESSION_TIMEZONE } from '../utils/traderTime';
import { X, AlertTriangle, ShieldCheck, CheckSquare, Square, Calculator } from 'lucide-react';
import { Trade } from '../types';
import { MultiImageDropzone, ImageThumbGrid } from './ImageUploadDropzone';

export const QuickTradeModal: React.FC = () => {
  const {
    quickTradeModalOpen,
    setQuickTradeModalOpen,
    tradingHQ,
    assets,
    addTrade,
    performanceStats,
  } = useTrading();

  const [asset, setAsset] = useState('BTC');
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('LONG');
  const [timeframe, setTimeframe] = useState('15M');
  const [session, setSession] = useState(tradingHQ.sessions[0]?.name || 'New York');
  const [modelId, setModelId] = useState(tradingHQ.executionModels[0]?.id || 'model-slp');
  const [setupGrade, setSetupGrade] = useState('A+');
  const [entryPrice, setEntryPrice] = useState<string>('');
  const [stopPrice, setStopPrice] = useState<string>('');
  const [targetPrice, setTargetPrice] = useState<string>('');
  const [narrative, setNarrative] = useState('');
  const [setupReasoning, setSetupReasoning] = useState('');
  const [screenshots, setScreenshots] = useState<string[]>([]);
  const [chartLink, setChartLink] = useState('');

  // 5 Process Checks
  const [checkSession, setCheckSession] = useState(true);
  const [checkGrade, setCheckGrade] = useState(true);
  const [checkRisk, setCheckRisk] = useState(true);
  const [checkManagement, setCheckManagement] = useState(true);
  const [checkStructure, setCheckStructure] = useState(true);

  // Entry time (device-local in the input). The session and the Session
  // check are derived from it in NY time, so DST and travel can't break them.
  const toLocalInput = (d: Date) => {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
  };
  const [entryLocal, setEntryLocal] = useState(() => toLocalInput(new Date()));
  useEffect(() => {
    if (quickTradeModalOpen) setEntryLocal(toLocalInput(new Date()));
  }, [quickTradeModalOpen]);
  const entryDate = useMemo(() => {
    const d = new Date(entryLocal);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }, [entryLocal]);
  const sessionCheck = useMemo(() => evaluateSessionCheck(tradingHQ.sessions, entryDate, timeframe), [tradingHQ.sessions, entryDate, timeframe]);
  const entryNyLabel = minutesToHhmm(minutesInZone(entryDate, SESSION_TIMEZONE));
  useEffect(() => {
    setSession(sessionCheck.session?.name ?? 'Outside windows');
    setCheckSession(sessionCheck.pass);
  }, [sessionCheck.session?.id, sessionCheck.pass]);

  const numEntry = parseFloat(entryPrice);
  const numStop = parseFloat(stopPrice);
  const numTarget = parseFloat(targetPrice);

  const calculatedR = useMemo(() => {
    if (!isNaN(numEntry) && !isNaN(numStop) && !isNaN(numTarget)) {
      return calculatePlannedR(direction, numEntry, numStop, numTarget);
    }
    return 0;
  }, [direction, numEntry, numStop, numTarget]);

  const violations = useMemo(() => {
    const list = evaluateRiskViolations(
      {
        plannedR: calculatedR,
        setupGrade,
      },
      tradingHQ,
      performanceStats.lossCountToday
    );
    if (sessionCheck.outWindow) {
      list.push(`${timeframe} entry at ${entryNyLabel} NY is outside the session windows. Sub-5M entries are window-restricted (OUT_WINDOW).`);
    }
    return list;
  }, [calculatedR, setupGrade, tradingHQ, performanceStats.lossCountToday, sessionCheck.outWindow, timeframe, entryNyLabel]);

  const processScoreTotal =
    (checkSession ? 1 : 0) +
    (checkGrade ? 1 : 0) +
    (checkRisk ? 1 : 0) +
    (checkManagement ? 1 : 0) +
    (checkStructure ? 1 : 0);

  if (!quickTradeModalOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNaN(numEntry) || isNaN(numStop) || isNaN(numTarget)) {
      alert('Please provide valid Entry, Stop, and Target prices.');
      return;
    }

    if (calculatedR <= 0) {
      alert('Invalid Risk:Reward calculation. Please check your stop and target relative to entry and direction.');
      return;
    }

    const processScore = {
      session: checkSession,
      grade: checkGrade,
      risk: checkRisk,
      management: checkManagement,
      structure: checkStructure,
      score: processScoreTotal,
    };

    const newTrade: Omit<Trade, 'id' | 'timestamp' | 'configVersionUsed'> = {
      date: traderDateString(entryDate),
      entryAt: entryDate.toISOString(),
      asset,
      direction,
      timeframe,
      session,
      modelId,
      setupGrade,
      narrative: narrative.trim() || 'No narrative logged prior to execution.',
      setupReasoning: setupReasoning.trim() || 'Standard institutional setup criteria met.',
      entryPrice: numEntry,
      stopPrice: numStop,
      targetPrice: numTarget,
      plannedR: calculatedR,
      status: 'OPEN',
      processScore,
      violations,
      mistakeCodes: sessionCheck.outWindow ? ['OUT_WINDOW'] : [],
      screenshots: {
        // First image is the entry chart; the rest go to "More charts".
        before: screenshots[0] || undefined,
        additional: screenshots.length > 1
          ? screenshots.slice(1).map((url, i) => ({ id: `add-${Date.now()}-${i}`, url, title: `Chart ${i + 1}` }))
          : undefined,
      },
      notesDuring: '',
      reflectionAfter: '',
    };

    try {
      await addTrade(newTrade);
      setQuickTradeModalOpen(false);
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not save the trade. Your journal has not been changed.');
      return;
    }

    // Reset fields
    setEntryPrice('');
    setStopPrice('');
    setTargetPrice('');
    setNarrative('');
    setSetupReasoning('');
    setScreenshots([]);
    setChartLink('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="bg-panel border border-slate-700 rounded-lg max-w-2xl w-full text-slate-200 shadow-2xl overflow-hidden my-8">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-panel">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-cyan-400" />
            <h2 className="font-mono text-base font-bold tracking-wide text-slate-100 uppercase">
              New execution — discretionary trade log
            </h2>
          </div>
          <button
            onClick={() => setQuickTradeModalOpen(false)}
            className="text-slate-400 hover:text-slate-200 p-1 rounded"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 text-xs">
          {/* Violations Warning Banner */}
          {/* Only warn once there are prices to check (an empty form isn't a rule break). */}
          {violations.length > 0 && !(isNaN(numEntry) || isNaN(numStop) || isNaN(numTarget)) && (
            <div className="p-3 bg-rose-950/40 border border-rose-800/80 rounded flex items-start gap-2.5 text-rose-200 font-mono text-[11px]">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold uppercase tracking-wider text-rose-300">Trading HQ Rule Warnings:</div>
                <ul className="list-disc list-inside mt-0.5 space-y-0.5">
                  {violations.map((v, i) => (
                    <li key={i}>{v}</li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Row 1: Asset, Direction, Timeframe, Session */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block text-slate-400 font-mono mb-1">Asset</label>
              <select
                value={asset}
                onChange={(e) => setAsset(e.target.value)}
                className="w-full bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 outline-none"
              >
                {assets.map((a) => (
                  <option key={a.id} value={a.symbol}>
                    {a.symbol} ({a.name})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Direction</label>
              <div className="grid grid-cols-2 gap-1 bg-raised p-0.5 border border-slate-700 rounded">
                <button
                  type="button"
                  onClick={() => setDirection('LONG')}
                  className={`py-1 rounded font-mono font-bold transition text-center ${
                    direction === 'LONG'
                      ? 'bg-emerald-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Long
                </button>
                <button
                  type="button"
                  onClick={() => setDirection('SHORT')}
                  className={`py-1 rounded font-mono font-bold transition text-center ${
                    direction === 'SHORT'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Short
                </button>
              </div>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Timeframe</label>
              <select
                value={timeframe}
                onChange={(e) => setTimeframe(e.target.value)}
                className="w-full bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 outline-none"
              >
                <option value="1M">1M</option>
                <option value="5M">5M</option>
                <option value="15M">15M</option>
                <option value="1H">1H</option>
                <option value="4H">4H</option>
                <option value="Daily">Daily</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Session (NY time)</label>
              <div
                className={`w-full rounded px-2.5 py-1.5 font-mono border ${
                  sessionCheck.outWindow
                    ? 'bg-rose-950/40 border-rose-800 text-rose-300'
                    : sessionCheck.session
                    ? 'bg-raised border-slate-700 text-cyan-300'
                    : 'bg-raised border-slate-700 text-slate-400'
                }`}
                title="Worked out from the entry time in New York time"
              >
                {sessionCheck.session ? sessionCheck.session.name : 'Outside windows'} · {entryNyLabel} NY
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-400 font-mono mb-1">Entry time (your local time)</label>
              <input
                type="datetime-local"
                value={entryLocal}
                onChange={(e) => setEntryLocal(e.target.value)}
                className="w-full bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 outline-none"
              />
            </div>
            <p className="text-[10px] text-slate-500 font-mono self-end pb-1.5">
              {sessionCheck.restricted
                ? 'Sub-5M entry: must be inside a session window.'
                : `${timeframe} entry: not window-restricted (only sub-5M entries are).`}
            </p>
          </div>

          {/* Row 2: Model, Grade, & Calculated R Display */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-mono mb-1">Execution model</label>
              <select
                value={modelId}
                onChange={(e) => setModelId(e.target.value)}
                className="w-full bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 outline-none"
              >
                {tradingHQ.executionModels.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Setup grade</label>
              <select
                value={setupGrade}
                onChange={(e) => setSetupGrade(e.target.value)}
                className="w-full bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 outline-none"
              >
                {tradingHQ.setupGrades.map((g) => (
                  <option key={g.grade} value={g.grade}>
                    {g.grade} (min {g.minR}R)
                  </option>
                ))}
              </select>
            </div>

            <div className="bg-raised p-2.5 rounded border border-slate-700 flex flex-col justify-center">
              <span className="text-[10px] text-slate-400 font-mono uppercase">Planned R:R ratio</span>
              <div className="flex items-baseline gap-2">
                <span
                  className={`text-xl font-mono font-bold ${
                    calculatedR >= 5.0
                      ? 'text-emerald-400'
                      : calculatedR >= 3.0
                      ? 'text-cyan-400'
                      : calculatedR > 0
                      ? 'text-amber-400'
                      : 'text-slate-500'
                  }`}
                >
                  {calculatedR > 0 ? `${calculatedR}R` : '0.00R'}
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  {calculatedR >= 5 ? 'A+ Grade Threshold Met' : calculatedR >= 3 ? 'Valid (≥3R)' : 'Below 3R minimum'}
                </span>
              </div>
            </div>
          </div>

          {/* Row 3: Prices (Entry, Stop, Target) */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-slate-400 font-mono mb-1">Entry price</label>
              <input
                type="number"
                step="any"
                required
                value={entryPrice}
                onChange={(e) => setEntryPrice(e.target.value)}
                placeholder="e.g. 93450"
                className="w-full bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Stop loss price</label>
              <input
                type="number"
                step="any"
                required
                value={stopPrice}
                onChange={(e) => setStopPrice(e.target.value)}
                placeholder="e.g. 92850"
                className="w-full bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 outline-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Target price</label>
              <input
                type="number"
                step="any"
                required
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                placeholder="e.g. 96450"
                className="w-full bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          {/* Pre-Trade Narrative & Setup Reasoning */}
          <div className="space-y-3">
            <div>
              <label className="block text-slate-400 font-mono mb-1">Current market narrative (before trade)</label>
              <textarea
                rows={2}
                value={narrative}
                onChange={(e) => setNarrative(e.target.value)}
                placeholder="What is price currently doing? Liquidity swept, HTF context, Wyckoff phase..."
                className="w-full bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-sans focus:border-cyan-500 outline-none resize-none"
              />
            </div>

            <div>
              <label className="block text-slate-400 font-mono mb-1">Setup reasoning & evidence</label>
              <input
                type="text"
                value={setupReasoning}
                onChange={(e) => setSetupReasoning(e.target.value)}
                placeholder="Displacement confirmation, FVG retest, volume delta divergence..."
                className="w-full bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-200 font-sans focus:border-cyan-500 outline-none"
              />
            </div>
          </div>

          {/* 5-Part Process Score Checks */}
          <div className="p-3 bg-raised border border-slate-800 rounded">
            <div className="flex items-center justify-between mb-2">
              <span className="font-mono text-slate-300 font-semibold text-[11px] uppercase flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" />
                Process Score Criteria ({processScoreTotal}/5 Checks Passed)
              </span>
              <span className="text-[10px] text-slate-400 font-mono">
                {processScoreTotal >= 4 ? 'PASS: High Process Quality' : 'CAUTION: Process Sub-optimal'}
              </span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {[
                { label: '1. Session', state: checkSession, set: setCheckSession },
                { label: '2. Grade', state: checkGrade, set: setCheckGrade },
                { label: '3. Risk (1%)', state: checkRisk, set: setCheckRisk },
                { label: '4. Management', state: checkManagement, set: setCheckManagement },
                { label: '5. Structure', state: checkStructure, set: setCheckStructure },
              ].map((c, i) => (
                <button
                  type="button"
                  key={i}
                  onClick={() => c.set(!c.state)}
                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded text-[11px] font-mono border transition ${
                    c.state
                      ? 'bg-emerald-950/40 border-emerald-700/80 text-emerald-300'
                      : 'bg-slate-900 border-slate-800 text-slate-500'
                  }`}
                >
                  {c.state ? <CheckSquare className="w-3.5 h-3.5 text-emerald-400" /> : <Square className="w-3.5 h-3.5" />}
                  <span>{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Chart screenshots: several at once; the first is the entry chart */}
          <div className="space-y-2">
            <span className="text-[11px] font-mono font-bold text-slate-300 block">
              SETUP CHART SCREENSHOTS {screenshots.length ? `(${screenshots.length})` : ''}
              <span className="font-normal text-slate-500"> · the first one is saved as the entry chart</span>
            </span>
            <ImageThumbGrid images={screenshots} onRemove={(i) => setScreenshots((prev) => prev.filter((_, j) => j !== i))} />
            <MultiImageDropzone onAdd={(urls) => setScreenshots((prev) => [...prev, ...urls])} />
            <div className="flex gap-2">
              <input
                value={chartLink}
                onChange={(e) => setChartLink(e.target.value)}
                placeholder="Or paste a TradingView snapshot link"
                className="flex-1 bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 font-mono text-xs focus:border-cyan-500 outline-none"
              />
              <button
                type="button"
                disabled={!/^https?:\/\//.test(chartLink.trim())}
                onClick={() => { setScreenshots((prev) => [...prev, chartLink.trim()]); setChartLink(''); }}
                className="px-3 py-1.5 rounded border border-slate-700 text-cyan-300 font-mono text-xs disabled:opacity-40"
              >
                Add link
              </button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => setQuickTradeModalOpen(false)}
              className="px-4 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-mono font-medium transition cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-mono font-bold tracking-wide transition cursor-pointer flex items-center gap-1.5 shadow-sm"
            >
              <span>Commit trade to journal</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
