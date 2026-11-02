-- Pending setups: planned setups on an Asset Desk, waiting for their entry.
-- A triggered setup converts into a Journal trade; one that never triggers is
-- marked invalidated or expired. Rows are never deleted from the app.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists public.trading_os_pending_setups (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  desk_id text not null,
  status text not null check (status in ('PENDING', 'TRIGGERED', 'INVALIDATED', 'EXPIRED')),
  setup_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trading_os_pending_setups_user_idx on public.trading_os_pending_setups(user_id, created_at desc);

revoke all on public.trading_os_pending_setups from anon;
revoke all on public.trading_os_pending_setups from authenticated;
grant select, insert, update on public.trading_os_pending_setups to authenticated;
alter table public.trading_os_pending_setups enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_os_pending_setups' and policyname = 'pending_setups_owner_select') then
    create policy pending_setups_owner_select on public.trading_os_pending_setups for select to authenticated using ((select auth.uid()) = user_id);
    create policy pending_setups_owner_insert on public.trading_os_pending_setups for insert to authenticated with check ((select auth.uid()) = user_id);
    create policy pending_setups_owner_update on public.trading_os_pending_setups for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end $$;
