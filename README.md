# Trading OS

Trading OS is a workbench for discretionary traders. It brings market analysis, period planning, trade journaling, and review into one account-scoped workspace so each decision can be traced back to its evidence.

## Workspaces

- **Today and Asset Desks** organize session context, watchlists, market levels, and pending setups.
- **Market Decomposition** guides Monthly, Weekly, and Daily reads through eight structured analytical layers. Published analyses are versioned.
- **Periodic Plans** connect completed-candle evidence, scenarios, and points of interest to a feed-specific plan and close review.
- **Journal and Accounts** capture fills, risk, amendments, and performance. Open Quick Trade with `⌘K` or `Ctrl+K`.
- **Research and Backtesting** turn observations and missed expectations into testable questions and linked samples.
- **Trading HQ** holds the risk, session, grading, and methodology settings used by the workspaces.

Trading OS records and evaluates trader decisions. It does not place broker orders.

## Run locally

Use Node.js 22.12 or later, npm, and a development Supabase project that has the Trading OS schema.

```sh
npm ci
cp .env.example .env
```

Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env`. The second variable accepts a Supabase publishable key or legacy anon key. Set the optional server-only `GEMINI_API_KEY` to enable the AI features.

```sh
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) and sign in with a development account.

## Development checks

```sh
npm run lint   # TypeScript type check
npm test       # Vitest regression suite
npm run build  # Production client and server bundles
```

## Repository

| Path | Purpose |
| --- | --- |
| `src/components/` | Workspaces and shared interface components |
| `src/decomposition/` | Market analysis, feed timing, planning, and review rules |
| `src/lib/` | Supabase stores and application integrations |
| `api/`, `server.ts` | Hosted API handlers and the local development server |
| `supabase/migrations/` | Versioned database changes for the Trading OS schema |

Use a development database when testing migrations or workflows that write records. The migration history builds on the original project schema, including `asset_desks` and `trading_hq_configs`. Review the baseline and migration history before provisioning a new database.

Published records live in Supabase. Unpublished analysis and plan drafts, appearance, and layout preferences are browser-local. For export coverage and restore behavior, see [Data, backups, and privacy](docs/DATA_EXPORT_BACKUP_PRIVACY.md).
