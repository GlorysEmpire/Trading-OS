import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';
import type { DailyDebrief } from '../types';

type Row = { debrief_date: string; debrief_data: DailyDebrief; created_at: string; updated_at: string };

const MISSING_TABLE_MESSAGE =
  'Daily debriefs aren\'t set up in Supabase yet. Run supabase/migrations/20261030000000_daily_debriefs.sql in the SQL Editor.';

function isMissingTable(error: { code?: string | null; message?: string }) {
  return error.code === '42P01' || error.code === 'PGRST205' || /trading_os_daily_debriefs/.test(error.message ?? '');
}

export async function loadDebriefs(supabase: SupabaseClient, userId: string): Promise<DailyDebrief[]> {
  const { data, error } = await supabase
    .from('trading_os_daily_debriefs')
    .select('debrief_date, debrief_data, created_at, updated_at')
    .eq('user_id', userId)
    .order('debrief_date', { ascending: false });
  if (error) throw isMissingTable(error) ? new Error(MISSING_TABLE_MESSAGE) : toSupabaseError(error);
  return (data as Row[] ?? []).map((row) => ({ ...row.debrief_data, date: row.debrief_date, createdAt: row.created_at, updatedAt: row.updated_at }));
}

export async function upsertDebrief(supabase: SupabaseClient, userId: string, debrief: DailyDebrief): Promise<DailyDebrief> {
  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from('trading_os_daily_debriefs')
    .upsert({ user_id: userId, debrief_date: debrief.date, debrief_data: debrief, updated_at: now }, { onConflict: 'user_id,debrief_date' })
    .select('debrief_date, debrief_data, created_at, updated_at')
    .single();
  if (error) throw isMissingTable(error) ? new Error(MISSING_TABLE_MESSAGE) : toSupabaseError(error);
  const row = data as Row;
  return { ...row.debrief_data, date: row.debrief_date, createdAt: row.created_at, updatedAt: row.updated_at };
}
