-- 探针，用完即丢：`public`（那个「所有角色都算数」的伪角色，不是
-- schema）到底对哪些 security definer 函式还留着执行权。这一支解释了
-- 为什么撤销 authenticated/anon 的授权之后 sync_payslip_totals 照样能打——
-- Postgres 建函式**预设就把 EXECUTE 给了 public 伪角色**，除非当初
-- 建的时候明写了 `revoke execute ... from public`。逐一撤销具名角色
-- 从来没有真的关上这扇门，除非连 public 伪角色也一起撤。
create or replace function public.probe_public_role_grants()
returns table (fn_name text, fn_args text, is_secdef boolean, public_can_execute boolean)
language sql
security definer
set search_path = public
as $$
  select p.proname::text,
         pg_get_function_identity_arguments(p.oid),
         p.prosecdef,
         has_function_privilege('public', p.oid, 'EXECUTE')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef = true
  order by p.proname;
$$;
grant execute on function public.probe_public_role_grants() to authenticated;
