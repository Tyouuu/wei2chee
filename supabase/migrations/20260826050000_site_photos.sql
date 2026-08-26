-- Where a customer's own photographs live.
--
-- 「不要自己養吧 我prefer就是如果那個圖庫好用 我們就用 然後用可以不滿意 可以再去圖庫
-- 推薦 也可以用ai 生成」 -- 2026-08-26.
--
-- Three sources end up in ONE bucket on purpose: the owner's upload, a stock
-- photo adopted from a library, and an AI-generated one. Once a photo is on a
-- customer's public page the page should not care where it came from, and the
-- page must not depend on anyone else's CDN staying up.
--
-- THAT IS ALSO A LICENCE REQUIREMENT and not only an engineering preference.
-- Pixabay's API documentation, read 2026-08-26: 「permanent hotlinking of images
-- (using Pixabay URLs in your app) is not allowed. If you intend to use the
-- images, please download them to your server first.」 Unsplash requires the
-- exact opposite -- 「we require the image URLs returned by the API to be
-- directly used or embedded」 -- which is why Pixabay is the one that fits: a
-- published customer site that loads its hero from a third party goes down
-- when the third party does.
--
-- PUBLIC READ, because these appear on /s/<slug>, which a stranger opens with
-- no session. Nothing private is ever put here; the bucket holds photographs a
-- business is publishing on purpose.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'site-photos',
  'site-photos',
  true,
  -- 8MB. A phone photo off a contractor's camera roll is 3-5MB, and anything
  -- larger than this on a landing page is a slow first screen rather than a
  -- better one.
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- ---------------------------------------------------------------------------
-- Who may write
-- ---------------------------------------------------------------------------
-- The path is `<project_id>/<name>`, and a signed-in owner may only touch the
-- folder named after a project they own. RLS on storage.objects is the real
-- boundary here -- the API route that uploads runs with the user's session for
-- exactly that reason, rather than with the service role.
drop policy if exists "site photos are world readable" on storage.objects;
create policy "site photos are world readable"
  on storage.objects for select
  using (bucket_id = 'site-photos');

drop policy if exists "an owner writes only into their own project folder" on storage.objects;
create policy "an owner writes only into their own project folder"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'site-photos'
    and (storage.foldername(name))[1] in (
      select p.id::text from public.projects p where p.account_id = auth.uid()
    )
  );

drop policy if exists "an owner replaces only their own project folder" on storage.objects;
create policy "an owner replaces only their own project folder"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'site-photos'
    and (storage.foldername(name))[1] in (
      select p.id::text from public.projects p where p.account_id = auth.uid()
    )
  );

drop policy if exists "an owner deletes only their own project folder" on storage.objects;
create policy "an owner deletes only their own project folder"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'site-photos'
    and (storage.foldername(name))[1] in (
      select p.id::text from public.projects p where p.account_id = auth.uid()
    )
  );
