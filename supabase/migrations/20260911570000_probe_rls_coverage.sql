-- 探针，用完即丢：直接问系统目录哪些 public 表没开 RLS、
-- 哪些开了但一条政策都没有（等于开了锁却没有钥匙规则，
-- 效果视乎有没有其他挡法，但值得单独列出来看）。
create or replace function public.probe_rls_coverage()
returns table (table_name text, rls_enabled boolean, policy_count bigint)
language sql
security definer
set search_path = public
as $$
  select c.relname::text,
         c.relrowsecurity,
         (select count(*) from pg_policy pol where pol.polrelid = c.oid)
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind = 'r'
  order by c.relname;
$$;
grant execute on function public.probe_rls_coverage() to authenticated;
