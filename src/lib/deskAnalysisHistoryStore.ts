import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';
import type { DeskChartPlacement } from '../types';

export type DeskAnalysisScope = 'all' | DeskChartPlacement;
export type DeskAnalysisOutcome = 'TARGET_HIT' | 'INVALIDATED' | 'COMPLETED' | 'RESET';

export interface DeskAnalysisHistory {
  id: string;
  deskId: string;
  scope: DeskAnalysisScope;
  outcome: DeskAnalysisOutcome;
  reason: string;
  snapshot: { symbol: string; content: Record<string, unknown> };
  createdAt: string;
}

type Row = {
  id: string; desk_id: string; scope: DeskAnalysisScope; outcome: DeskAnalysisOutcome;
  reason: string; snapshot: DeskAnalysisHistory['snapshot']; created_at: string;
};

const toHistory = (row: Row): DeskAnalysisHistory => ({
  id: row.id, deskId: row.desk_id, scope: row.scope, outcome: row.outcome,
  reason: row.reason, snapshot: row.snapshot, createdAt: row.created_at,
});

export async function loadDeskAnalysisHistory(supabase: SupabaseClient, deskId: string): Promise<DeskAnalysisHistory[]> {
  const { data, error } = await supabase.from('trading_os_desk_analysis_history')
    .select('id, desk_id, scope, outcome, reason, snapshot, created_at')
    .eq('desk_id', deskId).order('created_at', { ascending: false });
  if (error) throw toSupabaseError(error);
  return ((data ?? []) as Row[]).map(toHistory);
}

export async function archiveAndResetDeskAnalysis(
  supabase: SupabaseClient,
  deskId: string,
  scope: DeskAnalysisScope,
  outcome: DeskAnalysisOutcome,
  reason: string,
): Promise<DeskAnalysisHistory> {
  const { data, error } = await supabase.rpc('trading_os_archive_and_reset_desk_analysis', {
    p_desk_id: deskId, p_scope: scope, p_outcome: outcome, p_reason: reason,
  });
  if (error?.code === '42883' || error?.code === 'PGRST202') {
    throw new Error('The Asset Desk analysis history migration has not been applied in Supabase. Your analysis is unchanged.');
  }
  if (error) throw toSupabaseError(error);
  return toHistory(data as Row);
}
