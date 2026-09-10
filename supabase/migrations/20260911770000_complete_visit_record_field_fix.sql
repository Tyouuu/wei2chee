-- 🔴 补 20260911760000 那次的一个真错，不是重讲一次这一支的道理：
-- 那一份用一个 `record` 变数（`status_row`）装 `set_appointment_status`
-- 的回传，而按第二下（`already_done` 那个分支）从来没有对它赋值——
-- PL/pgSQL 对一个没赋值过的 `record` 取栏位会直接炸
-- （`record "status_row" is not assigned yet`）。真登入测的时候
-- 第②段当场抓到，还没推给任何人用过。改成四个各自的纯量变数，
-- 已经赋值的路径填真的值，「已经做完过」那条路径留着不填，
-- 一个字都不会炸。这一支剩下的逻辑跟 20260911760000 完全一样。
--
-- 老板问「明明是一件事却被拆开」，指的是这一段：一个师傅送走客人之前
-- 要分开做好几件事——标记做完（顺手扣套票）· 记做了什么跟收多少钱 ·
-- 记用了哪些货（顺手扣架上的库存）· 记小费。今天是四个分开的按钮。
--
-- 抄的是 Aesthetic Record 的 Chart-to-Cart 那一句话（「消除重复输入，
-- 把病历卡当成唯一的事实来源」）：**资料表不合并**（预约 · 明细 ·
-- 用料 · 小费还是四张各自的表，理由没变——不同的东西留不同的证据、
-- 会不会变、属于谁都不一样），**合并的是这一个动作**。
--
-- 全部原样呼叫既有那四支（set_appointment_status · add_visit_line ·
-- add_visit_product · set_visit_tip），一行都不重写——[重点 31] 第 1 条：
-- 新写一支去串旧的，不要碰旧的一个字。
--
-- 🔴 幂等靠「这一单本来是不是已经 done」，不是另开一把钥匙：
-- 按第二下（网路重试 · 手滑连点两下）如果这一单已经是 done，
-- 直接把已经记过的那几行原样吐回去，**不再多插一行**——
-- 跟这个仓库别的每一支「按两下」同一条纪律。
create or replace function public.complete_visit(
  in_appointment_id uuid,
  /* [{"service": "洗剪吹", "staff_id": null, "price_cents": null,
       "tip_cents": null,
       "products": [{"item_id": "...", "qty": 1, "batch_id": null, "branch_id": null}]}] */
  in_lines jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.appointments;
  v_used_package_id uuid;
  v_package_name text;
  v_sessions_left integer;
  v_why text;
  line jsonb;
  product jsonb;
  made public.appointment_lines;
  made_lines jsonb := '[]'::jsonb;
  products_added integer := 0;
  total_cents bigint := 0;
  tips_cents bigint := 0;
  already_done boolean;
begin
  select * into appt from public.appointments where id = in_appointment_id;
  if appt.id is null or not public.works_here(appt.project_id) then
    raise exception 'no such visit in your business';
  end if;

  already_done := (appt.status = 'done');

  if not already_done then
    select s.used_package_id, s.package_name, s.sessions_left, s.why
      into v_used_package_id, v_package_name, v_sessions_left, v_why
      from public.set_appointment_status(in_appointment_id, 'done') s;

    for line in select * from jsonb_array_elements(coalesce(in_lines, '[]'::jsonb))
    loop
      made := public.add_visit_line(
        in_appointment_id := in_appointment_id,
        in_service := line ->> 'service',
        in_staff_id := nullif(line ->> 'staff_id', '')::uuid,
        in_price_cents := nullif(line ->> 'price_cents', '')::bigint
      );
      total_cents := total_cents + coalesce(made.price_cents, 0);

      for product in select * from jsonb_array_elements(coalesce(line -> 'products', '[]'::jsonb))
      loop
        perform public.add_visit_product(
          in_line_id := made.id,
          in_item_id := (product ->> 'item_id')::uuid,
          in_qty := (product ->> 'qty')::numeric,
          in_batch_id := nullif(product ->> 'batch_id', '')::uuid,
          in_branch_id := nullif(product ->> 'branch_id', '')::uuid
        );
        products_added := products_added + 1;
      end loop;

      if (line ->> 'tip_cents') is not null then
        made := public.set_visit_tip(made.id, (line ->> 'tip_cents')::bigint);
      end if;
      tips_cents := tips_cents + coalesce(made.tip_cents, 0);

      made_lines := made_lines || jsonb_build_object(
        'id', made.id, 'service', made.service,
        'price_cents', made.price_cents, 'tip_cents', made.tip_cents
      );
    end loop;
  else
    /* 已经做完过一次——原样吐回她那时候记下的那几行，不再多插。
       套票那几栏这一轮没有重新算——它只在第一次真的按下去那一刻
       算过一次，第二次问的是「有没有重复插入」，不是「套票现在状态」。 */
    v_why := 'already_done';
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', l.id, 'service', l.service,
             'price_cents', l.price_cents, 'tip_cents', l.tip_cents
           )), '[]'::jsonb),
           coalesce(sum(l.price_cents), 0),
           coalesce(sum(l.tip_cents), 0)
      into made_lines, total_cents, tips_cents
      from public.appointment_lines l
     where l.appointment_id = in_appointment_id;
  end if;

  return jsonb_build_object(
    'already_done', already_done,
    'used_package_id', v_used_package_id,
    'package_name', v_package_name,
    'sessions_left', v_sessions_left,
    'why', v_why,
    'lines', made_lines,
    'products_added', products_added,
    'total_cents', total_cents,
    'tip_cents', tips_cents
  );
end;
$$;

revoke execute on function public.complete_visit(uuid, jsonb) from public;
grant execute on function public.complete_visit(uuid, jsonb) to authenticated;

comment on function public.complete_visit(uuid, jsonb) is
  'One action for finishing a customer visit: marks the appointment done (auto-deducting a package session the way set_appointment_status already does), records each service line, records products consumed against the shelf, and records tips -- all by calling the existing set_appointment_status/add_visit_line/add_visit_product/set_visit_tip untouched. Calling it again on an already-done appointment returns the lines already recorded instead of inserting new ones. See 20260911760000.';
