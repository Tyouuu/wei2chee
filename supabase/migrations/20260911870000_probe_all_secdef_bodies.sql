-- 探针，用完即丢：一次拿全部 security definer 函式的完整原始码，
-- 拿去做两把系统性扫描——① 验证了一个外键参数没有验证另一个
-- ② 读一个会变的聚合数、检查够不够、才写，中间没有锁。
create or replace function public.probe_all_secdef_bodies()
returns table (fn_name text, fn_args text, is_trigger boolean, src text)
language sql security definer set search_path = public as $$
  select p.proname::text,
         pg_get_function_identity_arguments(p.oid),
         (p.prorettype = 'trigger'::regtype),
         pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.prosecdef = true
  order by p.proname;
$$;
grant execute on function public.probe_all_secdef_bodies() to authenticated;
