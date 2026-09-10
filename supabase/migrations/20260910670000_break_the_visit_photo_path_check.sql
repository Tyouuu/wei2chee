-- 🔴 故意弄坏：拿掉「档案路径第一段要是这一家」那一段，看 check:visit-photos 红不红。
-- 单独推这一支，看过红了再用 20260910680000 原样放回去（不是重打）。

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
