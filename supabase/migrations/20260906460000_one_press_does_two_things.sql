-- 一颗按钮做两件 —— 客人来了，那张套票顺手少一次。
--
-- 那份「十三条链」的报告排的第五步：**目标是每条链他动手 ≤ 1 次，
-- 而今天的中位数是 3**。第⑦条链（预约到来店）七节里四节没有，
-- 其中一节就是这个：**来了要按一次，扣套票要再按一次。**
--
-- 一间沙龙一天二十个客人，那是**一天多按二十次**。
-- （[重点 29](./founder-points.md)：判一个功能做得好不好，量他要打几个字。）
--
-- ── 🔴 而它不可以变成「替他猜」──────────────────────────────────────
-- [任务 89](#89) 量过一次，代价写在那里：**靠猜省他的字，会把钱记到
-- 另一个人头上。** 所以这一支只在**一点歧义都没有**的时候动手:
--
--   · 那一单没有连到人        → 不动，讲 `no_party`
--   · 她一张能用的套票都没有  → 不动，讲 `no_package`
--   · 🔴 **她有两张以上**      → **不动**，讲 `many_packages`
--     （洗剪吹十次 · 染发五次 —— 扣哪一张是他的判断，不是我们的）
--   · 🔴 **只剩一张而且过期了** → **不动**，讲 `expired_only`
--
-- 最后那一条要讲清楚，因为它跟 20260904190000 那句「过期不挡」不冲突:
-- **他自己按那颗扣一次，过期照样扣得下去**（那一条没有变）；
-- 这里不动的是**我们替他自动扣** —— 一张过期的套票被系统静静用掉，
-- 是一个他没有做过的决定。**不挡他，只是不替他做。**
--
-- ── ⚠️ 签名变了，所以先 drop ────────────────────────────────────────
-- 它本来回 void，现在要回**发生了什么** —— 一个静静扣掉一次而不讲的系统，
-- 正是这个仓库最不能接受的那一类。
-- 回传型别变了一定要先 drop（[重点 31](./founder-points.md) 第二条）。
--
-- ⚠️ 而下面这一支是从 20260902030000 —— **最后一次定义它的那个档案** ——
-- 原样抽出来加一段，不是照记忆重打（同一条第一项，被咬过三次）。

drop function if exists public.set_appointment_status(uuid, text);

create or replace function public.set_appointment_status(
  in_id uuid,
  in_status text
)
returns table (
  status text,
  used_package_id uuid,
  package_name text,
  sessions_left integer,
  why text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.appointments;
  pack public.service_packages;
  n integer;
  reason text := 'not_done';
  left_now integer;
begin
  select * into appt from public.appointments where id = in_id;
  if appt.id is null or not public.works_here(appt.project_id) then
    raise exception 'not your appointment';
  end if;

  if in_status not in ('booked', 'done', 'no_show', 'cancelled') then
    raise exception 'not a status an appointment can be in: %', in_status;
  end if;

  update public.appointments
  set status = in_status, updated_at = now()
  where id = in_id;

  /* ── 🔴 第二件事，只在「来了」的时候 ─────────────────────────── */
  if in_status = 'done' then
    if appt.party_id is null then
      reason := 'no_party';
    else
      /* 能用的 = 没收起来 · 还有次数 · 没过期。
         次数是**数出来的**，不是存着的一栏（这个 schema 判过十次）。 */
      select count(*) into n
      from public.service_packages p
      where p.project_id = appt.project_id
        and p.party_id = appt.party_id
        and p.archived_at is null
        and (p.expires_on is null or p.expires_on >= public.today_myt())
        and p.sessions_total > (
          select count(*) from public.package_uses u where u.package_id = p.id
        );

      if n = 1 then
        select * into pack
        from public.service_packages p
        where p.project_id = appt.project_id
          and p.party_id = appt.party_id
          and p.archived_at is null
          and (p.expires_on is null or p.expires_on >= public.today_myt())
          and p.sessions_total > (
            select count(*) from public.package_uses u where u.package_id = p.id
          );

        /* 🔴 那把防重复的钥匙就是**这一单自己的编号** ——
           他按两下「来了」，套票只会少一次。 */
        perform public.use_package_session(
          pack.id,
          (appt.starts_at at time zone 'Asia/Kuala_Lumpur')::date,
          appt.staff_id,
          '',
          in_id
        );
        reason := 'used';
      elsif n > 1 then
        /* 洗剪吹十次 · 染发五次 —— 扣哪一张是他的判断。 */
        reason := 'many_packages';
      else
        /* 一张都没有，还是只剩过期的那一张？两句话不一样，
           而第二句他下一步做得了事（自己按那颗扣一次）。 */
        select count(*) into n
        from public.service_packages p
        where p.project_id = appt.project_id
          and p.party_id = appt.party_id
          and p.archived_at is null
          and p.expires_on is not null
          and p.expires_on < public.today_myt()
          and p.sessions_total > (
            select count(*) from public.package_uses u where u.package_id = p.id
          );
        reason := case when n > 0 then 'expired_only' else 'no_package' end;
      end if;
    end if;
  end if;

  if pack.id is not null then
    select pack.sessions_total - count(*)::integer into left_now
    from public.package_uses u where u.package_id = pack.id;
  end if;

  return query
  select in_status, pack.id, coalesce(pack.name, ''), left_now, reason;

exception
  /* Re-booking a cancelled slot somebody else has taken since. Reachable
     because a cancelled row does not hold its time. */
  when exclusion_violation then
    raise exception 'that time is already taken'
      using errcode = 'check_violation';
end;
$$;

revoke execute on function public.set_appointment_status(uuid, text) from public, anon;
grant execute on function public.set_appointment_status(uuid, text) to authenticated;
