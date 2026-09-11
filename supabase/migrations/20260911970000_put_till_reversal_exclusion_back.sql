-- 改回来：20260911960000 弄坏的那两行撤销掉，恢复 20260911930000 的版本。
create or replace function public.count_till(
  in_project_id uuid,
  in_on date,
  in_method text,
  in_counted_cents bigint,
  in_branch_id uuid default null,
  in_note text default ''
)
returns till_counts
language plpgsql
security definer
set search_path = public
as $$
declare
  expected bigint;
  row public.till_counts;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;
  if not public.branch_is_ours(in_project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;
  if coalesce(btrim(in_method), '') = '' then
    raise exception 'say which payment method you counted';
  end if;
  if in_counted_cents is null or in_counted_cents < 0 then
    raise exception 'a count cannot be negative';
  end if;

  select coalesce(sum(
           case when e.direction = 'in' then e.amount_cents else -e.amount_cents end
         ), 0)
    into expected
  from public.ledger_entries e
  where e.project_id = in_project_id
    and e.entry_on = in_on
    and lower(btrim(e.method)) = lower(btrim(in_method))
    and (in_branch_id is null or e.branch_id is not distinct from in_branch_id)
    and e.adjusts_id is null
    and not exists (select 1 from public.ledger_entries r where r.adjusts_id = e.id);

  insert into public.till_counts (
    project_id, branch_id, counted_on, method,
    expected_cents, counted_cents, note, created_by
  ) values (
    in_project_id, in_branch_id, in_on, btrim(in_method),
    expected, in_counted_cents, left(btrim(coalesce(in_note, '')), 500), auth.uid()
  )
  returning * into row;

  return row;
end;
$$;
