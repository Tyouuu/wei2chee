create or replace function public.probe_commission_fns()
returns table (fn_name text, src text)
language sql security definer set search_path = public as $$
  select p.proname::text, pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('staff_earnings', 'commission_rate_at', 'commission_scheme_at')
  order by p.proname;
$$;
grant execute on function public.probe_commission_fns() to authenticated;
