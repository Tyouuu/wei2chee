-- 探针 v2——第一版用 information_schema 查出 0 笔，换 pg_constraint 系统目录再试一次。

create or replace function public.probe_auth_users_fks_v2()
returns table (table_name text, column_name text, constraint_name text)
language sql
stable
security definer
set search_path = public
as $$
  select cl.relname::text, a.attname::text, con.conname::text
    from pg_constraint con
    join pg_class cl on cl.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = cl.relnamespace
    join pg_attribute a on a.attrelid = con.conrelid and a.attnum = any(con.conkey)
    join pg_class fcl on fcl.oid = con.confrelid
    join pg_namespace fnsp on fnsp.oid = fcl.relnamespace
   where con.contype = 'f'
     and nsp.nspname = 'public'
     and fnsp.nspname = 'auth'
     and fcl.relname = 'users'
   order by cl.relname, a.attname;
$$;

grant execute on function public.probe_auth_users_fks_v2() to authenticated;
