# Data, backups, and privacy

## Storage and access

Supabase Auth identifies the signed-in user. Supabase Postgres stores the account's Trading HQ, asset desks, structural analyses, period plans and reviews, trades and amendments, setups, accounts, research, backtests, debriefs, calendar, psychology, and alerts. Account data is scoped through database permissions and row-level security. Uploaded charts use Supabase Storage.

Appearance, Today layout, chart-feed preferences, and unpublished analysis and plan drafts are stored in the browser. These preferences and drafts stay with that browser. The app also detects legacy browser-only records in supported workspaces and offers a one-time import where available.

## Exports and restore

| Action | What it covers |
| --- | --- |
| **Workspaces → Download backup** | A JSON snapshot of the active workspace records in the app, including trades, trade amendments, Trading HQ, desks, accounts, pending setups, reviews from the daily and weekly journals, research, backtests, calendar, psychology, and alerts. |
| **Workspaces → Restore backup** | Adds trades that do not already exist and imports supported research, backtest, calendar, psychology, and alert records. It does not restore Trading HQ, desks, accounts, pending setups, debriefs, weekly reviews, or trade amendments. |
| **Trading HQ → Reset app → Download backup** | Reads the account tables supported by the reset backup and lists chart file paths. The JSON does not contain the chart file bytes and is not a one-click restore. |

The current app export and reset backup omit versioned structural analyses, period plans, and their close reviews. Include the corresponding database tables in a separate database backup when preserving those records. Keep browser-only drafts separately if you need them on another device.

Backups are unencrypted. Keep them in private storage and out of Git. Restore writes one category at a time, so an interrupted restore may leave earlier records imported. Review the affected workspaces before retrying. Existing trades are preserved when IDs match.

## Trade history

Closing a trade locks its execution evidence. Corrections go through an amendment with a reason. Notes, reflections, and screenshots can still be added. Voided trades remain visible in the Journal and are excluded from performance statistics.

## Optional AI features

The AI endpoints require a valid Supabase session and apply per-user rate limits. When a Gemini API key is configured, using an AI feature sends the relevant prompt and context for that request to Google's Gemini API. Keep API keys in server configuration. Use a Supabase publishable or legacy anon key for the browser.

## Account reset

Trading HQ offers an account data reset with typed confirmation. The reset attempts to remove the account's application records and chart files. Download and verify the database and file backups you need before resetting.
