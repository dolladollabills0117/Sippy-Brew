-- Public bucket for shop photos. Owners upload into a folder named after their user id.
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    insert into storage.buckets (id, name, public) values ('shop-photos', 'shop-photos', true)
      on conflict (id) do nothing;

    execute $p$
      create policy "shop photos are public" on storage.objects for select using (bucket_id = 'shop-photos')
    $p$;
    execute $p$
      create policy "owners upload their own shop photos" on storage.objects for insert to authenticated
      with check (bucket_id = 'shop-photos' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
    execute $p$
      create policy "owners replace their own shop photos" on storage.objects for update to authenticated
      using (bucket_id = 'shop-photos' and (storage.foldername(name))[1] = auth.uid()::text)
    $p$;
  end if;
end $$;
