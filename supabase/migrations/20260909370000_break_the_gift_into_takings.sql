-- 🔴 故意弄坏，看它红（[重点 31] 第 3 条）。**单独推一次**。
--
-- 弄坏的方式是把**送的那一笔也记成一笔收款** —— 也就是把一笔
-- **从来没有进过户口的钱**算进他的营业额。
--
-- 坏起来的样子：一间做「充一千送两百」的沙龙，每卖一张卡，
-- 帐上就多出 200 块假的收入。**月底他拿银行对帐单一比，对不上的正是那一笔**，
-- 而画面上那两个数字（卡里 1,200 · 帐上 1,200）看起来非常合理。
-- ⚠️ 这是这套系统最不可以出的错（[重点 26]：钱那一层一个都不准）。
-- 20260909380000 把它原样搬回去。

create or replace function public.grant_credit(
  in_project_id uuid,
  in_party_id uuid,
  in_amount_cents bigint,
  in_reason text default '',
  /* 跟着哪一笔充值来的。单独送的（生日 · 赔偿）不给。 */
  in_entry_id uuid default null,
  in_idempotency_key uuid default null
)
returns public.stored_value_moves
language plpgsql
security definer
set search_path = public
as $$
declare
  made public.stored_value_moves;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;
  /* 🔴 **送钱是老板的事**（跟 `set_booking_rules` · `set_class_fee` 同一条）。
     ⚠️ 他把规矩讲出来那天，这里要放宽给柜台 —— 照规矩送跟自己决定送，
     是两件事，而今天只有后者存在。 */
  if not public.sees_money(in_project_id) then
    raise exception 'giving credit away is for the owner';
  end if;
  if coalesce(in_amount_cents, 0) <= 0 then
    raise exception 'say how much to give';
  end if;
  perform 1 from public.directory_entries
   where id = in_party_id and project_id = in_project_id;
  if not found then
    raise exception 'that person is not in your directory';
  end if;

  if in_idempotency_key is not null then
    select * into made from public.stored_value_moves
     where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then return made; end if;
  end if;

  /* 🔴 弄坏的就是这一段：送的那一笔也当成一笔真的收款记进去。 */
  perform public.add_ledger_entry(
    in_project_id => in_project_id,
    in_module_key => 'payments',
    in_direction => 'in',
    in_amount_cents => in_amount_cents,
    in_party_id => in_party_id
  );

  insert into public.stored_value_moves
    (project_id, party_id, direction, amount_cents, reason, entry_id,
     created_by, idempotency_key)
  values (in_project_id, in_party_id, 'in', in_amount_cents,
          left(btrim(coalesce(in_reason, '')), 200), in_entry_id,
          auth.uid(), in_idempotency_key)
  returning * into made;
  return made;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into made from public.stored_value_moves
       where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then return made; end if;
    end if;
    raise;
end;
$$;


revoke execute on function public.grant_credit(uuid, uuid, bigint, text, uuid, uuid)
  from public, anon;
grant execute on function public.grant_credit(uuid, uuid, bigint, text, uuid, uuid)
  to authenticated;
