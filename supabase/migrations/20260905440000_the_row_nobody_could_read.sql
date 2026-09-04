/**
 * 交接那一行，老板在自己的后台读得到。
 *
 * 20260905410000 让「交给我去建」写下一行 —— **而写下来没有人读，
 * 就是这个仓库犯过十九次的那件事**（能力有，线没接）。
 * 那一行存在的全部理由是「讯息送不送得出去，他都看得到」，
 * 所以它必须在 console 上。
 *
 * ⚠️ 一次回全部，不分页：**今天零个客户**，而这一份清单在超过一屏之前
 * 不需要分页。这一条是判断不是省事 —— 而它写下来，是为了以后回来加分页
 * 的人知道当初为什么没有。
 *
 * ⚠️ 带着 `contact_phone` 一起回：console 那颗「联络客户」到今天只能
 * 寄 email（任务 48），而这一份清单正好是号码第一次真的存在的地方。
 */
create or replace function public.console_handoffs()
returns table (
  id uuid,
  project_id uuid,
  business_name text,
  owner_name text,
  email text,
  contact_phone text,
  stage text,
  note text,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_founder() then
    raise exception 'not permitted';
  end if;

  return query
  select
    h.id,
    h.project_id,
    p.business_name,
    p.owner_name,
    a.email,
    p.contact_phone,
    p.stage,
    h.note,
    h.created_at
  from public.handoff_requests h
  join public.projects p on p.id = h.project_id
  join public.accounts a on a.id = p.account_id
  order by h.created_at desc;
end;
$$;

revoke execute on function public.console_handoffs() from anon;
grant execute on function public.console_handoffs() to authenticated;
