-- 一支只读的探针：问 pg_proc 一支函式**现在真的长什么样**。
--
-- 为什么要它：动 add_ledger_entry 的权限之前（任务 411，他拍板「肯定要放宽给
-- 员工」），迁移档案的历史答不了「哪一版是活的」——同一个名字在
-- 20260904200000 跟 20260905720000 签名不一样，之后 20260911880000 起又被
-- 拆过一次，谁赢只有资料库自己知道。照 20260912050000 那一次同样的做法，
-- 用完就丢（下一支迁移就是丢它）。
--
-- 🔴 只有 service_role 打得到：它回的是函式原始码，不是客户的资料，但
-- 也不该让任何登入的人（或陌生人）拿去读 —— 这个仓库 20260911 那一轮
-- 抓到过 77 支函式默认把执行权送给 public，这一支不重犯。
create or replace function public.probe_function_source(in_name text)
returns text
language sql
security definer
set search_path = public
as $$
  select string_agg(
           '-- ' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
             || E'\n' || pg_get_functiondef(p.oid),
           E'\n\n'
           order by p.oid
         )
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = in_name;
$$;

revoke execute on function public.probe_function_source(text) from public, anon, authenticated;
grant execute on function public.probe_function_source(text) to service_role;
