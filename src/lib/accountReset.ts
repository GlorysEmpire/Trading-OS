import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';
import { CHART_BUCKET } from './chartStorage';

/** The phrase the user must type; the database function checks it too. */
export const WIPE_PHRASE = 'DELETE MY DATA';

/** Every table that holds the user's Trading OS data. */
export const USER_TABLES = [
  'trading_hq_configs',
  'asset_desks',
  'trading_os_trade_records',
  'trading_os_trade_amendments',
  'trading_os_pending_setups',
  'trading_os_daily_debriefs',
  'trading_os_weekly_reviews',
  'trading_os_research_questions',
  'trading_os_backtest_samples',
  'trading_os_desk_analysis_history',
  'trading_os_capital_settings',
  'trading_os_accounts',
  'trading_os_calendar_events',
  'trading_os_psychology_entries',
  'trading_os_alert_rules',
] as const;

/** Browser keys that are kept through a reset (appearance only). */
const KEEP_LOCAL_KEYS = ['trading_os_v1_store_theme'];

/** Reads every row of every table straight from the database (not from what
 * the screen happens to have loaded), so the backup is complete. */
export async function fetchFullBackup(supabase: SupabaseClient, userId: string) {
  const tables: Record<string, unknown[]> = {};
  const missing: string[] = [];
  for (const table of USER_TABLES) {
    const { data, error } = await supabase.from(table).select('*').eq('user_id', userId);
    if (error) {
      // A table that doesn't exist on this database is noted, not fatal.
      missing.push(`${table}: ${error.message}`);
      continue;
    }
    tables[table] = data ?? [];
  }
  const charts = await listChartFiles(supabase, userId).catch(() => [] as string[]);
  return {
    kind: 'trading-os-full-backup',
    version: 1,
    exportedAt: new Date().toISOString(),
    userId,
    tables,
    chartFiles: charts,
    notReadable: missing,
  };
}

export async function downloadFullBackup(supabase: SupabaseClient, userId: string): Promise<{ rows: number; charts: number; notReadable: string[] }> {
  const backup = await fetchFullBackup(supabase, userId);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `trading_os_full_backup_${backup.exportedAt.slice(0, 19).replace(/[:T]/g, '-')}.json`;
  a.click();
  URL.revokeObjectURL(url);
  const rows = Object.values(backup.tables).reduce((sum, list) => sum + list.length, 0);
  return { rows, charts: backup.chartFiles.length, notReadable: backup.notReadable };
}

/** Paths of every chart file in the user's folder. */
async function listChartFiles(supabase: SupabaseClient, userId: string): Promise<string[]> {
  const paths: string[] = [];
  const walk = async (prefix: string) => {
    for (let offset = 0; ; offset += 1000) {
      const { data, error } = await supabase.storage.from(CHART_BUCKET).list(prefix, { limit: 1000, offset });
      if (error) throw error;
      const items = data ?? [];
      for (const item of items) {
        const path = `${prefix}/${item.name}`;
        // Folders come back without an id.
        if (item.id) paths.push(path);
        else await walk(path);
      }
      if (items.length < 1000) break;
    }
  };
  await walk(userId);
  return paths;
}

export interface WipeResult {
  deletedRows: Record<string, number>;
  chartsDeleted: number;
  chartsLeft: number;
}

/** Permanently deletes all of the user's Trading OS data. */
export async function wipeAllData(supabase: SupabaseClient, userId: string, phrase: string): Promise<WipeResult> {
  if (phrase !== WIPE_PHRASE) throw new Error(`Type ${WIPE_PHRASE} to confirm.`);

  // Database first: if it refuses (wrong phrase, function missing), nothing
  // has been touched. Chart files go after, once the rows pointing at them are gone.
  const { data, error } = await supabase.rpc('trading_os_wipe_my_data', { confirmation: phrase });
  if (error) throw toSupabaseError(error);

  let chartsDeleted = 0;
  let chartsLeft = 0;
  const files = await listChartFiles(supabase, userId).catch(() => [] as string[]);
  for (let i = 0; i < files.length; i += 100) {
    const batch = files.slice(i, i + 100);
    const { data: removed, error: removeError } = await supabase.storage.from(CHART_BUCKET).remove(batch);
    const n = removeError ? 0 : removed?.length ?? 0;
    chartsDeleted += n;
    chartsLeft += batch.length - n;
  }

  clearLocalData();
  return { deletedRows: (data ?? {}) as Record<string, number>, chartsDeleted, chartsLeft };
}

/** Clears Trading OS data kept in this browser (old local journal copies,
 * dashboard layout), keeping only appearance. Sign-in is untouched. */
export function clearLocalData() {
  try {
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('trading_os') && !KEEP_LOCAL_KEYS.includes(k)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    // Storage unavailable: nothing to clear.
  }
}
