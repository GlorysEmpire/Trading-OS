import React from 'react';
import { useTrading } from '../context/TradingContext';
import { ACCOUNT_KIND_LABEL, formatMoney } from '../utils/accounts';

/** Picks the trading account a trade or setup belongs to. Shows each active
 * account's current balance; archived accounts are hidden unless already chosen. */
export const AccountSelect: React.FC<{
  id: string;
  value: string;
  onChange: (id: string) => void;
  className: string;
  required?: boolean;
}> = ({ id, value, onChange, className, required }) => {
  const { accounts, accountSummaries, accountsError } = useTrading();
  const options = accounts.filter((a) => !a.archivedAt || a.id === value);
  if (accountsError === 'missing' || options.length === 0) {
    return <p className="text-[11px] text-ink-3">No accounts yet. Add one under Journal → Accounts & capital to track each account's balance.</p>;
  }
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)} className={className} required={required}>
      <option value="" disabled={required}>{required ? 'Choose an account…' : 'No account'}</option>
      {options.map((a) => (
        <option key={a.id} value={a.id}>
          {a.name} · {ACCOUNT_KIND_LABEL[a.kind]} · {formatMoney(accountSummaries[a.id]?.balance ?? a.startingBalance, a.currency)}
          {a.archivedAt ? ' (archived)' : ''}
        </option>
      ))}
    </select>
  );
};
