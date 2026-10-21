# Data, Export/Backup, and Privacy

This document explains what Trading OS stores, where it stores it, who can
access it, and how to back up or restore your data. It reflects the app as
it actually works today, not an aspirational target — anything listed as
"not yet migrated" is a known, intentional gap.

## Where your data lives

Trading OS stores data in two places:

| Store | What's in it | Scope |
|---|---|---|
| **Supabase (cloud database)** | Trading HQ config (risk rules, setup grades, execution models, sessions, process checks, mistake codes), Asset Desks (including the Market Watch star flag), Trades, Research Questions, Backtest Samples | Synced across devices/browsers, owner-scoped |
| **Browser `localStorage`** | Psychology entries, Calendar events, Alerts, UI theme (light/dark), Dashboard widget visibility preferences | This browser only — not synced, not backed up by Supabase |

**Why the split exists:** Trading HQ, Asset Desks, Trades, Research
Questions, and Backtest Samples were migrated to Supabase across Weeks 1–3
of the implementation plan. Psychology, Calendar, and Alerts are still
Context + `localStorage` and have not been migrated yet — this is tracked,
known scope, not a bug. Dashboard widget visibility is intentionally
`localStorage`-only even going forward: it's a per-browser view preference,
not trading data, so it doesn't belong in the shared database.

**Practical consequence:** if you log in from a different browser or device,
your Trading HQ, Asset Desks, Trades, Research, and Backtest data will be
there, but your Psychology entries, Calendar, and Alerts will not — those
are tied to the specific browser you created them in. Clearing that
browser's site data (or using a private/incognito window) will also erase
them, since nothing else has a copy. The JSON backup described below is the
only way to move that local-only data between browsers, or to keep it safe
from being cleared.

## Who can access your data

- All Supabase tables are protected by Row Level Security (RLS), scoped to
  `auth.uid()` — the authenticated Supabase user. You can only read or write
  your own rows; the anonymous/public key has no standing access.
- The AI assistant routes (`/api/ai/chat`, `/api/ai/analyze-trade`) require a
  valid Supabase session (a signed, non-expired access token) and are
  rate-limited per authenticated user. No AI route accepts unauthenticated
  requests.
- Nothing in this app sends your trading data to a third party other than:
  - **Supabase**, to store it (this is also where your login/auth lives).
  - **Google's Gemini API**, only when you use the AI Assistant or the AI
    trade-critique feature, and only the specific prompt/context you send
    for that request (not your whole trade history) — and only if a
    `GEMINI_API_KEY` is configured. Without a key, those features fall back
    to a canned, rule-based response and nothing leaves the app.
- Server logs for the AI routes intentionally log only the error message on
  failure (`logServerError`), never the request body, your prompt, or your
  trade data — so a failed AI call does not leak trade details into logs.

## Exporting a backup

Click **Export** in the header. This downloads a file named
`trading_os_backup_<YYYY-MM-DD>.json` containing a single JSON snapshot of:

- `exportDate`
- `tradingHQ`
- `assets` (Asset Desks)
- `trades`
- `researchQuestions`
- `backtestSamples`
- `psychologyEntries`
- `calendarEvents`
- `alerts`

This is the **only** mechanism that captures the `localStorage`-only data
(Psychology, Calendar, Alerts) in a portable file — back up regularly if you
rely on those sections, since they have no other persistence.

The export is a plain, unencrypted JSON file written to your own downloads
folder. Treat it like any other file containing your trading history: it is
not encrypted at rest by the app, and anyone with the file can read its
contents.

## Restoring from a backup

Click **Import** in the header and select a previously exported JSON file.
On import:

- `trades`, `researchQuestions`, and `backtestSamples` are written through
  to Supabase (one `save` call per record) and then the in-app lists are
  reloaded from Supabase — so a restore actually persists, rather than only
  populating local state that would vanish on refresh.
- `psychologyEntries`, `calendarEvents`, and `alerts` are restored directly
  into local state (and therefore into this browser's `localStorage`) since
  they have no Supabase table yet.
- Trading HQ and Asset Desks are **not** touched by import — those are
  live, versioned Supabase config and are edited through their own screens
  (Trading HQ, Asset Desks), not overwritten wholesale by a backup file.
- Import is additive, not a wipe-and-replace: it writes/updates the records
  found in the file but does not delete anything not present in it.
- If the file is not valid JSON, or doesn't parse, the import fails cleanly
  and reports failure without partially corrupting existing data (wrapped in
  try/catch; a thrown error is caught and `false` is returned before any
  writes happen for the fields that failed to parse).

## Known gaps (tracked, not hidden)

- Psychology, Calendar, and Alerts are not yet Supabase-backed — they are
  single-browser and only portable via the JSON export above.
- The JSON backup file itself is not encrypted — treat it as sensitive.
- There is no automatic/scheduled backup; export is manual, on demand.
- Deleting your account does not yet have a dedicated "delete all my data"
  flow in-app; your data is scoped to your Supabase user row via RLS, but a
  full self-service erasure flow has not been built.
