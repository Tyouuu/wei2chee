create or replace function public.probe_test_fn_acl()
returns text
language sql security definer set search_path = public as $$
  select proacl::text from pg_proc where proname = 'probe_default_priv_test';
$$;
grant execute on function public.probe_test_fn_acl() to authenticated;
