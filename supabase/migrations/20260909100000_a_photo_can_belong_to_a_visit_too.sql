-- 前后对比的照片 —— 挂在**那一次疗程**上，不是挂在一张单上。
--
-- ── 为什么是这一件 ─────────────────────────────────────────────────────
--
-- [任务 309](../docs/founder-tasks.md) 量出来 medi spa 差三件，这是第二件。
-- Zenoti 的原文：`HIPAA-Compliant Before/After Photo Management —— Photos
-- linked to treatment visits with side-by-side comparison overlays`；
-- Aoikumo（马来西亚那一家）：`Photo Capture, Annotation and Collaging`。
--
-- 🔴 而我们**不重做一张表**。20260904010000 那一张早就在，而它已经解过
-- 这一件全部难的地方：**私有的桶** · 签出来的网址（不存会过期的字串）·
-- `works_here`（拍照的跟看照片的都是现场那一个）· 一次一张不整批换。
-- 它唯一的问题是**它只挂得上一张单**，而一间 medi spa 不开单。
--
-- ── 🔴 这是一次「放宽」，所以先问那条守卫本来在保护什么 ────────────────
--
-- `record_id not null` 保护的是：**一张照片一定属於某一件事**
-- （少了它，桶里会长出一堆没有人认得的脸）。
-- 那件事没有不见 —— 它换成了 `record_photos_belongs_to_one`：
-- **一张照片属於一张单，或者一次疗程，刚好一个。**
--
-- ⚠️ 而桶一个字都不用改：路径是 `<project_id>/<...>/<uuid>`，
-- 而那三条政策读的只有第一段。
--
-- ── 🔴 「之前」还是「之后」是一栏，不是靠说明去猜 ───────────────────────
--
-- 一张写着「打之前」的说明，跟一栏 `stage = 'before'`，在画面上差很远：
-- 前者排不了序、配不了对，而**她要的就是把两张摆在一起**。
-- 三个值（before · after · during），封闭的一份 —— 不是我们发明的，
-- 那是这一行本来就在讲的三个词。
--
-- ── 🔴 而最要紧的那一栏是「可不可以给别人看」，预设是**不可以** ─────────
--
-- Zenoti 那一句：`capture clinical and marketing consent separately …
-- clearly identify which photos are approved for public use`。
--
-- 这不是一个多的功能，是**这一整件事最容易出的那个事故**：
-- 一张客人的脸出现在他的官网上，而她从来没有答应过。
-- [任务 19](../docs/founder-tasks.md) 立过那一条（没填的东西不上线），
-- 而这一栏是它在这一层的样子：**`may_show` 预设 false，要她一个动作才翻。**
--
-- ⚠️ 而它今天**还没有接到官网上** —— 那一层要的时候只准读这一栏，
-- 不准自己判。写下来，免得下一个人从别的地方去挑照片。

alter table public.record_photos
  alter column record_id drop not null;

alter table public.record_photos
  add column if not exists note_id uuid references public.treatment_notes(id) on delete cascade;

alter table public.record_photos
  add column if not exists stage text not null default '';

alter table public.record_photos
  add column if not exists may_show boolean not null default false;

comment on column public.record_photos.may_show is
  'Whether the customer agreed this one may be shown publicly. Default false; nothing outside the record may read a photo without it.';

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'record_photos_belongs_to_one'
  ) then
    alter table public.record_photos
      add constraint record_photos_belongs_to_one check (
        (record_id is not null and note_id is null)
        or (record_id is null and note_id is not null)
      );
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'record_photos_stage_known'
  ) then
    alter table public.record_photos
      add constraint record_photos_stage_known
        check (stage in ('', 'before', 'during', 'after'));
  end if;
end;
$$;

/* 同一张照片不可以挂两次 —— 手机上网路慢，她会按两次。
   原本那一条只管挂在单上的（unique (record_id, path)），而 null 不互相撞，
   所以挂在疗程上的那几张要它自己一条。 */
create unique index if not exists record_photos_note_path_unique
  on public.record_photos (note_id, path) where note_id is not null;

create index if not exists record_photos_note_idx
  on public.record_photos (note_id, stage, sort_order, created_at);

/* 那张表的 project_id 跟着它上一层走 —— 原本那一支只认得单。
   🔴 在原来那一支上加，不整支重打（[重点 31] 第一条）。 */
create or replace function public.record_photos_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $fn$
declare
  owner_project uuid;
begin
  if new.note_id is not null then
    select project_id into owner_project
    from public.treatment_notes where id = new.note_id;
    if owner_project is null then
      raise exception 'no such treatment note';
    end if;
  else
    select project_id into owner_project
    from public.pipeline_records where id = new.record_id;
    if owner_project is null then
      raise exception 'no such document';
    end if;
  end if;
  new.project_id := owner_project;
  return new;
end;
$fn$;

-- ── 挂一张在那一次疗程上 ──────────────────────────────────────────────────

create or replace function public.add_treatment_photo(
  in_note_id uuid,
  in_path text,
  in_stage text default '',
  in_caption text default '',
  in_may_show boolean default false
)
returns public.record_photos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  note public.treatment_notes;
  row public.record_photos;
  seat integer;
begin
  select * into note from public.treatment_notes
   where id = in_note_id and public.works_here(project_id);
  if note.id is null then
    raise exception 'no such treatment note in your business';
  end if;

  if btrim(coalesce(in_path, '')) = '' then
    raise exception 'that upload did not land';
  end if;

  /* 路径的第一段就是那一家 —— 桶那三条政策读的也是它。
     少了这一句，一张挂在她的疗程上的照片，档案可以在别人家的资料夹里。 */
  if split_part(btrim(in_path), '/', 1) <> note.project_id::text then
    raise exception 'that file is not in this business';
  end if;

  if coalesce(in_stage, '') not in ('', 'before', 'during', 'after') then
    raise exception 'a photo is before, during or after';
  end if;

  if (select count(*) from public.record_photos where note_id = in_note_id) >= 50 then
    raise exception 'that visit already has fifty photographs';
  end if;

  select coalesce(max(sort_order), 0) + 1 into seat
    from public.record_photos where note_id = in_note_id;

  insert into public.record_photos
    (note_id, project_id, path, caption, stage, may_show, sort_order, taken_by)
  values (
    in_note_id, note.project_id, btrim(in_path),
    left(coalesce(in_caption, ''), 200),
    coalesce(in_stage, ''),
    /* 🔴 预设 false。见档头 —— 要她一个动作才翻。 */
    coalesce(in_may_show, false),
    seat, auth.uid()
  )
  on conflict (note_id, path) where note_id is not null do nothing
  returning * into row;

  /* 按两下：把原本那一张还给她，不是报错也不是第二张。 */
  if row.id is null then
    select * into row from public.record_photos
     where note_id = in_note_id and path = btrim(in_path);
  end if;

  return row;
end;
$fn$;

-- 她后来才问客人「这张可不可以放上去」—— 那是一个她自己做的动作。
create or replace function public.set_photo_may_show(
  in_id uuid,
  in_may_show boolean
)
returns public.record_photos
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.record_photos;
begin
  select * into row from public.record_photos
   where id = in_id and public.works_here(project_id);
  if row.id is null then
    raise exception 'no such photograph in your business';
  end if;

  update public.record_photos
     set may_show = coalesce(in_may_show, false)
   where id = in_id
  returning * into row;

  return row;
end;
$fn$;

-- 她站在客人面前会开的那一页：这一次的照片，之前的排在之后的前面。
create or replace function public.treatment_photos_of(in_note_id uuid)
returns table (
  id uuid,
  path text,
  stage text,
  caption text,
  may_show boolean,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $fn$
  select p.id, p.path, p.stage, p.caption, p.may_show, p.created_at
    from public.record_photos p
   where p.note_id = in_note_id
     and public.works_here(p.project_id)
   order by
     case p.stage when 'before' then 0 when 'during' then 1
                  when 'after' then 2 else 3 end,
     p.sort_order, p.created_at;
$fn$;

grant execute on function public.add_treatment_photo(uuid, text, text, text, boolean) to authenticated;
grant execute on function public.set_photo_may_show(uuid, boolean) to authenticated;
grant execute on function public.treatment_photos_of(uuid) to authenticated;
