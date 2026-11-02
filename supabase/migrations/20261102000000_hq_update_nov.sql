-- Trading HQ update (2026-11-02).
--  1. Allow the new `focus_rotation` HQ category (weekly focus rotation).
--  2. Trades gained `entryAt` (entry time, for NY-time session scoring) and
--     `breakeven` (how the stop was moved to BE). Both are evidence, so the
--     trade-lock trigger now protects them too.
--
-- Run once in the Supabase SQL Editor, AFTER 20261029000000_trade_lock_amendments.sql.
-- Safe to re-run.

alter table trading_hq_configs drop constraint if exists trading_hq_configs_category_check;
alter table trading_hq_configs add constraint trading_hq_configs_category_check
  check (category = any (array[
    'risk'::text, 'setup_quality'::text, 'execution_model'::text, 'session'::text,
    'research_framework'::text, 'mistake_code'::text, 'process_score'::text,
    'focus_rotation'::text
  ]));

-- Keep locked_keys in sync with EVIDENCE_FIELDS in src/utils/tradeIntegrity.ts.
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
    'mistakeCodes','violations','configVersionUsed','closedAt','voided',
    'entryAt','breakeven'
  ];
  changed boolean := false;
begin
  if new.user_id is distinct from old.user_id then
    raise exception 'A trade cannot be moved to another user' using errcode = 'P0001';
  end if;

  if coalesce(old.trade_data->>'status', '') <> 'CLOSED' and (old.trade_data->'voided') is null then
    return new;
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
