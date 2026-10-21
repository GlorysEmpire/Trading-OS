-- Week 2: durable, user-owned journal records. This does not modify or delete
-- legacy/local records; import is explicit and deduplicated by (user_id, id).
create table if not exists public.trading_os_trade_records (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_data jsonb not null,
  hq_config_version text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trading_os_trade_records_user_created_idx on public.trading_os_trade_records(user_id, created_at desc);
revoke all on public.trading_os_trade_records from anon;
grant select, insert, update, delete on public.trading_os_trade_records to authenticated;
alter table public.trading_os_trade_records enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_os_trade_records' and policyname = 'trade_records_owner_select') then
    create policy trade_records_owner_select on public.trading_os_trade_records for select to authenticated using ((select auth.uid()) = user_id);
    create policy trade_records_owner_insert on public.trading_os_trade_records for insert to authenticated with check ((select auth.uid()) = user_id);
    create policy trade_records_owner_update on public.trading_os_trade_records for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    create policy trade_records_owner_delete on public.trading_os_trade_records for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;
