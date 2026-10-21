import { GoogleGenAI } from "@google/genai";
import { createClient } from "@supabase/supabase-js";

/**
 * Shared hardening for the AI routes (api/ai/chat.ts, api/ai/analyze-trade.ts,
 * and the local-dev mirror in server.ts). These endpoints call out to a paid
 * third-party model with the server's own API key, so they need to require a
 * logged-in user, bound the size of what they'll accept, rate-limit misuse,
 * and never leak internal error detail or request content to the client or
 * the server logs.
 */

// ---- Gemini client (lazy, reused across warm invocations) ----
let genAIClient: GoogleGenAI | null = null;
export function getGenAIClient(): GoogleGenAI | null {
  if (!process.env.GEMINI_API_KEY) return null;
  if (!genAIClient) {
    genAIClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
      httpOptions: { headers: { "User-Agent": "aistudio-build" } },
    });
  }
  return genAIClient;
}

// ---- Auth: require a valid Supabase session ----
// Vite only exposes VITE_-prefixed vars to the client bundle, but these are
// ordinary process.env vars on the server too, so no separate server-side
// secret is needed — the anon key is safe to use here, it's the same one
// shipped to the browser. We only use it to ask Supabase's Auth server
// "is this access token valid, and whose is it" — we never touch the DB
// with it directly from these routes.
let authClient: ReturnType<typeof createClient> | null = null;
function getAuthClient() {
  const url = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !anonKey) return null;
  if (!authClient) authClient = createClient(url, anonKey);
  return authClient;
}

export type AuthResult = { ok: true; userId: string } | { ok: false; status: number; message: string };

export async function requireAuthenticatedUser(headers: Record<string, string | string[] | undefined>): Promise<AuthResult> {
  const raw = headers.authorization ?? headers.Authorization;
  const headerValue = Array.isArray(raw) ? raw[0] : raw;
  const token = headerValue?.startsWith("Bearer ") ? headerValue.slice(7).trim() : null;
  if (!token) return { ok: false, status: 401, message: "Sign in required." };

  const client = getAuthClient();
  if (!client) return { ok: false, status: 500, message: "Server is not configured for authentication." };

  const { data, error } = await client.auth.getUser(token);
  if (error || !data?.user) return { ok: false, status: 401, message: "Your session has expired. Please sign in again." };
  return { ok: true, userId: data.user.id };
}

// ---- Rate limiting ----
// Best-effort only: this is an in-memory map scoped to one warm serverless
// instance, so it resets on cold start and isn't shared across concurrent
// instances. It still meaningfully raises the cost of abuse once combined
// with the auth requirement above (no more anonymous, unlimited calls), and
// can be swapped for a shared store (Vercel KV / Upstash) later without
// changing callers.
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 12;
const rateLimitHits = new Map<string, number[]>();

export function checkRateLimit(key: string): boolean {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const recent = (rateLimitHits.get(key) ?? []).filter((t) => t > windowStart);
  if (recent.length >= RATE_LIMIT_MAX) {
    rateLimitHits.set(key, recent);
    return false;
  }
  recent.push(now);
  rateLimitHits.set(key, recent);
  return true;
}

// ---- Input validation ----
export const MAX_PROMPT_LENGTH = 6000;
export const MAX_JSON_PAYLOAD_LENGTH = 20000;

function jsonTooLarge(value: unknown, max: number): boolean {
  if (value === undefined) return false;
  try {
    return JSON.stringify(value).length > max;
  } catch {
    return true; // not serializable — reject rather than let it through
  }
}

export function validateChatInput(body: unknown): { prompt: string; context?: unknown } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const { prompt, context } = body as { prompt?: unknown; context?: unknown };
  if (typeof prompt !== "string" || !prompt.trim()) return { error: "Missing prompt." };
  if (prompt.length > MAX_PROMPT_LENGTH) return { error: `Prompt is too long (max ${MAX_PROMPT_LENGTH} characters).` };
  if (jsonTooLarge(context, MAX_JSON_PAYLOAD_LENGTH)) return { error: "Context payload is too large." };
  return { prompt, context };
}

export function validateAnalyzeInput(body: unknown): { trade: unknown; rules: unknown } | { error: string } {
  if (!body || typeof body !== "object") return { error: "Invalid request body." };
  const { trade, rules } = body as { trade?: unknown; rules?: unknown };
  if (!trade || typeof trade !== "object") return { error: "Missing trade." };
  if (jsonTooLarge(trade, MAX_JSON_PAYLOAD_LENGTH)) return { error: "Trade payload is too large." };
  if (jsonTooLarge(rules, MAX_JSON_PAYLOAD_LENGTH)) return { error: "Rules payload is too large." };
  return { trade, rules };
}

// ---- Safe logging ----
// Never pass the request body, prompt, trade, or context into this — those
// can carry the trader's own narrative/notes text. Log only the error.
export function logServerError(scope: string, error: unknown) {
  console.error(`[${scope}]`, error instanceof Error ? error.message : String(error));
}
