import React, { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import type { AccountRisk } from '../types';
import { accountRiskPct, formatMoney, riskWarnings } from '../utils/accounts';

export type RiskDraft = Record<string, { pct: string; amount: string }>;

const round2 = (n: number) => Math.round(n * 100) / 100;

/** Parsed risk per account, or null if any box isn't a positive number. */
export function parseRiskDraft(accountIds: string[], draft: RiskDraft): Record<string, AccountRisk> | null {
  const out: Record<string, AccountRisk> = {};
  for (const id of accountIds) {
    const pct = Number(draft[id]?.pct);
    const amount = Number(draft[id]?.amount);
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100 || !Number.isFinite(amount) || amount <= 0) return null;
    out[id] = { pct: round2(pct), amount: round2(amount) };
  }
  return out;
}

/** Risk on each ticked account, as % of its balance or as an amount; typing
 * one fills the other. Starts at each account's own risk per trade. */
export const RiskInputs: React.FC<{
  accountIds: string[];
  value: RiskDraft;
  onChange: (next: RiskDraft) => void;
  field: string;
}> = ({ accountIds, value, onChange, field }) => {
  const { accounts, accountSummaries, accountPropStatus, tradingHQ } = useTrading();
  const hqPct = tradingHQ.riskRules.riskPerSetupPct;
  const balanceOf = (id: string) => {
    const a = accounts.find((x) => x.id === id);
    return accountSummaries[id]?.balance ?? a?.startingBalance ?? 0;
  };

  // Fill in defaults for newly ticked accounts.
  useEffect(() => {
    const missing = accountIds.filter((id) => !value[id]);
    if (!missing.length) return;
    const next = { ...value };
    for (const id of missing) {
      const a = accounts.find((x) => x.id === id);
      if (!a) continue;
      const pct = accountRiskPct(a, hqPct);
      next[id] = { pct: String(pct), amount: String(round2((balanceOf(id) * pct) / 100)) };
    }
    onChange(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountIds.join('|'), accounts]);

  const setPct = (id: string, pct: string) => {
    const n = Number(pct);
    onChange({ ...value, [id]: { pct, amount: Number.isFinite(n) && pct.trim() ? String(round2((balanceOf(id) * n) / 100)) : value[id]?.amount ?? '' } });
  };
  const setAmount = (id: string, amount: string) => {
    const n = Number(amount);
    const bal = balanceOf(id);
    onChange({ ...value, [id]: { amount, pct: Number.isFinite(n) && amount.trim() && bal > 0 ? String(round2((n / bal) * 100)) : value[id]?.pct ?? '' } });
  };

  const warnings = accountIds.flatMap((id) => {
    const a = accounts.find((x) => x.id === id);
    const pct = Number(value[id]?.pct);
    const amount = Number(value[id]?.amount);
    if (!a || !Number.isFinite(pct) || !Number.isFinite(amount)) return [];
    return riskWarnings(a, { pct, amount }, hqPct, accountPropStatus[id]);
  });

  return (
    <div className="space-y-2">
      <span className="block text-xs text-ink-3">Risk on each account · enter % or amount, the other fills in</span>
      {accountIds.map((id) => {
        const a = accounts.find((x) => x.id === id);
        if (!a) return null;
        return (
          <div key={id} className="grid grid-cols-[minmax(0,1fr)_96px_128px] items-center gap-2">
            <span className="min-w-0">
              <span className="block truncate text-sm text-ink">{a.name}</span>
              <span className="block truncate text-[11px] text-ink-3">Allowed {accountRiskPct(a, hqPct)}% · balance {formatMoney(balanceOf(id), a.currency)}</span>
            </span>
            <label className="relative">
              <span className="sr-only">Risk % on {a.name}</span>
              <input type="number" min="0.01" max="100" step="0.01" value={value[id]?.pct ?? ''} onChange={(e) => setPct(id, e.target.value)} className={`${field} pr-6`} />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-ink-3">%</span>
            </label>
            <label className="relative">
              <span className="sr-only">Risk amount on {a.name} ({a.currency})</span>
              <input type="number" min="0.01" step="0.01" value={value[id]?.amount ?? ''} onChange={(e) => setAmount(id, e.target.value)} className={`${field} pr-11`} />
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[11px] text-ink-3">{a.currency}</span>
            </label>
          </div>
        );
      })}
      {warnings.map((w) => (
        <p key={w} className="flex items-start gap-1.5 text-[11px] text-amber-300"><AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" /> {w}</p>
      ))}
    </div>
  );
};
