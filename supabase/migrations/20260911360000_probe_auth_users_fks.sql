-- 探针，不是产品代码：量出资料库上现在真的还有几处 `references auth.users`
-- 外键——[任务 350] 只用文字数过迁移史，而好几处已经在后来的迁移里被拿掉了
-- （`party_alerts` 两栏、`treatment_notes` 的 `created_by`/`signed_by`）。
-- 用完这一支就删。

create or replace function public.probe_auth_users_fks()
returns table (table_name text, column_name text, constraint_name text)
language sql
stable
security definer
set search_path = public
as $$
  select tc.table_name::text, kcu.column_name::text, tc.constraint_name::text
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu
      on kcu.constraint_name = tc.constraint_name
     and kcu.table_schema = tc.table_schema
    join information_schema.constraint_column_usage ccu
      on ccu.constraint_name = tc.constraint_name
     and ccu.table_schema = tc.table_schema
   where tc.constraint_type = 'FOREIGN KEY'
     and tc.table_schema = 'public'
     and ccu.table_schema = 'auth'
     and ccu.table_name = 'users'
   order by tc.table_name, kcu.column_name;
$$;

grant execute on function public.probe_auth_users_fks() to authenticated;
