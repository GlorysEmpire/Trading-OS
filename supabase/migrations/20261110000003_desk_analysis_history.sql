-- Completing or resetting analysis archives the live snapshot and clears the
-- selected scope in one transaction. Instrument identity and watchlist stay.
create table if not exists public.trading_os_desk_analysis_history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  desk_id text not null,
  scope text not null check (scope in ('all','narrative','monthly','weekly','daily','h4')),
  outcome text not null check (outcome in ('TARGET_HIT','INVALIDATED','COMPLETED','RESET')),
  reason text not null default '',
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);
create index if not exists desk_analysis_history_desk_idx
  on public.trading_os_desk_analysis_history(desk_id, created_at desc);
revoke all on public.trading_os_desk_analysis_history from anon;
grant select, insert on public.trading_os_desk_analysis_history to authenticated;
alter table public.trading_os_desk_analysis_history enable row level security;
create policy desk_analysis_history_owner_select on public.trading_os_desk_analysis_history
  for select to authenticated using ((select auth.uid()) = user_id);
create policy desk_analysis_history_owner_insert on public.trading_os_desk_analysis_history
  for insert to authenticated with check (
    (select auth.uid()) = user_id
    and exists (select 1 from public.asset_desks d where d.id::text = desk_id and d.user_id = (select auth.uid()))
  );

create or replace function public.trading_os_archive_and_reset_desk_analysis(
  p_desk_id text,
  p_scope text,
  p_outcome text,
  p_reason text default ''
) returns public.trading_os_desk_analysis_history
language plpgsql security invoker set search_path = public as $$
declare
  desk public.asset_desks%rowtype;
  history public.trading_os_desk_analysis_history%rowtype;
  htf jsonb := '{}'::jsonb;
  notes_bundle jsonb := '{}'::jsonb;
  charts jsonb := '[]'::jsonb;
  scoped_charts jsonb := '[]'::jsonb;
  remaining_charts jsonb := '[]'::jsonb;
  archived_content jsonb;
  selected_text text;
begin
  if (select auth.uid()) is null then
    raise exception 'Sign in required' using errcode = '42501';
  end if;
  if p_scope not in ('all','narrative','monthly','weekly','daily','h4')
     or p_outcome not in ('TARGET_HIT','INVALIDATED','COMPLETED','RESET') then
    raise exception 'Invalid analysis scope or outcome' using errcode = 'P0001';
  end if;
  if p_outcome = 'INVALIDATED' and nullif(btrim(p_reason), '') is null then
    raise exception 'An invalidated analysis needs a reason' using errcode = 'P0001';
  end if;
  select * into desk from public.asset_desks
    where id::text = p_desk_id and user_id = (select auth.uid()) and archived_at is null
    for update;
  if not found then raise exception 'Active asset desk not found' using errcode = 'P0001'; end if;
  begin
    htf := coalesce(nullif(desk.htf_structure, '')::jsonb, '{}'::jsonb);
  exception when others then htf := '{}'::jsonb;
  end;
  begin
    notes_bundle := coalesce(nullif(desk.notes, '')::jsonb, '{}'::jsonb);
  exception when others then notes_bundle := '{}'::jsonb;
  end;
  if jsonb_typeof(htf) <> 'object' then htf := '{}'::jsonb; end if;
  if jsonb_typeof(notes_bundle) <> 'object' then notes_bundle := '{}'::jsonb; end if;
  charts := coalesce(notes_bundle->'charts', '[]'::jsonb);
  if jsonb_typeof(charts) <> 'array' then charts := '[]'::jsonb; end if;

  if p_scope = 'all' then
    archived_content := jsonb_build_object(
      'bias', desk.bias, 'narrative', desk.narrative, 'htfStructure', htf,
      'liquidity', desk.liquidity, 'pois', desk.pois,
      'wyckoffDevelopment', desk.wyckoff_development,
      'externalContext', desk.external_context, 'scenarios', desk.scenarios,
      'researchNotes', desk.research_notes, 'notesBundle', notes_bundle,
      'rawNotes', desk.notes, 'rawHtfStructure', desk.htf_structure
    );
    update public.asset_desks set
      bias = 'NEUTRAL', narrative = '',
      htf_structure = '{"monthly":"","weekly":"","daily":"","h4":""}',
      liquidity = '{"high24h":"","low24h":"","keySustainedLevel":""}',
      pois = '[]', wyckoff_development = '{"phase":"","notes":""}',
      external_context = '{}', scenarios = '[]', research_notes = '',
      notes = jsonb_build_object(
        'watchlisted', coalesce(notes_bundle->'watchlisted', 'false'::jsonb),
        'liquidityZones', '[]'::jsonb, 'wyckoffEvents', '[]'::jsonb, 'charts', '[]'::jsonb
      )::text
    where id = desk.id;
  else
    select coalesce(jsonb_agg(value), '[]'::jsonb) into scoped_charts
      from jsonb_array_elements(charts) value where value->>'placement' = p_scope;
    select coalesce(jsonb_agg(value), '[]'::jsonb) into remaining_charts
      from jsonb_array_elements(charts) value where value->>'placement' is distinct from p_scope;
    if p_scope = 'narrative' then
      selected_text := coalesce(desk.narrative, '');
      archived_content := jsonb_build_object('bias', desk.bias, 'narrative', selected_text, 'charts', scoped_charts);
      update public.asset_desks set bias = 'NEUTRAL', narrative = '',
        notes = jsonb_set(notes_bundle, '{charts}', remaining_charts)::text where id = desk.id;
    else
      selected_text := coalesce(htf->>p_scope, '');
      archived_content := jsonb_build_object('structure', selected_text, 'charts', scoped_charts);
      update public.asset_desks set htf_structure = jsonb_set(htf, array[p_scope], '""'::jsonb)::text,
        notes = jsonb_set(notes_bundle, '{charts}', remaining_charts)::text where id = desk.id;
    end if;
  end if;

  insert into public.trading_os_desk_analysis_history
    (user_id, desk_id, scope, outcome, reason, snapshot)
  values
    (desk.user_id, desk.id::text, p_scope, p_outcome, coalesce(btrim(p_reason), ''),
     jsonb_build_object('symbol', desk.symbol, 'content', archived_content))
  returning * into history;
  return history;
end;
$$;
revoke all on function public.trading_os_archive_and_reset_desk_analysis(text, text, text, text) from public, anon;
grant execute on function public.trading_os_archive_and_reset_desk_analysis(text, text, text, text) to authenticated;
