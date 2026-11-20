import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';
import type { AccountAdjustment, PropRules, TradingAccount, TradingAccountKind } from '../types';

type AccountRow = {
  id: string;
  name: string;
  kind: string;
  broker: string;
  currency: string;
  starting_balance: number | string;
  adjustments: AccountAdjustment[] | null;
  notes: string;
  archived_at: string | null;
  created_at: string;
  /** Added by migration 20261120030000; absent before it. */
  settings?: { riskPct?: number; propRules?: PropRules } | null;
};

// '*' so the app still loads accounts before the settings column exists.
const COLUMNS = '*';

function rowToAccount(row: AccountRow): TradingAccount {
  return {
    id: row.id,
    name: row.name,
    kind: (row.kind as TradingAccountKind) || 'OTHER',
    broker: row.broker ?? '',
    currency: row.currency,
    startingBalance: Number(row.starting_balance),
    adjustments: Array.isArray(row.adjustments) ? row.adjustments : [],
    notes: row.notes ?? '',
    archivedAt: row.archived_at ?? undefined,
    createdAt: row.created_at,
    riskPct: row.settings?.riskPct,
    propRules: row.settings?.propRules,
  };
}

/** True when the accounts table isn't on the database yet. */
export function isMissingAccountsTable(error: unknown): boolean {
  const e = error as { code?: string; message?: string } | null;
  return e?.code === '42P01' || e?.code === 'PGRST205' || /trading_os_accounts/.test(e?.message ?? '');
}

export async function loadAccounts(supabase: SupabaseClient, userId: string): Promise<TradingAccount[]> {
  const { data, error } = await supabase.from('trading_os_accounts').select(COLUMNS).eq('user_id', userId).order('created_at');
  if (error) throw isMissingAccountsTable(error) ? Object.assign(new Error('ACCOUNTS_TABLE_MISSING'), { code: 'ACCOUNTS_TABLE_MISSING' }) : toSupabaseError(error);
  return (data ?? []).map((r) => rowToAccount(r as AccountRow));
}

export function validateAccount(a: TradingAccount) {
  if (!a.name.trim()) throw new Error('Give the account a name.');
  if (!Number.isFinite(a.startingBalance) || a.startingBalance <= 0) throw new Error('Starting balance must be greater than zero.');
  if (!/^[A-Z]{3}$/.test(a.currency)) throw new Error('Enter a three-letter currency code, e.g. USD.');
  if (a.riskPct !== undefined && (!Number.isFinite(a.riskPct) || a.riskPct <= 0 || a.riskPct > 100)) throw new Error('Risk per trade must be between 0 and 100%.');
  const r = a.propRules;
  for (const [label, v] of [['Daily loss', r?.dailyLossPct], ['Max loss', r?.maxLossPct], ['Profit target', r?.profitTargetPct]] as const) {
    if (v !== undefined && (!Number.isFinite(v) || v <= 0 || v > 100)) throw new Error(`${label} must be between 0 and 100%.`);
  }
  for (const adj of a.adjustments) {
    if (!Number.isFinite(adj.amount) || adj.amount === 0) throw new Error('Each deposit or withdrawal needs a non-zero amount.');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(adj.date)) throw new Error('Each deposit or withdrawal needs a date.');
  }
}

export async function saveAccount(supabase: SupabaseClient, userId: string, a: TradingAccount): Promise<void> {
  validateAccount(a);
  const { error } = await supabase.from('trading_os_accounts').upsert({
    id: a.id,
    user_id: userId,
    name: a.name.trim(),
    kind: a.kind,
    broker: a.broker.trim(),
    currency: a.currency,
    starting_balance: a.startingBalance,
    adjustments: a.adjustments,
    notes: a.notes,
    archived_at: a.archivedAt ?? null,
    settings: { riskPct: a.riskPct, propRules: a.propRules },
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) {
    if (/settings/.test(error.message ?? '')) throw new Error('Saving risk and prop rules needs the database update 20261120030000_account_rules.sql. Run it once in Supabase, then try again.');
    throw toSupabaseError(error);
  }
}
