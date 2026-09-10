-- 故意弄坏：拿掉 works_here 那段守卫——看过它红，才知道别人家真的改不了。
-- 单独推、单独看红，见 20260911190000 档头。

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
  -- 🔴 故意拿掉 works_here 那一段，谁都能改任何一行的小费
  select * into row from public.appointment_lines where id = in_line_id;
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
