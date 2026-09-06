create or replace function public.function_arg_names()
returns table (fn text, args text[], odd text[])
language sql
stable
security definer
set search_path = public
as $$
  select p.proname::text,
         coalesce(p.proargnames, '{}'::text[]),
         array(
           select a from unnest(coalesce(p.proargnames, '{}'::text[])) as a
           where a not like 'in\_%'
         )
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.prokind = 'f'
    and has_function_privilege('authenticated', p.oid, 'execute')
    and coalesce(array_length(p.proargnames, 1), 0) > 0
  order by p.proname;
$$;
revoke execute on function public.function_arg_names() from public, anon;
grant execute on function public.function_arg_names() to authenticated;
