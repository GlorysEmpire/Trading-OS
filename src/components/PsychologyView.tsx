import React, { useState } from 'react';
import { useTrading } from '../context/TradingContext';
import {
  Brain,
  Plus,
  AlertTriangle,
  Smile,
  Frown,
  Meh,
  Activity,
  Tag,
  ShieldAlert,
} from 'lucide-react';
import { PsychologyEntry } from '../types';

export const PsychologyView: React.FC = () => {
  const { psychologyEntries, addPsychologyEntry, trades } = useTrading();

  const [showModal, setShowModal] = useState(false);
  const [thoughtsText, setThoughtsText] = useState('');
  const [confidence, setConfidence] = useState(7);
  const [fear, setFear] = useState(3);
  const [hesitation, setHesitation] = useState(false);
  const [frustration, setFrustration] = useState(false);
  const [fearOfMissingOut, setFearOfMissingOut] = useState(false);
  const [protectingPnL, setProtectingPnL] = useState(false);
  const [tradeId, setTradeId] = useState('');
  const [keyLesson, setKeyLesson] = useState('Strict execution of plan without emotional bargaining.');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!thoughtsText.trim()) return;

    const patterns: string[] = [];
    if (hesitation) patterns.push('Hesitation before valid entry');
    if (frustration) patterns.push('Frustration / Impatience');
    if (fearOfMissingOut) patterns.push('FOMO / Chasing price');
    if (protectingPnL) patterns.push('Prematurely protecting green PnL');

    const emotionalState: PsychologyEntry['emotionalState'] = hesitation
      ? 'HESITANT'
      : frustration
      ? 'FRUSTRATED'
      : fearOfMissingOut
      ? 'FOMO'
      : confidence >= 8
      ? 'FOCUSED'
      : 'CALM';

    addPsychologyEntry({
      date: new Date().toISOString().split('T')[0],
      session: 'New York Session',
      linkedTradeId: tradeId || undefined,
      thoughts: thoughtsText.trim(),
      confidenceLevel: confidence,
      fearLevel: fear,
      emotionalState,
      hesitationNotes: hesitation ? 'Felt hesitation despite meeting all Trading HQ setup criteria' : undefined,
      recurringPatternObserved: patterns.join(', ') || undefined,
      keyLesson: keyLesson.trim() || 'Process adherence is the primary goal.',
    });

    setThoughtsText('');
    setHesitation(false);
    setFrustration(false);
    setFearOfMissingOut(false);
    setProtectingPnL(false);
    setShowModal(false);
  };

  // Compute pattern frequencies
  const patternCounts: Record<string, number> = {};
  psychologyEntries.forEach((entry) => {
    if (entry.hesitationNotes) {
      patternCounts['Hesitation before valid setup'] = (patternCounts['Hesitation before valid setup'] || 0) + 1;
    }
    if (entry.recurringPatternObserved) {
      entry.recurringPatternObserved.split(',').forEach((p: string) => {
        const cleaned = p.trim();
        if (cleaned) patternCounts[cleaned] = (patternCounts[cleaned] || 0) + 1;
      });
    }
  });

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <Brain className="w-4 h-4" />
            DISCRETIONARY PSYCHOLOGY & COGNITIVE VIGILANCE
          </div>
          <h2 className="text-xl font-mono font-bold text-slate-100 mt-1">PSYCHOLOGY LAB</h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Observing internal cognitive friction: hesitation, fear of loss, impatience, and behavioral pattern tracking.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ LOG PSYCHOLOGY ENTRY</span>
        </button>
      </div>

      {/* Behavioral Pattern Frequency Radar */}
      <div className="bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-3">
        <div className="flex items-center justify-between border-b border-slate-800 pb-2">
          <span className="font-mono text-xs font-bold text-slate-200 uppercase flex items-center gap-2">
            <Activity className="w-4 h-4 text-rose-400" />
            RECURRING BEHAVIORAL PATTERNS DETECTED
          </span>
          <span className="text-[11px] font-mono text-slate-400">Systemic friction radar</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Object.entries(patternCounts).map(([pattern, count]) => (
            <div key={pattern} className="p-3 rounded bg-[#162130] border border-slate-800 space-y-1">
              <div className="flex items-center justify-between font-mono">
                <span className="text-xs text-slate-200 font-semibold">{pattern}</span>
                <span className="px-2 py-0.5 rounded bg-rose-950/80 border border-rose-800 text-rose-300 font-bold text-xs">
                  {count}x
                </span>
              </div>
              <span className="text-[10px] text-slate-500 block font-sans">
                Flagged across psychological journals
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Entries List */}
      <div className="space-y-3">
        {psychologyEntries.map((entry) => (
          <div key={entry.id} className="bg-[#101722] border border-slate-800 rounded-lg p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
              <div className="flex items-center gap-2 font-mono text-xs">
                <span className="font-bold text-slate-300">{entry.date}</span>
                {entry.linkedTradeId && (
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-cyan-300 text-[11px]">
                    Trade: {entry.linkedTradeId}
                  </span>
                )}
                <span
                  className={`px-2 py-0.5 rounded font-bold text-[11px] ${
                    entry.emotionalState === 'FOCUSED'
                      ? 'bg-emerald-950 text-emerald-300'
                      : entry.emotionalState === 'CALM'
                      ? 'bg-cyan-950 text-cyan-300'
                      : 'bg-amber-950 text-amber-300'
                  }`}
                >
                  {entry.emotionalState}
                </span>
              </div>

              <div className="font-mono text-xs text-slate-400">
                Confidence: <strong className="text-slate-200">{entry.confidenceLevel}/10</strong> | Fear: <strong className="text-rose-400">{entry.fearLevel}/10</strong>
              </div>
            </div>

            <p className="text-xs text-slate-200 font-sans leading-relaxed">{entry.thoughts}</p>

            {entry.recurringPatternObserved && (
              <div className="text-[11px] font-mono text-amber-400/90 flex items-center gap-1.5 pt-1 border-t border-slate-800/60">
                <Tag className="w-3 h-3 text-amber-400" />
                <span>Identified Pattern: {entry.recurringPatternObserved}</span>
              </div>
            )}

            {entry.keyLesson && (
              <div className="text-[11px] text-slate-300 font-sans italic">
                <strong className="text-slate-400 font-mono not-italic">Key Lesson: </strong>
                {entry.keyLesson}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f141d] border border-slate-700 rounded-lg max-w-lg w-full text-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-mono text-sm font-bold text-slate-100 uppercase">LOG PSYCHOLOGY REFLECTION</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-4 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">LINKED TRADE (OPTIONAL)</label>
                <select
                  value={tradeId}
                  onChange={(e) => setTradeId(e.target.value)}
                  className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                >
                  <option value="">None / Standalone session</option>
                  {trades.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.id} - {t.asset} {t.direction} ({t.date})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">
                    CONFIDENCE: <strong className="text-cyan-400">{confidence} / 10</strong>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={confidence}
                    onChange={(e) => setConfidence(parseInt(e.target.value))}
                    className="w-full accent-cyan-500"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">
                    FEAR / STRESS: <strong className="text-rose-400">{fear} / 10</strong>
                  </label>
                  <input
                    type="range"
                    min="1"
                    max="10"
                    value={fear}
                    onChange={(e) => setFear(parseInt(e.target.value))}
                    className="w-full accent-rose-500"
                  />
                </div>
              </div>

              {/* Behavior Flags */}
              <div className="space-y-2">
                <span className="text-slate-400 uppercase text-[10px] block font-bold">BEHAVIORAL FRICTION FLAGS:</span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 p-2 rounded bg-[#162130] border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={hesitation}
                      onChange={(e) => setHesitation(e.target.checked)}
                      className="accent-cyan-500 rounded"
                    />
                    <span className="text-slate-200 text-[11px]">Hesitated on Entry</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded bg-[#162130] border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={protectingPnL}
                      onChange={(e) => setProtectingPnL(e.target.checked)}
                      className="accent-cyan-500 rounded"
                    />
                    <span className="text-slate-200 text-[11px]">Protecting PnL Early</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded bg-[#162130] border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={frustration}
                      onChange={(e) => setFrustration(e.target.checked)}
                      className="accent-cyan-500 rounded"
                    />
                    <span className="text-slate-200 text-[11px]">Frustration / Impatience</span>
                  </label>

                  <label className="flex items-center gap-2 p-2 rounded bg-[#162130] border border-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={fearOfMissingOut}
                      onChange={(e) => setFearOfMissingOut(e.target.checked)}
                      className="accent-cyan-500 rounded"
                    />
                    <span className="text-slate-200 text-[11px]">FOMO / Chasing</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">HONEST INTERNAL REFLECTION</label>
                <textarea
                  rows={3}
                  required
                  placeholder="What were you thinking and feeling? Were you adhering strictly to the process, or feeling defensive about paper gains?"
                  value={thoughtsText}
                  onChange={(e) => setThoughtsText(e.target.value)}
                  className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none font-sans"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">KEY TAKEAWAY / LESSON</label>
                <input
                  type="text"
                  value={keyLesson}
                  onChange={(e) => setKeyLesson(e.target.value)}
                  className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-white font-bold"
                >
                  Commit Reflection
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
