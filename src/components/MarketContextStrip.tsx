import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, Check, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { AssetDeskData, ContextField, ContextLane, ContextLaneState, OperationalCalendarEvent } from '../types';
import {
  applyFieldEdit,
  confirmField,
  contextId,
  emptyField,
  fieldAge,
  formatAsOfNY,
  getLanes,
  isStale,
  isoToNyInput,
  needsConfirmation,
  nyInputToIso,
  upcomingDeskEvents,
  withLanes,
} from '../utils/marketContext';
import { traderDateString, SESSION_TIMEZONE } from '../utils/traderTime';

const STATE_LABEL: Record<ContextLaneState, string> = {
  SUPPORTS: 'Supports narrative',
  AGAINST: 'Against narrative',
  NEUTRAL: 'Neutral',
};
const STATE_CLASS: Record<ContextLaneState, string> = {
  SUPPORTS: 'bg-sky-950/60 border-sky-700 text-sky-300',
  AGAINST: 'bg-orange-950/60 border-orange-700 text-orange-300',
  NEUTRAL: 'bg-raised border-line-strong text-ink-2',
};

const input = 'w-full rounded-lg border border-line bg-well px-3 py-2 text-sm text-ink outline-none focus:border-sky-500';
const smallBtn = 'inline-flex items-center gap-1 rounded-lg border border-line bg-raised px-2.5 py-1.5 text-xs text-ink-2 hover:text-ink';

interface Props {
  desk: AssetDeskData;
  calendarEvents: OperationalCalendarEvent[];
  onSave: (externalContext: AssetDeskData['externalContext']) => void;
}

/** MC-1: the desk's external context, in lanes. Context only, never a signal. */
export const MarketContextStrip: React.FC<Props> = ({ desk, calendarEvents, onSave }) => {
  const lanes = useMemo(() => getLanes(desk), [desk]);
  const [editingLanes, setEditingLanes] = useState(false);
  const [editing, setEditing] = useState<{ laneId: string; field: ContextField; isNew: boolean } | null>(null);
  const [stateMenu, setStateMenu] = useState<string | null>(null);
  const now = new Date();
  const savedYet = Array.isArray(desk.externalContext?.lanes);

  const save = (next: ContextLane[]) => onSave(withLanes(desk.externalContext, next));
  const updateLane = (laneId: string, fn: (l: ContextLane) => ContextLane) => save(lanes.map((l) => (l.id === laneId ? fn(l) : l)));

  const setState = (laneId: string, state: ContextLaneState | undefined) => {
    updateLane(laneId, (l) => ({ ...l, state, stateBy: state ? 'MANUAL' : undefined }));
    setStateMenu(null);
  };
  const confirmLaneState = (laneId: string) => updateLane(laneId, (l) => ({ ...l, stateBy: 'MANUAL' }));
  const confirmValue = (laneId: string, fieldId: string) =>
    updateLane(laneId, (l) => ({ ...l, fields: l.fields.map((f) => (f.id === fieldId ? confirmField(f) : f)) }));

  const saveField = (laneId: string, original: ContextField, draft: ContextField, isNew: boolean) => {
    updateLane(laneId, (l) => {
      const edited = applyFieldEdit(original, { ...draft, enteredBy: 'MANUAL' });
      return { ...l, fields: isNew ? [...l.fields, edited] : l.fields.map((f) => (f.id === original.id ? edited : f)) };
    });
    setEditing(null);
  };

  const moveLane = (index: number, dir: -1 | 1) => {
    const j = index + dir;
    if (j < 0 || j >= lanes.length) return;
    const next = [...lanes];
    [next[index], next[j]] = [next[j], next[index]];
    save(next);
  };
  const removeLane = (lane: ContextLane) => {
    if (!window.confirm(`Remove the "${lane.name}" lane and its ${lane.fields.length} field(s) from this desk?`)) return;
    save(lanes.filter((l) => l.id !== lane.id));
  };
  const removeField = (laneId: string, field: ContextField) => {
    if (!window.confirm(`Remove "${field.label}" from this desk?`)) return;
    updateLane(laneId, (l) => ({ ...l, fields: l.fields.filter((f) => f.id !== field.id) }));
  };
  const addLane = () => save([...lanes, { id: contextId('cl'), name: 'New lane', question: '', kind: 'FIELDS', fields: [] }]);
  const renameLane = (laneId: string, patch: Partial<ContextLane>) => updateLane(laneId, (l) => ({ ...l, ...patch }));

  const today = traderDateString(now, SESSION_TIMEZONE);
  const events = upcomingDeskEvents(calendarEvents, desk.symbol, today);

  return (
    <section aria-labelledby="mc-title" className="rounded-xl border border-line bg-panel overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div>
          <h3 id="mc-title" className="text-[15px] font-semibold text-ink">Market context</h3>
          <p className="mt-0.5 text-xs text-ink-3">Context for the narrative, never a buy or sell signal. Price structure stays primary.</p>
        </div>
        <div className="flex items-center gap-2">
          {!savedYet && <span className="text-xs text-ink-3">Starting lanes for {desk.category.toLowerCase()} · saved on first edit</span>}
          <button type="button" onClick={() => setEditingLanes((v) => !v)} className={smallBtn}>
            {editingLanes ? <><Check className="h-3.5 w-3.5" /> Done</> : <><Pencil className="h-3.5 w-3.5" /> Edit lanes</>}
          </button>
        </div>
      </div>

      {lanes.map((lane, li) => (
        <div key={lane.id} className="grid grid-cols-1 md:grid-cols-[210px_minmax(0,1fr)] border-b border-line">
          <div className="flex flex-col gap-2 bg-well px-4 py-3">
            {editingLanes ? (
              <>
                <label className="sr-only" htmlFor={`ln-${lane.id}`}>Lane name</label>
                <BlurInput id={`ln-${lane.id}`} value={lane.name} onCommit={(v) => v.trim() && renameLane(lane.id, { name: v.trim() })} className={input} />
                <label className="sr-only" htmlFor={`lq-${lane.id}`}>Question this lane answers</label>
                <BlurInput id={`lq-${lane.id}`} value={lane.question ?? ''} placeholder="Question it answers" onCommit={(v) => renameLane(lane.id, { question: v.trim() })} className={`${input} text-xs`} />
                <div className="flex gap-1">
                  <button type="button" aria-label="Move lane up" onClick={() => moveLane(li, -1)} className={smallBtn}><ArrowUp className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label="Move lane down" onClick={() => moveLane(li, 1)} className={smallBtn}><ArrowDown className="h-3.5 w-3.5" /></button>
                  <button type="button" aria-label={`Remove ${lane.name} lane`} onClick={() => removeLane(lane)} className={`${smallBtn} hover:text-rose-400`}><Trash2 className="h-3.5 w-3.5" /></button>
                </div>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-ink">{lane.name}</span>
                {lane.question && <span className="text-xs leading-snug text-ink-3">{lane.question}</span>}
                {lane.kind !== 'EVENTS' && (
                  <div className="relative">
                    {lane.state && lane.stateBy === 'AI_DRAFT' ? (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-full border border-dashed border-slate-500 px-2.5 py-1 text-xs font-semibold text-ink-2">AI draft: {STATE_LABEL[lane.state]}</span>
                        <button type="button" onClick={() => confirmLaneState(lane.id)} className="text-xs font-semibold text-sky-400 hover:text-sky-300">Confirm</button>
                        <button type="button" onClick={() => setStateMenu(lane.id)} className="text-xs text-ink-3 hover:text-ink">Change</button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setStateMenu(stateMenu === lane.id ? null : lane.id)}
                        className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${lane.state ? STATE_CLASS[lane.state] : 'border-dashed border-line-strong text-ink-3'}`}
                      >
                        {lane.state ? STATE_LABEL[lane.state] : 'Set your read'}
                      </button>
                    )}
                    {stateMenu === lane.id && (
                      <div className="absolute left-0 top-full z-20 mt-1 w-48 rounded-xl border border-line bg-panel p-1.5 shadow-xl">
                        {(Object.keys(STATE_LABEL) as ContextLaneState[]).map((s) => (
                          <button key={s} type="button" onClick={() => setState(lane.id, s)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-ink-2 hover:bg-raised">{STATE_LABEL[s]}</button>
                        ))}
                        <button type="button" onClick={() => setState(lane.id, undefined)} className="block w-full rounded-lg px-3 py-2 text-left text-xs text-ink-3 hover:bg-raised">Clear</button>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          <div className="grid grid-cols-1 gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-3">
            {lane.kind === 'EVENTS' ? (
              events.length ? (
                events.map((ev) => (
                  <div key={ev.id} className="rounded-lg border border-line bg-raised px-3 py-2.5">
                    <div className="text-xs text-ink-3">{ev.impact ? `${ev.impact.toLowerCase()} impact` : 'Event'}</div>
                    <div className="mt-1 text-[15px] font-semibold text-ink">{ev.title}</div>
                    <div className="mt-0.5 text-xs text-ink-2">{formatEventWhen(ev, today)}</div>
                    <div className="mt-2 text-[11.5px] text-ink-3">Calendar · {ev.assetOrCurrency}</div>
                  </div>
                ))
              ) : (
                <p className="col-span-full text-xs text-ink-3">No upcoming events linked to {desk.symbol}. Put "{desk.symbol}" in an event's asset field in Calendar and it shows here.</p>
              )
            ) : (
              <>
                {lane.fields.map((f) => {
                  const stale = isStale(f, now);
                  const draft = needsConfirmation(f);
                  const age = fieldAge(f, now);
                  const empty = !f.value.trim();
                  return (
                    <div
                      key={f.id}
                      className={`group min-w-0 rounded-lg px-3 py-2.5 ${draft ? 'border border-dashed border-slate-500 bg-raised' : stale ? 'border border-dashed border-line-strong bg-well opacity-75' : 'border border-line bg-raised'}`}
                    >
                      <div className="flex items-center justify-between gap-2 text-xs text-ink-3">
                        <span className="truncate">{f.label}</span>
                        <span className="flex items-center gap-1.5">
                          {age && <span className={stale ? 'font-semibold text-orange-400' : ''}>{stale ? `stale · ${age}` : age}</span>}
                          {editingLanes && (
                            <button type="button" aria-label={`Remove ${f.label}`} onClick={() => removeField(lane.id, f)} className="text-ink-3 hover:text-rose-400"><X className="h-3.5 w-3.5" /></button>
                          )}
                        </span>
                      </div>
                      <button type="button" onClick={() => setEditing({ laneId: lane.id, field: f, isNew: false })} className="mt-1 block w-full text-left" title={f.conceptNote || 'Edit value'}>
                        {empty ? (
                          <span className="text-sm text-ink-3">Add value</span>
                        ) : (
                          <>
                            <span className="block text-[17px] font-semibold text-ink">{f.value}</span>
                            {(f.changeNote || f.previous) && (
                              <span className="mt-0.5 block text-xs text-ink-2">
                                {f.changeNote || `Was ${f.previous!.value}${f.previous!.asOf ? ` (${formatAsOfNY(f.previous!.asOf)})` : ''}`}
                              </span>
                            )}
                          </>
                        )}
                      </button>
                      {!empty && (
                        <div className="mt-2 flex flex-wrap items-center gap-x-1.5 text-[11.5px] text-ink-3">
                          <span>{f.source || 'No source'}</span>
                          <span aria-hidden>·</span>
                          <span>{f.asOf ? formatAsOfNY(f.asOf) : 'no time'}</span>
                          <span aria-hidden>·</span>
                          <span>{f.enteredBy === 'AI_DRAFT' ? 'AI draft' : f.enteredBy === 'PROVIDER' ? 'Provider' : 'You'}</span>
                          {draft && (
                            <button type="button" onClick={() => confirmValue(lane.id, f.id)} className="ml-auto font-semibold text-sky-400 hover:text-sky-300">Confirm</button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => setEditing({ laneId: lane.id, field: emptyField(''), isNew: true })}
                  className="flex min-h-[64px] items-center justify-center gap-1.5 rounded-lg border border-dashed border-line-strong text-xs text-ink-3 hover:text-ink"
                >
                  <Plus className="h-3.5 w-3.5" /> Field
                </button>
              </>
            )}
          </div>
        </div>
      ))}

      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 px-4 py-2.5 text-xs text-ink-3">
        {editingLanes && <button type="button" onClick={addLane} className={smallBtn}><Plus className="h-3.5 w-3.5" /> Lane</button>}
        <span>Your read on each lane is yours to set; AI drafts show dashed until you confirm.</span>
        <span>Dashed grey = older than its stale limit.</span>
        <span>Times in New York time.</span>
      </div>

      {editing && (
        <FieldEditor
          laneName={lanes.find((l) => l.id === editing.laneId)?.name ?? ''}
          field={editing.field}
          isNew={editing.isNew}
          onCancel={() => setEditing(null)}
          onSave={(draft) => saveField(editing.laneId, editing.field, draft, editing.isNew)}
        />
      )}
    </section>
  );
};

function formatEventWhen(ev: OperationalCalendarEvent, today: string): string {
  const d = new Date(`${ev.date}T12:00:00Z`);
  const day = new Intl.DateTimeFormat('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC' }).format(d);
  const days = Math.round((Date.parse(`${ev.date}T00:00:00Z`) - Date.parse(`${today}T00:00:00Z`)) / 86_400_000);
  const when = days === 0 ? 'today' : days === 1 ? 'in 1 day' : `in ${days} days`;
  const zone = ev.timeZone === 'America/New_York' ? ' NY' : ev.timeZone === 'Africa/Lagos' ? ' Lagos' : '';
  return `${day}${ev.time ? ` · ${ev.time}${zone}` : ''} · ${when}`;
}

const FieldEditor: React.FC<{
  laneName: string;
  field: ContextField;
  isNew: boolean;
  onCancel: () => void;
  onSave: (draft: ContextField) => void;
}> = ({ laneName, field, isNew, onCancel, onSave }) => {
  const [label, setLabel] = useState(field.label);
  const [value, setValue] = useState(field.value);
  const [changeNote, setChangeNote] = useState(field.changeNote ?? '');
  const [source, setSource] = useState(field.source || 'Manual');
  const [asOf, setAsOf] = useState(isoToNyInput(field.asOf) || isoToNyInput(new Date().toISOString()));
  const [stale, setStale] = useState(field.staleAfterHours ? String(field.staleAfterHours) : '');
  const [note, setNote] = useState(field.conceptNote ?? '');
  const valueChanged = value.trim() !== field.value.trim();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim()) return;
    const hours = Number(stale);
    onSave({
      ...field,
      label: label.trim(),
      value: value.trim(),
      // A new value replaces the old change note unless one was typed.
      changeNote: changeNote.trim() || undefined,
      source: source.trim(),
      asOf: nyInputToIso(asOf),
      staleAfterHours: stale && hours > 0 ? hours : undefined,
      conceptNote: note.trim() || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onCancel}>
      <form onSubmit={submit} onClick={(e) => e.stopPropagation()} className="w-full max-w-xl space-y-4 rounded-xl border border-line-strong bg-panel p-5 shadow-2xl" aria-labelledby="mc-edit-title">
        <div className="flex items-center justify-between">
          <h4 id="mc-edit-title" className="text-base font-semibold text-ink">{isNew ? `New field · ${laneName}` : `${field.label} · ${laneName}`}</h4>
          <button type="button" aria-label="Close" onClick={onCancel} className="rounded-lg p-1.5 text-ink-3 hover:bg-raised hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Labelled id="mc-label" label="Field name">
            <input id="mc-label" value={label} onChange={(e) => setLabel(e.target.value)} className={input} placeholder="e.g. Funding" required />
          </Labelled>
          <Labelled id="mc-value" label="Value">
            <input id="mc-value" value={value} onChange={(e) => setValue(e.target.value)} className={input} placeholder="e.g. Negative on 5 exchanges" />
          </Labelled>
          <Labelled id="mc-change" label="Change note (optional)">
            <input id="mc-change" value={changeNote} onChange={(e) => setChangeNote(e.target.value)} className={input} placeholder={valueChanged && field.value ? `Was ${field.value}` : 'e.g. −21% since Nov 2'} />
          </Labelled>
          <Labelled id="mc-source" label="Source">
            <input id="mc-source" value={source} onChange={(e) => setSource(e.target.value)} className={input} placeholder="Where it came from" />
          </Labelled>
          <Labelled id="mc-asof" label="As of (New York time)">
            <div className="flex gap-2">
              <input id="mc-asof" type="datetime-local" value={asOf} onChange={(e) => setAsOf(e.target.value)} className={`${input} min-w-0 flex-1`} />
              <button type="button" onClick={() => setAsOf(isoToNyInput(new Date().toISOString()))} className={`${smallBtn} shrink-0`}>Now</button>
            </div>
          </Labelled>
          <Labelled id="mc-stale" label="Grey out after (hours, blank = never)">
            <input id="mc-stale" type="number" min={1} value={stale} onChange={(e) => setStale(e.target.value)} className={input} />
          </Labelled>
        </div>
        <Labelled id="mc-note" label="How I read it (your note)">
          <textarea id="mc-note" rows={3} value={note} onChange={(e) => setNote(e.target.value)} className={input} />
        </Labelled>
        {field.enteredBy !== 'MANUAL' && !isNew && (
          <p className="text-xs text-ink-3">Entered by {field.enteredBy === 'AI_DRAFT' ? 'an AI draft' : 'a provider'}. Saving here makes it your confirmed value.</p>
        )}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-line bg-raised px-4 py-2 text-sm text-ink-2 hover:text-ink">Cancel</button>
          <button type="submit" className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500">Save</button>
        </div>
      </form>
    </div>
  );
};

const Labelled: React.FC<{ id: string; label: string; children: React.ReactNode }> = ({ id, label, children }) => (
  <div className="space-y-1">
    <label htmlFor={id} className="block text-xs text-ink-2">{label}</label>
    {children}
  </div>
);

/** Text input that saves when it loses focus (or on Enter), not on every key. */
const BlurInput: React.FC<{ id: string; value: string; placeholder?: string; className: string; onCommit: (v: string) => void }> = ({ id, value, placeholder, className, onCommit }) => {
  const [draft, setDraft] = useState(value);
  React.useEffect(() => setDraft(value), [value]);
  return (
    <input
      id={id}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onCommit(draft); }}
      onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
      className={className}
    />
  );
};
