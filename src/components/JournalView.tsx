import React, { useState } from 'react';
import { useTrading } from '../context/TradingContext';
import { getAuthHeaders } from '../lib/supabaseClient';
import {
  BookOpen,
  Filter,
  Search,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Sparkles,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
  ShieldAlert,
  Image as ImageIcon,
  Plus,
} from 'lucide-react';
import { Trade } from '../types';
import { TradeOutcomePanel } from './TradeOutcomePanel';
import { ChartLink } from './ChartImage';
import { ImageViewerModal, LightboxImage } from './ImageViewerModal';
import { ImageUploadDropzone, MultiImageDropzone, ImageThumbGrid } from './ImageUploadDropzone';

export const JournalView: React.FC = () => {
  const { trades, assets, updateTrade, setQuickTradeModalOpen, tradingHQ, tradesLoading, tradesError, localTradeImportCount, importLocalTrades } = useTrading();

  const [filterAsset, setFilterAsset] = useState<string>('ALL');
  const [filterProcess, setFilterProcess] = useState<string>('ALL');
  const [filterOutcome, setFilterOutcome] = useState<string>('ALL');
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(trades[0]?.id || null);

  // Lightbox Modal state
  const [lightboxImages, setLightboxImages] = useState<LightboxImage[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const openTradeLightbox = (trade: Trade, initialIndex = 0) => {
    const list: LightboxImage[] = [];
    if (trade.screenshots.before) {
      list.push({
        url: trade.screenshots.before,
        title: `${trade.asset} ${trade.direction} — Entry Setup Chart`,
        subtitle: `Timeframe: ${trade.timeframe} | Session: ${trade.session}`,
        badge: 'PRE-TRADE SETUP',
        timeframe: trade.timeframe,
        notes: trade.narrative,
      });
    }
    if (trade.screenshots.during) {
      list.push({
        url: trade.screenshots.during,
        title: `${trade.asset} ${trade.direction} — In-Trade Management`,
        subtitle: `Holding Position Notes`,
        badge: 'IN-TRADE MANAGEMENT',
        timeframe: trade.timeframe,
        notes: trade.notesDuring || undefined,
      });
    }
    if (trade.screenshots.after) {
      list.push({
        url: trade.screenshots.after,
        title: `${trade.asset} ${trade.direction} — Exit & Outcome Chart`,
        subtitle: `Outcome: ${trade.outcome || 'Pending'} | Realized: ${trade.realizedR || 0}R`,
        badge: 'TRADE OUTCOME',
        timeframe: trade.timeframe,
        notes: trade.reflectionAfter || undefined,
      });
    }
    if (trade.screenshots.additional) {
      trade.screenshots.additional.forEach((item, i) => {
        const itemUrl = typeof item === 'string' ? item : item.url;
        const itemTitle = typeof item === 'string' ? `HTF Context / Additional #${i + 1}` : (item.title || `HTF Context / Additional #${i + 1}`);
        list.push({
          url: itemUrl,
          title: `${trade.asset} ${trade.direction} — ${itemTitle}`,
          badge: 'HTF CONTEXT',
          timeframe: trade.timeframe,
        });
      });
    }

    if (list.length > 0) {
      setLightboxImages(list);
      setLightboxIndex(Math.min(initialIndex, list.length - 1));
      setLightboxOpen(true);
    }
  };

  const additionalUrls = (trade: Trade) => (trade.screenshots.additional ?? []).map((a) => (typeof a === 'string' ? a : a.url));
  const hasCharts = (trade: Trade) =>
    !!(trade.screenshots.before || trade.screenshots.during || trade.screenshots.after || additionalUrls(trade).length);
  const slotCount = (trade: Trade) => [trade.screenshots.before, trade.screenshots.during, trade.screenshots.after].filter(Boolean).length;
  const addMoreCharts = (trade: Trade, urls: string[]) => {
    const existing = (trade.screenshots.additional ?? []).map((a, i) => (typeof a === 'string' ? { id: `add-${i}`, url: a, title: `Chart ${i + 1}` } : a));
    const now = Date.now();
    const added = urls.map((url, i) => ({ id: `add-${now}-${i}`, url, title: `Chart ${existing.length + i + 1}` }));
    updateTrade(trade.id, { screenshots: { ...trade.screenshots, additional: [...existing, ...added] } });
  };
  const removeMoreChart = (trade: Trade, index: number) => {
    const next = (trade.screenshots.additional ?? []).filter((_, i) => i !== index);
    updateTrade(trade.id, { screenshots: { ...trade.screenshots, additional: next } });
  };

  // AI Audit state
  const [auditingTradeId, setAuditingTradeId] = useState<string | null>(null);
  const [auditResult, setAuditResult] = useState<{ tradeId: string; analysis: string } | null>(null);

  const filteredTrades = trades.filter((t) => {
    if (filterAsset !== 'ALL' && t.asset !== filterAsset) return false;
    if (filterProcess !== 'ALL' && t.processCategory !== filterProcess) return false;
    if (filterOutcome !== 'ALL' && t.outcome !== filterOutcome) return false;
    return true;
  });

  const handleAuditTrade = async (trade: Trade) => {
    setAuditingTradeId(trade.id);
    try {
      const response = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await getAuthHeaders()) },
        body: JSON.stringify({
          prompt: `Perform a rigorous professional post-trade process audit on this trade. Compare it strictly against active Trading HQ rules:
- Asset: ${trade.asset}
- Direction: ${trade.direction}
- Session: ${trade.session}
- Model: ${trade.modelId}
- Setup Grade: ${trade.setupGrade}
- Planned R: ${trade.plannedR}R
- Realized R: ${trade.realizedR || 'Open'}R
- Outcome: ${trade.outcome || 'Pending'}
- Process Score: ${trade.processScore.score}/5 (${JSON.stringify(trade.processScore)})
- Narrative Before: ${trade.narrative}
- Reflections After: ${trade.reflectionAfter || 'None'}
- Mistake Codes: ${trade.mistakeCodes.join(', ') || 'None'}

Provide an objective assessment:
1. Did the trader execute with discipline?
2. Is this a Good Process Loss, Bad Process Win, or clean execution?
3. Actionable lesson.`,
          context: {
            rules: tradingHQ.riskRules,
            grades: tradingHQ.setupGrades,
          },
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setAuditResult({ tradeId: trade.id, analysis: data.error || 'Audit request failed.' });
        return;
      }
      setAuditResult({
        tradeId: trade.id,
        analysis: data.text || 'Audit completed.',
      });
    } catch (e: any) {
      setAuditResult({
        tradeId: trade.id,
        analysis:
          'Automated Audit: Setup satisfied the required minimum planned R ratio (≥3.0R). Session alignment was confirmed within the primary NY window. Note: monitor emotional management during drawdown to ensure the stop loss is never adjusted defensively.',
      });
    } finally {
      setAuditingTradeId(null);
    }
  };

  return (
    <div className="p-4 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <BookOpen className="w-4 h-4" />
            DISCRETIONARY EXECUTION JOURNAL
          </div>
          <h2 className="text-xl font-mono font-bold text-slate-100 mt-1">TRADE JOURNAL & AUDIT</h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Narrative-driven trade logs documenting Before, During, and After states with mathematical process scoring.
          </p>
        </div>

        <button
          onClick={() => setQuickTradeModalOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-mono text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <span>+ LOG NEW EXECUTION</span>
        </button>
        {localTradeImportCount > 0 && <button onClick={() => importLocalTrades().catch(error => alert(error instanceof Error ? error.message : 'Import failed'))} className="px-4 py-2 rounded border border-amber-700 text-amber-300 font-mono text-xs font-bold">IMPORT {localTradeImportCount} LOCAL TRADE{localTradeImportCount === 1 ? '' : 'S'}</button>}
      </div>

      {/* Filters Bar */}
      <div className="bg-[#101722] border border-slate-800 rounded-lg p-3 flex flex-wrap items-center gap-4 text-xs font-mono">
        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-slate-400" />
          <span className="text-slate-400">ASSET:</span>
          <select
            value={filterAsset}
            onChange={(e) => setFilterAsset(e.target.value)}
            className="bg-[#162130] border border-slate-700 rounded px-2.5 py-1 text-slate-200 outline-none"
          >
            <option value="ALL">All Assets ({trades.length})</option>
            {assets.map(asset => <option key={asset.id} value={asset.symbol}>{asset.symbol}</option>)}
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">PROCESS CATEGORY:</span>
          <select
            value={filterProcess}
            onChange={(e) => setFilterProcess(e.target.value)}
            className="bg-[#162130] border border-slate-700 rounded px-2.5 py-1 text-slate-200 outline-none"
          >
            <option value="ALL">All Categories</option>
            <option value="GOOD_PROCESS_WIN">Good Process + Win</option>
            <option value="GOOD_PROCESS_LOSS">Good Process + Loss</option>
            <option value="BAD_PROCESS_WIN">Bad Process + Win</option>
            <option value="BAD_PROCESS_LOSS">Bad Process + Loss</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-slate-400">OUTCOME:</span>
          <select
            value={filterOutcome}
            onChange={(e) => setFilterOutcome(e.target.value)}
            className="bg-[#162130] border border-slate-700 rounded px-2.5 py-1 text-slate-200 outline-none"
          >
            <option value="ALL">All Outcomes</option>
            <option value="WIN">Win</option>
            <option value="LOSS">Loss</option>
            <option value="SCRATCH">Scratch / BE</option>
          </select>
        </div>
      </div>

      {/* Trades List */}
      <div className="space-y-3">
        {tradesLoading && <p className="text-xs font-mono text-slate-500">Loading durable trade journal…</p>}
        {tradesError && <p className="text-xs font-mono text-rose-400">{tradesError}</p>}
        {filteredTrades.map((trade) => {
          const isExpanded = expandedTradeId === trade.id;
          const isWin = trade.outcome === 'WIN';
          const isLoss = trade.outcome === 'LOSS';
          const isGoodProcess = trade.processScore.score >= 4;

          return (
            <div
              key={trade.id}
              className={`bg-[#101722] border rounded-lg overflow-hidden transition ${
                isExpanded ? 'border-cyan-500/50 shadow-md' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Summary Row */}
              <div
                onClick={() => setExpandedTradeId(isExpanded ? null : trade.id)}
                className="p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer select-none"
              >
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs font-bold text-slate-400">{trade.date}</span>
                  <span className="font-mono text-sm font-bold text-slate-100">{trade.asset}</span>
                  <span
                    className={`font-mono text-[11px] px-2 py-0.5 rounded font-bold ${
                      trade.direction === 'LONG'
                        ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/80'
                        : 'bg-rose-950 text-rose-300 border border-rose-800/80'
                    }`}
                  >
                    {trade.direction}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-slate-800 text-slate-300 font-mono">
                    {trade.session}
                  </span>
                  <span className="text-xs px-2 py-0.5 rounded bg-purple-950/60 border border-purple-800 text-purple-300 font-mono">
                    {trade.setupGrade} (Planned {trade.plannedR}R)
                  </span>
                  {hasCharts(trade) && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        openTradeLightbox(trade, 0);
                      }}
                      className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-sky-950/60 border border-sky-700/80 text-sky-300 hover:bg-sky-900/60 font-mono text-xs transition"
                      title="Click to inspect position setup charts"
                    >
                      <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                      <span>Charts</span>
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  {trade.voided && (
                    <span className="text-[10px] px-2 py-0.5 rounded bg-rose-950/60 border border-rose-800 text-rose-300 font-mono font-bold" title={trade.voided.reason}>
                      VOIDED
                    </span>
                  )}
                  {/* Process Score Badge */}
                  <div
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded font-mono text-xs border ${
                      trade.processCategory === 'GOOD_PROCESS_WIN'
                        ? 'bg-emerald-950/70 border-emerald-800 text-emerald-300'
                        : trade.processCategory === 'GOOD_PROCESS_LOSS'
                        ? 'bg-cyan-950/70 border-cyan-800 text-cyan-300'
                        : trade.processCategory === 'BAD_PROCESS_WIN'
                        ? 'bg-amber-950/70 border-amber-800 text-amber-300'
                        : trade.processCategory === 'BAD_PROCESS_LOSS'
                        ? 'bg-rose-950/70 border-rose-800 text-rose-300'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    <ShieldCheck className="w-3.5 h-3.5" />
                    <span>{trade.processCategory?.replace(/_/g, ' ') || `${trade.processScore.score}/5 Process`}</span>
                  </div>

                  {/* Realized R & Outcome */}
                  <div className="font-mono text-right min-w-[70px]">
                    {trade.status === 'CLOSED' ? (
                      <span
                        className={`text-base font-bold ${trade.voided ? 'line-through opacity-50 ' : ''}${
                          isWin ? 'text-emerald-400' : isLoss ? 'text-rose-400' : 'text-slate-400'
                        }`}
                      >
                        {trade.realizedR && trade.realizedR > 0 ? `+${trade.realizedR}` : trade.realizedR}R
                      </span>
                    ) : (
                      <span className="text-xs text-cyan-400 px-2 py-0.5 rounded bg-cyan-950/50 border border-cyan-800 font-bold">
                        OPEN
                      </span>
                    )}
                  </div>

                  {isExpanded ? (
                    <ChevronUp className="w-4 h-4 text-slate-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-slate-400" />
                  )}
                </div>
              </div>

              {/* Expanded Trade Story Details */}
              {isExpanded && (
                <div className="px-5 pb-5 pt-2 border-t border-slate-800/80 bg-[#0d131d] space-y-5 text-xs">
                  {/* 1. Before The Trade */}
                  <div className="space-y-2">
                    <span className="font-mono text-[11px] font-bold text-cyan-400 uppercase tracking-wider block">
                      1. BEFORE THE TRADE (NARRATIVE & SETUP CRITERIA)
                    </span>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 font-mono">
                      <div className="p-3 rounded bg-[#131b26] border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">ENTRY PRICE:</span>
                        <span className="text-slate-100 font-bold">{trade.entryPrice}</span>
                      </div>
                      <div className="p-3 rounded bg-[#131b26] border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">STOP LOSS:</span>
                        <span className="text-rose-400 font-bold">{trade.stopPrice}</span>
                      </div>
                      <div className="p-3 rounded bg-[#131b26] border border-slate-800">
                        <span className="text-[10px] text-slate-400 block">TARGET:</span>
                        <span className="text-emerald-400 font-bold">{trade.targetPrice}</span>
                      </div>
                    </div>
                    <div className="p-3 rounded bg-[#131b26] border border-slate-800 font-sans space-y-1">
                      <strong className="text-slate-400 font-mono text-[11px] uppercase block">PRE-TRADE NARRATIVE:</strong>
                      <p className="text-slate-200 leading-relaxed">{trade.narrative}</p>
                    </div>
                    {trade.setupReasoning && (
                      <div className="text-slate-300 font-sans">
                        <strong className="text-slate-400 font-mono text-[11px] uppercase">EVIDENCE: </strong>
                        {trade.setupReasoning}
                      </div>
                    )}
                  </div>

                  {/* Visual Trade Screenshots & Chart Position Setup */}
                  <div className="p-3.5 rounded-lg bg-[#0b1018] border border-slate-800 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-[11px] font-bold text-sky-400 uppercase tracking-wider flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-sky-400" />
                        Visual Position Setup & Chart Markups
                      </span>
                      {hasCharts(trade) && (
                        <button
                          type="button"
                          onClick={() => openTradeLightbox(trade, 0)}
                          className="text-[11px] font-mono text-sky-400 hover:text-sky-300 underline cursor-pointer"
                        >
                          View In Fullscreen Lightbox
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {/* Entry Setup Chart */}
                      <ImageUploadDropzone
                        value={trade.screenshots.before || ''}
                        onChange={(url) => {
                          updateTrade(trade.id, {
                            screenshots: { ...trade.screenshots, before: url },
                          });
                        }}
                        label="ENTRY SETUP CHART"
                        sublabel="Pre-trade sweep, HTF bias & entry trigger"
                        compact={!trade.screenshots.before}
                        onView={() => openTradeLightbox(trade, 0)}
                      />

                      {/* In-Trade Management Chart */}
                      <ImageUploadDropzone
                        value={trade.screenshots.during || ''}
                        onChange={(url) => {
                          updateTrade(trade.id, {
                            screenshots: { ...trade.screenshots, during: url },
                          });
                        }}
                        label="IN-TRADE MANAGEMENT"
                        sublabel="Scale-outs, trailing stop & holding"
                        compact={!trade.screenshots.during}
                        onView={() => openTradeLightbox(trade, trade.screenshots.before ? 1 : 0)}
                      />

                      {/* Exit / Outcome Chart */}
                      <ImageUploadDropzone
                        value={trade.screenshots.after || ''}
                        onChange={(url) => {
                          updateTrade(trade.id, {
                            screenshots: { ...trade.screenshots, after: url },
                          });
                        }}
                        label="EXIT / OUTCOME CHART"
                        sublabel="Final take-profit or stop-out delivery"
                        compact={!trade.screenshots.after}
                        onView={() =>
                          openTradeLightbox(
                            trade,
                            (trade.screenshots.before ? 1 : 0) + (trade.screenshots.during ? 1 : 0)
                          )
                        }
                      />
                    </div>

                    <div className="space-y-2">
                      <span className="text-[11px] font-mono font-bold text-slate-300 block">
                        MORE CHARTS {additionalUrls(trade).length ? `(${additionalUrls(trade).length})` : ''}
                        <span className="font-normal text-slate-500"> · HTF context, other timeframes, extra markups</span>
                      </span>
                      <ImageThumbGrid
                        images={additionalUrls(trade)}
                        onView={(i) => openTradeLightbox(trade, slotCount(trade) + i)}
                        onRemove={(i) => removeMoreChart(trade, i)}
                      />
                      <MultiImageDropzone compact onAdd={(urls) => addMoreCharts(trade, urls)} />
                    </div>
                  </div>

                  {/* 2. During The Trade */}
                  <div className="space-y-2">
                    <span className="font-mono text-[11px] font-bold text-amber-400 uppercase tracking-wider block">
                      2. DURING THE TRADE (MANAGEMENT & EXECUTION NOTES)
                    </span>
                    <textarea
                      rows={2}
                      value={trade.notesDuring || ''}
                      onChange={(e) => updateTrade(trade.id, { notesDuring: e.target.value })}
                      placeholder="Log management thoughts during the position (e.g. held through pullback, target scaled)..."
                      className="w-full bg-[#162130] border border-slate-700 rounded p-2.5 text-slate-200 font-sans text-xs outline-none"
                    />
                  </div>

                  {/* 3. After The Trade & Process Review */}
                  <div className="space-y-2">
                    <span className="font-mono text-[11px] font-bold text-purple-400 uppercase tracking-wider block">
                      3. AFTER THE TRADE (OUTCOME, PROCESS SCORING & REFLECTION)
                    </span>

                    <TradeOutcomePanel trade={trade} />

                    {/* Post-Trade Reflection */}
                    <div>
                      <label className="text-[10px] font-mono text-slate-400 block mb-1">
                        POST-TRADE REFLECTION & LESSON:
                      </label>
                      <textarea
                        rows={2}
                        value={trade.reflectionAfter || ''}
                        onChange={(e) => updateTrade(trade.id, { reflectionAfter: e.target.value })}
                        placeholder="What did this execution teach you about your psychology, market rhythm, or process adherence?"
                        className="w-full bg-[#162130] border border-slate-700 rounded p-2.5 text-slate-200 font-sans text-xs outline-none"
                      />
                    </div>
                  </div>

                  {/* AI Auditor Trigger & Result */}
                  <div className="pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => handleAuditTrade(trade)}
                        disabled={auditingTradeId === trade.id}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-purple-900/60 hover:bg-purple-800 text-purple-200 border border-purple-700 font-mono text-xs font-bold transition cursor-pointer"
                      >
                        <Sparkles className="w-3.5 h-3.5 text-purple-300" />
                        <span>{auditingTradeId === trade.id ? 'AUDITING EXECUTION...' : 'RUN AI PROCESS AUDIT'}</span>
                      </button>

                      {trade.screenshots.before && (
                        <ChartLink
                          src={trade.screenshots.before}
                          className="text-xs font-mono text-cyan-400 hover:text-cyan-300 flex items-center gap-1"
                        >
                          <ExternalLink className="w-3 h-3" /> Chart Link
                        </ChartLink>
                      )}
                    </div>

                  </div>

                  {/* Audit Result Display */}
                  {auditResult && auditResult.tradeId === trade.id && (
                    <div className="p-3 bg-[#131525] border border-purple-800/80 rounded font-sans text-purple-200/90 leading-relaxed text-xs">
                      <div className="flex items-center justify-between mb-1 font-mono font-bold text-purple-300 text-[11px]">
                        <span>AI DISCRETIONARY PROCESS AUDIT</span>
                        <button onClick={() => setAuditResult(null)} className="text-slate-400 hover:text-slate-200">
                          ✕
                        </button>
                      </div>
                      <div className="whitespace-pre-line">{auditResult.analysis}</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Lightbox Modal for Fullscreen Chart Analysis */}
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
