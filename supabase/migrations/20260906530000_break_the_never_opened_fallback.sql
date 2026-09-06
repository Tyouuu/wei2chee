-- 🔴 故意弄坏：拿掉「从来没登入过就算从开户那天起」那一句。
-- **单独推一次**（重点 31 第三条）。
--
-- 它坏掉的时候长什么样子：**一个从来没有打开过系统的客户
-- 从那张名单上消失** —— 而他正好是最该打那一通电话的那一个。

create or replace function public.console_quiet_customers(
  in_days integer default 30
)
returns table (
  project_id uuid,
  business_name text,
  email text,
  last_seen_at timestamptz,
  days_quiet integer,
  stage text,
  enquiries_this_month bigint
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
  if coalesce(in_days, 0) < 1 or in_days > 365 then
    raise exception 'ask for between 1 and 365 days';
  end if;

  return query
  select
    p.id, p.business_name, a.email, u.last_sign_in_at,
    /* 从来没有登入过的算成「从开户到今天」—— 一个 null 排在最后
       会让最该打电话的那一个看不见。 */
    (public.today_myt() - u.last_sign_in_at::date)::integer,
    p.stage,
    (select count(*) from public.site_enquiries e
      where e.project_id = p.id
        and e.created_at >= date_trunc('month', public.today_myt()::timestamptz))
  from public.projects p
  join public.accounts a on a.id = p.account_id
  left join auth.users u on u.id = a.id
  where a.role = 'customer'
    and public.today_myt() - u.last_sign_in_at::date >= in_days
  order by (public.today_myt() - u.last_sign_in_at::date) desc;
end;
$$;
