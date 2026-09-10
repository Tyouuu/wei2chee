-- 探针：确认上一支迁移真的把 44 个约束都拿掉了，没有漏网的。用完就删。

create or replace function public.probe_remaining_fks()
returns table (table_name text, column_name text, on_delete text, constraint_name text)
language sql
stable
security definer
set search_path = public
as $$
  select cl.relname::text, a.attname::text,
         case con.confdeltype
           when 'a' then 'no action' when 'r' then 'restrict'
           when 'c' then 'cascade' when 'n' then 'set null' when 'd' then 'set default'
         end,
         con.conname::text
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

grant execute on function public.probe_remaining_fks() to authenticated;
