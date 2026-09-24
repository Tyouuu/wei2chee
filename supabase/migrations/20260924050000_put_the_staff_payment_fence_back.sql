-- 把 20260924020000 那一版放回来（弄坏两次、看过守卫红过之后）。
-- 内容跟 20260924020000 里的函式逐字一样 —— 由同一份模板生出，没有手抄。

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
declare
  made public.ledger_entries;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;

  made := public.add_ledger_entry_core(
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

  if not public.sees_money(in_project_id)
     and not (made.direction = 'in' and made.module_key = 'payments') then
    raise exception 'staff can record what a customer paid; anything else is for the owner';
  end if;

  return made;
end;
$$;
