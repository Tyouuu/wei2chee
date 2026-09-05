-- 临时探针：那个帐号为什么删不掉。
-- API 把资料库的原话包成一句 "Database error deleting user" —— 问不出是哪一条。
-- 任务 129 用过同一支，用完就删。
create or replace function public.probe_delete_user_3(in_id uuid)
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
grant execute on function public.probe_delete_user_3(uuid) to service_role;
