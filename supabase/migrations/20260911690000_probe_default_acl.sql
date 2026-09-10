create or replace function public.probe_default_acl()
returns table (defaclrole text, defaclnamespace text, defaclobjtype text, defaclacl text)
language sql security definer set search_path = public as $$
  select r.rolname::text, n.nspname::text, d.defaclobjtype::text, d.defaclacl::text
  from pg_default_acl d
  join pg_roles r on r.oid = d.defaclrole
  left join pg_namespace n on n.oid = d.defaclnamespace;
$$;
grant execute on function public.probe_default_acl() to authenticated;
