-- Trade lock + append-only amendment log.
--
-- Principle: once a trade is closed (or voided) its evidence — prices, R,
-- outcome, process score, mistake codes, grade — can't be silently rewritten.
-- Every correction is an amendment row with a reason, and amendment rows can
-- never be edited or deleted. Trades can't be deleted at all any more; a
-- mistaken entry is voided (kept, flagged, excluded from stats) instead.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.

-- 1. Amendment log (insert + select only).
create table if not exists public.trading_os_trade_amendments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  trade_id text not null references public.trading_os_trade_records(id) on delete cascade,
  kind text not null check (kind in ('AMEND', 'VOID')),
  reason text not null check (length(btrim(reason)) > 0),
  changes jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists trading_os_trade_amendments_trade_idx
  on public.trading_os_trade_amendments(trade_id, created_at);

revoke all on public.trading_os_trade_amendments from anon;
revoke all on public.trading_os_trade_amendments from authenticated;
grant select, insert on public.trading_os_trade_amendments to authenticated;
alter table public.trading_os_trade_amendments enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_os_trade_amendments' and policyname = 'trade_amendments_owner_select') then
    create policy trade_amendments_owner_select on public.trading_os_trade_amendments
      for select to authenticated using ((select auth.uid()) = user_id);
    -- You can only log an amendment against your own trade.
    create policy trade_amendments_owner_insert on public.trading_os_trade_amendments
      for insert to authenticated with check (
        (select auth.uid()) = user_id
        and exists (select 1 from public.trading_os_trade_records t where t.id = trade_id and t.user_id = (select auth.uid()))
      );
  end if;
end $$;

-- 2. Trades can no longer be deleted from the app.
revoke delete on public.trading_os_trade_records from authenticated;
drop policy if exists trade_records_owner_delete on public.trading_os_trade_records;

-- 3. Guard: evidence on a closed/voided trade only changes when an amendment
--    for that trade was logged moments before. Documentation fields
--    (reflectionAfter, notesDuring, screenshots, links) stay freely editable.
--    Keep locked_keys in sync with EVIDENCE_FIELDS in src/utils/tradeIntegrity.ts.
create or replace function public.trading_os_guard_locked_trade()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  k text;
  locked_keys text[] := array[
    'date','asset','direction','timeframe','session','modelId','setupGrade',
    'narrative','setupReasoning','entryPrice','stopPrice','targetPrice','exitPrice',
    'plannedR','realizedR','status','outcome','processScore','processCategory',
    'mistakeCodes','violations','configVersionUsed','closedAt','voided'
  ];
  changed boolean := false;
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'A trade cannot be moved to another user' using errcode = 'P0001';
  end if;

  if coalesce(old.trade_data->>'status', '') <> 'CLOSED' and (old.trade_data->'voided') is null then
    return new; -- still open: freely editable
  end if;

  if new.hq_config_version is distinct from old.hq_config_version then
    changed := true;
  end if;
  if not changed then
    foreach k in array locked_keys loop
      if (old.trade_data -> k) is distinct from (new.trade_data -> k) then
        changed := true;
        exit;
      end if;
    end loop;
  end if;

  if not changed then
    return new;
  end if;

  if exists (
    select 1 from public.trading_os_trade_amendments a
    where a.trade_id = new.id and a.user_id = new.user_id
      and a.created_at > now() - interval '2 minutes'
  ) then
    return new;
  end if;

  raise exception 'Trade % is locked: its evidence can only change through a logged amendment with a reason', new.id
    using errcode = 'P0001';
end;
$$;

drop trigger if exists trading_os_guard_locked_trade on public.trading_os_trade_records;
create trigger trading_os_guard_locked_trade
  before update on public.trading_os_trade_records
  for each row execute function public.trading_os_guard_locked_trade();
