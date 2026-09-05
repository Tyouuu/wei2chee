-- 探针，第二次：加了那一段放行之后它还是删不掉。
-- 「Database error deleting user」问不出是哪一条，只能去问资料库原话。
create or replace function public.probe_delete_user_4(in_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = in_id;
  return 'ok';
exception when others then
  return sqlstate || ' | ' || sqlerrm;
end;
$$;
grant execute on function public.probe_delete_user_4(uuid) to service_role;
