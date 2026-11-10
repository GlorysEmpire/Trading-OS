import { describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Trade } from '../types';
import { saveHQCategory, type HQConfigRow } from './hqStore';
import { amendTradeRecord } from './tradeStore';
import { archiveAndResetDeskAnalysis } from './deskAnalysisHistoryStore';

const row: HQConfigRow = {
  id: 'hq-1', category: 'risk', version: 3, content: {}, changed_reason: null,
  updated_at: '2026-11-10T00:00:00Z',
};

function client(result: unknown) {
  const rpc = vi.fn().mockResolvedValue(result);
  const from = vi.fn(() => { throw new Error('Unexpected separate table write'); });
  return { supabase: { rpc, from } as unknown as SupabaseClient, rpc, from };
}

describe('atomic database writes', () => {
  it('revises Trading HQ through one RPC with an expected version', async () => {
    const { supabase, rpc, from } = client({ error: null });
    await saveHQCategory(supabase, row, { riskPerSetupPct: 0.5 }, 'Reduced risk');
    expect(rpc).toHaveBeenCalledWith('trading_os_replace_hq_category', {
      p_row_id: 'hq-1', p_expected_version: 3,
      p_content: { riskPerSetupPct: 0.5 }, p_reason: 'Reduced risk',
    });
    expect(from).not.toHaveBeenCalled();
  });

  it('does not fall back to separate writes when the HQ migration is absent', async () => {
    const { supabase, from } = client({ error: { code: 'PGRST202', message: 'missing function' } });
    await expect(saveHQCategory(supabase, row, {}, 'test')).rejects.toThrow(/migration has not been applied/);
    expect(from).not.toHaveBeenCalled();
  });

  it('amends a trade and its audit record in one RPC', async () => {
    const before = { id: 'tr-1', configVersionUsed: 'v3', exitPrice: 100 } as Trade;
    const after = { ...before, exitPrice: 101 };
    const { supabase, rpc, from } = client({
      data: { id: 'am-1', trade_id: 'tr-1', kind: 'AMEND', reason: 'Corrected price', changes: [], created_at: '2026-11-10T00:00:00Z' },
      error: null,
    });
    const amendment = await amendTradeRecord(supabase, before, after, 'AMEND', 'Corrected price');
    expect(rpc).toHaveBeenCalledWith('trading_os_amend_trade', {
      p_trade_id: 'tr-1', p_expected_trade_data: before, p_next_trade_data: after,
      p_kind: 'AMEND', p_reason: 'Corrected price',
    });
    expect(amendment.tradeId).toBe('tr-1');
    expect(from).not.toHaveBeenCalled();
  });

  it('archives and resets the selected Asset Desk scope in one RPC', async () => {
    const { supabase, rpc, from } = client({
      data: {
        id: 'history-1', desk_id: 'desk-1', scope: 'h4', outcome: 'INVALIDATED',
        reason: 'External structure broke', snapshot: { symbol: 'BTC', content: { structure: 'old H4' } },
        created_at: '2026-11-10T00:00:00Z',
      },
      error: null,
    });
    const history = await archiveAndResetDeskAnalysis(supabase, 'desk-1', 'h4', 'INVALIDATED', 'External structure broke');
    expect(rpc).toHaveBeenCalledWith('trading_os_archive_and_reset_desk_analysis', {
      p_desk_id: 'desk-1', p_scope: 'h4', p_outcome: 'INVALIDATED', p_reason: 'External structure broke',
    });
    expect(history.snapshot.content.structure).toBe('old H4');
    expect(from).not.toHaveBeenCalled();
  });
});
