-- Week 3: durable, user-owned research questions and backtest samples.
-- Same pattern as Week 2's trade journal (20261022000000): additive only,
-- no modification or deletion of any existing data, explicit local import.

create table if not exists public.trading_os_research_questions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  rq_data jsonb not null,
  status text not null default 'OBSERVATION',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trading_os_research_questions_user_created_idx
  on public.trading_os_research_questions(user_id, created_at desc);
revoke all on public.trading_os_research_questions from anon;
grant select, insert, update, delete on public.trading_os_research_questions to authenticated;
alter table public.trading_os_research_questions enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_os_research_questions' and policyname = 'research_questions_owner_select') then
    create policy research_questions_owner_select on public.trading_os_research_questions for select to authenticated using ((select auth.uid()) = user_id);
    create policy research_questions_owner_insert on public.trading_os_research_questions for insert to authenticated with check ((select auth.uid()) = user_id);
    create policy research_questions_owner_update on public.trading_os_research_questions for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    create policy research_questions_owner_delete on public.trading_os_research_questions for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;

create table if not exists public.trading_os_backtest_samples (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  research_question_id text references public.trading_os_research_questions(id) on delete set null,
  sample_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists trading_os_backtest_samples_user_created_idx
  on public.trading_os_backtest_samples(user_id, created_at desc);
create index if not exists trading_os_backtest_samples_rq_idx
  on public.trading_os_backtest_samples(research_question_id);
revoke all on public.trading_os_backtest_samples from anon;
grant select, insert, update, delete on public.trading_os_backtest_samples to authenticated;
alter table public.trading_os_backtest_samples enable row level security;
do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_os_backtest_samples' and policyname = 'backtest_samples_owner_select') then
    create policy backtest_samples_owner_select on public.trading_os_backtest_samples for select to authenticated using ((select auth.uid()) = user_id);
    create policy backtest_samples_owner_insert on public.trading_os_backtest_samples for insert to authenticated with check ((select auth.uid()) = user_id);
    create policy backtest_samples_owner_update on public.trading_os_backtest_samples for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
    create policy backtest_samples_owner_delete on public.trading_os_backtest_samples for delete to authenticated using ((select auth.uid()) = user_id);
  end if;
end $$;
