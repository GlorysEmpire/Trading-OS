import React, { useState } from 'react';
import { PageTitle } from './PageTitle';
import { useTrading } from '../context/TradingContext';
import { Sliders, ShieldCheck, Clock, AlertOctagon, Save, Tag, Info, Layers, History, Plus, Trash2, ListChecks, FlaskConical, CalendarDays } from 'lucide-react';
import type { HQCategory } from '../lib/hqStore';
import { REAL_SESSIONS, defaultContent } from '../lib/hqStore';
import { deviceTimeZone, nyTimeIn } from '../utils/traderTime';
import type { ExecutionModel, FocusDay, MistakeCode, SessionWindow, SetupGradeRule } from '../types';

function CategoryVersionBadge({ label }: { label: string }) {
  return (
    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-cyan-300 flex items-center gap-1">
      <History className="w-3 h-3" />v{label}
    </span>
  );
}

/** Small shared input styling so every editable field in this view looks
 * consistent without repeating the class string everywhere. */
const fieldClass =
  'bg-raised border border-slate-700 rounded px-2.5 py-1.5 text-slate-100 text-xs font-mono outline-none focus:border-cyan-600 w-full';
const textareaClass = `${fieldClass} font-sans resize-none`;

function SectionHeader({
  icon,
  title,
  onSave,
  saving,
  extra,
}: {
  icon: React.ReactNode;
  title: string;
  onSave?: () => void;
  saving?: boolean;
  extra?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between border-b border-slate-800 pb-2 flex-wrap gap-2">
      <div className="flex items-center gap-2">
        {icon}
        <h3 className="font-mono text-xs font-bold uppercase tracking-wider text-slate-200">{title}</h3>
      </div>
      <div className="flex items-center gap-2">
        {extra}
        {onSave && (
          <button
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-semibold transition"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? 'SAVING…' : 'SAVE'}
          </button>
        )}
      </div>
    </div>
  );
}

export const TradingHQView: React.FC = () => {
  const { tradingHQ, hqLoading, hqError, updateHQCategory } = useTrading();
  const [savingCategory, setSavingCategory] = useState<HQCategory | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Local editable copies, seeded from tradingHQ once loaded. Every category
  // here is just a reference list or a rules object the trader fills in —
  // none of it is hardcoded logic. What ships as the DEFAULT content (the
  // Wyckoff+ICT/SLP methodology, the London/NY/Afternoon/Tokyo sessions,
  // etc.) is one trader's real strategy, kept as the starting point for a
  // new account — but every field below can be edited, added to, or
  // removed so a different trader's methodology fits just as naturally.

  // ---- Section 1: Risk Rules ----
  const [riskPerSetup, setRiskPerSetup] = useState(tradingHQ.riskRules.riskPerSetupPct);
  const [maxDailyLosses, setMaxDailyLosses] = useState(tradingHQ.riskRules.maxDailyLosses);
  const [noReEntry, setNoReEntry] = useState(tradingHQ.riskRules.noReEntry);
  const [noAdding, setNoAdding] = useState(tradingHQ.riskRules.noAdding);
  const [scratchCountsAsLoss, setScratchCountsAsLoss] = useState(tradingHQ.riskRules.scratchCountsAsLoss);
  const [maxOpenTrades, setMaxOpenTrades] = useState(tradingHQ.riskRules.maxOpenTrades);

  // ---- Section 2: Setup Grades ----
  const [setupGrades, setSetupGrades] = useState<SetupGradeRule[]>(tradingHQ.setupGrades);

  // ---- Section 3: Execution Models ----
  const [executionModels, setExecutionModels] = useState<ExecutionModel[]>(tradingHQ.executionModels);

  // ---- Section 4: Sessions ----
  const [sessions, setSessions] = useState<SessionWindow[]>(tradingHQ.sessions);

  // ---- Section 5: Mistake Codes ----
  const [mistakeCodes, setMistakeCodes] = useState<MistakeCode[]>(tradingHQ.mistakeCodes);

  // ---- Section 6: Process Checklist ----
  // Labels only — the trade-logging form (Quick Trade / Journal) always
  // scores exactly 5 checks under the hood (ProcessScore has 5 fixed
  // boolean fields), so this list stays at 5 entries; renaming them here
  // changes how they read everywhere else they're shown.
  const [processChecks, setProcessChecks] = useState<string[]>(tradingHQ.processChecks);

  // ---- Section 8: Focus Rotation ----
  const [focusRotation, setFocusRotation] = useState<FocusDay[]>(tradingHQ.focusRotation);
  const updateFocusDay = (idx: number, patch: Partial<FocusDay>) =>
    setFocusRotation((prev) => prev.map((d, i) => (i === idx ? { ...d, ...patch } : d)));
  const handleSaveFocusRotation = () => saveCategory('focus_rotation', focusRotation);

  // Default mistake codes this account doesn't have yet (e.g. UNTESTED_MODEL,
  // added to the defaults after the account was created).
  const missingDefaultCodes = defaultContent<MistakeCode[]>('mistake_code').filter((d) => !mistakeCodes.some((m) => m.code === d.code));

  const localTz = deviceTimeZone();
  const localTzLabel = localTz.split('/').pop()?.replace(/_/g, ' ') ?? localTz;

  // ---- Section 7: Research Framework ----
  const [minSamples, setMinSamples] = useState(tradingHQ.researchFramework.minSamples);
  const [researchNotes, setResearchNotes] = useState(tradingHQ.researchFramework.notes);

  async function saveCategory(category: HQCategory, content: unknown, reasonPrompt = true) {
    const reason = reasonPrompt ? window.prompt('Why is this changing? (recorded on the new version, optional)') ?? '' : '';
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

  const handleSaveSetupGrades = () => saveCategory('setup_quality', setupGrades);
  const addSetupGrade = () => setSetupGrades((prev) => [...prev, { grade: 'New Grade', minR: 1, description: '' }]);
  const removeSetupGrade = (idx: number) => setSetupGrades((prev) => prev.filter((_, i) => i !== idx));
  const updateSetupGrade = (idx: number, patch: Partial<SetupGradeRule>) =>
    setSetupGrades((prev) => prev.map((g, i) => (i === idx ? { ...g, ...patch } : g)));

  const handleSaveExecutionModels = () => saveCategory('execution_model', executionModels);
  const addExecutionModel = () =>
    setExecutionModels((prev) => [...prev, { id: `model-${Date.now()}`, name: 'New Model', description: '', keyCriteria: [] }]);
  const removeExecutionModel = (id: string) => setExecutionModels((prev) => prev.filter((m) => m.id !== id));
  const updateExecutionModel = (id: string, patch: Partial<ExecutionModel>) =>
    setExecutionModels((prev) => prev.map((m) => (m.id === id ? { ...m, ...patch } : m)));

  const handleSaveSessions = () => saveCategory('session', sessions);
  const resetSessionsToStandard = () => {
    setSessions(REAL_SESSIONS);
    saveCategory('session', REAL_SESSIONS, false);
  };
  const addSession = () =>
    setSessions((prev) => [
      ...prev,
      {
        id: `sess-${Date.now()}`,
        name: 'New Session',
        nyStart: '00:00',
        nyEnd: '00:00',
        activeDays: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
        notes: '',
      },
    ]);
  const removeSession = (id: string) => setSessions((prev) => prev.filter((s) => s.id !== id));
  const updateSession = (id: string, patch: Partial<SessionWindow>) =>
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, ...patch } : s)));

  const handleSaveMistakeCodes = () => saveCategory('mistake_code', mistakeCodes);
  const addMistakeCode = () =>
    setMistakeCodes((prev) => [...prev, { code: 'NEW_CODE', label: 'New mistake', category: 'EXECUTION', description: '' }]);
  const removeMistakeCode = (idx: number) => setMistakeCodes((prev) => prev.filter((_, i) => i !== idx));
  const updateMistakeCode = (idx: number, patch: Partial<MistakeCode>) =>
    setMistakeCodes((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

  const handleSaveProcessChecks = () => saveCategory('process_score', processChecks);
  const updateProcessCheck = (idx: number, value: string) =>
    setProcessChecks((prev) => prev.map((c, i) => (i === idx ? value : c)));

  const handleSaveResearchFramework = () =>
    saveCategory('research_framework', {
      workflow: tradingHQ.researchFramework.workflow,
      minSamples: Number(minSamples),
      notes: researchNotes,
    });

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
        <PageTitle icon={Sliders} title="Trading HQ" description="Your rulebook: risk, grades, sessions, mistake codes and focus rotation. Every change is saved as a new version, so past trades keep the rules they were taken under." />
        <CategoryVersionBadge label={tradingHQ.version.replace(/^v/, '')} />
      </div>

      {hqError && <p className="text-sm font-mono text-rose-400">{hqError}</p>}
      {saveError && <p className="text-sm font-mono text-rose-400">{saveError}</p>}

      <div className="p-4 bg-panel border-l-4 border-cyan-400 rounded-r-lg shadow-sm space-y-1">
        <div className="flex items-center gap-2 text-cyan-300 font-mono text-xs font-bold uppercase tracking-wider">
          <Info className="w-4 h-4 text-cyan-400" />
          Mandatory Wyckoff terminology governance: AR = automatic reaction
        </div>
        <p className="text-xs text-slate-300 font-sans leading-relaxed">
          <strong>AR (Automatic Reaction)</strong> is an <em>analytical/event concept</em> that establishes the
          initial boundaries of a developing Wyckoff schematic. It is <strong>NOT</strong> an entry trigger, POI,
          confirmation, execution step, or mandatory sequence requirement. This note documents the default
          methodology's own terminology — it's not enforced on a different strategy's execution models below.
        </p>
      </div>

      {/* Section 1: Risk Rules */}
      <div className="bg-panel border border-slate-800 rounded-xl p-5 space-y-4">
        <SectionHeader
          icon={<ShieldCheck className="w-4 h-4 text-emerald-400" />}
          title="1. RISK RULES & DRAWDOWN CONTROLS"
          onSave={handleSaveRisk}
          saving={savingCategory === 'risk'}
        />

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs font-mono">
          <div>
            <label className="block text-slate-400 mb-1">Risk per setup (%)</label>
            <div className="flex items-center gap-2 bg-raised border border-slate-700 rounded px-3 py-2">
              <input type="number" step="0.1" min="0.1" max="5.0" value={riskPerSetup} onChange={e => setRiskPerSetup(parseFloat(e.target.value) || 1.0)} className="bg-transparent text-slate-100 font-bold w-full outline-none" />
              <span className="text-slate-400">%</span>
            </div>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Max daily losses</label>
            <div className="flex items-center gap-2 bg-raised border border-slate-700 rounded px-3 py-2">
              <input type="number" min="1" max="5" value={maxDailyLosses} onChange={e => setMaxDailyLosses(parseInt(e.target.value) || 2)} className="bg-transparent text-slate-100 font-bold w-full outline-none" />
              <span className="text-slate-400">losses</span>
            </div>
            <span className="text-[10px] text-slate-500 mt-1 block">Triggers mandatory daily halt</span>
          </div>
          <div>
            <label className="block text-slate-400 mb-1">Max open concurrent trades</label>
            <div className="flex items-center gap-2 bg-raised border border-slate-700 rounded px-3 py-2">
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
          <label className="flex items-center gap-2 p-3 rounded bg-raised border border-slate-800 cursor-pointer">
            <input type="checkbox" checked={noReEntry} onChange={e => setNoReEntry(e.target.checked)} className="accent-cyan-500 w-4 h-4 rounded" />
            <div>
              <span className="text-slate-200 font-bold block">No re-entry</span>
              <span className="text-[10px] text-slate-400">No re-entering same idea after stopped out</span>
            </div>
          </label>
          <label className="flex items-center gap-2 p-3 rounded bg-raised border border-slate-800 cursor-pointer">
            <input type="checkbox" checked={noAdding} onChange={e => setNoAdding(e.target.checked)} className="accent-cyan-500 w-4 h-4 rounded" />
            <div>
              <span className="text-slate-200 font-bold block">No adding</span>
              <span className="text-[10px] text-slate-400">Never add to an existing position</span>
            </div>
          </label>
          <label className="flex items-center gap-2 p-3 rounded bg-raised border border-slate-800 cursor-pointer">
            <input type="checkbox" checked={scratchCountsAsLoss} onChange={e => setScratchCountsAsLoss(e.target.checked)} className="accent-cyan-500 w-4 h-4 rounded" />
            <div>
              <span className="text-slate-200 font-bold block">BE / scratch counts as loss</span>
              <span className="text-[10px] text-slate-400">Consumes 1 daily loss ticket</span>
            </div>
          </label>
        </div>
      </div>

      {/* Section 2: Setup Grades */}
      <div className="bg-panel border border-slate-800 rounded-xl p-5 space-y-4">
        <SectionHeader
          icon={<Tag className="w-4 h-4 text-purple-400" />}
          title="2. SETUP GRADES & MINIMUM THRESHOLDS"
          onSave={handleSaveSetupGrades}
          saving={savingCategory === 'setup_quality'}
          extra={
            <button onClick={addSetupGrade} className="flex items-center gap-1 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 border border-slate-700 rounded px-2 py-1">
              <Plus className="w-3 h-3" /> Add grade
            </button>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {setupGrades.map((g, idx) => (
            <div key={idx} className="p-3 rounded bg-raised border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={g.grade}
                  onChange={(e) => updateSetupGrade(idx, { grade: e.target.value })}
                  className={`${fieldClass} font-bold text-sm`}
                  placeholder="Grade name"
                />
                <button onClick={() => removeSetupGrade(idx)} className="text-slate-500 hover:text-rose-400 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono text-slate-500 uppercase shrink-0">Min R</span>
                <input
                  type="number"
                  step="0.5"
                  value={g.minR}
                  onChange={(e) => updateSetupGrade(idx, { minR: parseFloat(e.target.value) || 0 })}
                  className={fieldClass}
                />
              </div>
              <div className="flex items-center gap-2" title="Earliest R at which breakeven is allowed for this grade. A structural reason is always allowed; anything earlier is BE_EARLY.">
                <span className="text-[10px] font-mono text-slate-500 uppercase shrink-0">BE from R</span>
                <input
                  type="number"
                  step="0.5"
                  value={g.breakevenAtR ?? ''}
                  placeholder="no rule"
                  onChange={(e) => updateSetupGrade(idx, { breakevenAtR: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                  className={fieldClass}
                />
              </div>
              <textarea
                value={g.description}
                onChange={(e) => updateSetupGrade(idx, { description: e.target.value })}
                className={textareaClass}
                rows={3}
                placeholder="What qualifies a trade for this grade"
              />
            </div>
          ))}
          {setupGrades.length === 0 && (
            <p className="text-xs text-slate-500 font-sans col-span-full">No setup grades yet — add one above.</p>
          )}
        </div>
      </div>

      {/* Section 3: Execution Models */}
      <div className="bg-panel border border-slate-800 rounded-xl p-5 space-y-4">
        <SectionHeader
          icon={<Layers className="w-4 h-4 text-cyan-400" />}
          title={`3. EXECUTION MODELS (${executionModels.length})`}
          onSave={handleSaveExecutionModels}
          saving={savingCategory === 'execution_model'}
          extra={
            <button onClick={addExecutionModel} className="flex items-center gap-1 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 border border-slate-700 rounded px-2 py-1">
              <Plus className="w-3 h-3" /> Add model
            </button>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {executionModels.map((model) => (
            <div key={model.id} className="p-4 rounded bg-raised border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={model.name}
                  onChange={(e) => updateExecutionModel(model.id, { name: e.target.value })}
                  className={`${fieldClass} font-bold text-sm`}
                  placeholder="Model name"
                />
                <button onClick={() => removeExecutionModel(model.id)} className="text-slate-500 hover:text-rose-400 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <textarea
                value={model.description}
                onChange={(e) => updateExecutionModel(model.id, { description: e.target.value })}
                className={textareaClass}
                rows={3}
                placeholder="Definition and entry criteria"
              />
              <div className="pt-1 space-y-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Key Criteria (one per line):</span>
                <textarea
                  key={`${model.id}-${model.keyCriteria.join('|')}`}
                  defaultValue={model.keyCriteria.join('\n')}
                  onBlur={(e) =>
                    updateExecutionModel(model.id, {
                      keyCriteria: e.target.value.split('\n').map((c) => c.trim()).filter(Boolean),
                    })
                  }
                  className={textareaClass}
                  rows={3}
                  placeholder="One criterion per line"
                />
              </div>
            </div>
          ))}
          {executionModels.length === 0 && (
            <p className="text-xs text-slate-500 font-sans col-span-full">No execution models yet — add one above.</p>
          )}
        </div>
      </div>

      {/* Section 4: Sessions */}
      <div className="bg-panel border border-slate-800 rounded-xl p-5 space-y-4">
        <SectionHeader
          icon={<Clock className="w-4 h-4 text-emerald-400" />}
          title="4. OPERATIONAL SESSION WINDOWS"
          onSave={handleSaveSessions}
          saving={savingCategory === 'session'}
          extra={
            <>
              <button onClick={addSession} className="flex items-center gap-1 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 border border-slate-700 rounded px-2 py-1">
                <Plus className="w-3 h-3" /> Add session
              </button>
              <button
                onClick={resetSessionsToStandard}
                disabled={savingCategory === 'session'}
                className="text-[10px] font-mono text-cyan-300 hover:text-cyan-200 border border-slate-700 rounded px-2 py-1"
                title="Reset to the default 4-session day in NY time: London 00–05, New York 05–12, Afternoon 12–18, Tokyo 18–00"
              >
                {savingCategory === 'session' ? 'SAVING…' : 'Reset to default sessions'}
              </button>
            </>
          }
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {sessions.map((sess) => (
            <div key={sess.id} className="p-4 rounded bg-raised border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={sess.name}
                  onChange={(e) => updateSession(sess.id, { name: e.target.value })}
                  className={`${fieldClass} font-bold text-sm`}
                  placeholder="Session name"
                />
                <button onClick={() => removeSession(sess.id)} className="text-slate-500 hover:text-rose-400 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs font-mono pt-1">
                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px] block">New York time (source of truth):</span>
                  <div className="flex items-center gap-1">
                    <input value={sess.nyStart} onChange={(e) => updateSession(sess.id, { nyStart: e.target.value })} className={`${fieldClass} text-cyan-300`} placeholder="HH:MM" />
                    <span className="text-slate-500">–</span>
                    <input value={sess.nyEnd} onChange={(e) => updateSession(sess.id, { nyEnd: e.target.value })} className={`${fieldClass} text-cyan-300`} placeholder="HH:MM" />
                  </div>
                </div>
                <div className="space-y-1">
                  <span className="text-slate-400 text-[10px] block">{localTzLabel.toUpperCase()} TIME TODAY:</span>
                  <div className="px-2.5 py-1.5 rounded border border-slate-800 bg-well text-emerald-300" title="Derived from NY time with today's daylight-saving offsets; changes automatically when US clocks change">
                    {nyTimeIn(sess.nyStart, localTz)} – {nyTimeIn(sess.nyEnd, localTz)}
                  </div>
                </div>
              </div>
              <div className="space-y-1 pt-1">
                <span className="text-[10px] font-mono text-slate-400 uppercase">Active Days (comma-separated)</span>
                <input
                  key={`${sess.id}-${sess.activeDays.join(',')}`}
                  defaultValue={sess.activeDays.join(', ')}
                  onBlur={(e) => updateSession(sess.id, { activeDays: e.target.value.split(',').map((d) => d.trim()).filter(Boolean) })}
                  className={fieldClass}
                  placeholder="Monday, Tuesday, …"
                />
              </div>
              <textarea
                value={sess.notes ?? ''}
                onChange={(e) => updateSession(sess.id, { notes: e.target.value })}
                className={`${textareaClass} mt-1`}
                rows={2}
                placeholder="Notes (e.g. timeframe restrictions)"
              />
            </div>
          ))}
          {sessions.length === 0 && (
            <p className="text-xs text-slate-500 font-sans col-span-full">No sessions yet — add one above.</p>
          )}
        </div>
      </div>

      {/* Section 5: Mistake Codes */}
      <div className="bg-panel border border-slate-800 rounded-xl p-5 space-y-4">
        <SectionHeader
          icon={<AlertOctagon className="w-4 h-4 text-amber-400" />}
          title="5. MISTAKE CODE TAXONOMY"
          onSave={handleSaveMistakeCodes}
          saving={savingCategory === 'mistake_code'}
          extra={
            <button onClick={addMistakeCode} className="flex items-center gap-1 text-[11px] font-mono text-cyan-300 hover:text-cyan-200 border border-slate-700 rounded px-2 py-1">
              <Plus className="w-3 h-3" /> Add code
            </button>
          }
        />
        {missingDefaultCodes.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-2.5 rounded border border-cyan-900/60 bg-cyan-950/20 text-[11px] font-mono">
            <span className="text-cyan-300">In the defaults but not in your list:</span>
            {missingDefaultCodes.map((d) => (
              <button
                key={d.code}
                onClick={() => setMistakeCodes((prev) => [...prev, d])}
                title={d.description}
                className="flex items-center gap-1 px-2 py-0.5 rounded border border-slate-700 text-slate-200 hover:text-cyan-200"
              >
                <Plus className="w-3 h-3" /> {d.code}
              </button>
            ))}
            <span className="text-slate-500">Adding fills the form; press SAVE to version it.</span>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {mistakeCodes.map((m, idx) => (
            <div key={idx} className="p-3 rounded bg-raised border border-slate-800 space-y-2">
              <div className="flex items-center gap-2">
                <input
                  value={m.code}
                  onChange={(e) => updateMistakeCode(idx, { code: e.target.value.toUpperCase().replace(/\s+/g, '_') })}
                  className={`${fieldClass} font-bold text-amber-400`}
                  placeholder="CODE_NAME"
                />
                <button onClick={() => removeMistakeCode(idx)} className="text-slate-500 hover:text-rose-400 shrink-0">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
              <select
                value={m.category}
                onChange={(e) => updateMistakeCode(idx, { category: e.target.value as MistakeCode['category'] })}
                className={fieldClass}
              >
                <option value="MANAGEMENT">Management</option>
                <option value="EXECUTION">Execution</option>
                <option value="PSYCHOLOGY">Psychology</option>
                <option value="RISK">Risk</option>
              </select>
              <input
                value={m.label}
                onChange={(e) => updateMistakeCode(idx, { label: e.target.value })}
                className={`${fieldClass} font-sans`}
                placeholder="Short label"
              />
              <textarea
                value={m.description}
                onChange={(e) => updateMistakeCode(idx, { description: e.target.value })}
                className={textareaClass}
                rows={2}
                placeholder="What this mistake means"
              />
            </div>
          ))}
          {mistakeCodes.length === 0 && (
            <p className="text-xs text-slate-500 font-sans col-span-full">No mistake codes yet — add one above.</p>
          )}
        </div>
      </div>

      {/* Section 6: Process Checklist */}
      <div className="bg-panel border border-slate-800 rounded-xl p-5 space-y-4">
        <SectionHeader
          icon={<ListChecks className="w-4 h-4 text-cyan-400" />}
          title="6. PROCESS CHECKLIST"
          onSave={handleSaveProcessChecks}
          saving={savingCategory === 'process_score'}
        />
        <p className="text-[11px] text-slate-400 font-sans">
          Every logged trade is scored against exactly these 5 checks — you can rename them to match your own
          process, but the trade-logging form always captures 5, so the list stays at 5 entries.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
          {processChecks.map((check, idx) => (
            <div key={idx} className="space-y-1">
              <span className="text-[10px] font-mono text-slate-500">CHECK {idx + 1}</span>
              <input value={check} onChange={(e) => updateProcessCheck(idx, e.target.value)} className={`${fieldClass} font-bold`} />
            </div>
          ))}
        </div>
      </div>

      {/* Section 7: Research Framework */}
      <div className="bg-panel border border-slate-800 rounded-xl p-5 space-y-4">
        <SectionHeader
          icon={<FlaskConical className="w-4 h-4 text-purple-400" />}
          title="7. RESEARCH FRAMEWORK"
          onSave={handleSaveResearchFramework}
          saving={savingCategory === 'research_framework'}
        />
        <div className="flex flex-wrap gap-2 text-[11px] font-mono">
          {tradingHQ.researchFramework.workflow.map((stage, i) => (
            <span key={stage} className="px-2 py-1 rounded bg-raised border border-slate-800 text-slate-300">
              {i + 1}. {stage}
            </span>
          ))}
        </div>
        <p className="text-[11px] text-slate-500 font-sans">
          The workflow stages above mirror the Research Engine's own stage names and aren't editable here — the
          sample-size standard and notes below are.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label className="block text-slate-400 mb-1 text-xs font-mono">Min. Samples for a finding</label>
            <input
              type="number"
              min="1"
              value={minSamples}
              onChange={(e) => setMinSamples(parseInt(e.target.value) || 1)}
              className={fieldClass}
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-slate-400 mb-1 text-xs font-mono">Notes</label>
            <textarea value={researchNotes} onChange={(e) => setResearchNotes(e.target.value)} className={textareaClass} rows={2} />
          </div>
        </div>
      </div>

      {/* Section 8: Focus Rotation */}
      <div className="bg-panel border border-slate-800 rounded-xl p-5 space-y-4">
        <SectionHeader
          icon={<CalendarDays className="w-4 h-4 text-cyan-400" />}
          title="8. WEEKLY FOCUS ROTATION"
          onSave={handleSaveFocusRotation}
          saving={savingCategory === 'focus_rotation'}
        />
        <p className="text-[11px] text-slate-400 font-sans">
          Which assets get focused study, scalping attention and backtesting on each day. This drives the weekly watchlist.
          It's a focus, not a restriction: a qualified setup on another asset can still be traded.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono min-w-[520px]">
            <thead>
              <tr className="text-[10px] text-slate-500 text-left border-b border-slate-800">
                <th className="py-1.5 font-normal w-28">DAY</th>
                <th className="font-normal">FOCUS ASSETS (comma-separated)</th>
                <th className="font-normal w-56">Primary activity</th>
              </tr>
            </thead>
            <tbody>
              {focusRotation.map((d, idx) => (
                <tr key={d.day} className="border-b border-slate-800/60">
                  <td className="py-1.5 text-slate-200">{d.day}</td>
                  <td className="pr-2">
                    <input
                      key={`${d.day}-${d.assets.join(',')}`}
                      defaultValue={d.assets.join(', ')}
                      onBlur={(e) => updateFocusDay(idx, { assets: e.target.value.split(',').map((a) => a.trim()).filter(Boolean) })}
                      className={fieldClass}
                    />
                  </td>
                  <td>
                    <input value={d.activity} onChange={(e) => updateFocusDay(idx, { activity: e.target.value })} className={fieldClass} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
