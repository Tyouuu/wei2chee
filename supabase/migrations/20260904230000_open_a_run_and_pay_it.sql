-- 开一次薪，算它，发它。
--
-- 20260904210000 是法律，20260904220000 是那几张表。这一支是**动词** ——
-- 前两支没有这一支，就是这个仓库犯过最多次的那个错。

/**
 * 这个人怎么算钱。
 *
 * `null` 的三个类别是**真的答案**：他工地上一半的师傅是分包的，自己缴。
 * 一套逼每个人都要填公积金类别的薪资，会让他把真的分包也填成员工。
 */
create or replace function public.set_staff_pay_terms(
  in_staff_id uuid,
  in_basis text default 'monthly',
  in_rate_cents bigint default 0,
  in_epf_part text default null,
  in_socso_part text default null,
  in_eis_part text default null,
  in_note text default ''
)
returns public.staff_pay_terms
language plpgsql
security definer
set search_path = public
as $$
declare
  pid uuid;
  row public.staff_pay_terms;
begin
  select d.project_id into pid
  from public.directory_entries d
  where d.id = in_staff_id and d.module_key = 'staff';
  if pid is null then
    raise exception 'that person is not a staff member';
  end if;
  if not public.sees_money(pid) then
    raise exception 'not your project';
  end if;

  insert into public.staff_pay_terms (
    project_id, staff_id, basis, rate_cents, epf_part, socso_part, eis_part, note
  ) values (
    pid, in_staff_id,
    coalesce(nullif(btrim(in_basis), ''), 'monthly'),
    greatest(coalesce(in_rate_cents, 0), 0),
    nullif(btrim(coalesce(in_epf_part, '')), ''),
    nullif(btrim(coalesce(in_socso_part, '')), ''),
    nullif(btrim(coalesce(in_eis_part, '')), ''),
    left(coalesce(in_note, ''), 500)
  )
  on conflict (staff_id) do update set
    basis = excluded.basis,
    rate_cents = excluded.rate_cents,
    epf_part = excluded.epf_part,
    socso_part = excluded.socso_part,
    eis_part = excluded.eis_part,
    note = excluded.note,
    updated_at = now()
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.set_staff_pay_terms(uuid, text, bigint, text, text, text, text)
  from public, anon;
grant execute on function public.set_staff_pay_terms(uuid, text, bigint, text, text, text, text)
  to authenticated;

/**
 * 法律那几行，重算。
 *
 * 🔴 **只删它自己写过的那几行**（`schedule_id is not null`）。
 * 他打进去的底薪 · 加班 · 津贴一行都不动 —— 一支顺手清掉他打的字的
 * 重算函式，是他再也不敢按第二次的那种按钮。
 */
create or replace function public.recompute_payslip_statutory(in_payslip_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  slip public.payslips;
  run public.pay_runs;
  terms public.staff_pay_terms;
  gross bigint;
  hit record;
  n integer := 100;
begin
  select * into slip from public.payslips where id = in_payslip_id;
  if not found then
    raise exception 'no such payslip';
  end if;
  select * into run from public.pay_runs where id = slip.run_id;
  if run.paid_at is not null then
    raise exception 'this run has been paid -- money already reached them, so the slip is fixed';
  end if;
  select * into terms from public.staff_pay_terms where staff_id = slip.staff_id;

  delete from public.payslip_lines
   where payslip_id = in_payslip_id and schedule_id is not null;

  select coalesce(sum(amount_cents), 0) into gross
  from public.payslip_lines
  where payslip_id = in_payslip_id and kind = 'earning';

  if terms.id is null or gross <= 0 then
    perform public.sync_payslip_totals(in_payslip_id);
    return;
  end if;

  /* ⚠️ 三个计划各查各的表。查不到就抛错，而错误讯息里带着去哪里拿 ——
     一张少了一笔公积金的薪资单，是老板的漏缴。 */
  if terms.epf_part is not null then
    select * into hit from public.statutory_lookup('epf', terms.epf_part, run.period_to, gross);
    if hit.employee_cents > 0 then
      insert into public.payslip_lines (payslip_id, kind, label, amount_cents, schedule_id, sort_order)
      values (in_payslip_id, 'deduction', 'EPF', hit.employee_cents, hit.schedule_id, n);
      n := n + 1;
    end if;
    if hit.employer_cents > 0 then
      insert into public.payslip_lines (payslip_id, kind, label, amount_cents, schedule_id, sort_order)
      values (in_payslip_id, 'employer', 'EPF (employer)', hit.employer_cents, hit.schedule_id, n);
      n := n + 1;
    end if;
  end if;

  if terms.socso_part is not null then
    select * into hit from public.statutory_lookup('socso', terms.socso_part, run.period_to, gross);
    if hit.employee_cents > 0 then
      insert into public.payslip_lines (payslip_id, kind, label, amount_cents, schedule_id, sort_order)
      values (in_payslip_id, 'deduction', 'SOCSO', hit.employee_cents, hit.schedule_id, n);
      n := n + 1;
    end if;
    if hit.employer_cents > 0 then
      insert into public.payslip_lines (payslip_id, kind, label, amount_cents, schedule_id, sort_order)
      values (in_payslip_id, 'employer', 'SOCSO (employer)', hit.employer_cents, hit.schedule_id, n);
      n := n + 1;
    end if;
  end if;

  if terms.eis_part is not null then
    select * into hit from public.statutory_lookup('eis', terms.eis_part, run.period_to, gross);
    if hit.employee_cents > 0 then
      insert into public.payslip_lines (payslip_id, kind, label, amount_cents, schedule_id, sort_order)
      values (in_payslip_id, 'deduction', 'EIS', hit.employee_cents, hit.schedule_id, n);
      n := n + 1;
    end if;
    if hit.employer_cents > 0 then
      insert into public.payslip_lines (payslip_id, kind, label, amount_cents, schedule_id, sort_order)
      values (in_payslip_id, 'employer', 'EIS (employer)', hit.employer_cents, hit.schedule_id, n);
    end if;
  end if;

  perform public.sync_payslip_totals(in_payslip_id);
end;
$$;

revoke execute on function public.recompute_payslip_statutory(uuid) from public, anon;
grant execute on function public.recompute_payslip_statutory(uuid) to authenticated;

/**
 * 开一次薪。
 *
 * 名册里每一个**有薪资条件**的师傅一张单。没有条件的不开 ——
 * 一张空白的薪资单挂在一个分包师傅名下，读起来像我们漏算了他。
 *
 * 月薪的人自动带底薪；日薪跟时薪的带 0，因为**做了几天只有他知道**，
 * 而替他猜一个天数比留白糟得多。
 */
create or replace function public.open_pay_run(
  in_project_id uuid,
  in_period_from date,
  in_period_to date,
  in_note text default '',
  in_branch_id uuid default null,
  in_idempotency_key uuid default null
)
returns public.pay_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  run public.pay_runs;
  t public.staff_pay_terms;
  slip public.payslips;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your project';
  end if;
  if not public.branch_is_ours(in_project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;
  if in_period_to < in_period_from then
    raise exception 'the period ends before it starts';
  end if;

  if in_idempotency_key is not null then
    select * into run from public.pay_runs
     where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return run;
    end if;
  end if;

  insert into public.pay_runs (
    project_id, period_from, period_to, note, branch_id, idempotency_key
  ) values (
    in_project_id, in_period_from, in_period_to,
    left(coalesce(in_note, ''), 500), in_branch_id, in_idempotency_key
  )
  returning * into run;

  for t in
    select * from public.staff_pay_terms where project_id = in_project_id
  loop
    insert into public.payslips (run_id, project_id, staff_id)
    values (run.id, in_project_id, t.staff_id)
    returning * into slip;

    if t.basis = 'monthly' and t.rate_cents > 0 then
      insert into public.payslip_lines (payslip_id, kind, label, amount_cents, sort_order)
      values (slip.id, 'earning', 'Basic pay', t.rate_cents, 0);
    end if;

    perform public.recompute_payslip_statutory(slip.id);
  end loop;

  return run;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into run from public.pay_runs
       where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return run;
      end if;
    end if;
    raise;
end;
$$;

revoke execute on function public.open_pay_run(uuid, date, date, text, uuid, uuid) from public, anon;
grant execute on function public.open_pay_run(uuid, date, date, text, uuid, uuid) to authenticated;

/**
 * 他付的那几行 —— 底薪 · 加班 · 津贴。整批换。
 *
 * 换完法律那几行自己重算，因为它们是从这几行加出来的总额算的。
 */
create or replace function public.set_payslip_earnings(
  in_payslip_id uuid,
  in_lines jsonb default '[]'::jsonb
)
returns public.payslips
language plpgsql
security definer
set search_path = public
as $$
declare
  slip public.payslips;
  run public.pay_runs;
  l jsonb;
  i integer := 0;
begin
  select * into slip from public.payslips where id = in_payslip_id;
  if not found then
    raise exception 'no such payslip';
  end if;
  if not public.sees_money(slip.project_id) then
    raise exception 'not your project';
  end if;
  select * into run from public.pay_runs where id = slip.run_id;
  if run.paid_at is not null then
    raise exception 'this run has been paid -- money already reached them, so the slip is fixed';
  end if;

  delete from public.payslip_lines where payslip_id = in_payslip_id and schedule_id is null;

  for l in select * from jsonb_array_elements(coalesce(in_lines, '[]'::jsonb)) loop
    insert into public.payslip_lines (payslip_id, kind, label, amount_cents, sort_order)
    values (
      in_payslip_id,
      'earning',
      left(coalesce(l ->> 'label', ''), 120),
      greatest(coalesce((l ->> 'amount_cents')::bigint, 0), 0),
      i
    );
    i := i + 1;
  end loop;

  perform public.recompute_payslip_statutory(in_payslip_id);
  select * into slip from public.payslips where id = in_payslip_id;
  return slip;
end;
$$;

revoke execute on function public.set_payslip_earnings(uuid, jsonb) from public, anon;
grant execute on function public.set_payslip_earnings(uuid, jsonb) to authenticated;

/**
 * 发出去。
 *
 * ── 🔴 两道门 ────────────────────────────────────────────────────────────
 *
 *   1. **没有人核对过的法定表，钱发不出去。** 逐行看它用过的每一份表，
 *      只要有一份 `confirmed_at` 是空的就拒绝，并且讲得出是哪一份。
 *      薪资单照样算得出来 —— 挡的是钱，不是资讯。
 *   2. 发过就锁住。跟收过货的进货单同一条：钱已经到工人手上了。
 *
 * ── 记进帐上的是「实收」，不是「总额」──────────────────────────────────
 *
 * 我们的损益表是收付实现制，而发薪那天真的只有实收离开。公积金跟社险
 * 是次月缴的，他那天再记一笔。**代价（那个月人工成本偏低）写在
 * 20260904220000 的档头，不藏。**
 *
 * ⚠️ 走的是**人按「加一笔开销」同一支** `add_ledger_entry` —— 单号、
 * 防重复、对方、权限全部只有一份（重点 23）。
 */
create or replace function public.pay_pay_run(
  in_run_id uuid,
  in_category text default '',
  in_method text default '',
  in_entry_on date default null
)
returns public.pay_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  run public.pay_runs;
  unconfirmed text;
  slip record;
  made public.ledger_entries;
  who text;
begin
  select * into run from public.pay_runs where id = in_run_id;
  if not found then
    raise exception 'no such pay run';
  end if;
  if not public.sees_money(run.project_id) then
    raise exception 'not your project';
  end if;
  if run.paid_at is not null then
    raise exception 'this run has already been paid';
  end if;

  /* ── 🔴 第一道门 ────────────────────────────────────────────────────── */
  select string_agg(distinct s.scheme || ' (' || s.part || ') -- ' || s.source_url, E'\n')
    into unconfirmed
  from public.payslip_lines l
  join public.payslips p on p.id = l.payslip_id
  join public.statutory_schedules s on s.id = l.schedule_id
  where p.run_id = in_run_id and s.confirmed_at is null;

  if unconfirmed is not null then
    raise exception
      'these statutory tables have not been checked against the official document yet, so the money cannot go out:%s%',
      E'\n', unconfirmed;
  end if;

  for slip in
    select p.*, d.name as staff_name
    from public.payslips p
    join public.directory_entries d on d.id = p.staff_id
    where p.run_id = in_run_id and p.net_cents > 0
  loop
    who := coalesce(nullif(btrim(slip.staff_name), ''), 'Staff');
    made := public.add_ledger_entry(
      in_project_id := run.project_id,
      in_module_key := 'expenses',
      in_direction := 'out',
      in_amount_cents := slip.net_cents,
      in_party := who,
      in_entry_on := coalesce(in_entry_on, public.today_myt()),
      in_method := coalesce(in_method, ''),
      in_note := 'Pay ' || to_char(run.period_from, 'YYYY-MM-DD')
                 || ' to ' || to_char(run.period_to, 'YYYY-MM-DD') || ' -- ' || who,
      in_party_id := slip.staff_id,
      in_branch_id := run.branch_id,
      /* 谁做的。⚠️ `staff_earnings` 只数进来的钱，所以这一笔不会
         灌大她的业绩 —— 它让「我一共付过这个人多少」答得出来。 */
      in_done_by := slip.staff_id,
      in_category := left(coalesce(in_category, ''), 60)
    );
    update public.payslips set entry_id = made.id where id = slip.id;
  end loop;

  update public.pay_runs set paid_at = now() where id = in_run_id
  returning * into run;
  return run;
end;
$$;

revoke execute on function public.pay_pay_run(uuid, text, text, date) from public, anon;
grant execute on function public.pay_pay_run(uuid, text, text, date) to authenticated;

/**
 * 收起来一次还没发的薪。
 *
 * ⚠️ **发过的删不掉** —— 那几笔钱已经在帐上了，删掉这张单会让帐上多出
 * 几笔没有出处的开销。要改就冲正那几笔（那是钱自己的规矩）。
 */
create or replace function public.discard_pay_run(in_run_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  run public.pay_runs;
begin
  select * into run from public.pay_runs where id = in_run_id;
  if not found then
    raise exception 'no such pay run';
  end if;
  if not public.sees_money(run.project_id) then
    raise exception 'not your project';
  end if;
  if run.paid_at is not null then
    raise exception 'this run has been paid -- reverse the entries instead of deleting the run';
  end if;
  delete from public.pay_runs where id = in_run_id;
end;
$$;

revoke execute on function public.discard_pay_run(uuid) from public, anon;
grant execute on function public.discard_pay_run(uuid) to authenticated;
