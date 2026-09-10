-- 探针，用完即丢：这一批函式，anon / authenticated 到底能不能直接呼叫。
create or replace function public.probe_fn_grants(fn_names text[])
returns table (fn_name text, fn_args text, anon_can_execute boolean, authenticated_can_execute boolean)
language sql
security definer
set search_path = public
as $$
  select p.proname::text,
         pg_get_function_identity_arguments(p.oid),
         has_function_privilege('anon', p.oid, 'EXECUTE'),
         has_function_privilege('authenticated', p.oid, 'EXECUTE')
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = any(fn_names)
  order by p.proname;
$$;
grant execute on function public.probe_fn_grants(text[]) to authenticated;
