-- Weekly reviews: one per trader per week (week_start = Monday).
-- Stores the reflection fields, next week's watchlist and a snapshot of the
-- week's evidence. Editable, never deleted from the app.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.

create table if not exists public.trading_os_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null,
  review_data jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);

revoke all on public.trading_os_weekly_reviews from anon;
revoke all on public.trading_os_weekly_reviews from authenticated;
grant select, insert, update on public.trading_os_weekly_reviews to authenticated;
alter table public.trading_os_weekly_reviews enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'public' and tablename = 'trading_os_weekly_reviews' and policyname = 'weekly_reviews_owner_select') then
    create policy weekly_reviews_owner_select on public.trading_os_weekly_reviews for select to authenticated using ((select auth.uid()) = user_id);
    create policy weekly_reviews_owner_insert on public.trading_os_weekly_reviews for insert to authenticated with check ((select auth.uid()) = user_id);
    create policy weekly_reviews_owner_update on public.trading_os_weekly_reviews for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
  end if;
end $$;
