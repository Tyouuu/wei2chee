-- 故意弄坏：拿掉「没做完不给留评价」那一段——看过它红，才知道那段守卫是真的。
-- 单独推、单独看红，见 20260911010000 档头。

create or replace function public.submit_appointment_review(
  in_ref uuid,
  in_rating smallint,
  in_text text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  appt public.appointments;
begin
  if in_ref is null then
    return 'not_found';
  end if;

  select * into appt from public.appointments a where a.public_ref = in_ref;
  if appt.id is null then
    return 'not_found';
  end if;

  if appt.archived_at is not null then
    return 'not_found';
  end if;

  -- 🔴 故意拿掉：if appt.status <> 'done' then return 'not_yet'; end if;

  if appt.review_submitted_at is not null then
    return 'already_submitted';
  end if;

  if in_rating is null or in_rating < 1 or in_rating > 5 then
    return 'invalid';
  end if;

  if length(coalesce(in_text, '')) > 2000 then
    return 'too_long';
  end if;

  update public.appointments
     set review_rating = in_rating,
         review_text = left(btrim(coalesce(in_text, '')), 2000),
         review_submitted_at = now()
   where id = appt.id;

  return 'ok';
end;
$fn$;
