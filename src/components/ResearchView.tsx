import React, { useState } from 'react';
import { PageTitle } from './PageTitle';
import { useTrading } from '../context/TradingContext';
import {
  Radar,
  Plus,
  CheckCircle2,
  AlertCircle,
  FileText,
  Search,
  ArrowRight,
  Bookmark,
  Sparkles,
  Lock,
} from 'lucide-react';
import { ResearchQuestion } from '../types';

export const ResearchView: React.FC = () => {
  const { tradingHQ, researchQuestions, addResearchQuestion, backtestSamples, setActiveTab, researchLoading, researchError, localResearchImportCount, importLocalResearchQuestions } = useTrading();

  const [showAddModal, setShowAddModal] = useState(false);
  const [code, setCode] = useState(`RQ-0${researchQuestions.length + 1}`);
  const [title, setTitle] = useState('');
  const [hypothesis, setHypothesis] = useState('');
  const [targetSamples, setTargetSamples] = useState(50);
  const [initialAsset, setInitialAsset] = useState('ETH');
  const [scheduledDay, setScheduledDay] = useState('Tuesday');

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !hypothesis.trim()) return;

    try {
      await addResearchQuestion({
        code,
        title: title.trim(),
        hypothesis: hypothesis.trim(),
        targetSamples: Number(targetSamples),
        sampleCount: 0,
        initialAsset,
        scheduledDay,
        status: 'HYPOTHESIS',
        findings: 'Hypothesis registered. Commencing empirical sample collection.',
      });
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Could not save the research question. It has not been registered.');
      return;
    }

    setTitle('');
    setHypothesis('');
    setShowAddModal(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <PageTitle icon={Radar} title="Research" description="Turn observations into rules step by step: observation, hypothesis, backtest, validation, locked rule." />

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold transition shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>New research question</span>
        </button>
        {localResearchImportCount > 0 && (
          <button
            onClick={() => importLocalResearchQuestions().catch(error => alert(error instanceof Error ? error.message : 'Import failed'))}
            className="px-4 py-2 rounded border border-amber-700 text-amber-300 font-mono text-xs font-bold"
          >
            IMPORT {localResearchImportCount} LOCAL RESEARCH QUESTION{localResearchImportCount === 1 ? '' : 'S'}
          </button>
        )}
      </div>

      {/* Scientific Workflow Diagram */}
      <div className="p-3 bg-panel border border-slate-800 rounded-xl flex flex-wrap items-center justify-around gap-2 text-xs font-mono">
        <span className="text-slate-400 font-semibold">1. Observation</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-purple-300 font-semibold">2. Hypothesis</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-cyan-300 font-semibold">3. Backtest ({tradingHQ.researchFramework.minSamples}+ samples)</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-amber-300 font-semibold">4. Validation</span>
        <ArrowRight className="w-3.5 h-3.5 text-slate-600" />
        <span className="text-emerald-400 font-bold flex items-center gap-1">
          <Lock className="w-3 h-3" /> 5. Locked rule (trading HQ)
        </span>
      </div>

      {/* Questions Cards */}
      <div className="space-y-4">
        {researchLoading && <p className="text-xs font-mono text-slate-500">Loading durable research questions…</p>}
        {researchError && <p className="text-xs font-mono text-rose-400">{researchError}</p>}
        {researchQuestions.map((rq) => {
          const pct = Math.min(100, Math.round((rq.sampleCount / rq.targetSamples) * 100));

          return (
            <div key={rq.id} className="bg-panel border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
                <div className="flex items-center gap-3">
                  <span className="px-2.5 py-1 rounded bg-purple-950/80 border border-purple-800 text-purple-300 font-mono text-xs font-bold">
                    {rq.code}
                  </span>
                  <h3 className="font-mono text-sm font-bold text-slate-100">{rq.title}</h3>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    Assigned: {rq.initialAsset}{rq.scheduledDay ? ` · ${rq.scheduledDay}` : ''}
                  </span>
                  <span
                    className={`text-xs font-mono px-2.5 py-0.5 rounded font-bold ${
                      rq.status === 'LOCKED_RULE'
                        ? 'bg-emerald-950 border border-emerald-800 text-emerald-300'
                        : rq.status === 'BACKTEST'
                        ? 'bg-cyan-950 border border-cyan-800 text-cyan-300'
                        : rq.status === 'VALIDATION'
                        ? 'bg-amber-950 border border-amber-800 text-amber-300'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    STATUS: {rq.status}
                  </span>
                </div>
              </div>

              {/* Hypothesis */}
              <div className="bg-canvas p-3 rounded border border-slate-800 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Core hypothesis:</span>
                <p className="text-xs text-slate-200 font-sans leading-relaxed italic">"{rq.hypothesis}"</p>
              </div>

              {/* Sample Progress */}
              <div className="space-y-1.5 font-mono text-xs">
                <div className="flex justify-between text-slate-400">
                  <span>Empirical Samples Progress:</span>
                  <span className="text-purple-300 font-bold">
                    {rq.sampleCount} of {rq.targetSamples} Samples ({pct}%)
                  </span>
                </div>
                <div className="w-full h-2.5 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-purple-600 rounded-full transition-all duration-500"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>

              {/* Findings */}
              <div className="space-y-1 text-xs">
                <span className="text-[10px] font-mono text-slate-400 uppercase font-bold">Preliminary findings & evidence:</span>
                <p className="text-slate-300 font-sans leading-relaxed">{rq.findings}</p>
              </div>

              {/* Action Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-xs font-mono">
                <span className="text-slate-500">Created: {rq.createdAt}</span>
                <button
                  onClick={() => setActiveTab('backtesting')}
                  className="text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-bold cursor-pointer"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Log Samples for {rq.code} in Backtesting</span>
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-panel border border-slate-700 rounded-lg max-w-lg w-full text-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-mono text-sm font-bold text-slate-100 uppercase">Register research question</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs font-mono">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Code</label>
                  <input
                    type="text"
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value)}
                    className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Target sample count</label>
                  <input
                    type="number"
                    required
                    value={targetSamples}
                    onChange={(e) => setTargetSamples(parseInt(e.target.value) || 50)}
                    className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SMT Divergence at Key Liquidity Pools"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Testable hypothesis statement</label>
                <textarea
                  rows={3}
                  required
                  placeholder="If [Condition A] occurs in [Context B], then [Expectation C] will occur with ≥60% win rate..."
                  value={hypothesis}
                  onChange={(e) => setHypothesis(e.target.value)}
                  className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none font-sans"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Initial asset</label>
                  <select
                    value={initialAsset}
                    onChange={(e) => setInitialAsset(e.target.value)}
                    className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  >
                    <option value="ETH">ETH</option>
                    <option value="BTC">BTC</option>
                    <option value="NQ">NQ</option>
                    <option value="XAU">XAU</option>
                    <option value="EUR/USD">EUR/USD</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Scheduled calendar day</label>
                  <input
                    type="text"
                    value={scheduledDay}
                    onChange={(e) => setScheduledDay(e.target.value)}
                    className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-purple-600 hover:bg-purple-500 rounded-lg text-white font-bold"
                >
                  Register Hypothesis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
