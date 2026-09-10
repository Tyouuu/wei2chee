-- 剪完头发临时加一样疗程，价钱要算得准，时长不用算。
--
-- ── 为什么（founder 把「染发等待时间」那件事重讲了一次）───────────────────
--
-- 上一支（20260910390000，已经撤掉）想解的是「染发等的那 35 分钟能不能
-- 插别的客人」——founder 讲清楚了那不是他要的：
--
-- 「就是不要用到那么复杂的算法 是要进来 可能是剪头发最后才临时加的
-- treatment 时间真的很难估算 只要能算到准确的价钱就可以了」
--
-- **真正要答的问题窄很多**：一单本来在剪头发，剪到最后柜台／师傅临时说
-- 「再加一个头皮护理」——那一刻没有人知道它会花几分钟，也不需要知道。
-- 需要的只有一件事：**这一行加进去的价钱要对。**
--
-- ── 而这一件今天已经有一半了，缺的是把两个零件接起来 ────────────────────
--
-- `add_visit_line`（20260910010000）已经能在剪到一半的时候加一行，
-- `staff_prices` / `price_for`（20260910040000）已经知道阿明剪 38、
-- 老板剪 68。**而这两支从来没有被接在一起** —— 今天临时加一行，
-- 价钱那一格要嘛柜台自己重打一次（她自己的价目表要重打第二次），
-- 要嘛空着。
--
-- ── 加，不是重写；不猜，只认一模一样的名字 ───────────────────────────────
--
-- 没有讲价钱的时候，去她自己的货架 / 服务清单找一次同名的那一件，
-- 找到了就照 `price_for` 算（师傅有自己的价就用那个，没有就用原价）。
-- **只认完全一样的名字**（大小写、头尾空白不算数）——配不到就照旧留 null，
-- 不猜、不模糊比对（[任务 89] 那条界线：省她的字不能靠猜省）。
--
-- 讲了价钱的照旧用她讲的那个数字——**这一支从来不会盖掉一个人亲口讲的价**。

create or replace function public.add_visit_line(
  in_appointment_id uuid,
  in_service text,
  in_staff_id uuid default null,
  in_price_cents bigint default null
)
returns public.appointment_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.appointments;
  seat integer;
  made public.appointment_lines;
  found_item uuid;
  looked_up record;
  final_price bigint;
begin
  select * into appt from public.appointments where id = in_appointment_id;
  if appt.id is null or not public.works_here(appt.project_id) then
    raise exception 'no such visit in your business';
  end if;
  if coalesce(btrim(in_service), '') = '' then
    raise exception 'say what was done';
  end if;
  if in_price_cents is not null and in_price_cents < 0 then
    raise exception 'a price cannot be less than nothing';
  end if;

  if in_staff_id is not null then
    perform 1 from public.directory_entries
     where id = in_staff_id and project_id = appt.project_id;
    if not found then
      raise exception 'that person does not work here';
    end if;
  end if;

  final_price := in_price_cents;

  /* 🔴 没有讲价钱——不是留白，是先去她自己的清单找一次。
     只认得一模一样的名字，配不到就照旧留 null（还没讲），
     跟纸本一样：讲得出名字的，价钱本来就写在她自己那张表上。 */
  if final_price is null then
    select id into found_item from public.catalog_items
     where project_id = appt.project_id
       and archived_at is null
       and lower(btrim(name)) = lower(btrim(in_service))
     limit 1;

    if found_item is not null then
      select * into looked_up from public.price_for(found_item, in_staff_id);
      final_price := looked_up.price_cents;
    end if;
  end if;

  select coalesce(max(sort_order), -1) + 1 into seat
    from public.appointment_lines where appointment_id = in_appointment_id;

  insert into public.appointment_lines
    (project_id, appointment_id, service, staff_id, price_cents, sort_order, created_by)
  values (appt.project_id, in_appointment_id, left(btrim(in_service), 120),
          in_staff_id, final_price, seat, auth.uid())
  returning * into made;
  return made;
end;
$$;
