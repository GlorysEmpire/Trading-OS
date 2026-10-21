import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!url || !anonKey) {
  // Fail loudly in dev rather than silently running with no backend.
  console.error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Copy .env.example to .env and fill in the Supabase project credentials.'
  );
}

export const supabase = createClient(url || '', anonKey || '');

/** Authorization header for calling our own /api/ai/* routes, which require
 * a signed-in Supabase user. Returns {} when there's no session — the route
 * will reject the request with 401 rather than silently proceeding. */
export async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}
