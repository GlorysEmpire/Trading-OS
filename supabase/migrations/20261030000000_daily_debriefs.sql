-- Daily debriefs: one per trader per day.
-- The debrief stores its reflection fields plus a snapshot of the day's
-- evidence (computed from the Journal) at the time it was written.
-- Debriefs can be edited (it's reflection, written that evening), never
-- deleted from the app.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists public.trading_os_daily_debriefs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  debrief_date date not null,
  debrief_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, debrief_date)
);

revoke all on public.trading_os_daily_debriefs from anon;
revoke all on public.trading_os_daily_debriefs from authenticated;
grant select, insert, update on public.trading_os_daily_debriefs to authenticated;
alter table public.trading_os_daily_debriefs enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_os_daily_debriefs' and policyname = 'daily_debriefs_owner_select') then
    create policy daily_debriefs_owner_select on public.trading_os_daily_debriefs for select to authenticated using ((select auth.uid()) = user_id);
    create policy daily_debriefs_owner_insert on public.trading_os_daily_debriefs for insert to authenticated with check ((select auth.uid()) = user_id);
    create policy daily_debriefs_owner_update on public.trading_os_daily_debriefs for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end $$;
