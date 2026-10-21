import type { SupabaseClient } from '@supabase/supabase-js';
import type { BacktestSample } from '../types';

type Row = { id: string; sample_data: BacktestSample; created_at: string };

export async function loadBacktestSamples(supabase: SupabaseClient, userId: string): Promise<BacktestSample[]> {
  const { data, error } = await supabase
    .from('trading_os_backtest_samples')
    .select('id, sample_data, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Row[] ?? []).map(row => ({ ...row.sample_data, id: row.id }));
}

export async function saveBacktestSample(supabase: SupabaseClient, userId: string, sample: BacktestSample) {
  const { error } = await supabase
    .from('trading_os_backtest_samples')
    .upsert(
      { id: sample.id, user_id: userId, research_question_id: sample.researchQuestionId || null, sample_data: sample, updated_at: new Date().toISOString() },
      { onConflict: 'id' }
    );
  if (error) throw error;
}

export async function removeBacktestSample(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('trading_os_backtest_samples').delete().eq('id', id);
  if (error) throw error;
}

export async function importBacktestSamplesOnce(supabase: SupabaseClient, userId: string, samples: BacktestSample[]) {
  if (!samples.length) return 0;
  for (const sample of samples) await saveBacktestSample(supabase, userId, sample);
  return samples.length;
}
