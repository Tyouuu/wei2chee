-- 探针，用完即丢：把每一支的原始 ACL 文字吐出来，分清楚
-- 「authenticated 自己被明确点名」跟「只是沾了 public 那一条的光」——
-- pg_proc.proacl 里没写角色名的那一条（格式 =X/owner）就是 public 那一条，
-- 写了角色名的（authenticated=X/owner）才是真的对那个角色单独授权过。
create or replace function public.probe_raw_acl()
returns table (fn_name text, fn_args text, acl text)
language sql
security definer
set search_path = public
as $$
  select p.proname::text,
         pg_get_function_identity_arguments(p.oid),
         p.proacl::text
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef = true
  order by p.proname;
$$;
grant execute on function public.probe_raw_acl() to authenticated;
