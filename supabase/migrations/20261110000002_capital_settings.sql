-- One user-owned starting balance. Trade results remain in the journal;
-- the displayed balance is derived, so amendments and voids recalculate it.
create table if not exists public.trading_os_capital_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  starting_capital numeric(20, 2) not null check (starting_capital > 0),
  currency text not null default 'USD' check (currency ~ '^[A-Z]{3}$'),
  updated_at timestamptz not null default now()
);
revoke all on public.trading_os_capital_settings from anon;
grant select, insert, update on public.trading_os_capital_settings to authenticated;
alter table public.trading_os_capital_settings enable row level security;
create policy capital_owner_select on public.trading_os_capital_settings
  for select to authenticated using ((select auth.uid()) = user_id);
create policy capital_owner_insert on public.trading_os_capital_settings
  for insert to authenticated with check ((select auth.uid()) = user_id);
create policy capital_owner_update on public.trading_os_capital_settings
  for update to authenticated using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
