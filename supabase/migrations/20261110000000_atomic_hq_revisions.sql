-- Replace a Trading HQ category in one transaction. A failed insert rolls back
-- the deactivation, so the last active configuration is never lost.
revoke delete, truncate on public.trading_hq_configs from authenticated;
drop policy if exists trading_hq_configs_owner_delete on public.trading_hq_configs;
create or replace function public.trading_os_replace_hq_category(
  p_row_id uuid,
  p_expected_version integer,
  p_content jsonb,
  p_reason text
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  current_row public.trading_hq_configs%rowtype;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  select * into current_row
  from public.trading_hq_configs
  where id = p_row_id and user_id = (select auth.uid())
  for update;
  if not found or not current_row.is_active or current_row.version <> p_expected_version then
    raise exception 'Trading HQ changed since it was loaded; refresh before saving' using errcode = 'P0001';
  end if;
  update public.trading_hq_configs set is_active = false where id = current_row.id;
  insert into public.trading_hq_configs
    (user_id, category, slug, title, content, version, is_active, changed_reason)
  values
    (current_row.user_id, current_row.category, current_row.slug, current_row.title,
     p_content, current_row.version + 1, true, nullif(btrim(p_reason), ''));
end;
$$;
revoke all on function public.trading_os_replace_hq_category(uuid, integer, jsonb, text) from public, anon;
grant execute on function public.trading_os_replace_hq_category(uuid, integer, jsonb, text) to authenticated;
