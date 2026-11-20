import React from 'react';
import { useTrading } from '../context/TradingContext';
import { ACCOUNT_KIND_LABEL, formatMoney } from '../utils/accounts';

/** Picks the trading accounts a trade or setup is taken on: one, several, or
 * all. Active accounts are listed with their current balance; an archived
 * account only appears if it's already chosen. */
export const AccountPicker: React.FC<{
  label?: string;
  value: string[];
  onChange: (ids: string[]) => void;
  /** Optional line under each account (e.g. the money at risk). */
  detail?: (accountId: string) => string;
}> = ({ label = 'Accounts', value, onChange, detail }) => {
  const { accounts, accountSummaries, accountsError } = useTrading();
  const options = accounts.filter((a) => !a.archivedAt || value.includes(a.id));
  const active = options.filter((a) => !a.archivedAt);
  if (accountsError === 'missing' || options.length === 0) {
    return (
      <div className="space-y-1">
        <span className="block text-xs text-ink-3">{label}</span>
        <p className="text-[11px] text-ink-3">No accounts yet. Add them under Journal → Accounts & capital to track each account's balance.</p>
      </div>
    );
  }
  const allOn = active.length > 0 && active.every((a) => value.includes(a.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const toggleAll = () => onChange(allOn ? [] : active.map((a) => a.id));

  return (
    <fieldset className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <legend className="text-xs text-ink-3">{label} <span className="text-ink-3/80">· tick every account you took it on</span></legend>
        {active.length > 1 && (
          <button type="button" onClick={toggleAll} className="text-xs font-semibold text-sky-400 hover:text-sky-300">
            {allOn ? 'Clear all' : 'Select all'}
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {options.map((a) => {
          const on = value.includes(a.id);
          const extra = on && detail ? detail(a.id) : '';
          return (
            <label key={a.id} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2 text-sm ${on ? 'border-sky-500 bg-sky-500/10' : 'border-line bg-raised hover:border-line-strong'}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(a.id)} className="mt-0.5 h-4 w-4 accent-sky-500" />
              <span className="min-w-0">
                <span className="block truncate font-medium text-ink">{a.name}{a.archivedAt ? ' (archived)' : ''}</span>
                <span className="block truncate text-xs text-ink-3">
                  {ACCOUNT_KIND_LABEL[a.kind]} · {formatMoney(accountSummaries[a.id]?.balance ?? a.startingBalance, a.currency)}
                </span>
                {extra && <span className="block truncate text-xs text-ink-2">{extra}</span>}
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
