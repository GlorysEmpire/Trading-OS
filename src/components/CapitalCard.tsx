import React, { useEffect, useState } from 'react';
import { useTrading } from '../context/TradingContext';

export const CapitalCard: React.FC = () => {
  const {
    capitalSettings, capitalSummary, capitalLoading, capitalError,
    updateCapitalSettings,
  } = useTrading();
  const [editing, setEditing] = useState(false);
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  useEffect(() => {
    setAmount(capitalSettings ? String(capitalSettings.startingCapital) : '');
    setCurrency(capitalSettings?.currency ?? 'USD');
  }, [capitalSettings]);

  const money = (value: number) => {
    try {
      return new Intl.NumberFormat(undefined, {
        style: 'currency', currency: capitalSettings?.currency ?? 'USD',
        maximumFractionDigits: 2,
      }).format(value);
    } catch {
      return `${capitalSettings?.currency ?? 'USD'} ${value.toFixed(2)}`;
    }
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaveError(null);
    setSaving(true);
    try {
      await updateCapitalSettings({ startingCapital: Number(amount), currency: currency.trim().toUpperCase() });
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : 'Could not save starting capital');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-panel border border-line rounded-xl p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h4 className="text-sm font-semibold text-ink">Trading capital</h4>
          <p className="text-xs text-ink-3">Starting amount and estimated balance from closed trades</p>
        </div>
        {!editing && !capitalLoading && (
          <button type="button" onClick={() => setEditing(true)} className="text-xs text-cyan-400 hover:text-cyan-300">
            {capitalSettings ? 'Edit starting capital' : 'Add starting capital'}
          </button>
        )}
      </div>
      {capitalLoading && <p className="text-xs text-ink-3">Loading capital…</p>}
      {capitalError && <p className="text-xs text-rose-400">{capitalError}</p>}
      {capitalSettings && capitalSummary && !editing && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-sm">
          <div><span className="text-xs text-ink-3 block">Starting capital</span><strong className="text-ink font-mono">{money(capitalSettings.startingCapital)}</strong></div>
          <div><span className="text-xs text-ink-3 block">Estimated balance</span><strong className="text-ink font-mono">{money(capitalSummary.currentBalance)}</strong></div>
          <div><span className="text-xs text-ink-3 block">Trade P/L</span><strong className={`font-mono ${capitalSummary.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{money(capitalSummary.netProfit)}</strong></div>
        </div>
      )}
      {capitalSettings && capitalSummary && !editing && (
        <p className="text-xs text-ink-3">
          Based on {capitalSummary.closedTrades} closed, non-voided trades and each trade’s R result.
          {capitalSummary.estimatedTrades > 0 && ` ${capitalSummary.estimatedTrades} older trade(s) use your current Trading HQ risk setting because their original risk was not recorded.`}
          {' '}Deposits, withdrawals, fees, and actual position sizes are not recorded yet.
        </p>
      )}
      {editing && (
        <form onSubmit={save} className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-ink-3">Starting capital
            <input className="block mt-1 bg-raised border border-line rounded px-3 py-2 text-ink w-40" type="number" min="0.01" step="0.01" value={amount} onChange={e => setAmount(e.target.value)} required />
          </label>
          <label className="text-xs text-ink-3">Currency
            <input className="block mt-1 bg-raised border border-line rounded px-3 py-2 text-ink w-20 uppercase" maxLength={3} value={currency} onChange={e => setCurrency(e.target.value)} required />
          </label>
          <button disabled={saving} className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-50 text-white rounded px-3 py-2 text-xs">{saving ? 'Saving…' : 'Save'}</button>
          <button type="button" onClick={() => setEditing(false)} className="text-xs text-ink-3 px-2 py-2">Cancel</button>
        </form>
      )}
      {saveError && <p className="text-xs text-rose-400">{saveError}</p>}
    </div>
  );
};
