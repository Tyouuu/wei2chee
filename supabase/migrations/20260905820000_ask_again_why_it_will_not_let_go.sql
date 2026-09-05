-- 临时探针：问资料库为什么放不了手。
--
-- 20260904170000 那一支已经不在了，而同一个症状回来了：
--   🔴 Database error deleting user
-- 而那正是任务 129 的形状（一条守卫挡住 cascade，然后清理的时候
-- 有人拿正则去扫全库，把示范帐号一起炸掉）。
--
-- ⚠️ 这一支**只给 service_role**，而且下一支 migration 就把它拆掉。
-- 弄坏跟拆掉分开推，不然没有人看得到它红过。

create or replace function public.probe_delete_user_2(in_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
begin
  begin
    delete from auth.users where id = in_id;
    /* 真的删掉了就回滚 —— 这一支是来问话的，不是来动手的。 */
    raise exception 'ROLLBACK_ON_PURPOSE';
  exception
    when others then
      if SQLERRM = 'ROLLBACK_ON_PURPOSE' then
        return 'it would have worked';
      end if;
      return SQLSTATE || ' | ' || SQLERRM;
  end;
end;
$fn$;

revoke execute on function public.probe_delete_user_2(uuid) from public, anon, authenticated;
grant execute on function public.probe_delete_user_2(uuid) to service_role;
