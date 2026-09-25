import React, { useState } from 'react';
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

export const CalendarView: React.FC = () => {
  const { calendarEvents, addCalendarEvent, toggleCalendarEvent } = useTrading();

  const [filterType, setFilterType] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form states
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('08:30');
  const [eventTitle, setEventTitle] = useState('');
  const [eventType, setEventType] = useState<OperationalCalendarEvent['type']>('NEWS');
  const [eventImpact, setEventImpact] = useState<OperationalCalendarEvent['impact']>('HIGH');
  const [eventNotes, setEventNotes] = useState('');
  const [reminderMin, setReminderMin] = useState(15);

  const filteredEvents = calendarEvents.filter((ev) => {
    if (filterType !== 'ALL' && ev.type !== filterType) return false;
    return true;
  });

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;

    addCalendarEvent({
      date: eventDate,
      time: eventTime,
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
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-cyan-400 uppercase tracking-wider">
            <CalendarIcon className="w-4 h-4" />
            DISCRETIONARY OPERATIONAL SCHEDULE
          </div>
          <h2 className="text-xl font-mono font-bold text-slate-100 mt-1">OPERATIONAL CALENDAR</h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Synchronizing trading sessions, high-impact economic releases, backtesting blocks, and review rituals.
          </p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded bg-cyan-600 hover:bg-cyan-500 text-white font-mono text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ SCHEDULE EVENT</span>
        </button>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto text-xs font-mono border-b border-slate-800 pb-2">
        {[
          { id: 'ALL', label: 'All Events' },
          { id: 'NEWS', label: 'High-Impact News' },
          { id: 'BACKTEST', label: 'Backtest Sessions' },
          { id: 'TRADING_SESSION', label: 'Market Windows' },
          { id: 'REVIEW', label: 'Process Reviews' },
        ].map((f) => (
          <button
            key={f.id}
            onClick={() => setFilterType(f.id)}
            className={`px-3 py-1.5 rounded transition ${
              filterType === f.id
                ? 'bg-[#182335] text-cyan-300 border border-cyan-500/40 font-bold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* Events Timeline / Matrix */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredEvents.map((ev) => {
          return (
            <div
              key={ev.id}
              className={`p-4 rounded-lg border transition space-y-2 ${
                ev.completed
                  ? 'bg-[#0e131d]/60 border-slate-800/60 opacity-60'
                  : 'bg-[#101722] border-slate-800 hover:border-slate-700'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-mono">
                  <span className="text-xs text-slate-400 font-bold">{ev.date}</span>
                  <span className="text-slate-600">•</span>
                  <span className="text-cyan-400 font-semibold text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {ev.time}
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
                  onClick={() => toggleCalendarEvent(ev.id)}
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
                  <span>Reminder set for {ev.reminderMinutesBefore}m prior</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Add Event Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f141d] border border-slate-700 rounded-lg max-w-lg w-full text-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-mono text-sm font-bold text-slate-100 uppercase">SCHEDULE OPERATIONAL EVENT</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleAddSubmit} className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">TITLE</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. US Core CPI MoM / YoY Release"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">DATE</label>
                  <input
                    type="date"
                    required
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">TIME (EST)</label>
                  <input
                    type="text"
                    required
                    placeholder="08:30 EST"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">EVENT TYPE</label>
                  <select
                    value={eventType}
                    onChange={(e) => setEventType(e.target.value as any)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  >
                    <option value="NEWS">High-Impact News</option>
                    <option value="BACKTEST">Backtesting Block</option>
                    <option value="TRADING_SESSION">Trading Session</option>
                    <option value="REVIEW">Process Review</option>
                    <option value="RESEARCH">Research</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">VOLATILITY IMPACT</label>
                  <select
                    value={eventImpact}
                    onChange={(e) => setEventImpact(e.target.value as any)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  >
                    <option value="HIGH">HIGH IMPACT</option>
                    <option value="MEDIUM">MEDIUM IMPACT</option>
                    <option value="LOW">LOW IMPACT</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">NOTES</label>
                <textarea
                  rows={2}
                  value={eventNotes}
                  onChange={(e) => setEventNotes(e.target.value)}
                  placeholder="Context, expected volatility, trading posture..."
                  className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none font-sans"
                />
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
                  className="px-4 py-1.5 bg-cyan-600 hover:bg-cyan-500 rounded text-white font-bold"
                >
                  Save Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
