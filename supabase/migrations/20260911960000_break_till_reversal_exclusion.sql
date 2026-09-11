-- 故意弄坏：拿掉冲正过滤那两行，看 check:till 第④段真的红——
-- 一笔被冲正的钱不应该还算「这一天应该有」。单独推、单独跑，看过它红。
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
    and (in_branch_id is null or e.branch_id is not distinct from in_branch_id);
    /* 🔴 弄坏的地方：冲正过滤那两行拿掉了。 */

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
