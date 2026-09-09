-- 🔴 故意弄坏，看它红（[重点 31] 第 3 条）。**单独推一次** ——
-- 弄坏跟改回去在同一次推送里，红的那一刻没有人看得到。
--
-- 拿掉的是「按第二下」那**一对**守卫：早退那一句 ＋ 那把幂等钥匙。
-- ⚠️ **两条都要拿掉才看得到红** —— 它们互相盖住对方，
-- 而那正是这一次要证明的事：只拆一条，尺子是绿的。
--
-- 坏起来的样子：她在那一笔上按了两下，**名册上就有两个同名的客人**，
-- 而往后每一笔钱、每一次疗程记录会分到两个人头上
-- （[任务 89] 量过的那件事的另一张脸）。
-- 20260909260000 把它原样搬回去。

create or replace function public.claim_booking_party(
  in_appointment_id uuid,
  in_party_id uuid default null
)
returns public.directory_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.appointments;
  person public.directory_entries;
  contact text;
  digits integer;
begin
  select * into appt from public.appointments where id = in_appointment_id;
  if appt.id is null or not public.works_here(appt.project_id) then
    raise exception 'no such booking in your business';
  end if;

  if in_party_id is not null then
    select * into person from public.directory_entries
     where id = in_party_id
       and project_id = appt.project_id
       and module_key = 'customers'
       and archived_at is null;
    if person.id is null then
      raise exception 'that person is not on your customer list';
    end if;
  else
    if coalesce(btrim(appt.party), '') = '' then
      raise exception 'that booking has no name on it';
    end if;
    perform 1 from public.project_pages
     where project_id = appt.project_id and page_key = 'customers';
    if not found then
      raise exception 'you have no customer list yet';
    end if;

    contact := left(btrim(coalesce(appt.extra->>'contact', '')), 40);
    /* 看起来是不是一串号码：没有 @，而且数得出九个以上的数字。 */
    digits := length(regexp_replace(contact, '[^0-9]', '', 'g'));

    person := public.add_directory_entry(
      in_project_id := appt.project_id,
      in_module_key := 'customers',
      in_name := appt.party,
      in_phone := contact,
      in_whatsapp := case
        when contact not like '%@%' and digits >= 9 then contact else '' end,
      in_idempotency_key := gen_random_uuid()
    );
  end if;

  perform public.update_appointment(
    in_id := appt.id,
    in_starts_at := appt.starts_at,
    in_ends_at := appt.ends_at,
    in_party := appt.party,
    in_party_id := person.id,
    in_staff_id := appt.staff_id,
    in_service := appt.service,
    in_note := appt.note,
    in_extra := appt.extra
  );

  return person;
end;
$$;

revoke execute on function public.claim_booking_party(uuid, uuid) from public, anon;
grant execute on function public.claim_booking_party(uuid, uuid) to authenticated;

comment on function public.claim_booking_party(uuid, uuid) is
  'Turns a booking that carries only typed text into a booking that points at somebody on the customer list -- either one she picks, or a new entry built from what the visitor typed. Never matches by name (任务 89). works_here: the front desk does this. See 20260909240000.';
