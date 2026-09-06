-- 🔴 故意弄坏：把按天跟按钟点那两段拿掉，
-- 也就是把这个洞原样装回去。**单独推一次**（重点 31 第三条）。
--
-- 它坏掉的时候长什么样子：**一个按天算的师傅，
-- 开一次薪拿到的是一张空的薪资单** ——
-- 而它不报错、不讲，公积金社险照样按 0 算。

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
  worked record;
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
