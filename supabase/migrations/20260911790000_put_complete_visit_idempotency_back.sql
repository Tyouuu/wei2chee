-- ⚠️ 这一支没有真的生效——`db push` 认档名，这份档案原地被编辑过一次
-- 内容之后重推，回的是「Remote database is up to date」，没有真的执行。
-- 真正让恢复生效的是 20260911800000。留着不删，理由跟
-- 20260905340000（`an_aggregate_cannot_be_locked.sql`）一样：这是
-- 「我以为改好了」跟「真的改好了」之间那一步，删掉它下一个人会看不到
-- 这个坑。
--
-- 改回来：20260911780000 弄坏的那一行撤销掉，恢复 20260911770000 的版本。
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
