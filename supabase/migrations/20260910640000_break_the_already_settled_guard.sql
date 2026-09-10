-- 🔴 故意弄坏：拿掉「已经不是 booked 就不给取消」那一段，看 check:self-cancel 红不红。
-- 单独推这一支，看过红了再用 20260910650000 原样放回去（不是重打）。

create or replace function public.cancel_shared_appointment(in_ref uuid)
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

  /* 🔴 收起来的（被删掉那一家、或者这一支被存档的老资料）等於不存在——
     不告诉一个陌生人「这一笔本来在，现在没了」。 */
  if appt.archived_at is not null then
    return 'not_found';
  end if;

  /* 已经是别的结局了——做完了、没来、或者已经取消过。
     一句「已经处理过了」比一句资料库的错误讯息对她有意义。 */
  update public.appointments
     set status = 'cancelled', updated_at = now()
   where id = appt.id;

  return 'ok';
end;
$fn$;
