-- Trading OS Week 1. Additive migration: each Asset Desk becomes a managed instrument.
-- Apply only after taking a Supabase backup. No existing data is deleted.
alter table public.asset_desks
  add column if not exists canonical_symbol text,
  add column if not exists category text,
  add column if not exists tradingview_symbol text,
  add column if not exists archived_at timestamptz;

update public.asset_desks
set canonical_symbol = coalesce(nullif(canonical_symbol, ''), symbol),
    category = coalesce(nullif(category, ''), 'OTHER')
where canonical_symbol is null or canonical_symbol = '' or category is null or category = '';

alter table public.asset_desks
  alter column canonical_symbol set not null,
  alter column category set not null;

create index if not exists asset_desks_user_active_idx
  on public.asset_desks(user_id, archived_at) where archived_at is null;

comment on column public.asset_desks.archived_at is
  'Soft archive timestamp. Historical trades/research and desk data must be retained.';
