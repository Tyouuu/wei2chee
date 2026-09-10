-- 🔴 故意弄坏：拿掉「签了不准改」那一段，看 check:signoff 红不红。
-- 单独推这一支，看过红了再用 20260910280000 原样放回去（不是重打）。

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
