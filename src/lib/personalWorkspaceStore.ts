import type { SupabaseClient } from '@supabase/supabase-js';
import type { AlertRule, OperationalCalendarEvent, PsychologyEntry } from '../types';
import { toSupabaseError } from './supabaseErrors';

type Workspace = 'calendar' | 'psychology' | 'alerts';
type WorkspaceRecord = {
  calendar: OperationalCalendarEvent;
  psychology: PsychologyEntry;
  alerts: AlertRule;
};

const TABLE: Record<Workspace, string> = {
  calendar: 'trading_os_calendar_events',
  psychology: 'trading_os_psychology_entries',
  alerts: 'trading_os_alert_rules',
};

const PREFIX: Record<Workspace, string> = {
  calendar: 'cal-', psychology: 'psy-', alerts: 'al-',
};

function isRecordFor<K extends Workspace>(workspace: K, value: unknown): value is WorkspaceRecord[K] {
  if (!value || typeof value !== 'object') return false;
  const item = value as Record<string, unknown>;
  if (typeof item.id !== 'string' || !item.id.startsWith(PREFIX[workspace])) return false;
  if (workspace === 'calendar') return typeof item.title === 'string' && typeof item.date === 'string' && typeof item.time === 'string';
  if (workspace === 'psychology') return typeof item.thoughts === 'string' && typeof item.timestamp === 'number';
  return typeof item.title === 'string' && typeof item.conditionText === 'string';
}

export function readLocalWorkspace<K extends Workspace>(key: string, workspace: K): WorkspaceRecord[K][] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(key) ?? 'null');
    return Array.isArray(parsed) ? parsed.filter(item => isRecordFor(workspace, item)) : [];
  } catch {
    return [];
  }
}

export async function loadWorkspace<K extends Workspace>(
  supabase: SupabaseClient, userId: string, workspace: K,
): Promise<WorkspaceRecord[K][]> {
  const { data, error } = await supabase.from(TABLE[workspace])
    .select('payload, created_at').eq('user_id', userId).order('created_at', { ascending: false });
  if (error) throw toSupabaseError(error);
  const items = (data ?? []).map(row => row.payload).filter(item => isRecordFor(workspace, item)) as WorkspaceRecord[K][];
  if (workspace === 'psychology') items.sort((a, b) => (b as PsychologyEntry).timestamp - (a as PsychologyEntry).timestamp);
  return items;
}

export async function saveWorkspaceRecord<K extends Workspace>(
  supabase: SupabaseClient, userId: string, workspace: K, item: WorkspaceRecord[K],
): Promise<void> {
  const { error } = await supabase.from(TABLE[workspace]).upsert({
    user_id: userId, id: item.id, payload: item, updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id,id' });
  if (error) throw toSupabaseError(error);
}

export async function importWorkspaceRecords<K extends Workspace>(
  supabase: SupabaseClient, userId: string, workspace: K, items: WorkspaceRecord[K][],
): Promise<number> {
  const valid = items.filter(item => isRecordFor(workspace, item));
  if (!valid.length) return 0;
  const { error } = await supabase.from(TABLE[workspace]).upsert(
    valid.map(item => ({ user_id: userId, id: item.id, payload: item })),
    { onConflict: 'user_id,id', ignoreDuplicates: true },
  );
  if (error) throw toSupabaseError(error);
  return valid.length;
}
