-- 改回来：20260911940000 弄坏的那一行撤销掉，恢复 20260911930000 的版本。
create or replace function public.till_counts_of(
  in_project_id uuid,
  in_from date default null,
  in_until date default null
)
returns setof till_counts
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.till_counts t
  where t.project_id = in_project_id
    and public.sees_money(in_project_id)
    and (in_from is null or t.counted_on >= in_from)
    and (in_until is null or t.counted_on <= in_until)
  order by t.counted_on desc, t.created_at desc;
$$;
