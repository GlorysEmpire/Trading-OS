import type { SupabaseClient } from '@supabase/supabase-js';
import { toSupabaseError } from './supabaseErrors';

export interface CapitalSettings {
  startingCapital: number;
  currency: string;
}

export async function loadCapitalSettings(supabase: SupabaseClient, userId: string): Promise<CapitalSettings | null> {
  const { data, error } = await supabase.from('trading_os_capital_settings')
    .select('starting_capital, currency').eq('user_id', userId).maybeSingle();
  if (error) throw toSupabaseError(error);
  return data ? { startingCapital: Number(data.starting_capital), currency: data.currency } : null;
}

export async function saveCapitalSettings(supabase: SupabaseClient, userId: string, settings: CapitalSettings): Promise<void> {
  if (!Number.isFinite(settings.startingCapital) || settings.startingCapital <= 0) {
    throw new Error('Starting capital must be greater than zero.');
  }
  if (!/^[A-Z]{3}$/.test(settings.currency)) throw new Error('Enter a three-letter currency code.');
  const { error } = await supabase.from('trading_os_capital_settings').upsert({
    user_id: userId,
    starting_capital: settings.startingCapital,
    currency: settings.currency,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'user_id' });
  if (error) throw toSupabaseError(error);
}
