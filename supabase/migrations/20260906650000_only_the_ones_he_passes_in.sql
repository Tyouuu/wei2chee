-- 🔴 上一支数出「102 支不照惯例」，而那个数字是假的。
--
-- `proargnames` 里**同时装着回传那张表的栏名**（`returns table (...)`），
-- 而那些栏本来就不该叫 `in_*`。於是它把每一支会回一张表的函式
-- 全部算成「不照惯例」。
--
-- 🔴 **一个把回传栏当成参数的读数，跟一个真的读数，在报告里长得一模一样** ——
-- 而它刚好会把数字放大到「多到不用修」的程度，那是最坏的一种假读数。
--
-- 修法：看 `proargmodes` —— 它是 null 表示全部都是传进去的；
-- 不是 null 的时候只有 `i`（传进去）· `b`（进出）· `v`（可变）算参数，
-- `t` 是回传那张表的栏。
create or replace function public.function_arg_names()
returns table (fn text, args text[], odd text[])
language sql
stable
security definer
set search_path = public
as $$
  with f as (
    select p.proname::text as name,
           array(
             select n
             from unnest(coalesce(p.proargnames, '{}'::text[]))
                  with ordinality as u(n, i)
             where p.proargmodes is null
                or p.proargmodes[i] in ('i', 'b', 'v')
           ) as ins
    from pg_proc p
    join pg_namespace nsp on nsp.oid = p.pronamespace
    where nsp.nspname = 'public'
      and p.prokind = 'f'
      and has_function_privilege('authenticated', p.oid, 'execute')
  )
  select f.name,
         f.ins,
         array(select a from unnest(f.ins) as a where a not like 'in\_%')
  from f
  where array_length(f.ins, 1) > 0
  order by f.name;
$$;

revoke execute on function public.function_arg_names() from public, anon;
grant execute on function public.function_arg_names() to authenticated;
