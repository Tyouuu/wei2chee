-- 故意弄坏：让 till_counts_of 不挡师傅，看 check:till 第⑥段真的红。
-- 单独推、单独跑，看过它红，再改回去。
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
    and public.works_here(in_project_id) /* 🔴 弄坏的那一行 */
    and (in_from is null or t.counted_on >= in_from)
    and (in_until is null or t.counted_on <= in_until)
  order by t.counted_on desc, t.created_at desc;
$$;
