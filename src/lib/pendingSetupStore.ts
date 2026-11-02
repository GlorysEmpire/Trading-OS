import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';
import type { PendingSetup } from '../types';

type Row = { id: string; setup_data: PendingSetup };

const MISSING_TABLE_MESSAGE =
  'Pending setups aren\'t set up in Supabase yet. Run supabase/migrations/20261105000000_pending_setups.sql in the SQL Editor.';

function isMissingTable(error: { code?: string | null; message?: string }) {
  return error.code === '42P01' || error.code === 'PGRST205' || /trading_os_pending_setups/.test(error.message ?? '');
}

export async function loadPendingSetups(supabase: SupabaseClient, userId: string): Promise<PendingSetup[]> {
  const { data, error } = await supabase
    .from('trading_os_pending_setups')
    .select('id, setup_data')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw isMissingTable(error) ? new Error(MISSING_TABLE_MESSAGE) : toSupabaseError(error);
  return (data as Row[] ?? []).map((row) => ({ ...row.setup_data, id: row.id }));
}

export async function savePendingSetup(supabase: SupabaseClient, userId: string, setup: PendingSetup) {
  const { error } = await supabase.from('trading_os_pending_setups').upsert(
    { id: setup.id, user_id: userId, desk_id: setup.deskId, status: setup.status, setup_data: setup, updated_at: new Date().toISOString() },
    { onConflict: 'id' },
  );
  if (error) throw isMissingTable(error) ? new Error(MISSING_TABLE_MESSAGE) : toSupabaseError(error);
}
