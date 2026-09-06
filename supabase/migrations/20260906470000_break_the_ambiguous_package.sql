-- 🔴 故意弄坏：她有两张套票的时候也拿第一张去扣。
-- **单独推一次**（重点 31 第三条）。
--
-- 它坏掉的时候长什么样子：客人手上一张洗剪吹・一张染发，
-- 来做头发，**系统自己扣了染发那一张** ——
-- 而画面上什么都不会讲。任务 89 量过的那一句：
-- **靠猜省他的字，会把钱记到另一个人头上。**

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

      if n >= 1 then
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
