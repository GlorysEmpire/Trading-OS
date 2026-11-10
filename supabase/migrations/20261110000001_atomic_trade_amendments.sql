-- A closed trade and its audit row must commit together. Direct client updates
-- to locked evidence cannot borrow an earlier amendment.
revoke truncate on public.trading_os_trade_records from authenticated;
alter table public.trading_os_trade_amendments
  add column if not exists operation_xid bigint;

create or replace function public.trading_os_guard_locked_trade()
returns trigger language plpgsql security invoker set search_path = public as $$
declare
  k text;
  expected_changes jsonb := '[]'::jsonb;
  locked_keys text[] := array[
    'date','asset','direction','timeframe','session','modelId','setupGrade',
    'narrative','setupReasoning','entryPrice','stopPrice','targetPrice','exitPrice',
    'plannedR','realizedR','status','outcome','processScore','processCategory',
    'mistakeCodes','violations','configVersionUsed','closedAt','voided',
    'entryAt','breakeven','riskPercentAtEntry'
  ];
begin
  if new.user_id is distinct from old.user_id or new.id is distinct from old.id then
    raise exception 'A trade cannot be moved to another owner or ID' using errcode = 'P0001';
  end if;
  if coalesce(old.trade_data->>'status', '') <> 'CLOSED' and old.trade_data->'voided' is null then
    return new;
  end if;
  if new.hq_config_version is distinct from old.hq_config_version then
    raise exception 'A closed trade cannot change its Trading HQ version' using errcode = 'P0001';
  end if;
  foreach k in array locked_keys loop
    if old.trade_data->k is distinct from new.trade_data->k then
      expected_changes := expected_changes || jsonb_build_array(jsonb_build_object(
        'field', k, 'from', coalesce(old.trade_data->k, 'null'::jsonb),
        'to', coalesce(new.trade_data->k, 'null'::jsonb)
      ));
    end if;
  end loop;
  if jsonb_array_length(expected_changes) = 0 then return new; end if;
  if exists (
    select 1 from public.trading_os_trade_amendments a
    where a.trade_id = new.id and a.user_id = new.user_id
      and a.operation_xid = txid_current()
      and a.changes = expected_changes
  ) then return new; end if;
  raise exception 'Trade % is locked: use a logged amendment for this exact change', new.id
    using errcode = 'P0001';
end;
$$;

create or replace function public.trading_os_amend_trade(
  p_trade_id text,
  p_expected_trade_data jsonb,
  p_next_trade_data jsonb,
  p_kind text,
  p_reason text
) returns public.trading_os_trade_amendments
language plpgsql security invoker set search_path = public as $$
declare
  current_row public.trading_os_trade_records%rowtype;
  amendment public.trading_os_trade_amendments%rowtype;
  k text;
  changes jsonb := '[]'::jsonb;
  allowed text[] := array[
    'date','asset','direction','timeframe','session','modelId','setupGrade',
    'entryPrice','stopPrice','targetPrice','exitPrice','outcome','processScore',
    'mistakeCodes','entryAt','breakeven','plannedR','realizedR','processCategory'
  ];
  free_fields text[] := array[
    'reflectionAfter','notesDuring','screenshots','linkedPsychologyId',
    'linkedResearchQuestionId'
  ];
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_kind not in ('AMEND','VOID') or nullif(btrim(p_reason), '') is null then
    raise exception 'An amendment kind and reason are required' using errcode = 'P0001';
  end if;
  if jsonb_typeof(p_next_trade_data) <> 'object' then
    raise exception 'Trade data must be an object' using errcode = 'P0001';
  end if;
  select * into current_row from public.trading_os_trade_records
    where id = p_trade_id and user_id = (select auth.uid()) for update;
  if not found then raise exception 'Trade not found' using errcode = 'P0001'; end if;
  if current_row.trade_data is distinct from p_expected_trade_data then
    raise exception 'Trade changed since it was loaded; refresh before amending' using errcode = 'P0001';
  end if;
  if p_kind = 'AMEND' and current_row.trade_data->>'status' <> 'CLOSED' then
    raise exception 'Only closed trades can be amended' using errcode = 'P0001';
  end if;
  if current_row.trade_data->'voided' is not null then
    raise exception 'A voided trade cannot be amended again' using errcode = 'P0001';
  end if;
  if p_next_trade_data->>'id' is distinct from p_trade_id
     or p_next_trade_data->>'configVersionUsed' is distinct from current_row.hq_config_version then
    raise exception 'Trade ID and Trading HQ version cannot change' using errcode = 'P0001';
  end if;
  if p_kind = 'VOID' then
    if p_next_trade_data - 'voided' is distinct from current_row.trade_data - 'voided'
       or p_next_trade_data->'voided' is null then
      raise exception 'Voiding may only add the void record' using errcode = 'P0001';
    end if;
  else
    if p_next_trade_data->'voided' is distinct from current_row.trade_data->'voided' then
      raise exception 'Use VOID to void a trade' using errcode = 'P0001';
    end if;
    for k in select jsonb_object_keys(current_row.trade_data || p_next_trade_data) loop
      if current_row.trade_data->k is distinct from p_next_trade_data->k
         and not (k = any(allowed) or k = any(free_fields)) then
        raise exception 'Field % cannot be amended', k using errcode = 'P0001';
      end if;
    end loop;
  end if;
  foreach k in array array[
    'date','asset','direction','timeframe','session','modelId','setupGrade',
    'narrative','setupReasoning','entryPrice','stopPrice','targetPrice','exitPrice',
    'plannedR','realizedR','status','outcome','processScore','processCategory',
    'mistakeCodes','violations','configVersionUsed','closedAt','voided',
    'entryAt','breakeven','riskPercentAtEntry'
  ] loop
    if current_row.trade_data->k is distinct from p_next_trade_data->k then
      changes := changes || jsonb_build_array(jsonb_build_object(
        'field', k, 'from', coalesce(current_row.trade_data->k, 'null'::jsonb),
        'to', coalesce(p_next_trade_data->k, 'null'::jsonb)
      ));
    end if;
  end loop;
  if jsonb_array_length(changes) = 0 then
    raise exception 'No evidence changed' using errcode = 'P0001';
  end if;
  insert into public.trading_os_trade_amendments
    (user_id, trade_id, kind, reason, changes, operation_xid)
  values
    (current_row.user_id, p_trade_id, p_kind, btrim(p_reason), changes, txid_current())
  returning * into amendment;
  update public.trading_os_trade_records
    set trade_data = p_next_trade_data, updated_at = now()
    where id = p_trade_id and user_id = current_row.user_id;
  return amendment;
end;
$$;
revoke all on function public.trading_os_amend_trade(text, jsonb, jsonb, text, text) from public, anon;
grant execute on function public.trading_os_amend_trade(text, jsonb, jsonb, text, text) to authenticated;
