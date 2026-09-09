-- 官网订进来那一笔，一按就变成她名册上的客人 —— 名字跟电话是**他自己打的**。
--
-- ── 为什么（2026-09-09，`walk:medispa` 量出来的）────────────────────────────
--
-- 一个陌生人在官网上订时段，`submit_site_booking` 收下三样：
-- 他打的名字 · 他打的联络方式（`extra->>'contact'`）· 他要的服务。
-- 而那一笔**没有连到名册上的任何人**（那一支的 insert 里根本没有 `party_id`,
-- 见 20260905130000）—— 一个还不存在的人当然连不上。
--
-- 代价一直摆在那里，只是没有人量过：
--
--   · 她要**重打一次**他刚刚才打过的名字跟号码（[重点 29](../docs/founder-points.md)：
--     **那不是一个输入，那是一次抄写**）
--   · 「他上一次来做什么」永远接不上 —— 疗程记录挂在**人**身上
--   · 第十四个讯号（同意书还没签，20260909210000）对这一笔讲不了话，
--     而**官网订进来的正好最可能是新客人**
--
-- ── 🔴 不猜他是谁 ─────────────────────────────────────────────────────────
--
-- 最想当然的做法是拿名字去名册上找。**不做**：[任务 89](../docs/founder-tasks.md#89)
-- 量过 —— 靠名字自动认人会**把钱记到另一个人头上**，而这一行里
-- 「Ms Tan」「陈太太」满街都是。
--
-- 所以只有两条路，两条都是她讲的：
--   给 `in_party_id` → 认成名册上**已经有的**那一个（她自己指的）
--   不给            → 用他打的那些字**开一个新的**
--
-- ⚠️ 而**按第二下**要拿回同一个人：钥匙是 `md5('claim' || 那一笔的号)`，
-- 走 `add_directory_entry` 自己的幂等（[重点 23](../docs/founder-points.md)），
-- 不另开一张「认过了没有」的表。
--
-- ── 🔴 联络方式：照抄，但不当它是 WhatsApp ────────────────────────────────
--
-- 他打进那一格的可能是电话，也可能是电邮 —— 官网上那一格只写「怎么联络你」。
-- 所以原样进 `phone`（那本来就是「怎么找到他」），
-- 而 `whatsapp` 只在**它看起来真的是一串号码**的时候才填。
-- 一个填错的 WhatsApp 栏位不是少一样东西，是**把讯息发给一个陌生人**。
--
-- ⚠️ 这跟 [任务 89](../docs/founder-tasks.md#89) 那条界线不冲突：
-- 那一条禁的是**猜他是谁**；这里判的是**这一串字是不是号码**，
-- 而那是数得出来的。
--
-- ── 写进去走的是人按的那一支 ──────────────────────────────────────────────
--
-- 连上去那一下走 `update_appointment`，不在这里直接 update ——
-- [重点 23](../docs/founder-points.md)：同一件事不准有第二条写入路径。
-- 它整行覆写，所以其余每一栏都原样传回去。

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

  /* 🔴 按第二下 —— 已经认过的把同一个人还给她，不再开一个。 */
  if appt.party_id is not null then
    select * into person from public.directory_entries where id = appt.party_id;
    return person;
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
      in_idempotency_key := md5('claim' || in_appointment_id::text)::uuid
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
