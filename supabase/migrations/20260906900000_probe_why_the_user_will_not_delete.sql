-- ⚙ 临时探针 —— `check:follow-ups` 报「整个帐号删得掉」没过，
-- 而外面那一层只回一句 `Database error deleting user`，问不出是哪一条。
-- 任务 213 用过同一招：推一支探针去问资料库要原话，问完就删掉。
create or replace function public.probe_delete_user(in_uid uuid)
returns text
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  delete from auth.users where id = in_uid;
  return 'ok';
exception when others then
  return sqlstate || ' | ' || sqlerrm;
end;
$$;
grant execute on function public.probe_delete_user(uuid) to service_role;
