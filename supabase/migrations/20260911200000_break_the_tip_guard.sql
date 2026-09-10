-- 故意弄坏：拿掉「小费不准是负数」那一段——看过它红，才知道那段守卫是真的。
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
  select * into row from public.appointment_lines
   where id = in_line_id and public.works_here(project_id);
  if row.id is null then
    raise exception 'no such line in your business';
  end if;

  -- 🔴 故意拿掉：if in_tip_cents is not null and in_tip_cents < 0 then raise exception ...

  update public.appointment_lines
     set tip_cents = in_tip_cents
   where id = in_line_id
  returning * into row;

  return row;
end;
$fn$;
