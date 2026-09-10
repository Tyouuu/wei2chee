-- 放回去——20260911220000 拿掉的那一段，原样抄回来。看过它红之后确认是真的守卫：
-- 别人家的登入真的改得了我这一行的小费，直到这一段守卫回来。

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
