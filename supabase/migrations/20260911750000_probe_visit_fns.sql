-- 探针，用完即丢：拿这四支现在真的在跑的原始码，準备把它们串成一个动作。
create or replace function public.probe_visit_fns()
returns table (fn_name text, src text)
language sql security definer set search_path = public as $$
  select p.proname::text, pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in ('set_appointment_status', 'add_visit_line', 'add_visit_product', 'set_visit_tip', 'mark_loyalty_redeemed', 'loyalty_status_of')
  order by p.proname;
$$;
grant execute on function public.probe_visit_fns() to authenticated;
