import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';
import type { WeeklyReview } from '../types';

type Row = { week_start: string; review_data: WeeklyReview; created_at: string; updated_at: string };

const MISSING_TABLE_MESSAGE =
  'Weekly reviews aren\'t set up in Supabase yet. Run supabase/migrations/20261103000000_weekly_reviews.sql in the SQL Editor.';

function isMissingTable(error: { code?: string | null; message?: string }) {
  return error.code === '42P01' || error.code === 'PGRST205' || /trading_os_weekly_reviews/.test(error.message ?? '');
}

const fromRow = (row: Row): WeeklyReview => ({ ...row.review_data, weekStart: row.week_start, createdAt: row.created_at, updatedAt: row.updated_at });

export async function loadWeeklyReviews(supabase: SupabaseClient, userId: string): Promise<WeeklyReview[]> {
  const { data, error } = await supabase
    .from('trading_os_weekly_reviews')
    .select('week_start, review_data, created_at, updated_at')
    .eq('user_id', userId)
    .order('week_start', { ascending: false });
  if (error) throw isMissingTable(error) ? new Error(MISSING_TABLE_MESSAGE) : toSupabaseError(error);
  return (data as Row[] ?? []).map(fromRow);
}

export async function upsertWeeklyReview(supabase: SupabaseClient, userId: string, review: WeeklyReview): Promise<WeeklyReview> {
  const { data, error } = await supabase
    .from('trading_os_weekly_reviews')
    .upsert({ user_id: userId, week_start: review.weekStart, review_data: review, updated_at: new Date().toISOString() }, { onConflict: 'user_id,week_start' })
    .select('week_start, review_data, created_at, updated_at')
    .single();
  if (error) throw isMissingTable(error) ? new Error(MISSING_TABLE_MESSAGE) : toSupabaseError(error);
  return fromRow(data as Row);
}
