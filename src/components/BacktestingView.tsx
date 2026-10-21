import React, { useState } from 'react';
import { useTrading } from '../context/TradingContext';
import {
  Search,
  Plus,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  BarChart2,
  FileSpreadsheet,
  LayoutGrid,
  List,
  Image as ImageIcon,
  Upload,
} from 'lucide-react';
import { BacktestSample } from '../types';
import { calculatePlannedR, calculateRealizedR } from '../utils/tradingCalculations';
import { ImageViewerModal, LightboxImage } from './ImageViewerModal';
import { ImageUploadDropzone } from './ImageUploadDropzone';

export const BacktestingView: React.FC = () => {
  const {
    backtestSamples,
    addBacktestSample,
    updateBacktestSample,
    deleteBacktestSample,
    researchQuestions,
    performanceStats,
    assets,
  } = useTrading();

  const [showAddModal, setShowAddModal] = useState(false);
  const [viewMode, setViewMode] = useState<'list' | 'gallery'>('list');
  const [editingSampleChartId, setEditingSampleChartId] = useState<string | null>(null);

  // Lightbox state
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const openSampleLightbox = (selectedSample: BacktestSample) => {
    // Build lightbox gallery containing all samples that have screenshots, starting at clicked
    const samplesWithImages = backtestSamples.filter((s) => s.screenshot);
    const images: LightboxImage[] = samplesWithImages.map((s) => ({
      url: s.screenshot!,
      title: `${s.asset} ${s.direction} — Backtest Sample (${s.date})`,
      subtitle: `Model: ${s.setupModel} | Market Regime: ${s.marketRegime}`,
      badge: `${s.result} (${s.realizedR && s.realizedR > 0 ? `+${s.realizedR}` : s.realizedR || 0}R)`,
      notes: `${s.narrative}. Evidence: ${s.evidence}. Notes: ${s.notes || 'N/A'}`,
    }));

    const targetIdx = samplesWithImages.findIndex((s) => s.id === selectedSample.id);
    if (images.length > 0) {
      setLightboxImages(images);
      setLightboxIndex(targetIdx >= 0 ? targetIdx : 0);
      setLightboxOpen(true);
    }
  };

  // Form states
  const [asset, setAsset] = useState('');
  React.useEffect(() => {
    if (!asset && assets.length > 0) setAsset(assets[0].symbol);
  }, [asset, assets]);
  const [date, setDate] = useState('2024-11-12');
  const [regime, setRegime] = useState('Range');
  const [narrative, setNarrative] = useState('Phase B range testing AR boundary');
  const [setupModel, setSetupModel] = useState('Wyckoff + ICT');
  const [direction, setDirection] = useState<'LONG' | 'SHORT'>('SHORT');
  const [entryPrice, setEntryPrice] = useState<string>('3150');
  const [stopPrice, setStopPrice] = useState<string>('3175');
  const [targetPrice, setTargetPrice] = useState<string>('3050');
  const [exitPrice, setExitPrice] = useState<string>('3050');
  const [isValidSetup, setIsValidSetup] = useState(true);
  const [evidence, setEvidence] = useState('ST swept AR high with delta divergence on 5M');
  const [rqId, setRqId] = useState(researchQuestions[0]?.id || 'rq-05');
  const [notes, setNotes] = useState('Clean reaction following AR level test');
  const [screenshot, setScreenshot] = useState('');

  const handleAddSample = (e: React.FormEvent) => {
    e.preventDefault();
    const entry = parseFloat(entryPrice);
    const stop = parseFloat(stopPrice);
    const target = parseFloat(targetPrice);
    const exit = parseFloat(exitPrice);

    if (isNaN(entry) || isNaN(stop) || isNaN(target) || isNaN(exit)) {
      alert('Please provide valid numbers for all price fields.');
      return;
    }

    const realizedR = calculateRealizedR(direction, entry, stop, exit);
    const result = realizedR > 0 ? 'WIN' : realizedR < 0 ? 'LOSS' : 'SCRATCH';

    addBacktestSample({
      researchQuestionId: rqId || 'rq-05',
      asset,
      date,
      marketRegime: regime,
      narrative,
      setupModel,
      direction,
      entry,
      stop,
      target,
      result,
      realizedR,
      isValidSetup,
      evidence,
      screenshot: screenshot.trim() || undefined,
      notes: notes.trim() || 'Empirical sample recorded',
    });

    setShowAddModal(false);
  };

  // Backtest stats
  const totalSamples = backtestSamples.length;
  const wins = backtestSamples.filter((s) => s.result === 'WIN').length;
  const btWinRate = totalSamples > 0 ? Math.round((wins / totalSamples) * 100) : 0;
  const totalBtR = backtestSamples.reduce((acc, s) => acc + (s.realizedR || 0), 0);
  const avgBtR = totalSamples > 0 ? Number((totalBtR / totalSamples).toFixed(2)) : 0;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <Search className="w-4 h-4" />
            EMPIRICAL VALIDATION LABORATORY
          </div>
          <h2 className="text-xl font-mono font-bold text-slate-100 mt-1">BACKTESTING WORKSPACE</h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Backtesting shares the exact conceptual schema as live trading: identical fields, direction-aware R, and direct linking to active research questions.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ LOG BACKTEST SAMPLE</span>
        </button>
      </div>

      {/* Analytics Comparison: Live vs Backtest */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs font-mono">
        <div className="p-4 rounded-lg bg-[#101722] border border-slate-800">
          <span className="text-[10px] text-slate-400 block uppercase">BACKTEST SAMPLES</span>
          <div className="text-xl font-bold text-slate-100 mt-1">{totalSamples}</div>
          <span className="text-[10px] text-slate-500">Historical dataset size</span>
        </div>

        <div className="p-4 rounded-lg bg-[#101722] border border-slate-800">
          <span className="text-[10px] text-slate-400 block uppercase">BACKTEST WIN RATE</span>
          <div className="text-xl font-bold text-purple-400 mt-1">{btWinRate}%</div>
          <span className="text-[10px] text-slate-500">vs {performanceStats.winRate}% Live</span>
        </div>

        <div className="p-4 rounded-lg bg-[#101722] border border-slate-800">
          <span className="text-[10px] text-slate-400 block uppercase">CUMULATIVE BACKTEST R</span>
          <div className="text-xl font-bold text-emerald-400 mt-1">+{totalBtR.toFixed(1)}R</div>
          <span className="text-[10px] text-slate-500">vs +{performanceStats.totalR}R Live</span>
        </div>

        <div className="p-4 rounded-lg bg-[#101722] border border-slate-800">
          <span className="text-[10px] text-slate-400 block uppercase">AVG R PER SAMPLE</span>
          <div className="text-xl font-bold text-cyan-400 mt-1">+{avgBtR}R</div>
          <span className="text-[10px] text-slate-500">Expected sample payoff</span>
        </div>
      </div>

      {/* Samples Table / List / Visual Gallery */}
      <div className="bg-[#101722] border border-slate-800 rounded-lg overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-cyan-400" />
            <span className="font-mono text-xs font-bold text-slate-200 uppercase">
              EMPIRICAL SAMPLES LOG ({totalSamples})
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-[11px] font-mono text-slate-400 hidden sm:inline">
              Connected to active research hypotheses
            </span>

            {/* View Mode Toggle: List vs Visual Chart Gallery */}
            <div className="flex items-center bg-[#162130] p-0.5 rounded border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('list')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer ${
                  viewMode === 'list'
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <List className="w-3.5 h-3.5" />
                <span>List View</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode('gallery')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-mono transition cursor-pointer ${
                  viewMode === 'gallery'
                    ? 'bg-cyan-600 text-white font-bold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>Visual Gallery</span>
              </button>
            </div>
          </div>
        </div>

        {/* LIST VIEW */}
        {viewMode === 'list' && (
          <div className="divide-y divide-slate-800/80">
            {backtestSamples.map((s) => (
              <div
                key={s.id}
                className="p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-mono hover:bg-[#131b26] transition"
              >
                <div className="flex items-start gap-3.5">
                  {/* Chart Thumbnail or Upload Trigger */}
                  {s.screenshot ? (
                    <div
                      onClick={() => openSampleLightbox(s)}
                      className="group relative w-16 h-12 rounded overflow-hidden border border-slate-700 bg-black/40 flex-shrink-0 cursor-pointer shadow-sm"
                      title="Click to view chart screenshot in lightbox"
                    >
                      <img
                        src={s.screenshot}
                        alt="Backtest chart"
                        className="w-full h-full object-cover group-hover:scale-105 transition"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                        <ImageIcon className="w-4 h-4 text-white" />
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setEditingSampleChartId(s.id)}
                      className="w-16 h-12 rounded border border-dashed border-slate-700 hover:border-cyan-500 bg-[#162130] flex flex-col items-center justify-center gap-0.5 text-slate-500 hover:text-cyan-300 transition flex-shrink-0 cursor-pointer"
                      title="Attach chart screenshot to sample"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span className="text-[9px] font-mono">+ Chart</span>
                    </button>
                  )}

                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2.5">
                      <span className="text-slate-400 font-bold">{s.date}</span>
                      <span className="font-bold text-slate-100 text-sm">{s.asset}</span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                          s.direction === 'LONG' ? 'bg-emerald-950 text-emerald-300' : 'bg-rose-950 text-rose-300'
                        }`}
                      >
                        {s.direction}
                      </span>
                      <span className="text-slate-300 px-2 py-0.5 rounded bg-slate-800 text-[11px]">
                        {s.setupModel}
                      </span>
                      {s.researchQuestionId && (
                        <span className="text-purple-300 px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800 text-[10px]">
                          {s.researchQuestionId}
                        </span>
                      )}
                    </div>
                    <div className="text-slate-300 font-sans text-xs">
                      <strong className="text-slate-400 font-mono text-[11px]">Narrative: </strong>
                      {s.narrative}
                    </div>
                    <div className="text-slate-400 font-sans text-[11px]">
                      <strong className="text-slate-500 font-mono">Evidence: </strong>
                      {s.evidence}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] text-slate-500 uppercase">REALIZED R</div>
                    <div
                      className={`text-base font-bold ${
                        s.result === 'WIN'
                          ? 'text-emerald-400'
                          : s.result === 'LOSS'
                          ? 'text-rose-400'
                          : 'text-slate-400'
                      }`}
                    >
                      {s.realizedR && s.realizedR > 0 ? `+${s.realizedR}` : s.realizedR}R
                    </div>
                  </div>

                  {s.screenshot && (
                    <button
                      type="button"
                      onClick={() => setEditingSampleChartId(s.id)}
                      className="p-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-slate-200 transition"
                      title="Replace or edit chart screenshot"
                    >
                      <ImageIcon className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <button
                    onClick={() => deleteBacktestSample(s.id)}
                    className="p-1.5 rounded text-slate-500 hover:text-rose-400 transition"
                    title="Delete sample"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VISUAL CHART GALLERY VIEW */}
        {viewMode === 'gallery' && (
          <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {backtestSamples.map((s) => (
              <div
                key={s.id}
                className="rounded-lg border border-slate-800 bg-[#0d131d] overflow-hidden flex flex-col hover:border-slate-700 transition"
              >
                {/* Visual Chart Header Box */}
                <div className="relative w-full h-44 bg-black/50 border-b border-slate-800 flex items-center justify-center overflow-hidden">
                  {s.screenshot ? (
                    <div
                      onClick={() => openSampleLightbox(s)}
                      className="group w-full h-full cursor-pointer relative"
                    >
                      <img
                        src={s.screenshot}
                        alt={`${s.asset} backtest`}
                        className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        referrerPolicy="no-referrer"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/20 opacity-80 group-hover:opacity-60 transition" />
                      <div className="absolute bottom-2 right-2 px-2 py-0.5 rounded bg-black/70 backdrop-blur-sm text-[10px] font-mono text-cyan-300 border border-slate-700 flex items-center gap-1">
                        <ImageIcon className="w-3 h-3" /> Zoom Chart
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 text-center space-y-2">
                      <ImageIcon className="w-7 h-7 text-slate-600 mx-auto" />
                      <p className="text-[11px] font-mono text-slate-400">No chart attached</p>
                      <button
                        type="button"
                        onClick={() => setEditingSampleChartId(s.id)}
                        className="px-2.5 py-1 rounded bg-[#162130] border border-slate-700 text-cyan-400 hover:text-cyan-300 text-xs font-mono transition"
                      >
                        + Upload Screenshot
                      </button>
                    </div>
                  )}

                  {/* Outcome Badge in top right */}
                  <div className="absolute top-2 right-2 flex items-center gap-1.5">
                    <span
                      className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold border shadow-sm ${
                        s.result === 'WIN'
                          ? 'bg-emerald-950/90 border-emerald-700 text-emerald-300'
                          : s.result === 'LOSS'
                          ? 'bg-rose-950/90 border-rose-700 text-rose-300'
                          : 'bg-slate-800 border-slate-700 text-slate-300'
                      }`}
                    >
                      {s.result} ({s.realizedR && s.realizedR > 0 ? `+${s.realizedR}` : s.realizedR}R)
                    </span>
                  </div>

                  {/* Asset & Direction in top left */}
                  <div className="absolute top-2 left-2 flex items-center gap-1.5 font-mono">
                    <span className="px-2 py-0.5 rounded bg-black/75 backdrop-blur-sm text-slate-100 font-bold text-xs border border-slate-700">
                      {s.asset}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                        s.direction === 'LONG'
                          ? 'bg-emerald-900/80 text-emerald-300 border border-emerald-700'
                          : 'bg-rose-900/80 text-rose-300 border border-rose-700'
                      }`}
                    >
                      {s.direction}
                    </span>
                  </div>
                </div>

                {/* Card Body Details */}
                <div className="p-3.5 space-y-2.5 flex-1 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                      <span>{s.date}</span>
                      <span className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{s.setupModel}</span>
                    </div>
                    <p className="text-xs font-sans text-slate-200 line-clamp-2 leading-relaxed">
                      <strong className="font-mono text-slate-400">Narrative: </strong>
                      {s.narrative}
                    </p>
                    <p className="text-[11px] font-sans text-slate-400 line-clamp-2">
                      <strong className="font-mono text-slate-500">Evidence: </strong>
                      {s.evidence}
                    </p>
                  </div>

                  {/* Card Actions */}
                  <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => setEditingSampleChartId(s.id)}
                      className="text-[11px] font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1 cursor-pointer"
                    >
                      <Upload className="w-3 h-3" />
                      <span>{s.screenshot ? 'Replace Chart' : 'Upload Chart'}</span>
                    </button>

                    <button
                      onClick={() => deleteBacktestSample(s.id)}
                      className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer"
                      title="Delete sample"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Sample Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-[#0f141d] border border-slate-700 rounded-lg max-w-xl w-full text-slate-200 p-6 space-y-4 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-mono text-sm font-bold text-slate-100 uppercase">LOG BACKTEST SAMPLE</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSample} className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">DATE</label>
                  <input
                    type="date"
                    required
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">ASSET</label>
                  <select
                    value={asset}
                    onChange={(e) => setAsset(e.target.value)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                  >
                    {assets.length === 0 && <option value="">No configured instruments yet</option>}
                    {assets.map(a => (
                      <option key={a.id} value={a.symbol}>{a.symbol}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">DIRECTION</label>
                  <select
                    value={direction}
                    onChange={(e) => setDirection(e.target.value as any)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                  >
                    <option value="LONG">LONG</option>
                    <option value="SHORT">SHORT</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">MARKET REGIME</label>
                  <input
                    type="text"
                    value={regime}
                    onChange={(e) => setRegime(e.target.value)}
                    placeholder="e.g. Wyckoff Range Phase B"
                    className="w-full bg-[#162130] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">LINKED RESEARCH QUESTION</label>
                  <select
                    value={rqId}
                    onChange={(e) => setRqId(e.target.value)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none text-[11px]"
                  >
                    {researchQuestions.map((rq) => (
                      <option key={rq.id} value={rq.id}>
                        {rq.code} - {rq.title.slice(0, 30)}...
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Prices */}
              <div className="grid grid-cols-4 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1">ENTRY</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(e.target.value)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-2 py-1.5 text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">STOP</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={stopPrice}
                    onChange={(e) => setStopPrice(e.target.value)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-2 py-1.5 text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">TARGET</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={targetPrice}
                    onChange={(e) => setTargetPrice(e.target.value)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-2 py-1.5 text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">EXIT</label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={exitPrice}
                    onChange={(e) => setExitPrice(e.target.value)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-2 py-1.5 text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">NARRATIVE & STRUCTURE</label>
                <textarea
                  rows={2}
                  value={narrative}
                  onChange={(e) => setNarrative(e.target.value)}
                  className="w-full bg-[#162130] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">SETUP EVIDENCE / CONFIRMATION</label>
                <input
                  type="text"
                  value={evidence}
                  onChange={(e) => setEvidence(e.target.value)}
                  className="w-full bg-[#162130] border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 outline-none font-sans"
                />
              </div>

              {/* Chart Screenshot Upload Dropzone */}
              <ImageUploadDropzone
                value={screenshot}
                onChange={setScreenshot}
                label="SAMPLE CHART SCREENSHOT"
                sublabel="Upload, drag & drop, paste screenshot (Ctrl+V), or paste TradingView URL"
                compact={false}
              />

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-white font-bold cursor-pointer"
                >
                  Save Sample
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Quick Chart Edit Modal for Backtest Sample */}
      {editingSampleChartId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f141d] border border-slate-700 rounded-lg max-w-lg w-full text-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <span className="font-mono text-xs font-bold text-slate-100 uppercase flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-cyan-400" />
                Attach / Update Backtest Chart Screenshot
              </span>
              <button
                onClick={() => setEditingSampleChartId(null)}
                className="text-slate-400 hover:text-slate-200 cursor-pointer"
              >
                ✕
              </button>
            </div>

            {(() => {
              const currentSample = backtestSamples.find((s) => s.id === editingSampleChartId);
              if (!currentSample) return null;

              return (
                <div className="space-y-4">
                  <div className="p-2.5 rounded bg-[#162130] border border-slate-800 text-xs font-mono flex items-center justify-between">
                    <div>
                      <span className="text-slate-400 mr-2">{currentSample.date}</span>
                      <strong className="text-slate-100 mr-2">{currentSample.asset}</strong>
                      <span className="text-cyan-400">{currentSample.setupModel}</span>
                    </div>
                    <span className="font-bold text-slate-300">
                      {currentSample.result} ({currentSample.realizedR || 0}R)
                    </span>
                  </div>

                  <ImageUploadDropzone
                    value={currentSample.screenshot || ''}
                    onChange={(newUrl) => {
                      updateBacktestSample(currentSample.id, { screenshot: newUrl });
                    }}
                    label="SAMPLE CHART SCREENSHOT"
                    sublabel="Upload, drag & drop, paste screenshot (Ctrl+V), or paste TradingView URL"
                    compact={false}
                  />

                  <div className="flex justify-end pt-2 border-t border-slate-800">
                    <button
                      type="button"
                      onClick={() => setEditingSampleChartId(null)}
                      className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-white font-mono text-xs font-bold cursor-pointer"
                    >
                      Done
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Lightbox Modal for Backtest Screenshots */}
      <ImageViewerModal
        images={lightboxImages}
        currentIndex={lightboxIndex}
        isOpen={lightboxOpen}
        onClose={() => setLightboxOpen(false)}
        onNavigate={(idx) => setLightboxIndex(idx)}
      />
    </div>
  );
};
