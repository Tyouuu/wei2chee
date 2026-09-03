-- 工地的照片挂在那一张单上。
--
-- ── 为什么这一格在刚需之后排第一个行业包 ─────────────────────────────────
--
-- 装修 · 冷气水电 · 美容 —— 他最大的三个市场，三个都靠照片做事：
-- 「上个月那间厨房做完长什么样」「拆开来看到水管是这样烂的」「染之前是这个颜色」。
--
-- ServiceM8 商店页那五张，第四张就是 **Take Job Photos**（任务 106 实拍）。
-- 而我们今天的照片**只服务官网** —— 一张都不属於任何一张单。
--
-- ── 🔴 它不可以放进 `site-photos`，而这是这一支最重要的一句 ────────────
--
-- `site-photos` 的档头白纸黑字写着 **PUBLIC READ**，理由是对的：
-- 那些照片是他**故意要发布**在 /s/<slug> 上给陌生人看的。
--
-- 一张工地的照片不是。那是**他的客户家里**：拆开的厨房、烧掉的冷气、
-- 客人染发前的样子。放进一个公开读的桶，等於「拿到网址的人都看得到」。
--
-- 所以：**另一个桶，private，读要签名的网址。**
--
-- ── 🔴 而且写它的人不是老板，是工地上那一个 ─────────────────────────────
--
-- `site-photos` 那三条政策问的是 `p.account_id = auth.uid()` ——
-- **一个师傅一张照片都传不上去**。而拍工地照的本来就是他。
--
-- 这里问 `works_here()`：20260901010000 立的那一条「这个 schema 里只有一个
-- 判断权限的地方」。看照片同理 —— 师傅要看得到上一次拆开来长什么样。
--
-- ⚠️ 而 `site-photos` 那三条**故意不在这里改** —— 那是官网那一边的桶，
-- 而它的政策是另一个 session 的地盘（[重点 20]）。**只登记：师傅传不了官网照片。**

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'job-photos',
  'job-photos',
  /* 🔴 false。见档头 —— 这是这一支跟 site-photos 唯一、也是最重要的差别。 */
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- 路径是 `<project_id>/<record_id>/<uuid>.<ext>`，所以第一段就是那一家。
drop policy if exists "job photos are read by whoever works there" on storage.objects;
create policy "job photos are read by whoever works there"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'job-photos'
    and public.works_here(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "whoever works there uploads a job photo" on storage.objects;
create policy "whoever works there uploads a job photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'job-photos'
    and public.works_here(((storage.foldername(name))[1])::uuid)
  );

drop policy if exists "whoever works there removes a job photo" on storage.objects;
create policy "whoever works there removes a job photo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'job-photos'
    and public.works_here(((storage.foldername(name))[1])::uuid)
  );

-- ── 哪一张照片属於哪一张单 ────────────────────────────────────────────────
--
-- 一张表，不是单据上的一栏 jsonb：照片有顺序、有说明、而且是**不同的人在
-- 不同的时间加上去的**（师傅早上拍拆除，下午拍水管）。一栏 jsonb 会让
-- 两个人同一分钟各加一张的时候，后写的那个把前一个盖掉。

create table if not exists public.record_photos (
  id uuid primary key default gen_random_uuid(),

  record_id uuid not null references public.pipeline_records(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 桶里的路径，不是网址。网址是签出来的，而签名会过期 ——
     存一个会过期的字串，等於存一个明天变成假的东西。 */
  path text not null,

  /* 「拆除之前」「水管烂在这里」。可以空 —— 大部分照片不用说明。 */
  caption text not null default '',

  sort_order integer not null default 0,

  /* 谁拍的。师傅传的照片，老板要知道是谁传的。 */
  taken_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now(),

  constraint record_photos_path_not_blank check (btrim(path) <> ''),
  /* 同一张照片不可以挂两次 —— 手机上网路慢，他会按两次。 */
  constraint record_photos_path_unique unique (record_id, path)
);

comment on table public.record_photos is
  'Photographs taken on a job. Stored in the PRIVATE job-photos bucket, not the public site-photos one -- these are the customer''s own premises. See the header of 20260904010000.';
comment on column public.record_photos.path is
  'The path inside the bucket, never a URL: a signed URL expires, and a stored expiring string is a stored lie.';

create index if not exists record_photos_record_idx
  on public.record_photos (record_id, sort_order, created_at);

alter table public.record_photos enable row level security;

/* `works_here`：拍照的跟看照片的都是工地上那一个。 */
drop policy if exists "record_photos_members" on public.record_photos;
create policy "record_photos_members" on public.record_photos
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

create or replace function public.record_photos_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from public.pipeline_records where id = new.record_id;
  if owner_project is null then
    raise exception 'no such document';
  end if;
  new.project_id := owner_project;
  return new;
end;
$$;

drop trigger if exists record_photos_own_project_trg on public.record_photos;
create trigger record_photos_own_project_trg
  before insert or update on public.record_photos
  for each row execute function public.record_photos_own_project();

-- ── 写它 ──────────────────────────────────────────────────────────────────
--
-- ⚠️ **不是整批换**，跟明细 / 分期 / 分摊三支都不一样，理由要讲出来：
-- 那三样是「一份完整的话」，半套改完就不成立。照片不是 —— 它们是**一件一件
-- 发生的事**，师傅早上传一张，下午再传一张。整批换会让两个人同时在工地上
-- 各传一张的时候，后送出的那一个把前一个删掉。
--
-- 所以：一次加一张，一次删一张。

create or replace function public.add_record_photo(
  in_record_id uuid,
  in_path text,
  in_caption text default ''
)
returns public.record_photos
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  row public.record_photos;
  next_order integer;
begin
  select exists (
    select 1 from public.pipeline_records r
    where r.id = in_record_id and public.works_here(r.project_id)
  ) into mine;
  if not mine then
    raise exception 'no such document in your project';
  end if;

  if coalesce(btrim(in_path), '') = '' then
    raise exception 'a photo needs a path';
  end if;

  /* 一张单五十张照片是一本相簿，而那不是这一栏在做的事。 */
  if (select count(*) from public.record_photos where record_id = in_record_id) >= 50 then
    raise exception 'that is more photos than one job holds';
  end if;

  select coalesce(max(sort_order), -1) + 1 into next_order
  from public.record_photos where record_id = in_record_id;

  insert into public.record_photos (record_id, project_id, path, caption, sort_order, taken_by)
  values (
    in_record_id,
    /* 被触发器盖掉；这里只是为了满足 not null。 */
    '00000000-0000-0000-0000-000000000000'::uuid,
    btrim(in_path),
    left(coalesce(in_caption, ''), 200),
    next_order,
    auth.uid()
  )
  returning * into row;

  return row;

exception
  /* 手机上按了两次。第二次拿回同一张，不是一个错误。 */
  when unique_violation then
    select * into row from public.record_photos
    where record_id = in_record_id and path = btrim(in_path);
    if found then
      return row;
    end if;
    raise;
end;
$$;

create or replace function public.remove_record_photo(in_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  gone integer;
begin
  delete from public.record_photos p
  where p.id = in_id and public.works_here(p.project_id);
  get diagnostics gone = row_count;
  /* ⚠️ 桶里那个档案**不在这里删** —— 呼叫的人删完这一行再去删档案，
     而两件事失败的方式不一样：这一行没了而档案还在，是一个没有人看得到的
     孤儿档；档案没了而这一行还在，是画面上一张破掉的照片。
     所以先删档案、再删这一行 —— 前者比较不吓人。 */
  return gone > 0;
end;
$$;

revoke execute on function public.add_record_photo(uuid, text, text) from public, anon;
grant execute on function public.add_record_photo(uuid, text, text) to authenticated;
revoke execute on function public.remove_record_photo(uuid) from public, anon;
grant execute on function public.remove_record_photo(uuid) to authenticated;
