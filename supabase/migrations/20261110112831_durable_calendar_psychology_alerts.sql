-- Private, account-owned workspaces. Browser records are imported explicitly
-- by the signed-in user; this migration does not move or remove local data.
create table public.trading_os_calendar_events (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.trading_os_psychology_entries (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create table public.trading_os_alert_rules (
  user_id uuid not null references auth.users(id) on delete cascade,
  id text not null,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (user_id, id)
);

create index trading_os_calendar_events_user_date_idx
  on public.trading_os_calendar_events (user_id, ((payload->>'date')));
create index trading_os_psychology_entries_user_created_idx
  on public.trading_os_psychology_entries (user_id, created_at desc);
create index trading_os_alert_rules_user_created_idx
  on public.trading_os_alert_rules (user_id, created_at desc);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'trading_os_calendar_events',
    'trading_os_psychology_entries',
    'trading_os_alert_rules'
  ] loop
    execute format('revoke all on public.%I from anon', table_name);
    execute format('grant select, insert, update on public.%I to authenticated', table_name);
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy owner_select on public.%I for select to authenticated using ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_insert on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', table_name);
    execute format('create policy owner_update on public.%I for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id)', table_name);
  end loop;
end $$;
