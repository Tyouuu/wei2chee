-- 探针 v3——加上 ON DELETE 行为，才分得出哪些是 [任务 350] 那个坑
-- （on delete set null 造成的层叠顺序竞赛），哪些是真的关系型外键
-- （account_id · user_id 那种，不该动）。

create or replace function public.probe_auth_users_fks_v3()
returns table (table_name text, column_name text, on_delete text)
language sql
stable
security definer
set search_path = public
as $$
  select cl.relname::text, a.attname::text,
         case con.confdeltype
           when 'a' then 'no action'
           when 'r' then 'restrict'
           when 'c' then 'cascade'
           when 'n' then 'set null'
           when 'd' then 'set default'
         end
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
   order by con.confdeltype, cl.relname, a.attname;
$$;

grant execute on function public.probe_auth_users_fks_v3() to authenticated;
