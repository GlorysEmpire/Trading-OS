# Trading OS: Master Audit and Four-Week Implementation Plan

## Confirmed target

All work in this document applies only to `/Users/prophetglory/Projects/personal/Trading-OS-main`, the local checkout at commit `d80a427` that contains the audited Vite/React source (`TradingContext`, `QuickTradeModal`, `assetDesksStore`, `server.ts`, and `api/ai`). No GitHub repository was changed, committed, or pushed.

## Scope

Trading OS is a configurable, process-first discretionary trading journal and research application. It is not a broker-execution system. Warnings are trader-facing guidance, never broker-side enforcement. Trading HQ is editable configuration; AR is analytical context only, never an entry trigger. No fabricated market data or performance is permitted.

## Combined audit, verified locally

| Priority | Finding | Status / decision |
| --- | --- | --- |
| P0 | Trades, research, backtests, psychology, calendar and alerts are browser-localStorage state in `TradingContext`. Initial demo records are used when no saved state exists. | Week 2/3 persistence work remains required; demo records must be clearly separated before user performance is trusted. |
| P0 | Asset Desks persist in Supabase but `assetDesksStore.ts` hardcodes the five-symbol universe and derives category/TradingView metadata. | Week 1 migration and configurable-instrument code added locally. |
| P1 | The live schema previously lacked structured desk fields; current code serializes JSON into legacy text fields. | Preserved to avoid data loss. New migration is additive only. |
| P1 | Quick Trade currently uses loaded desks, but initially selects BTC and must handle an empty configured-instrument list safely. Backtesting has hardcoded values. | Week 1 partial; needs live UI verification after migration. |
| P1 | AI routes exist (`api/ai/chat.ts`, `api/ai/analyze-trade.ts`); their access, validation, and rate limits need security review. | Week 4 pending. |
| P1 | No migrations or test suite were in this checkout. | Added first additive migration. Test/tooling work pending. |
| P2 | Market Intelligence must not imply live numbers without a source. | Verify / label in Week 4. |

## Safety and evidence

- Backup created before editing: `backups/trading-os-main-pre-week1-20261021-0750.tar.gz`.
- No live database migration, deletion, or remote operation was run.
- `npm install` restored the missing TypeScript platform package. `npm run lint` (TypeScript `--noEmit`) passed on 2026-10-21.
- `npm run build` remains blocked by a missing optional `@rolldown/binding-darwin-arm64` native binding after installation. The tool reports the usual clean reinstall remedy; it was not performed because it would remove the existing `node_modules` and lockfile state.

## Week 1 — Configurable Asset Desk

**Current status: implementation in progress; user must apply migration before persistence can be verified.**

- [x] Added `supabase/migrations/20261021000000_configurable_instruments.sql` with canonical symbol, category, TradingView symbol, and non-destructive `archived_at` fields.
- [x] Reworked asset-store reads/seeds to use persisted instrument metadata and active (not archived) desks.
- [x] Added local data-layer operations to create, update, and archive instruments.
- [x] Added Asset Desk UI controls to add, edit, and archive instruments; archive retains old desk data.
- [x] `npm run lint` passed after dependency repair.
- [ ] Run migration, then test add/edit/archive/reload, duplicates, empty state, five existing records and existing analysis against the actual Supabase project.
- [ ] Ensure all selectors, including Backtesting, derive from configured records; verify with live UI.

## Week 2 — Persistent trade journal

- [x] Added additive `20261022000000_persistent_trade_journal.sql`: owner-scoped table, RLS policies, and no destructive alteration of legacy data.
- [x] New trades now save to Supabase before local UI state updates; edits and deletes use the durable record.
- [x] Existing localStorage records are not silently merged into performance. The Journal displays an explicit import action and upserts by trade ID.
- [x] Journal asset filter now derives from configured active instruments.
- [x] Typecheck passed after this work (`npm run lint`, 2026-10-21).
- [ ] Apply the migration and verify owner isolation, open/edit/close/delete/reload, screenshots, and local import in the actual Supabase project.
- [ ] The source’s current trade ID is client-generated and HQ version is captured as a config version string; strengthen the snapshot representation after the deployed HQ schema is verified.

## Week 3 — Persistent research and backtesting

- [ ] Add user-scoped persistence, CRUD, linked instruments/research, documented metrics, and safe migration preview.

## Week 4 — Command center and release readiness

- [ ] Integrate persisted stats; make trader timezone explicit and test dates/scratch/drawdown semantics.
- [ ] Protect AI routes with auth, strict validation, request-size/rate limits, generic client errors and safe logs.
- [ ] Label/remove unsourced market data; add critical tests/CI, export/backup/privacy documentation.

## USER MANUAL ACTIONS

1. Back up the Supabase project, then apply the new migration through its SQL editor/CLI. Do not run it blindly against a production database.
2. `npm run lint` now passes. To resolve the remaining Vite/Rolldown build dependency problem, approve or perform a clean dependency reinstall (the build output asks to remove `node_modules` and `package-lock.json` before `npm install`); this was intentionally not done automatically.
3. Test Asset Desks: add `BTCUSDT`, refresh, edit it, archive it, and confirm existing notes remain. Test duplicate validation.
4. Do not put a service-role or AI provider secret in frontend environment variables.
