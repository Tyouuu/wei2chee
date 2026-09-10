-- 探针，用完即丢：验证 20260911660000 真的生效——新建一支什么都不给的函式，
-- 看 public 伪角色是不是真的拿不到执行权。
create function public.probe_default_priv_test() returns void language sql as $$ select 1 $$;
create or replace function public.probe_check_default_priv()
returns boolean language sql security definer set search_path = public as $$
  select has_function_privilege('public', 'public.probe_default_priv_test()', 'EXECUTE');
$$;
grant execute on function public.probe_check_default_priv() to authenticated;
