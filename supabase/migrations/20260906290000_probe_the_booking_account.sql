create or replace function public.probe_delete_user_5(in_id uuid)
returns text language plpgsql security definer set search_path = public as $$
begin
  delete from auth.users where id = in_id;
  return 'ok';
exception when others then
  return sqlstate || ' | ' || sqlerrm;
end; $$;
grant execute on function public.probe_delete_user_5(uuid) to service_role;
