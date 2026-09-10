-- 探针，用完即丢：`public` schema 对 anon/authenticated 有没有 CREATE 权限。
-- 这一支函式全库用的都是 `set search_path = public`（不是官方建议的空字串），
-- 如果低权限角色能在 public 底下建物件，就是经典的 search_path 劫持攻击面——
-- 攻击者建一个跟内建函式同名的物件，security definer 函式呼叫的时候
-- 会先撞到攻击者建的那个，而不是原本要呼叫的那个。
create or replace function public.probe_public_schema_privileges()
returns table (grantee text, privilege_type text)
language sql
security definer
set search_path = public
as $$
  select grantee, privilege_type
  from information_schema.role_usage_grants
  where 1 = 0 -- placeholder, real query below via information_schema.schema_privileges is not standard; use has_schema_privilege instead
$$;

-- 用 has_schema_privilege 直接问，比查 information_schema 更直接。
create or replace function public.probe_schema_create_privilege()
returns table (role_name text, can_create boolean, can_usage boolean)
language sql
security definer
set search_path = public
as $$
  select r.rolname::text,
         has_schema_privilege(r.rolname, 'public', 'CREATE'),
         has_schema_privilege(r.rolname, 'public', 'USAGE')
  from pg_roles r
  where r.rolname in ('anon', 'authenticated', 'public')
$$;
grant execute on function public.probe_schema_create_privilege() to authenticated;
