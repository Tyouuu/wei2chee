-- 病历签核 —— 签了的那一笔不准就地改，改用一笔附注。
--
-- ── 为什么（[任务 341](../docs/founder-tasks.md#341) 零之二）───────────────
--
-- 马来西亚医药理事会（MMC）病历指引原文：「Erasure or 'blacking out' of
-- entries already made … should be avoided. If there are reasons for some
-- corrections, the erroneous statement should be neatly crossed out, but
-- still be readable. The correction should then be entered … and signed
-- clearly by the person making the correction」；每一笔要「signed by the
-- person making the entry」。
--
-- 而 `treatment_notes`（20260909040000）今天是一张可以 `update_treatment_note`
-- 整块洗掉 `what` / `area` / `note` / `done_on` / `staff_id` 的表。
-- **一笔可以就地改掉的纪录，在一场投诉里看起来就是被动过手脚的纪录。**
--
-- ── 用[重点 34](../docs/founder-points.md) 那把尺量过，没有做过头 ────────
--
-- 没有做「审核／共同签名」那一层（Aesthetic Record 的 Provider Room 有）——
-- 一间只有一两个美疗师的诊所，纸本病历也不会有人审核别人写的字，
-- **她自己写、写下去那一刻就是签了**，不用另外一颗「签核」按钮
-- （一个没人会按的按钮，比没有这个功能更糟）。
--
-- 而「附注」也不是一张新表单——就是原来那一页下面**再加一行**，
-- 带着谁、几时、说了什么，跟纸本病历下面加一行、写今天日期签名一样。
--
-- ── 🔴 这一次不重犯今晚已经踩过的坑 ────────────────────────────────────
--
-- `signed_by` 跟附注的 `created_by` 都**不带外键**——20260910250000
-- 刚测出来一个 `references auth.users(id) on delete set null` 会让帐号
-- 删不掉，`treatment_own_project` 那一段注解（20260909040000）跟
-- 20260906300000 都各记过一次同一个坑。这是第四次撞到，这一次不再撞。

alter table public.treatment_notes
  add column if not exists signed_at timestamptz,
  add column if not exists signed_by uuid;

/* 补签既有的那几笔——她当时写下去，就是当时签的，不是今天才补签。
   这个产品还没有真的客户（[重点：pre-launch]），这一步只影响 demo 资料。 */
update public.treatment_notes
   set signed_at = created_at, signed_by = created_by
 where signed_at is null;

comment on column public.treatment_notes.signed_by is
  'auth.uid() at write time, no FK -- see 20260910250000 for why this table stopped putting a foreign key on a column like this.';

-- ── 写下去就是签了 ────────────────────────────────────────────────────────

create or replace function public.add_treatment_note(
  in_party_id uuid,
  in_what text,
  in_appointment_id uuid default null,
  in_done_on date default null,
  in_area text default '',
  in_staff_id uuid default null,
  in_note text default ''
)
returns public.treatment_notes
language plpgsql
security definer
set search_path = public
as $fn$
declare
  proj uuid;
  row public.treatment_notes;
begin
  select p.project_id into proj
    from public.directory_entries p
   where p.id = in_party_id and public.works_here(p.project_id);
  if proj is null then
    raise exception 'that person is not in your directory';
  end if;

  if btrim(coalesce(in_what, '')) = '' then
    raise exception 'say what was done';
  end if;

  if in_appointment_id is not null
     and not exists (
       select 1 from public.appointments a
        where a.id = in_appointment_id and a.project_id = proj
     ) then
    raise exception 'that booking is not in this business';
  end if;

  if in_staff_id is not null
     and not exists (
       select 1 from public.directory_entries s
        where s.id = in_staff_id and s.project_id = proj
          and s.module_key = 'staff' and s.archived_at is null
     ) then
    raise exception 'that person is not on your staff list';
  end if;

  insert into public.treatment_notes
    (project_id, party_id, appointment_id, done_on, what, area, staff_id, note,
     created_by, signed_at, signed_by)
  values (
    proj,
    in_party_id,
    in_appointment_id,
    coalesce(in_done_on, public.today_myt()),
    left(btrim(in_what), 200),
    left(btrim(coalesce(in_area, '')), 120),
    in_staff_id,
    left(coalesce(in_note, ''), 2000),
    auth.uid(),
    now(),
    auth.uid()
  )
  returning * into row;

  return row;
end;
$fn$;

-- ── 签了的不准就地改 —— archived_at 例外（收起来不是改内容） ──────────────

create or replace function public.update_treatment_note(
  in_id uuid,
  in_what text default null,
  in_area text default null,
  in_staff_id uuid default null,
  in_note text default null,
  in_done_on date default null,
  in_clear_staff boolean default false,
  in_archived boolean default null
)
returns public.treatment_notes
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.treatment_notes;
begin
  select * into row from public.treatment_notes
   where id = in_id and public.works_here(project_id);
  if row.id is null then
    raise exception 'no such treatment note in your business';
  end if;

  /* 🔴 签了的这一笔，内容不准就地改——MMC 的原话见档头。
     收起来（archived）不算改内容，跟别的表「收起来不是删掉」同一条，照放行。 */
  if row.signed_at is not null
     and (
       in_what is not null
       or in_area is not null
       or in_staff_id is not null
       or in_clear_staff
       or in_note is not null
       or in_done_on is not null
     ) then
    raise exception 'this note is signed and cannot be edited -- add a correction note instead';
  end if;

  if in_staff_id is not null
     and not exists (
       select 1 from public.directory_entries s
        where s.id = in_staff_id and s.project_id = row.project_id
          and s.module_key = 'staff' and s.archived_at is null
     ) then
    raise exception 'that person is not on your staff list';
  end if;

  update public.treatment_notes set
    what = case
             when in_what is null then what
             when btrim(in_what) = '' then what
             else left(btrim(in_what), 200)
           end,
    area = coalesce(left(btrim(in_area), 120), area),
    staff_id = case when in_clear_staff then null
                    else coalesce(in_staff_id, staff_id) end,
    note = coalesce(left(in_note, 2000), note),
    done_on = coalesce(in_done_on, done_on),
    archived_at = case
                    when in_archived is null then archived_at
                    when in_archived then coalesce(archived_at, now())
                    else null
                  end,
    updated_at = now()
  where id = in_id
  returning * into row;

  return row;
end;
$fn$;

-- ── 附注 —— 纸本病历「划掉、写一行新的、签名」的那一行 ─────────────────────

create table if not exists public.treatment_note_addenda (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.treatment_notes(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  body text not null,

  /* 🔴 不带外键——同一个理由，见档头。 */
  created_by uuid,
  created_at timestamptz not null default now(),

  constraint treatment_note_addenda_body_not_blank check (btrim(body) <> ''),
  constraint treatment_note_addenda_body_not_long check (length(body) <= 2000)
);

comment on table public.treatment_note_addenda is
  'A correction to a signed treatment note -- the original stays exactly as written, this is the new dated, signed line underneath it. Insert-only: no update, no delete, the way record_changes works. See 20260910260000.';

create index if not exists treatment_note_addenda_note_idx
  on public.treatment_note_addenda (note_id, created_at);

alter table public.treatment_note_addenda enable row level security;

/* 🔴 只有 select policy——跟 record_changes 同一条做法：
   只有走这一支函式（security definer）才写得进去，前端直接 insert/update/delete
   一律没有 policy 可以过，一个删得掉、改得掉的附注等於没有附注。 */
drop policy if exists "treatment_note_addenda_read" on public.treatment_note_addenda;
create policy "treatment_note_addenda_read" on public.treatment_note_addenda
  for select to authenticated
  using (public.works_here(project_id));

create or replace function public.add_treatment_note_addendum(
  in_note_id uuid,
  in_body text
)
returns public.treatment_note_addenda
language plpgsql
security definer
set search_path = public
as $fn$
declare
  note public.treatment_notes;
  made public.treatment_note_addenda;
begin
  select * into note from public.treatment_notes
   where id = in_note_id and public.works_here(project_id);
  if note.id is null then
    raise exception 'no such treatment note in your business';
  end if;

  if coalesce(btrim(in_body), '') = '' then
    raise exception 'say what the correction is';
  end if;
  if length(in_body) > 2000 then
    raise exception 'that correction is too long';
  end if;

  insert into public.treatment_note_addenda (note_id, project_id, body, created_by)
  values (note.id, note.project_id, btrim(in_body), auth.uid())
  returning * into made;

  return made;
end;
$fn$;

revoke execute on function public.add_treatment_note_addendum(uuid, text) from public, anon;
grant execute on function public.add_treatment_note_addendum(uuid, text) to authenticated;

-- ── 读回来的那一页也要看得到附注（她站在客人面前打开的那一页） ────────────
--
-- 🔴 [重点 27] 第 2 步：回传形状变了要先 drop 旧的，`create or replace`
-- 换不了 OUT 参数的形状（`cannot change return type of existing function`）。

drop function if exists public.treatment_notes_of(uuid, int);

create or replace function public.treatment_notes_of(
  in_party_id uuid,
  in_limit int default 20
)
returns table (
  id uuid,
  done_on date,
  what text,
  area text,
  note text,
  staff_name text,
  archived boolean,
  products jsonb,
  addenda jsonb
)
language sql
stable
security definer
set search_path = public
as $fn$
  select
    n.id,
    n.done_on,
    n.what,
    n.area,
    n.note,
    coalesce(s.name, ''),
    n.archived_at is not null,
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'id', tp.id,
                   'item', ci.name,
                   'qty', tp.qty,
                   'unit', tp.unit,
                   'batch', coalesce(b.code, '')
                 )
                 order by tp.created_at
               )
          from public.treatment_products tp
          join public.catalog_items ci on ci.id = tp.item_id
          left join public.stock_batches b on b.id = tp.batch_id
         where tp.note_id = n.id
      ),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
                 jsonb_build_object(
                   'id', ad.id,
                   'body', ad.body,
                   'added_on', (ad.created_at at time zone 'Asia/Kuala_Lumpur')::date
                 )
                 order by ad.created_at
               )
          from public.treatment_note_addenda ad
         where ad.note_id = n.id
      ),
      '[]'::jsonb
    )
  from public.treatment_notes n
  left join public.directory_entries s on s.id = n.staff_id
  where n.party_id = in_party_id
    and public.works_here(n.project_id)
  order by n.done_on desc, n.created_at desc
  limit greatest(1, least(coalesce(in_limit, 20), 200));
$fn$;

grant execute on function public.add_treatment_note(uuid, text, uuid, date, text, uuid, text) to authenticated;
grant execute on function public.update_treatment_note(uuid, text, text, uuid, text, date, boolean, boolean) to authenticated;
grant execute on function public.treatment_notes_of(uuid, int) to authenticated;
