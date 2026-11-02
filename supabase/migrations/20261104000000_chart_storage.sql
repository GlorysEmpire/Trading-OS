-- Chart screenshots move out of the database rows into Supabase Storage.
-- Private bucket; each user can only read and add files in their own folder
-- (<user id>/...). No update or delete: a replaced screenshot is a new file,
-- so the original stays available as evidence.
--
-- Run once in the Supabase SQL Editor. Safe to re-run.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('trading-os-charts', 'trading-os-charts', false, 5242880,
        array['image/webp', 'image/png', 'image/jpeg', 'image/gif'])
on conflict (id) do nothing;

do $$ begin
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'trading_os_charts_owner_select') then
    create policy trading_os_charts_owner_select on storage.objects
      for select to authenticated
      using (bucket_id = 'trading-os-charts' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
  if not exists (select 1 from pg_policies where schemaname = 'storage' and tablename = 'objects' and policyname = 'trading_os_charts_owner_insert') then
    create policy trading_os_charts_owner_insert on storage.objects
      for insert to authenticated
      with check (bucket_id = 'trading-os-charts' and (storage.foldername(name))[1] = (select auth.uid())::text);
  end if;
end $$;
