-- 🔴 一支临时的探针：**问资料库它到底在拦什么。**
--
-- 20260904160000 把六条 restrict 改成 no action，删一个用过的测试帐号
-- 还是回 `Database error deleting user` —— 而那句话是 Supabase 的 API
-- 包装过的，**它没有告诉我是哪一条约束**。
--
-- 猜下一条要改什么，是这个仓库栽过好几次的那件事
-- （[重点 26](docs/founder-tasks.md)：用推的，没有去看）。所以这里问它。
--
-- ⚠️ 这一支是**临时的**，20260904180000 把它删掉。两份都留在历史里，
-- 因为它就是「我怎么查出来的」那份记录。
-- ⚠️ 只有 founder 打得开，而且它**会真的删**（在一个 savepoint 里，然后回滚）。

create or replace function public.probe_delete_user(in_id uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_founder() then
    return 'not you';
  end if;
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
$$;

revoke execute on function public.probe_delete_user(uuid) from public, anon;
grant execute on function public.probe_delete_user(uuid) to authenticated;
