-- 放回去——20260911200000 拿掉的那一段，原样抄回来。
-- 看过它红之后确认：拿掉函式自己那段守卫，栏位自己的 CHECK 约束接住了
-- 同一件事，只是讯息换成资料库原生的那一句，不是「less than nothing」。
-- 两层都留着——函式那一层给他看得懂的讯息，栏位那一层是最后一道防线。

create or replace function public.set_visit_tip(
  in_line_id uuid,
  in_tip_cents bigint
)
returns public.appointment_lines
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.appointment_lines;
begin
  select * into row from public.appointment_lines
   where id = in_line_id and public.works_here(project_id);
  if row.id is null then
    raise exception 'no such line in your business';
  end if;
  if in_tip_cents is not null and in_tip_cents < 0 then
    raise exception 'a tip cannot be less than nothing';
  end if;

  update public.appointment_lines
     set tip_cents = in_tip_cents
   where id = in_line_id
  returning * into row;

  return row;
end;
$fn$;
