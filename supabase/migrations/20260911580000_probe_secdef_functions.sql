-- 探针，用完即丢：把每一支 security definer 函式的真身（现在真的在跑的
-- 那一份，不是迁移档案历史）连同它的完整原始码一起吐出来，用来在
-- 应用层做静态比对——哪几支会写（insert/update/delete）却一个守卫
-- 关键字都不提。这里不判断，只吐资料。
create or replace function public.probe_secdef_functions()
returns table (
  fn_name text,
  fn_args text,
  is_secdef boolean,
  src text
)
language sql
security definer
set search_path = public
as $$
  select p.proname::text,
         pg_get_function_identity_arguments(p.oid),
         p.prosecdef,
         pg_get_functiondef(p.oid)
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prosecdef = true
  order by p.proname;
$$;
grant execute on function public.probe_secdef_functions() to authenticated;
