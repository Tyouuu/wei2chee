-- 把按天跟按钟点那两段原样搬回去。
--
-- 20260906560000 拿掉它们之后，七条红，而红出来的读数
-- 就是这个洞本来的样子：`[]` —— **按天算的师傅一行都没有**。
--
-- ⚠️ 从 20260906550000 原样抽出来，不是照记忆重打。

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

    /* 🔴 按天 · 按钟点的那两种，本来一行都没有。
       ⚠️ 而这一行**没有记录的时候照样画出来，写着 0** ——
       一张没有那一行的薪资单，跟一张写着「0 天」的薪资单，
       在他眼前差很远：前者看起来像还没做完，后者是一句他看得懂、
       而且马上知道要去补什么的话。 */
    elsif t.basis in ('daily', 'hourly') then
      select * into worked
      from public.days_worked(t.staff_id, in_period_from, in_period_to);

      if t.basis = 'daily' then
        insert into public.payslip_lines (payslip_id, kind, label, amount_cents, sort_order)
        values (
          slip.id, 'earning',
          'Days worked: ' || trim(to_char(coalesce(worked.days, 0), 'FM999999990.09')),
          floor(coalesce(worked.days, 0) * t.rate_cents)::bigint,
          0
        );
      else
        insert into public.payslip_lines (payslip_id, kind, label, amount_cents, sort_order)
        values (
          slip.id, 'earning',
          'Hours worked: ' || trim(to_char(coalesce(worked.hours, 0), 'FM999999990.09')),
          floor(coalesce(worked.hours, 0) * t.rate_cents)::bigint,
          0
        );
      end if;
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
