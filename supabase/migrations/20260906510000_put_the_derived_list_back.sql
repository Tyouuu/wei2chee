-- 把「哪几张表是他的资料」原样搬回去。
--
-- 20260906500000 把它换成一份手写的三张清单之后，
-- 🔴 **照资料库问的那一条跟着一起错、而且继续印「一张都没有漏」** ——
-- 因为它跟汇出那一支问的是同一句话。
-- 红的只有去问磁碟上那几百支 migration 的那一条，
-- 而它一口气列出了四十六张不在汇出档里的表。
--
-- —— 那就是那把尺为什么要有**第二个来源**的全部理由。
--
-- ⚠️ 从 20260906490000 原样抽出来，不是照记忆重打。

create or replace function public.his_data_tables()
returns table (tbl text)
language sql
stable
security definer
set search_path = public
as $$
  select c.table_name::text
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public'
    and c.column_name = 'project_id'
    and t.table_type = 'BASE TABLE'
  order by c.table_name;
$$;
