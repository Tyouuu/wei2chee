-- 🔴 故意弄坏，看守卫红不红：放宽放过头 —— 任何登入的人都过，而且没有「付出去的钱
-- 只有老板」那道后门检查。`check:ledger-staff` 里这几条**必须**红：
--   · 陌生人（别家帐号）记得进别人的专案  ← 跨租户，这一支最怕的那一个
--   · 离职员工记得进
--   · 员工记得下付出去的钱（三种写法 + 重播别人的钥匙）
-- 而「员工记得下客人付的钱」照样绿。下一支（20260924050000）放回来。

create or replace function public.add_ledger_entry(
  in_project_id uuid,
  in_module_key text,
  in_direction text default null,
  in_amount_cents bigint default 0,
  in_party text default '',
  in_against_id uuid default null,
  in_entry_on date default null,
  in_method text default '',
  in_reference text default '',
  in_receipt_url text default null,
  in_note text default '',
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null,
  in_party_id uuid default null,
  in_branch_id uuid default null,
  in_done_by uuid default null,
  in_category text default '',
  in_job_id uuid default null
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not your project';
  end if;

  return public.add_ledger_entry_core(
    in_actor => auth.uid(),
    in_project_id => in_project_id,
    in_module_key => in_module_key,
    in_direction => in_direction,
    in_amount_cents => in_amount_cents,
    in_party => in_party,
    in_against_id => in_against_id,
    in_entry_on => in_entry_on,
    in_method => in_method,
    in_reference => in_reference,
    in_receipt_url => in_receipt_url,
    in_note => in_note,
    in_extra => in_extra,
    in_idempotency_key => in_idempotency_key,
    in_party_id => in_party_id,
    in_branch_id => in_branch_id,
    in_done_by => in_done_by,
    in_category => in_category,
    in_job_id => in_job_id
  );
end;
$$;
