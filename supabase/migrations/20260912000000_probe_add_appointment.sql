create or replace function public.probe_add_appointment()
returns text language sql security definer set search_path = public as $$
  select pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = 'add_appointment'
  limit 1;
$$;
grant execute on function public.probe_add_appointment() to authenticated;
