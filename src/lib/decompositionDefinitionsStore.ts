import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';
import { PLACEHOLDER_DEFINITIONS, definitionsVersionName, prepareDefinitionsRevision, type DecompositionDefinitions } from '../decomposition';

/**
 * Market decomposition definitions, stored as their own versioned Trading HQ
 * category ('decomposition_definitions'). Every save deactivates the old row
 * and inserts the next version (same atomic function as the rest of Trading
 * HQ), so older versions stay readable for records that used them.
 */
const CATEGORY = 'decomposition_definitions';

export interface DefinitionsRow {
  id: string;
  rowVersion: number;
  isActive: boolean;
  definitions: DecompositionDefinitions;
  changedReason: string | null;
  updatedAt: string;
}

/** Thrown when the category isn't allowed by the database yet (migration not applied). */
export class DefinitionsNotReadyError extends Error {
  constructor() {
    super('Decomposition definitions need a one-time database update before they can be saved in Trading HQ. Until then the placeholder definitions are used.');
  }
}

const notReady = (e: { code?: string; message?: string } | null) => e?.code === '23514' || /category_check/.test(e?.message ?? '');

type Row = { id: string; version: number; is_active: boolean; content: DecompositionDefinitions; changed_reason: string | null; updated_at: string };

const toRow = (r: Row): DefinitionsRow => ({
  id: r.id,
  rowVersion: r.version,
  isActive: r.is_active,
  // The stored content always carries its version name; fill it if an old row lacks it.
  definitions: { ...PLACEHOLDER_DEFINITIONS, ...r.content, version: r.content?.version || definitionsVersionName(r.version) },
  changedReason: r.changed_reason,
  updatedAt: r.updated_at,
});

/** Every version, newest first (active and past). */
export async function loadDefinitionsHistory(supabase: SupabaseClient, userId: string): Promise<DefinitionsRow[]> {
  const { data, error } = await supabase
    .from('trading_hq_configs')
    .select('id, version, is_active, content, changed_reason, updated_at')
    .eq('user_id', userId)
    .eq('category', CATEGORY)
    .order('version', { ascending: false });
  if (error) throw toSupabaseError(error);
  return ((data ?? []) as Row[]).map(toRow);
}

/** First run: saves the placeholder as version 1 (unlocked). */
export async function seedDefinitions(supabase: SupabaseClient, userId: string): Promise<void> {
  const { error } = await supabase.from('trading_hq_configs').insert({
    user_id: userId,
    category: CATEGORY,
    slug: 'decomposition-definitions',
    title: 'Market decomposition definitions',
    content: { ...PLACEHOLDER_DEFINITIONS, version: definitionsVersionName(1) },
    version: 1,
    is_active: true,
    changed_reason: 'Placeholder definitions from the v0.3 proposal (not locked).',
  });
  if (notReady(error)) throw new DefinitionsNotReadyError();
  if (error) throw toSupabaseError(error);
}

/** Saves edited definitions as the next version. Returns what was saved. */
export async function saveDefinitions(supabase: SupabaseClient, current: DefinitionsRow, edited: DecompositionDefinitions, reason: string): Promise<DecompositionDefinitions> {
  if (!reason.trim()) throw new Error('Say why the definitions changed. It is kept with the version.');
  const next = prepareDefinitionsRevision(current.definitions, edited, current.rowVersion + 1);
  const { error } = await supabase.rpc('trading_os_replace_hq_category', {
    p_row_id: current.id,
    p_expected_version: current.rowVersion,
    p_content: next,
    p_reason: reason,
  });
  if (error) throw toSupabaseError(error);
  return next;
}
