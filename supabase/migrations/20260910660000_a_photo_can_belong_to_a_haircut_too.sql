-- 前后对比照 —— 沙龙那一边今天一张都挂不上。
--
-- ── 为什么（[任务 341] 沙龙其余那一组）───────────────────────────────────
--
-- `record_photos` 已经会挂在一张单上（`record_id`，20260904010000）跟
-- 一次医美疗程上（`note_id`，20260909100000）——而沙龙走的不是那两条：
-- 沙龙一次来访是 `appointment_lines`（20260910010000），一张照片今天
-- 没有第三个格子可以挂。研究原话：「前后对比照」是沙龙其余清单上
-- 排得进去的一件，Aoikumo·Zenoti 两家都在卖它。
--
-- ── 照 note_id 那一次一模一样再做一次——这是第二次，不是第一次 ──────────
--
-- `record_photos_belongs_to_one` 从「只能是单」放宽成「单或者疗程」
-- 已经有过一次先例。这一支照同一个做法，放宽成三选一：
-- 单、疗程、或者一次来访的某一行。**桶、路径规则、`may_show` 预设
-- 一个字都不用改**——那三条政策读的只有路径第一段。

alter table public.record_photos
  add column if not exists line_id uuid references public.appointment_lines(id) on delete cascade;

alter table public.record_photos
  drop constraint if exists record_photos_belongs_to_one;
alter table public.record_photos
  add constraint record_photos_belongs_to_one check (
    (record_id is not null)::int
    + (note_id is not null)::int
    + (line_id is not null)::int = 1
  );

create unique index if not exists record_photos_line_path_unique
  on public.record_photos (line_id, path) where line_id is not null;

create index if not exists record_photos_line_idx
  on public.record_photos (line_id, stage, sort_order, created_at);

comment on column public.record_photos.line_id is
  'A salon visit line instead of a document or a medi-spa treatment note -- the third and last of the places a photo can hang. See 20260910660000.';

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
  elsif new.line_id is not null then
    select project_id into owner_project
    from public.appointment_lines where id = new.line_id;
    if owner_project is null then
      raise exception 'no such visit line';
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

-- ── 挂一张在一次来访的某一行上 ────────────────────────────────────────────

create or replace function public.add_visit_photo(
  in_line_id uuid,
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
  line public.appointment_lines;
  row public.record_photos;
  seat integer;
begin
  select * into line from public.appointment_lines
   where id = in_line_id and public.works_here(project_id);
  if line.id is null then
    raise exception 'no such line on a visit in your business';
  end if;

  if btrim(coalesce(in_path, '')) = '' then
    raise exception 'that upload did not land';
  end if;

  if split_part(btrim(in_path), '/', 1) <> line.project_id::text then
    raise exception 'that file is not in this business';
  end if;

  if coalesce(in_stage, '') not in ('', 'before', 'during', 'after') then
    raise exception 'a photo is before, during or after';
  end if;

  if (select count(*) from public.record_photos where line_id = in_line_id) >= 50 then
    raise exception 'that visit already has fifty photographs';
  end if;

  select coalesce(max(sort_order), 0) + 1 into seat
    from public.record_photos where line_id = in_line_id;

  insert into public.record_photos
    (line_id, project_id, path, caption, stage, may_show, sort_order, taken_by)
  values (
    in_line_id, line.project_id, btrim(in_path),
    left(coalesce(in_caption, ''), 200),
    coalesce(in_stage, ''),
    coalesce(in_may_show, false),
    seat, auth.uid()
  )
  on conflict (line_id, path) where line_id is not null do nothing
  returning * into row;

  if row.id is null then
    select * into row from public.record_photos
     where line_id = in_line_id and path = btrim(in_path);
  end if;

  return row;
end;
$fn$;

grant execute on function public.add_visit_photo(uuid, text, text, text, boolean) to authenticated;

-- ── 读回来 ────────────────────────────────────────────────────────────────

create or replace function public.visit_photos_of(in_line_id uuid)
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
   where p.line_id = in_line_id
     and public.works_here(p.project_id)
   order by
     case p.stage when 'before' then 0 when 'during' then 1
                  when 'after' then 2 else 3 end,
     p.sort_order, p.created_at;
$fn$;

grant execute on function public.visit_photos_of(uuid) to authenticated;
