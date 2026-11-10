# Trading OS release readiness roadmap

This plan applies to the active `Trading-OS-main` Vite/React checkout. Keep the older empty `trading-os` directory out of release work. Do not migrate frameworks just for packaging.

## Current local implementation (2026-11-10)

- Trading HQ revisions and closed-trade amendments now have single-transaction database functions; the client calls those functions.
- Dashboard capital settings, per-trade risk capture, and a derived balance are implemented. The balance is an estimate until exact position size, fees, deposits, and withdrawals are recorded.
- Asset Desk analysis can be closed as target hit, invalidated, completed, or reset. Narrative, individual HTF structure, or the entire active analysis can be archived and cleared; history remains reviewable.
- Applied `20261110000000_atomic_hq_revisions.sql`, `20261110000001_atomic_trade_amendments.sql`, `20261110000002_capital_settings.sql`, then `20261110000003_desk_analysis_history.sql` to the live Trading OS Supabase project (`zhcrlqhwszmibvodnzhy`). The earlier manually applied migrations were reconciled in Supabase's history first.
- Live schema checks confirmed the new tables/functions, RLS on capital and analysis history, and removal of direct HQ deletion and trade truncation grants. Authenticated owner-flow tests, cross-device checks, and app deployment remain open.

## 1. Establish a verifiable baseline

- Confirm the GitHub main commit, Vercel project, environment names, production URL, and Supabase project reference.
- Compare every migration with the live database; capture the missing baseline schema for `asset_desks` and `trading_hq_configs` so a fresh environment can be rebuilt.
- Add a staging environment and run owner-isolation checks against real RLS, including chart storage.
- Gate: sign in and complete a full trade and research workflow on staging, refresh, and repeat on another device.

## 2. Protect methodology and trade evidence

- Make Trading HQ version changes transactional in the database. Only deactivate an old version if the replacement is committed.
- Make trade amendments and evidence updates one database transaction; match the exact changed fields and values, rather than accepting any recent amendment.
- Add database integration tests for failed HQ updates, owner isolation, duplicate imports, locked trades, voids, and amendment history.
- Gate: deliberate failure injection never loses active HQ configuration or permits an unlogged trade change.

## 3. Complete durable user workflows

- Move Calendar, Psychology, and Alerts from localStorage into user-owned Supabase tables; preserve existing browser data with a previewed, idempotent import.
- Keep appearance preferences local. Add a real reminder scheduler and delivery status, with timezone and daylight-saving tests.
- Make export/restore cover all durable entities, validate schema before writes, and report partial failures accurately.
- Gate: records appear across devices and survive browser-data clearing; reminders fire once at the expected local time.

## 4. Make AI and data sources trustworthy

- Remove hardcoded strategy/risk/session values from AI prompts and fallback responses. Assemble context from the active, versioned Trading HQ and state exactly what was included.
- Validate provider model and credentials, use a shared rate limit, and test unavailable-provider behavior.
- Add market providers only with source, observation time, freshness, and asset mapping; keep Scanner inactive until real observations support it.
- Gate: changing an HQ rule changes assistant analysis, and unavailable providers never imply current market facts.

## 5. Ship the installable app

- Add manifest, icons, install guidance, and mobile layout checks; decide cache/offline policy explicitly so old trading data cannot masquerade as fresh data.
- Add smoke tests for login, trade lifecycle, research sample, calendar, psychology, backup, and mobile viewport in CI.
- Deploy a staging preview; after passing user acceptance, promote the same tested build to production.
- Consider Capacitor for app-store distribution or native notification features after the installable web app is stable.

## Definition of done

A user can sign in on desktop and phone, edit HQ/Asset Desk, plan and close a trade with a chart, see correct R/process metrics, amend with an audit trail, record a backtest sample, use Calendar and Psychology across devices, receive a scheduled reminder, export/restore their data, and install the app. No private data leaks between users; no unsourced market information or hardcoded trading methodology appears as current advice.
