-- 客人自己按得了取消 —— 那个门牌九天前就发出去了，没有人接过。
--
-- ── 为什么（[任务 341] 沙龙其余那一组）───────────────────────────────────
--
-- `appointments.public_ref`（20260902030000）建表那天就在，注解原话：
-- 「The link a customer uses to move or cancel without an account」——
-- **而九天来没有一支函式读过它、写过它**。研究原话讲得直白：
-- 「现在那条连结是只读的，而改不了的客人干脆不来——我们的放飞机数字
-- 有一半是这样来的」。
--
-- ── 只做取消，不做改期 ───────────────────────────────────────────────────
--
-- 改期要先给她看有哪些时段还空着，而「哪些时段空着」今天没有一支
-- 对外的函式在答——那是另一件要做的事，登记在这一支的收尾里，
-- 不要为了凑成一件「完整」的功能，把两件不一样大小的事绑在一起
-- （[重点 34]：手写簿上会先有的是「打电话说不来了」，不是「打电话
-- 自己挑一个新时段」——后者是柜台在电话上帮她做的，不是她自己按的）。
--
-- ── 陌生人看得到什么，看不到什么——照 public_consent_form 那一支的规矩 ────
--
-- 看得到：这家自己的名字跟样子 · 她自己的名字 · 什么服务 · 几点 ·
-- 现在是什么状态 · 还能不能取消。
-- 🔴 看不到：任何 id · 她的其他预约 · 钱 · 这个门牌属於谁的手机号码
-- （号码本来就没有存在这张公开表单会印出来的地方）。
--
-- ── 回一个词，不抛例外——照 sign_consent / answer_shared_record 那一支 ────
--
-- 呼叫者是一个站在自己那张预约前面的陌生人，一句资料库的错误讯息
-- 对她没有意义。

create or replace function public.public_appointment(in_ref uuid)
returns table (
  business_name text,
  style text,
  palette text,
  system_language text,
  party_name text,
  service text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  can_cancel boolean
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  appt public.appointments;
  proj public.projects;
begin
  if in_ref is null then
    return;
  end if;

  select * into appt from public.appointments a where a.public_ref = in_ref;
  if appt.id is null then
    return;
  end if;

  select * into proj from public.projects p where p.id = appt.project_id;
  if proj.id is null then
    return;
  end if;

  return query
  select
    coalesce(proj.business_name, ''),
    proj.style,
    proj.palette,
    proj.system_language,
    coalesce(appt.party, ''),
    coalesce(appt.service, ''),
    appt.starts_at,
    appt.ends_at,
    appt.status,
    appt.status = 'booked' and appt.archived_at is null;
end;
$fn$;

revoke execute on function public.public_appointment(uuid) from public;
grant execute on function public.public_appointment(uuid) to anon, authenticated;

comment on function public.public_appointment(uuid) is
  'One booking as the person holding the link sees it -- her own name, what, when, and whether she can still cancel it. Never an id, never her other bookings, never money. See 20260910630000.';

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
  if appt.status <> 'booked' then
    return 'already_settled';
  end if;

  update public.appointments
     set status = 'cancelled', updated_at = now()
   where id = appt.id;

  return 'ok';
end;
$fn$;

revoke execute on function public.cancel_shared_appointment(uuid) from public;
grant execute on function public.cancel_shared_appointment(uuid) to anon, authenticated;

comment on function public.cancel_shared_appointment(uuid) is
  'She cancels her own booking. Returns a word, never an exception -- same contract as sign_consent and answer_shared_record. Cancelling twice is refused with a plain word, not a database error. See 20260910630000.';
