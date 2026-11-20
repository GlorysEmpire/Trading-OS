-- "Reset app": one call that permanently deletes everything the signed-in
-- user owns in Trading OS, so they can start again from a clean slate.
--
-- Trades can't be deleted from the app normally (see trade_lock_amendments),
-- so this runs as a security-definer function. It only ever touches rows of
-- auth.uid(), and only when the caller passes the exact confirmation phrase
-- the app makes the user type. Chart files are removed by the app through
-- Storage (the owner delete policy below), not from SQL.

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
  -- Children before parents (amendments reference trades).
  tables text[] := array[
    'trading_os_trade_amendments',
    'trading_os_trade_records',
    'trading_os_pending_setups',
    'trading_os_daily_debriefs',
    'trading_os_weekly_reviews',
    'trading_os_backtest_samples',
    'trading_os_research_questions',
    'trading_os_desk_analysis_history',
    'trading_os_capital_settings',
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

-- Let a user delete chart files in their own folder (used only by reset).
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'trading_os_charts_owner_delete') then
    create policy trading_os_charts_owner_delete on storage.objects
      for delete to authenticated
      using (bucket_id = 'trading-os-charts' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;
