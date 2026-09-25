import React, { useState } from 'react';
import { useTrading } from '../context/TradingContext';
import {
  AlertTriangle,
  Bell,
  Plus,
  Trash2,
  CheckCircle2,
  Sliders,
  Compass,
  Clock,
  Radio,
} from 'lucide-react';
import { AlertRule } from '../types';

export const AlertsView: React.FC = () => {
  const { alerts, addAlert, toggleAlert } = useTrading();

  const [showModal, setShowModal] = useState(false);
  const [asset, setAsset] = useState('BTC');
  const [alertType, setAlertType] = useState<AlertRule['type']>('LIQUIDITY');
  const [conditionText, setConditionText] = useState('');
  const [title, setTitle] = useState('');

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!conditionText.trim()) return;

    addAlert({
      title: title.trim() || `${asset} Alert`,
      asset,
      type: alertType,
      conditionText: conditionText.trim(),
      triggered: false,
      active: true,
    });

    setTitle('');
    setConditionText('');
    setShowModal(false);
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-4">
        <div>
          <div className="flex items-center gap-2 font-mono text-xs font-bold text-amber-400 uppercase tracking-wider">
            <Radio className="w-4 h-4 animate-pulse" />
            DISCRETIONARY SURVEILLANCE & TRIGGERS
          </div>
          <h2 className="text-xl font-mono font-bold text-slate-100 mt-1">OPERATIONAL ALERTS ENGINE</h2>
          <p className="text-xs text-slate-400 font-sans mt-0.5">
            Alerts anchored around liquidity events, session boundaries, and risk rules — not just basic price alerts.
          </p>
        </div>

        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-1.5 px-4 py-2 rounded bg-amber-600 hover:bg-amber-500 text-white font-mono text-xs font-bold transition shadow-sm cursor-pointer"
        >
          <Plus className="w-4 h-4" />
          <span>+ SET CONCEPTUAL ALERT</span>
        </button>
      </div>

      {/* Alerts Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {alerts.map((al) => (
          <div
            key={al.id}
            className={`p-4 rounded-lg border transition space-y-3 ${
              al.active ? 'bg-[#101722] border-slate-800' : 'bg-[#0e141e]/50 border-slate-900 opacity-60'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold text-sm text-slate-100">{al.asset || al.title}</span>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                    al.type === 'LIQUIDITY'
                      ? 'bg-amber-950/60 border-amber-800 text-amber-300'
                      : al.type === 'RISK_LIMIT'
                      ? 'bg-rose-950/60 border-rose-800 text-rose-300'
                      : al.type === 'SESSION'
                      ? 'bg-cyan-950/60 border-cyan-800 text-cyan-300'
                      : 'bg-purple-950/60 border-purple-800 text-purple-300'
                  }`}
                >
                  {al.type}
                </span>
              </div>

              <button
                onClick={() => toggleAlert(al.id)}
                className={`text-xs font-mono px-2.5 py-1 rounded border transition cursor-pointer ${
                  al.active
                    ? 'bg-emerald-950/60 border-emerald-800 text-emerald-300 font-bold'
                    : 'bg-slate-800 border-slate-700 text-slate-400'
                }`}
              >
                {al.active ? 'ACTIVE' : 'OFF'}
              </button>
            </div>

            <div className="font-semibold text-xs text-slate-200">{al.title}</div>

            <div className="font-mono text-xs text-cyan-300 bg-[#162130] p-2.5 rounded border border-slate-800">
              {al.conditionText}
            </div>
          </div>
        ))}
      </div>

      {/* Add Alert Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="bg-[#0f141d] border border-slate-700 rounded-lg max-w-lg w-full text-slate-200 p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-mono text-sm font-bold text-slate-100 uppercase">CREATE CONCEPTUAL ALERT</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-200">
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs font-mono">
              <div>
                <label className="block text-slate-400 mb-1">TITLE</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. BTC Key Liquidity Sweep"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 mb-1">ASSET</label>
                  <select
                    value={asset}
                    onChange={(e) => setAsset(e.target.value)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  >
                    <option value="BTC">BTC</option>
                    <option value="ETH">ETH</option>
                    <option value="NQ">NQ</option>
                    <option value="XAU">XAU</option>
                    <option value="EUR/USD">EUR/USD</option>
                    <option value="MACRO">GLOBAL / MACRO</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-400 mb-1">ALERT TYPE</label>
                  <select
                    value={alertType}
                    onChange={(e) => setAlertType(e.target.value as any)}
                    className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
                  >
                    <option value="LIQUIDITY">Liquidity Event (Sweep / Test)</option>
                    <option value="SESSION">Session Boundary (15m to open)</option>
                    <option value="RISK_LIMIT">Risk Control (Loss count / DD)</option>
                    <option value="POI">POI Retest</option>
                    <option value="NEWS">Economic News Event</option>
                    <option value="MACRO">Macro Catalyst</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1">CONDITION STATEMENT</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Price sweeps $95,200 Buy-Side Liquidity during NY Session"
                  value={conditionText}
                  onChange={(e) => setConditionText(e.target.value)}
                  className="w-full bg-[#162130] border border-slate-700 rounded px-3 py-2 text-slate-100 outline-none"
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
                  className="px-4 py-1.5 bg-amber-600 hover:bg-amber-500 rounded text-white font-bold"
                >
                  Arm Alert
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
