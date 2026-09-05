-- 临时探针：那几栏「指向 auth.users · on delete set null」到底真的在不在。
-- 尺子量到 `follow_ups.created_by` 在使用者被删掉之后还留着那个 id ——
-- 而 migration 里白纸黑字写着 on delete set null。读档案答不了，去问资料库。
create or replace function public.probe_user_fks()
returns table (tbl text, col text, on_delete text)
language sql
stable
security definer
set search_path = public
as $$
  select c.conrelid::regclass::text,
         a.attname::text,
         case c.confdeltype when 'a' then 'no action' when 'r' then 'restrict'
              when 'c' then 'cascade' when 'n' then 'set null'
              when 'd' then 'set default' end
  from pg_constraint c
  join unnest(c.conkey) k(attnum) on true
  join pg_attribute a on a.attrelid = c.conrelid and a.attnum = k.attnum
  where c.contype = 'f'
    and c.confrelid = 'auth.users'::regclass
    and c.connamespace = 'public'::regnamespace
  order by 1, 2;
$$;
grant execute on function public.probe_user_fks() to service_role;
