import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';
import type { ResearchQuestion } from '../types';

type Row = { id: string; rq_data: ResearchQuestion; created_at: string };

export async function loadResearchQuestions(supabase: SupabaseClient, userId: string): Promise<ResearchQuestion[]> {
  const { data, error } = await supabase
    .from('trading_os_research_questions')
    .select('id, rq_data, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw toSupabaseError(error);
  return (data as Row[] ?? []).map(row => ({ ...row.rq_data, id: row.id }));
}

export async function saveResearchQuestion(supabase: SupabaseClient, userId: string, rq: ResearchQuestion) {
  const { error } = await supabase
    .from('trading_os_research_questions')
    .upsert({ id: rq.id, user_id: userId, rq_data: rq, status: rq.status, updated_at: new Date().toISOString() }, { onConflict: 'id' });
  if (error) throw toSupabaseError(error);
}

export async function removeResearchQuestion(supabase: SupabaseClient, id: string) {
  const { error } = await supabase.from('trading_os_research_questions').delete().eq('id', id);
  if (error) throw toSupabaseError(error);
}

export async function importResearchQuestionsOnce(supabase: SupabaseClient, userId: string, rqs: ResearchQuestion[]) {
  if (!rqs.length) return 0;
  for (const rq of rqs) await saveResearchQuestion(supabase, userId, rq);
  return rqs.length;
}
