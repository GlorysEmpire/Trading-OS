import React, { useEffect, useState } from 'react';
import { CheckCircle2 } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import {
  loadDeskAnalysisHistory, type DeskAnalysisHistory,
  type DeskAnalysisOutcome, type DeskAnalysisScope,
} from '../lib/deskAnalysisHistoryStore';
import type { AssetDeskData } from '../types';

const SCOPES: Record<DeskAnalysisScope, string> = {
  narrative: 'Narrative', monthly: 'Monthly', weekly: 'Weekly',
  daily: 'Daily', h4: '4H', all: 'Entire analysis',
};
const LABEL: Record<DeskAnalysisOutcome, string> = {
  TARGET_HIT: 'Target hit', INVALIDATED: 'Invalidated',
  COMPLETED: 'Analysis complete', RESET: 'Reset',
};

function summary(history: DeskAnalysisHistory): string {
  const content = history.snapshot.content;
  if (history.scope === 'narrative') return String(content.narrative || 'No narrative text');
  if (history.scope !== 'all') return String(content.structure || 'No structure text');
  const htf = content.htfStructure as Record<string, string> | undefined;
  return [content.narrative, htf?.monthly, htf?.weekly, htf?.daily, htf?.h4]
    .filter(Boolean).map(String).join(' · ') || 'Archived full desk analysis';
}

function archivedCharts(value: unknown): Array<{ id?: string; title?: string; url?: string }> {
  return Array.isArray(value) ? value.filter(item => item && typeof item === 'object') : [];
}

function HistoryContent({ item }: { item: DeskAnalysisHistory }) {
  const content = item.snapshot.content;
  const structure = content.htfStructure as Record<string, string> | undefined;
  const notes = content.notesBundle as Record<string, unknown> | undefined;
  const charts = archivedCharts(item.scope === 'all' ? notes?.charts : content.charts);
  const fields = item.scope === 'all'
    ? (['monthly', 'weekly', 'daily', 'h4'] as const).map(key => ({ label: key === 'h4' ? '4H' : key, value: structure?.[key] })).filter(field => field.value)
    : [];
  return (
    <div className="mt-4 border-t border-line pt-4 space-y-4 text-xs">
      {item.reason && <p className="rounded-lg bg-cyan-950/30 border border-cyan-900/40 p-3"><strong className="text-cyan-300">Why it ended · </strong><span className="text-ink-2">{item.reason}</span></p>}
      {(item.scope === 'narrative' || item.scope === 'all') && (
        <div className="grid grid-cols-1 sm:grid-cols-[auto_1fr] gap-3">
          <div className="rounded-lg bg-raised border border-line p-3 min-w-28"><span className="text-ink-3 block mb-1">Bias</span><strong className="text-ink">{String(content.bias || 'Neutral')}</strong></div>
          <div className="rounded-lg bg-raised border border-line p-3"><span className="text-ink-3 block mb-1">Narrative</span><p className="text-ink-2 whitespace-pre-wrap">{String(content.narrative || 'No narrative text')}</p></div>
        </div>
      )}
      {item.scope !== 'narrative' && item.scope !== 'all' && (
        <div className="rounded-lg bg-raised border border-line p-3"><span className="text-ink-3 block mb-1">Structure</span><p className="text-ink-2 whitespace-pre-wrap">{String(content.structure || 'No structure text')}</p></div>
      )}
      {fields.length > 0 && <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">{fields.map(field => <div key={field.label} className="rounded-lg bg-raised border border-line p-3"><span className="text-cyan-300 uppercase text-[10px] font-semibold">{field.label}</span><p className="text-ink-2 whitespace-pre-wrap mt-1">{field.value}</p></div>)}</div>}
      {charts.length > 0 && <div><span className="text-ink-3 block mb-2">Archived charts</span><div className="flex flex-wrap gap-2">{charts.map((chart, index) => chart.url && <a key={chart.id ?? index} href={chart.url} target="_blank" rel="noreferrer" className="rounded-lg border border-line bg-raised hover:border-cyan-700 px-3 py-2 text-cyan-300">{chart.title || `Chart ${index + 1}`} ↗</a>)}</div></div>}
      {item.scope === 'all' && (
        <details className="rounded-lg bg-raised border border-line p-3">
          <summary className="cursor-pointer text-cyan-300 font-medium">Supporting context and full snapshot</summary>
          <pre className="whitespace-pre-wrap break-words mt-3 text-ink-3 font-sans max-h-80 overflow-auto">{JSON.stringify(content, null, 2)}</pre>
        </details>
      )}
    </div>
  );
}

export const DeskAnalysisLifecycle: React.FC<{ desk: AssetDeskData }> = ({ desk }) => {
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<DeskAnalysisHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setHistory([]);
    setLoadingHistory(true);
    loadDeskAnalysisHistory(supabase, desk.id)
      .then(rows => {
        if (active) {
          setHistory(previous => {
            const byId = new Map([...rows, ...previous].map(item => [item.id, item]));
            return [...byId.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          });
          setError(null);
        }
      })
      .catch(err => { if (active) setError(err instanceof Error ? err.message : 'Could not load analysis history'); })
      .finally(() => { if (active) setLoadingHistory(false); });
    return () => { active = false; };
  }, [desk.id]);

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-xs text-rose-400">{error}</p>}
      <div><h3 className="text-base font-semibold text-ink">Analysis history</h3><p className="text-xs text-ink-3 mt-1">Previous narratives and structure stay here for review.</p></div>
      {loadingHistory && <p className="text-xs text-ink-3">Loading history…</p>}
      {history.length === 0 && !loadingHistory && <p className="rounded-xl border border-line bg-panel p-5 text-sm text-ink-3">No analysis has been archived yet.</p>}
      {history.map(item => (
        <div key={item.id} className="rounded-xl border border-line bg-panel p-4">
          <button type="button" onClick={() => setExpandedId(expandedId === item.id ? null : item.id)} className="w-full text-left flex items-start gap-3">
            <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap gap-2 items-center text-sm font-semibold text-ink">
                {LABEL[item.outcome]} · {SCOPES[item.scope]}
                <span className="text-xs font-normal text-ink-3">{new Date(item.createdAt).toLocaleString()}</span>
              </span>
              <span className="block text-xs text-ink-3 mt-1 line-clamp-2">{summary(item)}</span>
            </span>
            <span className="text-xs text-cyan-400">{expandedId === item.id ? 'Hide' : 'Review'}</span>
          </button>
          {expandedId === item.id && <HistoryContent item={item} />}
        </div>
      ))}
    </div>
  );
};
