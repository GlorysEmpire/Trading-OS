-- M2 (Market Decomposition): storage for structural records, their layer
-- versions, period plans (Monthly / Weekly / Daily) and period reviews.
--
-- Truthfulness rules enforced here, not only in the app:
-- - Structural layer versions are insert-only (no update, no delete).
-- - Version numbers per record + timeframe are unique; a new one must be the next number.
-- - In BACKTEST mode a saved layer version is the locked prediction (locked_at set on insert),
--   and nothing can be added once the backtest outcome is recorded.
-- - Period plans: one per desk + cadence + symbol + feed + candle open + mode. Their read can
--   change only until the plan is reviewed; identity, chain and structural ref never change.
-- - Reviews: one per plan, insert-only, only after the candle has closed.
-- - Owner-only RLS everywhere. Only Reset app (trading_os_wipe_my_data) deletes.

-- ---- Structural records --------------------------------------------------------

create table if not exists public.trading_os_structural_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  desk_id uuid not null references public.asset_desks(id),
  symbol text not null check (length(btrim(symbol)) > 0),
  mode text not null default 'LIVE' check (mode in ('LIVE', 'BACKTEST')),
  research_question_id text,
  -- BACKTEST only, set once (M5). Null for LIVE.
  outcome jsonb,
  created_at timestamptz not null default now()
);
create index if not exists trading_os_structural_records_desk_idx on public.trading_os_structural_records(user_id, desk_id, mode);

create table if not exists public.trading_os_structural_layers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  structural_record_id uuid not null references public.trading_os_structural_records(id),
  timeframe text not null check (timeframe in ('MONTHLY', 'WEEKLY', 'DAILY', 'H4')),
  version integer not null check (version > 0),
  as_of timestamptz not null,
  definitions_version text not null check (length(btrim(definitions_version)) > 0),
  data jsonb not null,
  locked_at timestamptz,
  created_at timestamptz not null default now(),
  unique (structural_record_id, timeframe, version),
  check ((data->>'timeframe') = timeframe)
);
create index if not exists trading_os_structural_layers_record_idx on public.trading_os_structural_layers(structural_record_id);

create or replace function public.trading_os_guard_structural_layer()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  rec public.trading_os_structural_records%rowtype;
  latest integer;
begin
  select * into rec from public.trading_os_structural_records where id = new.structural_record_id and user_id = new.user_id;
  if not found then
    raise exception 'Structural record not found' using errcode = 'P0001';
  end if;
  if rec.mode = 'BACKTEST' and rec.outcome is not null then
    raise exception 'This backtest is closed: the outcome is recorded, so its predictions can no longer change.' using errcode = 'P0001';
  end if;
  select coalesce(max(version), 0) into latest from public.trading_os_structural_layers
    where structural_record_id = new.structural_record_id and timeframe = new.timeframe;
  if new.version <> latest + 1 then
    raise exception 'Layer version must be % (got %). Refresh and try again.', latest + 1, new.version using errcode = 'P0001';
  end if;
  new.created_at := now();
  new.locked_at := case when rec.mode = 'BACKTEST' then new.created_at else null end;
  return new;
end;
$$;

drop trigger if exists trading_os_guard_structural_layer on public.trading_os_structural_layers;
create trigger trading_os_guard_structural_layer before insert on public.trading_os_structural_layers
  for each row execute function public.trading_os_guard_structural_layer();

-- ---- Period plans ----------------------------------------------------------------

create table if not exists public.trading_os_period_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  desk_id uuid not null references public.asset_desks(id),
  cadence text not null check (cadence in ('MONTH', 'WEEK', 'DAY')),
  symbol text not null check (length(btrim(symbol)) > 0),
  feed text not null check (length(btrim(feed)) > 0),
  candle_open timestamptz not null,
  candle_close timestamptz check (candle_close is null or candle_close > candle_open),
  mode text not null default 'LIVE' check (mode in ('LIVE', 'BACKTEST')),
  structural_record_id uuid not null references public.trading_os_structural_records(id),
  structural_revision integer not null check (structural_revision > 0),
  structural_layer_ids jsonb not null,
  parent_plan_id uuid references public.trading_os_period_plans(id),
  gate jsonb not null,
  definitions_version text not null check (length(btrim(definitions_version)) > 0),
  read jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, desk_id, cadence, symbol, feed, candle_open, mode)
);
create index if not exists trading_os_period_plans_desk_idx on public.trading_os_period_plans(user_id, desk_id, cadence, candle_open desc);

create table if not exists public.trading_os_period_reviews (
  plan_id uuid primary key references public.trading_os_period_plans(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  saved_at timestamptz not null default now(),
  prediction text not null check (prediction in ('CORRECT', 'PARTLY', 'WRONG')),
  process text not null check (process in ('CORRECT', 'PARTLY', 'WRONG')),
  lesson text not null check (length(btrim(lesson)) > 0)
);

create or replace function public.trading_os_guard_period_plan()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  parent public.trading_os_period_plans%rowtype;
  expected_parent text;
begin
  if tg_op = 'INSERT' then
    if new.parent_plan_id is not null then
      select * into parent from public.trading_os_period_plans where id = new.parent_plan_id and user_id = new.user_id;
      if not found then
        raise exception 'Parent plan not found' using errcode = 'P0001';
      end if;
      expected_parent := case new.cadence when 'DAY' then 'WEEK' when 'WEEK' then 'MONTH' else '' end;
      if parent.cadence <> expected_parent then
        raise exception 'A plan''s parent must be one cadence up (Daily → Weekly → Monthly).' using errcode = 'P0001';
      end if;
      if parent.desk_id <> new.desk_id then
        raise exception 'The parent plan is for another asset.' using errcode = 'P0001';
      end if;
      if parent.candle_open > new.candle_open then
        raise exception 'The parent plan is for a later period.' using errcode = 'P0001';
      end if;
    end if;
    if not exists (select 1 from public.trading_os_structural_records where id = new.structural_record_id and user_id = new.user_id and desk_id = new.desk_id) then
      raise exception 'The structural record is for another asset.' using errcode = 'P0001';
    end if;
    new.created_at := now();
    new.updated_at := now();
    return new;
  end if;

  -- UPDATE: only the read (and updated_at) may change, and only before the review.
  if exists (select 1 from public.trading_os_period_reviews where plan_id = old.id) then
    raise exception 'This plan has been reviewed; it can no longer change.' using errcode = 'P0001';
  end if;
  if (new.id, new.user_id, new.desk_id, new.cadence, new.symbol, new.feed, new.candle_open, new.mode,
      new.structural_record_id, new.structural_revision, new.structural_layer_ids, new.parent_plan_id,
      new.gate, new.definitions_version, new.created_at)
     is distinct from
     (old.id, old.user_id, old.desk_id, old.cadence, old.symbol, old.feed, old.candle_open, old.mode,
      old.structural_record_id, old.structural_revision, old.structural_layer_ids, old.parent_plan_id,
      old.gate, old.definitions_version, old.created_at) then
    raise exception 'Only the plan''s answers can change. Its candle, chain and structural version are fixed.' using errcode = 'P0001';
  end if;
  -- The close time may be filled in once (when the chart prints it), never moved.
  if old.candle_close is not null and new.candle_close is distinct from old.candle_close then
    raise exception 'The candle close time is already recorded.' using errcode = 'P0001';
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trading_os_guard_period_plan on public.trading_os_period_plans;
create trigger trading_os_guard_period_plan before insert or update on public.trading_os_period_plans
  for each row execute function public.trading_os_guard_period_plan();

create or replace function public.trading_os_guard_period_review()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  plan public.trading_os_period_plans%rowtype;
begin
  select * into plan from public.trading_os_period_plans where id = new.plan_id and user_id = new.user_id;
  if not found then
    raise exception 'Plan not found' using errcode = 'P0001';
  end if;
  if plan.candle_close is null or now() < plan.candle_close then
    raise exception 'Review at the candle close: this candle has not closed yet.' using errcode = 'P0001';
  end if;
  new.saved_at := now();
  new.lesson := btrim(new.lesson);
  return new;
end;
$$;

drop trigger if exists trading_os_guard_period_review on public.trading_os_period_reviews;
create trigger trading_os_guard_period_review before insert on public.trading_os_period_reviews
  for each row execute function public.trading_os_guard_period_review();

-- ---- Privileges and RLS (owner only; no delete; layers and reviews insert-only) ----

revoke all on public.trading_os_structural_records, public.trading_os_structural_layers,
  public.trading_os_period_plans, public.trading_os_period_reviews from anon, authenticated;
grant select, insert on public.trading_os_structural_records to authenticated;
grant select, insert on public.trading_os_structural_layers to authenticated;
grant select, insert, update on public.trading_os_period_plans to authenticated;
grant select, insert on public.trading_os_period_reviews to authenticated;

alter table public.trading_os_structural_records enable row level security;
alter table public.trading_os_structural_layers enable row level security;
alter table public.trading_os_period_plans enable row level security;
alter table public.trading_os_period_reviews enable row level security;

do $$
declare t text;
begin
  foreach t in array array['trading_os_structural_records', 'trading_os_structural_layers', 'trading_os_period_plans', 'trading_os_period_reviews'] loop
    if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = t || '_owner_select') then
      execute format('create policy %I on public.%I for select to authenticated using ((select auth.uid()) = user_id)', t || '_owner_select', t);
      execute format('create policy %I on public.%I for insert to authenticated with check ((select auth.uid()) = user_id)', t || '_owner_insert', t);
    end if;
  end loop;
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_os_period_plans' and policyname = 'trading_os_period_plans_owner_update') then
    create policy trading_os_period_plans_owner_update on public.trading_os_period_plans
      for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end $$;

-- ---- Reset app: include the new tables (children before parents) ---------------

create or replace function public.trading_os_wipe_my_data(confirmation text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  t text;
  n integer;
  result jsonb := '{}'::jsonb;
  tables text[] := array[
    'trading_os_period_reviews',
    'trading_os_period_plans',
    'trading_os_structural_layers',
    'trading_os_structural_records',
    'trading_os_trade_amendments',
    'trading_os_trade_records',
    'trading_os_pending_setups',
    'trading_os_daily_debriefs',
    'trading_os_weekly_reviews',
    'trading_os_backtest_samples',
    'trading_os_research_questions',
    'trading_os_desk_analysis_history',
    'trading_os_capital_settings',
    'trading_os_accounts',
    'trading_os_calendar_events',
    'trading_os_psychology_entries',
    'trading_os_alert_rules',
    'asset_desks',
    'trading_hq_configs'
  ];
begin
  if uid is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if confirmation is distinct from 'DELETE MY DATA' then
    raise exception 'Confirmation phrase does not match' using errcode = 'P0001';
  end if;

  foreach t in array tables loop
    if to_regclass('public.' || t) is not null then
      execute format('delete from public.%I where user_id = $1', t) using uid;
      get diagnostics n = row_count;
      result := result || jsonb_build_object(t, n);
    end if;
  end loop;

  return result;
end;
$$;

revoke all on function public.trading_os_wipe_my_data(text) from public, anon;
grant execute on function public.trading_os_wipe_my_data(text) to authenticated;
