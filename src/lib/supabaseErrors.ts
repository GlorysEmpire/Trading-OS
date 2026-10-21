/** Supabase-js's query builders return `{ data, error }` rather than
 * throwing — `error` (when present) is the *raw* PostgREST/PostgREST-style
 * error payload (`{ message, details, hint, code }`), a plain object, NOT
 * an `Error` instance. Every data-store function in this app does
 * `if (error) throw error` to turn that into a thrown failure, which means
 * callers that do `e instanceof Error ? e.message : 'generic fallback'`
 * (see TradingContext.tsx) always hit the fallback and silently lose the
 * real message/hint/code — exactly the kind of error that's most useful
 * to see (e.g. a column/constraint mismatch, a bad filter value, RLS
 * denial detail).
 *
 * Throw `toSupabaseError(error)` instead of the raw `error` object so it's
 * an actual `Error`, with the real message (plus hint/code when present)
 * baked into `.message` where the UI can actually show it. */
export function toSupabaseError(error: {
  message?: string;
  details?: string | null;
  hint?: string | null;
  code?: string | null;
}): Error {
  const parts = [error?.message || 'Supabase request failed'];
  if (error?.hint) parts.push(`Hint: ${error.hint}`);
  if (error?.code) parts.push(`(code ${error.code})`);
  return new Error(parts.join(' — '));
}
