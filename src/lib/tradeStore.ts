import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trade } from '../types';

type Row = { id: string; trade_data: Trade; created_at: string };

export async function loadTrades(supabase: SupabaseClient, userId: string): Promise<Trade[]> {
  const { data, error } = await supabase.from('trading_os_trade_records').select('id, trade_data, created_at').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw error;
  return (data as Row[] ?? []).map(row => ({ ...row.trade_data, id: row.id }));
}

export async function saveTrade(supabase: SupabaseClient, userId: string, trade: Trade) {
  const { error } = await supabase.from('trading_os_trade_records').upsert({ id: trade.id, user_id: userId, trade_data: trade, hq_config_version: trade.configVersionUsed, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw error;
}

export async function removeTrade(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('trading_os_trade_records').delete().eq('id', id);
  if (error) throw error;
}

export async function importTradesOnce(supabase: SupabaseClient, userId: string, trades: Trade[]) {
  if (!trades.length) return 0;
  for (const trade of trades) await saveTrade(supabase, userId, trade);
  return trades.length;
}
