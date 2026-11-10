import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';
import type { Trade, TradeAmendment, TradeAmendmentChange } from '../types';

type Row = { id: string; trade_data: Trade; created_at: string };
type AmendmentRow = { id: string; trade_id: string; kind: 'AMEND' | 'VOID'; reason: string; changes: TradeAmendmentChange[]; created_at: string };

export async function loadTrades(supabase: SupabaseClient, userId: string): Promise<Trade[]> {
  const { data, error } = await supabase.from('trading_os_trade_records').select('id, trade_data, created_at').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw toSupabaseError(error);
  return (data as Row[] ?? []).map(row => ({ ...row.trade_data, id: row.id }));
}

export async function saveTrade(supabase: SupabaseClient, userId: string, trade: Trade) {
  const { error } = await supabase.from('trading_os_trade_records').upsert({ id: trade.id, user_id: userId, trade_data: trade, hq_config_version: trade.configVersionUsed, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw toSupabaseError(error);
}

/** Restores/imports only ADD trades that don't exist yet. An existing trade is
 * never overwritten by a backup file — that would be a back door around the
 * trade lock. Returns how many were actually new. */
export async function insertTradesIfNew(supabase: SupabaseClient, userId: string, trades: Trade[]): Promise<number> {
  if (!trades.length) return 0;
  const rows = trades.map(trade => ({ id: trade.id, user_id: userId, trade_data: trade, hq_config_version: trade.configVersionUsed, updated_at: new Date().toISOString() }));
  const { data, error } = await supabase.from('trading_os_trade_records').upsert(rows, { onConflict: 'id', ignoreDuplicates: true }).select('id');
  if (error) throw toSupabaseError(error);
  return (data ?? []).length;
}

export async function loadAmendments(supabase: SupabaseClient, userId: string): Promise<TradeAmendment[]> {
  const { data, error } = await supabase.from('trading_os_trade_amendments').select('id, trade_id, kind, reason, changes, created_at').eq('user_id', userId).order('created_at', { ascending: true });
  if (error) throw toSupabaseError(error);
  return (data as AmendmentRow[] ?? []).map(row => ({ id: row.id, tradeId: row.trade_id, kind: row.kind, reason: row.reason, changes: row.changes ?? [], createdAt: row.created_at }));
}

/** The database writes the audit row and evidence update in one transaction. */
export async function amendTradeRecord(
  supabase: SupabaseClient,
  before: Trade,
  after: Trade,
  kind: 'AMEND' | 'VOID',
  reason: string,
): Promise<TradeAmendment> {
  const { data, error } = await supabase.rpc('trading_os_amend_trade', {
    p_trade_id: before.id,
    p_expected_trade_data: before,
    p_next_trade_data: after,
    p_kind: kind,
    p_reason: reason,
  });
  if (error) {
    if (error.code === '42883' || error.code === 'PGRST202') {
      throw new Error('The atomic trade amendment migration has not been applied in Supabase. The trade was not changed.');
    }
    throw toSupabaseError(error);
  }
  const row = data as AmendmentRow;
  return { id: row.id, tradeId: row.trade_id, kind: row.kind, reason: row.reason, changes: row.changes ?? [], createdAt: row.created_at };
}
