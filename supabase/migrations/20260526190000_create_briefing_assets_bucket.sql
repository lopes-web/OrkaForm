insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'briefing-assets',
  'briefing-assets',
  true,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "briefing_assets_public_read" on storage.objects;
drop policy if exists "briefing_assets_authenticated_insert" on storage.objects;
drop policy if exists "briefing_assets_authenticated_update" on storage.objects;
drop policy if exists "briefing_assets_authenticated_delete" on storage.objects;

create policy "briefing_assets_public_read"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'briefing-assets');

create policy "briefing_assets_authenticated_insert"
on storage.objects
for insert
to authenticated
with check (bucket_id = 'briefing-assets');

create policy "briefing_assets_authenticated_update"
on storage.objects
for update
to authenticated
using (bucket_id = 'briefing-assets')
with check (bucket_id = 'briefing-assets');

create policy "briefing_assets_authenticated_delete"
on storage.objects
for delete
to authenticated
using (bucket_id = 'briefing-assets');

