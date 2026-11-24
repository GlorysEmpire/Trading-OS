-- M5 (Market Decomposition): record a backtest's outcome once.
-- Structural records have no update grant; this function is the only way to
-- set `outcome`, and only on the caller's own BACKTEST record, only once, and
-- only after a Daily read (the locked prediction) exists. After it is set, the
-- layer guard already refuses new layer versions ("This backtest is closed").

create or replace function public.trading_os_record_backtest_outcome(p_record_id uuid, p_outcome jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  rec public.trading_os_structural_records%rowtype;
  saved jsonb;
begin
  if uid is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  select * into rec from public.trading_os_structural_records where id = p_record_id and user_id = uid for update;
  if not found then
    raise exception 'Backtest not found' using errcode = 'P0001';
  end if;
  if rec.mode <> 'BACKTEST' then
    raise exception 'Outcomes are recorded only on backtests.' using errcode = 'P0001';
  end if;
  if rec.outcome is not null then
    raise exception 'The outcome is already recorded and cannot be changed.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.trading_os_structural_layers where structural_record_id = rec.id and timeframe = 'DAILY') then
    raise exception 'Lock a daily read before recording what price did.' using errcode = 'P0001';
  end if;
  if coalesce(p_outcome->>'result', '') not in ('REACHED_TARGET', 'HIT_INVALIDATION', 'NEITHER') then
    raise exception 'Say what price did: reached the target, hit the invalidation, or neither.' using errcode = 'P0001';
  end if;
  saved := p_outcome || jsonb_build_object('recordedAt', to_jsonb(now()));
  update public.trading_os_structural_records set outcome = saved where id = rec.id;
  return saved;
end;
$$;

revoke all on function public.trading_os_record_backtest_outcome(uuid, jsonb) from public, anon;
grant execute on function public.trading_os_record_backtest_outcome(uuid, jsonb) to authenticated;
