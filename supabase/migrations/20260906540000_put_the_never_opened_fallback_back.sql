-- 把「从来没登入过就算从开户那天起」那一句原样搬回去。
--
-- 20260906530000 拿掉它之后，那张名单回的是 **0 行** ——
-- 一个从来没有打开过系统的客户，在那张“谁安静了”的表上看不见，
-- 而他正好是最该打电话的那一个。
--
-- ⚠️ 从 20260906520000 原样抽出来，不是照记忆重打。

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
    (public.today_myt() - coalesce(u.last_sign_in_at, p.created_at)::date)::integer,
    p.stage,
    (select count(*) from public.site_enquiries e
      where e.project_id = p.id
        and e.created_at >= date_trunc('month', public.today_myt()::timestamptz))
  from public.projects p
  join public.accounts a on a.id = p.account_id
  left join auth.users u on u.id = a.id
  where a.role = 'customer'
    and public.today_myt() - coalesce(u.last_sign_in_at, p.created_at)::date >= in_days
  order by (public.today_myt() - coalesce(u.last_sign_in_at, p.created_at)::date) desc;
end;
$$;
