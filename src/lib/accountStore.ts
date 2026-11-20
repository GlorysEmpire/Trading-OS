import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';
import type { AccountAdjustment, TradingAccount, TradingAccountKind } from '../types';

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
};

const COLUMNS = 'id, name, kind, broker, currency, starting_balance, adjustments, notes, archived_at, created_at';

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
    updated_at: new Date().toISOString(),
  }, { onConflict: 'id' });
  if (error) throw toSupabaseError(error);
}
