import React, { useMemo, useState } from 'react';
import { Archive, ArrowDownUp, Pencil, Plus, Trash2, Wallet, X } from 'lucide-react';
import { useTrading } from '../context/TradingContext';
import type { AccountAdjustment, PropRules, TradingAccount, TradingAccountKind } from '../types';
import { ACCOUNT_KIND_LABEL, accountRiskPct, formatMoney, newAccountId, unassignedTrades, type LimitState } from '../utils/accounts';
import { CapitalCard } from './CapitalCard';
import { traderDateString } from '../utils/traderTime';

const input = 'tos-input';
const smallBtn = 'tos-secondary inline-flex items-center gap-1';

const blankAccount = (): TradingAccount => ({
  id: newAccountId(), name: '', kind: 'PERSONAL', broker: '', currency: 'USD', startingBalance: 0, adjustments: [], notes: '', createdAt: new Date().toISOString(),
});

/** Today → Accounts: every trading account with its balance, built from its
 * starting balance, deposits/withdrawals and the trades taken on it. */
export const AccountsCard: React.FC = () => {
  const { accounts, accountSummaries, accountsLoading, accountsError, saveTradingAccount, trades, assignTradesToAccount, capitalSettings, tradingHQ } = useTrading();
  const [editing, setEditing] = useState<TradingAccount | null>(null);
  const [moneyFor, setMoneyFor] = useState<TradingAccount | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const active = accounts.filter((a) => !a.archivedAt);
  const archived = accounts.filter((a) => a.archivedAt);
  const unassigned = useMemo(() => unassignedTrades(trades, accounts), [trades, accounts]);
  const currencies = [...new Set(active.map((a) => a.currency))];

  if (accountsError === 'missing') {
    return (
      <div className="space-y-2">
        <div className="rounded-xl border border-amber-700/60 bg-panel p-4 text-sm text-ink-2">
          <strong className="text-ink">Accounts need a database update.</strong> Run the migration
          <code className="mx-1 rounded bg-raised px-1.5 py-0.5 text-xs">20261120010000_trading_accounts.sql</code>
          once in Supabase, then reload. Until then, the single starting capital below is used.
        </div>
        <CapitalCard />
      </div>
    );
  }

  const archive = async (a: TradingAccount, on: boolean) => {
    if (on && !window.confirm(`Archive "${a.name}"? It disappears from the account pickers. Its trades and history stay.`)) return;
    try { await saveTradingAccount({ ...a, archivedAt: on ? new Date().toISOString() : undefined }); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not save'); }
  };

  const renderAccount = (a: TradingAccount) => {
    const s = accountSummaries[a.id];
    const money = (n: number) => formatMoney(n, a.currency);
    return (
      <div key={a.id} className={`tos-ledger-row space-y-3 rounded-xl border border-line bg-raised ${a.archivedAt ? 'opacity-70' : ''}`}>
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[15px] font-semibold text-ink">{a.name}</span>
              <span className="rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-ink-2">{ACCOUNT_KIND_LABEL[a.kind]}</span>
              {a.archivedAt && <span className="rounded-full border border-line-strong px-2 py-0.5 text-[11px] text-ink-3">Archived</span>}
            </div>
            <p className="mt-0.5 text-xs text-ink-3">
              {[a.broker, `${accountRiskPct(a, tradingHQ.riskRules.riskPerSetupPct)}% risk per trade`, a.propRules?.programme].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {!a.archivedAt && <button type="button" onClick={() => setMoneyFor(a)} className={smallBtn}><ArrowDownUp className="h-3.5 w-3.5" /> Deposit / withdraw</button>}
            <button type="button" onClick={() => setEditing(a)} className={smallBtn} aria-label={`Edit ${a.name}`}><Pencil className="h-3.5 w-3.5" /> Edit</button>
            <button type="button" onClick={() => archive(a, !a.archivedAt)} className={smallBtn}><Archive className="h-3.5 w-3.5" /> {a.archivedAt ? 'Restore' : 'Archive'}</button>
          </div>
        </div>
        {s && (
          <>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Stat label="Balance" value={money(s.balance)} strong />
              <Stat label="Trade P/L" value={`${s.tradePnl >= 0 ? '+' : ''}${money(s.tradePnl)}`} sub={`${s.returnPct >= 0 ? '+' : ''}${s.returnPct}% of start`} tone={s.tradePnl > 0 ? 'up' : s.tradePnl < 0 ? 'down' : undefined} />
              <Stat label="Trades" value={`${s.closedTrades} closed · ${s.openTrades} open`} sub={`${s.wins}W / ${s.losses}L · ${s.totalR >= 0 ? '+' : ''}${s.totalR}R`} />
              <Stat label="Worst dip" value={s.maxDrawdown > 0 ? `−${money(s.maxDrawdown)}` : money(0)} sub={`Started at ${money(a.startingBalance)}`} />
            </div>
            <p className="text-xs text-ink-3">
              {s.adjustmentsTotal !== 0 && <>Deposits/withdrawals: {s.adjustmentsTotal > 0 ? '+' : ''}{money(s.adjustmentsTotal)}. </>}
              {s.estimatedTrades > 0
                ? <>{s.estimatedTrades} trade(s) have no actual P/L entered, so their result is estimated from risk % × R{s.fallbackRiskTrades ? ` (${s.fallbackRiskTrades} using today's Trading HQ risk)` : ''}.</>
                : s.closedTrades > 0 ? <>All closed trades use the actual P/L you entered.</> : <>No closed trades on this account yet.</>}
            </p>
            <PropRulesPanel account={a} />
          </>
        )}
      </div>
    );
  };

  return (
    <section aria-labelledby="accounts-title" className="rounded-xl border border-line bg-panel p-4 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-sky-400" aria-hidden />
          <div>
            <h4 id="accounts-title" className="text-sm font-semibold text-ink">Accounts</h4>
            <p className="text-xs text-ink-3">Each account's balance: starting amount, deposits and withdrawals, plus the trades taken on it.</p>
          </div>
        </div>
        <button type="button" onClick={() => setEditing(blankAccount())} className="inline-flex items-center gap-1.5 rounded-lg bg-sky-600 px-3 py-2 text-sm font-semibold text-white hover:bg-sky-500">
          <Plus className="h-4 w-4" /> Add account
        </button>
      </div>

      {accountsLoading && <p className="text-xs text-ink-3">Loading accounts…</p>}
      {accountsError && accountsError !== 'missing' && <p className="text-xs text-rose-400">{accountsError}</p>}
      {error && <p className="text-xs text-rose-400">{error}</p>}

      {!accountsLoading && accounts.length === 0 && (
        <div className="rounded-lg border border-dashed border-line-strong p-4 text-sm text-ink-2 space-y-2">
          <p>No accounts yet. Add each account you trade (for example a prop challenge and a personal account), then pick the account whenever you log a trade.</p>
          {capitalSettings && (
            <button type="button" className={smallBtn}
              onClick={() => setEditing({ ...blankAccount(), name: 'Main account', currency: capitalSettings.currency, startingBalance: capitalSettings.startingCapital })}>
              Use my saved starting capital ({formatMoney(capitalSettings.startingCapital, capitalSettings.currency)}) as the first account
            </button>
          )}
        </div>
      )}

      {active.length > 1 && currencies.length === 1 && (
        <p className="text-sm text-ink-2">
          Total across {active.length} accounts: <strong className="text-ink">{formatMoney(active.reduce((t, a) => t + (accountSummaries[a.id]?.balance ?? 0), 0), currencies[0])}</strong>
        </p>
      )}

      <div className="space-y-3">{active.map(renderAccount)}</div>

      {unassigned.length > 0 && accounts.length > 0 && (
        <AssignBanner count={unassigned.length} onAssign={async (accountId) => {
          const target = accounts.find((a) => a.id === accountId)!;
          if (!window.confirm(`Put ${unassigned.length} trade(s) on "${target.name}"? Closed trades are moved with a logged amendment.`)) return;
          const r = await assignTradesToAccount(unassigned.map((t) => t.id), accountId, `Assigned to account "${target.name}" (was not on an account)`);
          setError(r.failed.length ? `Moved ${r.moved}; ${r.failed.length} could not be moved: ${r.failed.slice(0, 2).join('; ')}` : null);
        }} />
      )}

      {archived.length > 0 && (
        <div className="space-y-3">
          <button type="button" onClick={() => setShowArchived((v) => !v)} className="text-xs text-ink-3 hover:text-ink">
            {showArchived ? 'Hide' : 'Show'} archived accounts ({archived.length})
          </button>
          {showArchived && archived.map(renderAccount)}
        </div>
      )}

      {editing && (
        <AccountForm
          account={editing}
          isNew={!accounts.some((a) => a.id === editing.id)}
          onCancel={() => setEditing(null)}
          onSave={async (a) => { await saveTradingAccount(a); setEditing(null); }}
        />
      )}
      {moneyFor && (
        <AdjustmentForm
          account={moneyFor}
          onCancel={() => setMoneyFor(null)}
          onSave={async (adj) => { await saveTradingAccount({ ...moneyFor, adjustments: [...moneyFor.adjustments, adj] }); setMoneyFor(null); }}
        />
      )}
    </section>
  );
};

const Stat: React.FC<{ label: string; value: string; sub?: string; strong?: boolean; tone?: 'up' | 'down' }> = ({ label, value, sub, strong, tone }) => (
  <div className="min-w-0">
    <span className="block text-xs text-ink-3">{label}</span>
    <span className={`block truncate font-mono ${strong ? 'text-lg font-semibold text-ink' : 'text-sm font-semibold'} ${tone === 'up' ? 'text-emerald-400' : tone === 'down' ? 'text-rose-400' : strong ? '' : 'text-ink'}`}>{value}</span>
    {sub && <span className="block truncate text-xs text-ink-3">{sub}</span>}
  </div>
);

const AssignBanner: React.FC<{ count: number; onAssign: (accountId: string) => Promise<void> }> = ({ count, onAssign }) => {
  const { accounts } = useTrading();
  const [target, setTarget] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-amber-700/60 bg-amber-500/5 px-3 py-2.5 text-sm">
      <span className="text-ink-2">{count} trade(s) aren't on any account, so they don't count toward a balance.</span>
      <label htmlFor="assign-account" className="sr-only">Account to move them to</label>
      <select id="assign-account" value={target} onChange={(e) => setTarget(e.target.value)} className={`${input} !w-auto`}>
        <option value="">Choose account…</option>
        {accounts.filter((a) => !a.archivedAt).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <button type="button" disabled={!target || busy} onClick={async () => { setBusy(true); try { await onAssign(target); } finally { setBusy(false); } }}
        className="rounded-lg bg-amber-600 px-3 py-2 text-xs font-semibold text-white hover:bg-amber-500 disabled:opacity-40">
        {busy ? 'Moving…' : 'Move them'}
      </button>
    </div>
  );
};

const Modal: React.FC<{ title: string; onClose: () => void; children: React.ReactNode }> = ({ title, onClose, children }) => (
  <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-4" onClick={onClose}>
    <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto space-y-4 rounded-xl border border-line-strong bg-panel p-5 shadow-2xl" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
      <div className="flex items-center justify-between">
        <h4 className="text-base font-semibold text-ink">{title}</h4>
        <button type="button" aria-label="Close" onClick={onClose} className="rounded-lg p-1.5 text-ink-3 hover:bg-raised hover:text-ink"><X className="h-4 w-4" /></button>
      </div>
      {children}
    </div>
  </div>
);

const Field: React.FC<{ id: string; label: string; children: React.ReactNode; wide?: boolean }> = ({ id, label, children, wide }) => (
  <div className={`space-y-1 ${wide ? 'sm:col-span-2' : ''}`}>
    <label htmlFor={id} className="block text-xs text-ink-2">{label}</label>
    {children}
  </div>
);

const AccountForm: React.FC<{ account: TradingAccount; isNew: boolean; onCancel: () => void; onSave: (a: TradingAccount) => Promise<void> }> = ({ account, isNew, onCancel, onSave }) => {
  const [a, setA] = useState(account);
  const { tradingHQ } = useTrading();
  const [balance, setBalance] = useState(account.startingBalance ? String(account.startingBalance) : '');
  const num = (v: number | undefined) => (v === undefined ? '' : String(v));
  const [riskPct, setRiskPct] = useState(num(account.riskPct));
  const r0 = account.propRules ?? {};
  const [rules, setRules] = useState({
    programme: r0.programme ?? '',
    dailyLossPct: num(r0.dailyLossPct),
    dailyLossBasis: r0.dailyLossBasis ?? 'STARTING_BALANCE',
    maxLossPct: num(r0.maxLossPct),
    maxLossType: r0.maxLossType ?? 'STATIC',
    trailingLocksAtStart: r0.trailingLocksAtStart ?? false,
    profitTargetPct: num(r0.profitTargetPct),
    minTradingDays: num(r0.minTradingDays),
  });
  const setRule = (patch: Partial<typeof rules>) => setRules((prev) => ({ ...prev, ...patch }));
  const isProp = a.kind === 'PROP_CHALLENGE' || a.kind === 'PROP_FUNDED';
  const opt = (v: string) => (v.trim() === '' ? undefined : Number(v));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (patch: Partial<TradingAccount>) => setA((prev) => ({ ...prev, ...patch }));
  const removeAdjustment = (id: string) => set({ adjustments: a.adjustments.filter((x) => x.id !== id) });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    const propRules: PropRules | undefined = isProp ? {
      programme: rules.programme.trim() || undefined,
      dailyLossPct: opt(rules.dailyLossPct),
      dailyLossBasis: rules.dailyLossBasis as PropRules['dailyLossBasis'],
      maxLossPct: opt(rules.maxLossPct),
      maxLossType: rules.maxLossType as PropRules['maxLossType'],
      trailingLocksAtStart: rules.maxLossType === 'TRAILING' ? rules.trailingLocksAtStart : undefined,
      profitTargetPct: opt(rules.profitTargetPct),
      minTradingDays: opt(rules.minTradingDays),
    } : undefined;
    try { await onSave({ ...a, name: a.name.trim(), currency: a.currency.trim().toUpperCase(), startingBalance: Number(balance), riskPct: opt(riskPct), propRules }); }
    catch (err) { setError(err instanceof Error ? err.message : 'Could not save the account'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={isNew ? 'Add account' : `Edit ${account.name}`} onClose={onCancel}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="acc-name" label="Name" wide>
            <input id="acc-name" value={a.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. FundingPips 25k Stage 1" className={input} required />
          </Field>
          <Field id="acc-kind" label="Type">
            <select id="acc-kind" value={a.kind} onChange={(e) => set({ kind: e.target.value as TradingAccountKind })} className={input}>
              {(Object.keys(ACCOUNT_KIND_LABEL) as TradingAccountKind[]).map((k) => <option key={k} value={k}>{ACCOUNT_KIND_LABEL[k]}</option>)}
            </select>
          </Field>
          <Field id="acc-broker" label="Broker / firm (optional)">
            <input id="acc-broker" value={a.broker} onChange={(e) => set({ broker: e.target.value })} placeholder="e.g. FundingPips · MT5" className={input} />
          </Field>
          <Field id="acc-start" label="Starting balance">
            <input id="acc-start" type="number" min="0.01" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} className={input} required />
          </Field>
          <Field id="acc-cur" label="Currency">
            <input id="acc-cur" value={a.currency} maxLength={3} onChange={(e) => set({ currency: e.target.value.toUpperCase() })} className={`${input} uppercase`} required />
          </Field>
          <Field id="acc-risk" label={`Risk per trade, % of balance (blank = Trading HQ's ${tradingHQ.riskRules.riskPerSetupPct}%)`} wide>
            <input id="acc-risk" type="number" min="0.01" max="100" step="0.01" value={riskPct} onChange={(e) => setRiskPct(e.target.value)} placeholder={String(tradingHQ.riskRules.riskPerSetupPct)} className={input} />
          </Field>
          <Field id="acc-notes" label="Notes (optional)" wide>
            <input id="acc-notes" value={a.notes} onChange={(e) => set({ notes: e.target.value })} placeholder="e.g. 8% target, 5% daily loss, 10% max loss" className={input} />
          </Field>
        </div>
        {isProp && (
          <fieldset className="space-y-3 rounded-lg border border-line p-3">
            <legend className="px-1 text-xs font-semibold text-ink-2">Prop firm rules</legend>
            <p className="text-xs text-ink-3">As % of the starting balance unless set otherwise. Leave a box blank if the firm has no such rule.</p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="pr-prog" label="Programme (optional)" wide>
                <input id="pr-prog" value={rules.programme} onChange={(e) => setRule({ programme: e.target.value })} placeholder="e.g. FundingPips 2-step, Phase 1" className={input} />
              </Field>
              <Field id="pr-daily" label="Daily loss limit %">
                <input id="pr-daily" type="number" min="0.01" max="100" step="0.01" value={rules.dailyLossPct} onChange={(e) => setRule({ dailyLossPct: e.target.value })} placeholder="e.g. 5" className={input} />
              </Field>
              <Field id="pr-daily-basis" label="Daily limit measured from">
                <select id="pr-daily-basis" value={rules.dailyLossBasis} onChange={(e) => setRule({ dailyLossBasis: e.target.value as 'STARTING_BALANCE' })} className={input}>
                  <option value="STARTING_BALANCE">Starting balance</option>
                  <option value="DAY_START_BALANCE">Balance at the start of each day</option>
                </select>
              </Field>
              <Field id="pr-max" label="Max loss / drawdown %">
                <input id="pr-max" type="number" min="0.01" max="100" step="0.01" value={rules.maxLossPct} onChange={(e) => setRule({ maxLossPct: e.target.value })} placeholder="e.g. 10" className={input} />
              </Field>
              <Field id="pr-max-type" label="Max drawdown type">
                <select id="pr-max-type" value={rules.maxLossType} onChange={(e) => setRule({ maxLossType: e.target.value as 'STATIC' })} className={input}>
                  <option value="STATIC">Static (fixed floor below the start)</option>
                  <option value="TRAILING">Trailing (floor follows the highest balance)</option>
                </select>
              </Field>
              {rules.maxLossType === 'TRAILING' && (
                <label className="flex items-center gap-2 text-sm text-ink-2 sm:col-span-2">
                  <input type="checkbox" checked={rules.trailingLocksAtStart} onChange={(e) => setRule({ trailingLocksAtStart: e.target.checked })} className="h-4 w-4 accent-sky-500" />
                  Floor stops trailing once it reaches the starting balance
                </label>
              )}
              <Field id="pr-target" label="Profit target % (optional)">
                <input id="pr-target" type="number" min="0.01" max="100" step="0.01" value={rules.profitTargetPct} onChange={(e) => setRule({ profitTargetPct: e.target.value })} placeholder="e.g. 8" className={input} />
              </Field>
              <Field id="pr-days" label="Minimum trading days (optional)">
                <input id="pr-days" type="number" min="1" step="1" value={rules.minTradingDays} onChange={(e) => setRule({ minTradingDays: e.target.value })} placeholder="e.g. 3" className={input} />
              </Field>
            </div>
          </fieldset>
        )}
        {a.adjustments.length > 0 && (
          <div className="space-y-1.5">
            <span className="block text-xs text-ink-2">Deposits and withdrawals</span>
            {a.adjustments.map((x) => (
              <div key={x.id} className="flex items-center justify-between gap-2 rounded-lg border border-line bg-raised px-3 py-1.5 text-xs">
                <span className="text-ink-2">{x.date} · {x.note || (x.amount > 0 ? 'Deposit' : 'Withdrawal')}</span>
                <span className="flex items-center gap-2">
                  <span className={`font-mono font-semibold ${x.amount > 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{x.amount > 0 ? '+' : ''}{formatMoney(x.amount, a.currency)}</span>
                  <button type="button" aria-label="Remove this entry" onClick={() => removeAdjustment(x.id)} className="text-ink-3 hover:text-rose-400"><Trash2 className="h-3.5 w-3.5" /></button>
                </span>
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-line bg-raised px-4 py-2 text-sm text-ink-2 hover:text-ink">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
};

const KINDS = [
  { id: 'deposit', label: 'Deposit', sign: 1 },
  { id: 'withdrawal', label: 'Withdrawal', sign: -1 },
  { id: 'payout', label: 'Payout', sign: -1 },
  { id: 'fee', label: 'Fee / charge', sign: -1 },
] as const;

const AdjustmentForm: React.FC<{ account: TradingAccount; onCancel: () => void; onSave: (adj: AccountAdjustment) => Promise<void> }> = ({ account, onCancel, onSave }) => {
  const [kind, setKind] = useState<(typeof KINDS)[number]['id']>('deposit');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(traderDateString(new Date()));
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const k = KINDS.find((x) => x.id === kind)!;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const n = Math.abs(Number(amount));
    if (!Number.isFinite(n) || n === 0) { setError('Enter an amount.'); return; }
    setSaving(true); setError(null);
    try {
      await onSave({ id: `adj-${Date.now().toString(36)}`, date, amount: k.sign * n, note: note.trim() || k.label });
    } catch (err) { setError(err instanceof Error ? err.message : 'Could not save'); }
    finally { setSaving(false); }
  };

  return (
    <Modal title={`Money in or out · ${account.name}`} onClose={onCancel}>
      <form onSubmit={submit} className="space-y-4">
        <div role="radiogroup" aria-label="Type" className="flex flex-wrap gap-2">
          {KINDS.map((x) => (
            <button key={x.id} type="button" role="radio" aria-checked={kind === x.id} onClick={() => setKind(x.id)}
              className={`rounded-lg border px-3 py-2 text-sm ${kind === x.id ? 'border-sky-500 bg-sky-500/10 font-semibold text-ink' : 'border-line bg-raised text-ink-2'}`}>{x.label}</button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Field id="adj-amount" label={`Amount (${account.currency})`}>
            <input id="adj-amount" type="number" min="0.01" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className={input} required />
          </Field>
          <Field id="adj-date" label="Date">
            <input id="adj-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} className={input} required />
          </Field>
          <Field id="adj-note" label="Note (optional)" wide>
            <input id="adj-note" value={note} onChange={(e) => setNote(e.target.value)} placeholder={k.label} className={input} />
          </Field>
        </div>
        <p className="text-xs text-ink-3">{k.sign > 0 ? 'Adds to' : 'Takes from'} the balance. It doesn't count as trading profit or loss.</p>
        {error && <p className="text-sm text-rose-400">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="rounded-lg border border-line bg-raised px-4 py-2 text-sm text-ink-2 hover:text-ink">Cancel</button>
          <button type="submit" disabled={saving} className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50">{saving ? 'Saving…' : 'Save'}</button>
        </div>
      </form>
    </Modal>
  );
};

const STATE_TEXT: Record<LimitState, { label: string; bar: string; text: string }> = {
  OK: { label: 'OK', bar: 'bg-sky-500', text: 'text-ink-2' },
  CLOSE: { label: 'Close to limit', bar: 'bg-amber-500', text: 'text-amber-300' },
  BREACHED: { label: 'Limit reached', bar: 'bg-rose-500', text: 'text-rose-300' },
};

const Meter: React.FC<{ label: string; used: number; limit: number; state: LimitState; detail: string; sub?: string }> = ({ label, used, limit, state, detail, sub }) => {
  const pct = limit > 0 ? Math.min(100, Math.max(0, (used / limit) * 100)) : 0;
  const st = STATE_TEXT[state];
  return (
    <div className="space-y-1">
      <div className="flex items-baseline justify-between gap-2 text-xs">
        <span className="text-ink-2">{label}</span>
        <span className={`font-semibold ${st.text}`}>{st.label}</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-well" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pct)}>
        <div className={`h-full rounded-full ${st.bar}`} style={{ width: `${pct}%` }} />
      </div>
      <p className="text-xs text-ink-3">{detail}</p>
      {sub && <p className="text-xs text-ink-3">{sub}</p>}
    </div>
  );
};

/** A prop account's standing against its firm's rules (New York trading day). */
const PropRulesPanel: React.FC<{ account: TradingAccount }> = ({ account }) => {
  const { accountPropStatus } = useTrading();
  const st = accountPropStatus[account.id];
  if (!account.propRules || !st || (!st.daily && !st.max && !st.target && !st.tradingDays)) return null;
  const money = (n: number) => formatMoney(n, account.currency);
  return (
    <div className="grid grid-cols-1 gap-4 rounded-lg border border-line bg-well/60 p-3 sm:grid-cols-2">
      {st.daily && (
        <Meter label={`Daily loss · ${account.propRules.dailyLossPct}% of ${st.daily.basis === 'DAY_START_BALANCE' ? "today's opening balance" : 'starting balance'}`}
          used={st.daily.used} limit={st.daily.limit} state={st.daily.state}
          detail={`Lost today ${money(st.daily.used)} of ${money(st.daily.limit)} · ${money(st.daily.remaining)} left`}
          sub={st.openRisk > 0 ? `If open trades stop out: ${money(st.daily.usedIfOpenStopped)} lost today` : undefined} />
      )}
      {st.max && (
        <Meter label={`Max loss · ${account.propRules.maxLossPct}% ${st.max.type === 'TRAILING' ? 'trailing' : 'static'}`}
          used={st.max.limit - st.max.remaining} limit={st.max.limit} state={st.max.state}
          detail={`Stay above ${money(st.max.floor)} · ${money(st.max.remaining)} of room left`}
          sub={st.openRisk > 0 ? `If open trades stop out: ${money(Math.max(0, st.max.remainingIfOpenStopped))} left` : undefined} />
      )}
      {st.target && (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="text-ink-2">Profit target · {account.propRules.profitTargetPct}%</span>
            <span className={`font-semibold ${st.target.reached ? 'text-emerald-400' : 'text-ink-2'}`}>{st.target.reached ? 'Reached' : `${Math.max(0, Math.round((st.target.progress / st.target.amount) * 100))}%`}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-well" role="meter" aria-label="Profit target progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(Math.max(0, Math.min(100, (st.target.progress / st.target.amount) * 100)))}>
            <div className="h-full rounded-full bg-emerald-500" style={{ width: `${Math.max(0, Math.min(100, (st.target.progress / st.target.amount) * 100))}%` }} />
          </div>
          <p className="text-xs text-ink-3">{money(Math.max(0, st.target.progress))} of {money(st.target.amount)}</p>
        </div>
      )}
      {st.tradingDays && (
        <div className="space-y-1 text-xs">
          <span className="text-ink-2">Trading days</span>
          <p className={st.tradingDays.done >= st.tradingDays.required ? 'font-semibold text-emerald-400' : 'text-ink-3'}>{st.tradingDays.done} of {st.tradingDays.required} minimum</p>
        </div>
      )}
      <p className="text-[11px] text-ink-3 sm:col-span-2">From the trades and P/L recorded here (closed trades; estimates where no actual P/L was entered). Your firm's dashboard is the final word.</p>
    </div>
  );
};
