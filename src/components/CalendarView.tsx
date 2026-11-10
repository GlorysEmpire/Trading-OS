import React, { useState } from 'react';
import { PageTitle } from './PageTitle';
import { useTrading } from '../context/TradingContext';
import {
  Calendar as CalendarIcon,
  Clock,
  Filter,
  Plus,
  CheckCircle2,
  AlertTriangle,
  BookOpen,
  Search,
  Bell,
} from 'lucide-react';
import { OperationalCalendarEvent } from '../types';
import { PersonalWorkspaceNotice } from './PersonalWorkspaceNotice';
import { traderDateString } from '../utils/traderTime';

export const CalendarView: React.FC = () => {
  const { calendarEvents, addCalendarEvent, toggleCalendarEvent, personalWorkspaceStatus } = useTrading();

  const [filterType, setFilterType] = useState<string>('ALL');
  const [showCompleted, setShowCompleted] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [eventDate, setEventDate] = useState(() => traderDateString());
  const [eventTime, setEventTime] = useState('08:30');
  const [eventTimeZone, setEventTimeZone] = useState<NonNullable<OperationalCalendarEvent['timeZone']>>('Africa/Lagos');
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState<OperationalCalendarEvent['type']>('NEWS');
  const [eventImpact, setEventImpact] = useState<OperationalCalendarEvent['impact']>('HIGH');
  const [eventNotes, setEventNotes] = useState('');
  const [reminderMin, setReminderMin] = useState(15);

  const filteredEvents = calendarEvents.filter((ev) => {
    if (!showCompleted && ev.completed) return false;
    if (filterType !== 'ALL' && ev.type !== filterType) return false;
    return true;
  }).sort((a, b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;

    setSaving(true);
    try { await addCalendarEvent({
      date: eventDate,
      time: eventTime,
      timeZone: eventTimeZone,
      title: eventTitle.trim(),
      type: eventType,
      impact: eventImpact,
      notes: eventNotes.trim() || undefined,
      reminderMinutesBefore: Number(reminderMin),
      completed: false,
    });

    setEventTitle('');
    setEventNotes('');
    setShowAddModal(false);
    } catch { /* PersonalWorkspaceNotice displays the save error. */ }
    finally { setSaving(false); }
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <PageTitle icon={CalendarIcon} title="Calendar" description="Economic news, trading sessions and your own schedule in one place." />

        <button
          onClick={() => setShowAddModal(true)} disabled={personalWorkspaceStatus.calendar.loading}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-sm font-semibold transition shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>Add event</span>
        </button>
      </div>

      <PersonalWorkspaceNotice workspace="calendar" />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-ink-3">{filteredEvents.length} scheduled item{filteredEvents.length === 1 ? '' : 's'}</p>
        <div className="flex flex-wrap items-center gap-3">
        <label className="text-xs text-ink-3">Show
          <select value={filterType} onChange={event => setFilterType(event.target.value)}
            className="ml-2 rounded-lg border border-line bg-panel px-3 py-2 text-xs text-ink-2">
            <option value="ALL">All events</option>
            <option value="NEWS">News</option>
            <option value="BACKTEST">Backtesting</option>
            <option value="TRADING_SESSION">Trading windows</option>
            <option value="REVIEW">Reviews</option>
          </select>
        </label>
        <label className="inline-flex items-center gap-1.5 text-xs text-ink-3"><input type="checkbox" checked={showCompleted} onChange={event => setShowCompleted(event.target.checked)} className="accent-cyan-500" /> Completed</label>
        </div>
      </div>

      {/* Events Timeline / Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {!personalWorkspaceStatus.calendar.loading && filteredEvents.length === 0 && <p className="col-span-full rounded-xl border border-line bg-panel p-6 text-sm text-ink-3">No items in this view. Change the filter or add an event.</p>}
        {filteredEvents.map((ev) => {
          return (
            <div
              key={ev.id}
              className={`p-4 rounded-lg border transition space-y-2 ${
                ev.completed
                  ? 'bg-panel/60 border-slate-800/60 opacity-60'
                  : 'bg-panel border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 font-mono">
                  <span className="text-xs text-slate-400 font-bold">{ev.date}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-cyan-400 font-semibold text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {ev.time}{ev.timeZone ? ` ${ev.timeZone === 'Africa/Lagos' ? 'Lagos' : 'New York'}` : ''}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {ev.impact && (
                    <span
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded font-bold ${
                        ev.impact === 'HIGH'
                          ? 'bg-rose-950 text-rose-300 border border-rose-800'
                          : ev.impact === 'MEDIUM'
                          ? 'bg-amber-950 text-amber-300 border border-amber-800'
                          : 'bg-slate-800 text-slate-300'
                      }`}
                    >
                      {ev.impact} IMPACT
                    </span>
                  )}
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {ev.type}
                  </span>
                </div>
              </div>

              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3
                    className={`font-semibold text-sm ${
                      ev.completed ? 'line-through text-slate-400' : 'text-slate-100'
                    }`}
                  >
                    {ev.title}
                  </h3>
                  {ev.notes && <p className="text-xs text-slate-400 font-sans">{ev.notes}</p>}
                </div>

                <button
                  onClick={() => { void toggleCalendarEvent(ev.id).catch(() => {}); }}
                  title="Toggle Completed"
                  className={`p-1.5 rounded transition ${
                    ev.completed ? 'text-emerald-400 bg-emerald-950/50' : 'text-slate-500 hover:text-slate-300'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                </button>
              </div>

              {ev.reminderMinutesBefore && (
                <div className="text-[10px] font-mono text-slate-500 flex items-center gap-1 pt-1 border-t border-slate-800/80">
                  <Bell className="w-3 h-3 text-cyan-400" />
                  <span>Reminder preference: {ev.reminderMinutesBefore}m before · delivery not active yet</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-panel border border-line rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto text-ink p-5 sm:p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-mono text-sm font-bold text-slate-100 uppercase">Schedule operational event</h3>
              <button onClick={() => setShowAddModal(false)} disabled={saving} className="text-slate-400 hover:text-slate-200 disabled:opacity-50">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs font-mono">
              {personalWorkspaceStatus.calendar.error && <p role="alert" className="text-rose-400">{personalWorkspaceStatus.calendar.error}</p>}
              <div>
                <label className="block text-slate-400 mb-1">Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. US Core CPI MoM / YoY Release"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Date</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Time</label>
                  <input
                    type="time"
                    required
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Time zone</label>
                <select value={eventTimeZone} onChange={event => setEventTimeZone(event.target.value as NonNullable<OperationalCalendarEvent['timeZone']>)} className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none">
                  <option value="Africa/Lagos">Lagos</option>
                  <option value="America/New_York">New York (adjusts for daylight saving)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">Event type</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as any)}
                    className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  >
                    <option value="NEWS">High-Impact News</option>
                    <option value="BACKTEST">Backtesting Block</option>
                    <option value="TRADING_SESSION">Trading Session</option>
                    <option value="REVIEW">Process Review</option>
                    <option value="RESEARCH">Research</option>
                    <option value="PERSONAL">Personal</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">Volatility impact</label>
                  <select
                    value={eventImpact}
                    onChange={(e) => setEventImpact(e.target.value as any)}
                    className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  >
                    <option value="HIGH">High impact</option>
                    <option value="MEDIUM">Medium impact</option>
                    <option value="LOW">Low impact</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="Context, expected volatility, trading posture..."
                  className="w-full bg-raised border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  disabled={saving}
                  className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 rounded text-slate-300"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded-lg text-white font-bold"
                >
                  {saving ? 'Saving…' : 'Save Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
