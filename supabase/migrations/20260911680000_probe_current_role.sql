create or replace function public.probe_current_role()
returns table (fn_owner text, session_user_now text, current_user_now text)
language sql security definer set search_path = public as $$
  select (select rolname from pg_roles where oid = (select proowner from pg_proc where proname = 'probe_default_priv_test' limit 1)),
         session_user, current_user;
$$;
grant execute on function public.probe_current_role() to authenticated;
