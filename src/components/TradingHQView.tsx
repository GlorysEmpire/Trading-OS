import React, { useState } from 'react';
import { useTrading } from '../context/TradingContext';
import { Sliders, ShieldCheck, Clock, AlertOctagon, Save, Tag, Info, Layers, History } from 'lucide-react';
import type { HQCategory } from '../lib/hqStore';

function CategoryVersionBadge({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 flex items-center gap-1">
      <History className="w-3 h-3" />v{label}
    </span>
  );
}

export const TradingHQView: React.FC = () => {
  const { tradingHQ, hqLoading, hqError, updateHQCategory } = useTrading();
  const [savingCategory, setSavingCategory] = useState<HQCategory | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Local editable copies, seeded from tradingHQ once loaded.
  const [riskPerSetup, setRiskPerSetup] = useState(tradingHQ.riskRules.riskPerSetupPct);
  const [maxDailyLosses, setMaxDailyLosses] = useState(tradingHQ.riskRules.maxDailyLosses);
  const [noReEntry, setNoReEntry] = useState(tradingHQ.riskRules.noReEntry);
  const [noAdding, setNoAdding] = useState(tradingHQ.riskRules.noAdding);
  const [scratchCountsAsLoss, setScratchCountsAsLoss] = useState(tradingHQ.riskRules.scratchCountsAsLoss);
  const [maxOpenTrades, setMaxOpenTrades] = useState(tradingHQ.riskRules.maxOpenTrades);

  async function saveCategory(category: HQCategory, content: unknown) {
    const reason = window.prompt('Why is this changing? (recorded on the new version, optional)') ?? '';
    setSavingCategory(category);
    setSaveError(null);
    try {
      await updateHQCategory(category, content, reason);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Failed to save');
    } finally {
      setSavingCategory(null);
    }
  }

  const handleSaveRisk = () =>
    saveCategory('risk', {
      riskPerSetupPct: Number(riskPerSetup),
      maxDailyLosses: Number(maxDailyLosses),
      noReEntry,
      noAdding,
      scratchCountsAsLoss,
      ...(maxOpenTrades !== undefined ? { maxOpenTrades: Number(maxOpenTrades) } : {}),
    });

  const editModel = (id: string) => {
    const model = tradingHQ.executionModels.find(m => m.id === id);
    if (!model) return;
    const description = window.prompt(`Description for ${model.name}`, model.description);
    if (description === null) return;
    const criteriaRaw = window.prompt('Key criteria (one per line, can be left blank until confirmed)', model.keyCriteria.join('\n')) ?? '';
    const updated = tradingHQ.executionModels.map(m =>
      m.id === id ? { ...m, description, keyCriteria: criteriaRaw.split('\n').map(c => c.trim()).filter(Boolean) } : m
    );
    saveCategory('execution_model', updated);
  };

  if (hqLoading) {
    return (
      <div className="p-6">
        <p className="text-xs font-mono text-slate-500">Loading Trading HQ…</p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <Sliders className="w-4 h-4" />
            STRATEGIC SOURCE OF TRUTH & METHODOLOGY LAYER
          </div>
          <h2 className="text-xl font-mono font-bold text-slate-100 mt-1">TRADING HQ</h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5 max-w-3xl">
            The trader's strategy is never hardcoded. Every category below is versioned in Supabase — editing a
            category deactivates the current version and writes the next one, so a past trade always knows which
            rule it followed.
          </p>
        </div>
        <CategoryVersionBadge label={tradingHQ.version.replace(/^v/, '')} />
      </div>

      {hqError && <p className="text-sm font-mono text-rose-400">{hqError}</p>}
      {saveError && <p className="text-sm font-mono text-rose-400">{saveError}</p>}

      <div className="p-4 bg-[#141b27] border-l-4 border-cyan-400 rounded-r-lg shadow-sm space-y-1">
        <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs font-bold uppercase tracking-wider">
          <Info className="w-4 h-4 text-cyan-400" />
          MANDATORY WYCKOFF TERMINOLOGY GOVERNANCE: AR = AUTOMATIC REACTION
        </div>
        <p className="text-xs text-slate-300 font-sans leading-relaxed">
          <strong>AR (Automatic Reaction)</strong> is an <em>analytical/event concept</em> that establishes the
          initial boundaries of a developing Wyckoff schematic. It is <strong>NOT</strong> an entry trigger, POI,
          confirmation, execution step, or mandatory sequence requirement.
        </p>
      </div>

      {/* Section 1: Risk Rules */}
      <div className="bg-[#101722] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">1. RISK RULES & DRAWDOWN CONTROLS</h3>
          </div>
          <button
            onClick={handleSaveRisk}
            disabled={savingCategory === 'risk'}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white font-mono text-xs font-bold transition"
          >
            <Save className="w-3.5 h-3.5" />
            {savingCategory === 'risk' ? 'SAVING…' : 'SAVE'}
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="block text-slate-400 mb-1">RISK PER SETUP (%)</label>
            <div className="flex items-center gap-2 bg-[#162130] border border-slate-700 rounded px-3 py-2">
              <input type="number" step="0.1" min="0.1" max="5.0" value={riskPerSetup} onChange={e => setRiskPerSetup(parseFloat(e.target.value) || 1.0)} className="bg-transparent text-slate-100 font-bold w-full outline-none" />
              <span className="text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">MAX DAILY LOSSES</label>
            <div className="flex items-center gap-2 bg-[#162130] border border-slate-700 rounded px-3 py-2">
              <input type="number" min="1" max="5" value={maxDailyLosses} onChange={e => setMaxDailyLosses(parseInt(e.target.value) || 2)} className="bg-transparent text-slate-100 font-bold w-full outline-none" />
              <span className="text-slate-400">losses</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Triggers mandatory daily halt</span>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">MAX OPEN CONCURRENT TRADES</label>
            <div className="flex items-center gap-2 bg-[#162130] border border-slate-700 rounded px-3 py-2">
              <input
                type="number"
                min="1"
                max="5"
                placeholder="Not yet defined"
                value={maxOpenTrades ?? ''}
                onChange={e => setMaxOpenTrades(e.target.value ? parseInt(e.target.value) : undefined)}
                className="bg-transparent text-slate-100 font-bold w-full outline-none placeholder:text-slate-600"
              />
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Leave blank if not yet a formal rule</span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 text-xs font-mono">
          <label className="flex items-center gap-2 p-3 rounded bg-[#162130] border border-slate-800 cursor-pointer">
            <input type="checkbox" checked={noReEntry} onChange={e => setNoReEntry(e.target.checked)} className="accent-cyan-500 w-4 h-4 rounded" />
            <div>
              <span className="text-slate-200 font-bold block">NO RE-ENTRY</span>
              <span className="text-[10px] text-slate-400">No re-entering same idea after stopped out</span>
            </div>
          </label>
          <label className="flex items-center gap-2 p-3 rounded bg-[#162130] border border-slate-800 cursor-pointer">
            <input type="checkbox" checked={noAdding} onChange={e => setNoAdding(e.target.checked)} className="accent-cyan-500 w-4 h-4 rounded" />
            <div>
              <span className="text-slate-200 font-bold block">NO ADDING</span>
              <span className="text-[10px] text-slate-400">Never add to an existing position</span>
            </div>
          </label>
          <label className="flex items-center gap-2 p-3 rounded bg-[#162130] border border-slate-800 cursor-pointer">
            <input type="checkbox" checked={scratchCountsAsLoss} onChange={e => setScratchCountsAsLoss(e.target.checked)} className="accent-cyan-500 w-4 h-4 rounded" />
            <div>
              <span className="text-slate-200 font-bold block">BE / SCRATCH COUNTS AS LOSS</span>
              <span className="text-[10px] text-slate-400">Consumes 1 daily loss ticket</span>
            </div>
          </label>
        </div>
      </div>

      {/* Section 2: Setup Grades */}
      <div className="bg-[#101722] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Tag className="w-4 h-4 text-purple-400" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">2. SETUP GRADES & MINIMUM THRESHOLDS</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {tradingHQ.setupGrades.map((g, idx) => (
            <div key={idx} className="p-3 rounded bg-[#162130] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between font-mono">
                <span className="text-sm font-bold text-slate-100">{g.grade}</span>
                <span className="px-2 py-0.5 rounded bg-cyan-950 border border-cyan-800 text-cyan-300 text-xs font-bold">≥ {g.minR}R</span>
              </div>
              <p className="text-xs text-slate-400 font-sans">{g.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: Execution Models */}
      <div className="bg-[#101722] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-cyan-400" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">3. EXECUTION MODELS ({tradingHQ.executionModels.length})</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tradingHQ.executionModels.map(model => (
            <div key={model.id} className="p-4 rounded bg-[#162130] border border-slate-800 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-sm text-slate-100">{model.name}</span>
                <button onClick={() => editModel(model.id)} className="text-[11px] font-mono text-cyan-300 hover:text-cyan-200">
                  Edit
                </button>
              </div>
              <p className="text-xs text-slate-300 font-sans">{model.description}</p>
              {model.keyCriteria.length > 0 && (
                <div className="pt-2 border-t border-slate-800/80 space-y-1">
                  <span className="text-[10px] font-mono text-slate-400 uppercase">Key Criteria:</span>
                  <ul className="list-disc list-inside text-xs text-slate-400 space-y-0.5">
                    {model.keyCriteria.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Section 4: Sessions */}
      <div className="bg-[#101722] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">4. OPERATIONAL SESSION WINDOWS</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tradingHQ.sessions.map(sess => (
            <div key={sess.id} className="p-4 rounded bg-[#162130] border border-slate-800 space-y-2">
              <span className="font-mono font-bold text-sm text-slate-100">{sess.name}</span>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                <div className="p-2 rounded bg-[#0f1622] border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">NEW YORK TIME:</span>
                  <span className="text-cyan-300 font-semibold">{sess.nyStart} – {sess.nyEnd}</span>
                </div>
                <div className="p-2 rounded bg-[#0f1622] border border-slate-800">
                  <span className="text-slate-400 text-[10px] block">LAGOS TIME:</span>
                  <span className="text-emerald-300 font-semibold">{sess.lagosStart} – {sess.lagosEnd}</span>
                </div>
              </div>
              <div className="text-[11px] font-mono text-slate-400 pt-1">Active: {sess.activeDays.join(', ')}</div>
              {sess.notes && <p className="text-[11px] text-slate-400 font-sans pt-1 border-t border-slate-800/80">{sess.notes}</p>}
            </div>
          ))}
        </div>
      </div>

      {/* Section 5: Mistake Codes */}
      <div className="bg-[#101722] border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <div className="flex items-center gap-2">
            <AlertOctagon className="w-4 h-4 text-amber-400" />
            <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">5. MISTAKE CODE TAXONOMY</h3>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {tradingHQ.mistakeCodes.map(m => (
            <div key={m.code} className="p-3 rounded bg-[#162130] border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="font-mono font-bold text-xs text-amber-400">{m.code}</span>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">{m.category}</span>
              </div>
              <div className="text-xs font-semibold text-slate-200">{m.label}</div>
              <p className="text-[11px] text-slate-400 font-sans">{m.description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
