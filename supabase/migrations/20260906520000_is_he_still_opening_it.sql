-- 他还在不在开 —— 后台那两栏。
--
-- ── 为什么是这两栏（[任务 133](#133) 自己写下来的）──────────────────
-- 「**续约率不是一个指标，它就是这盘生意本身**：
--   续得高他每年只要签几个新的；续得低他每年要重签四十个 ——
--   那不叫生意，那叫一份工。」
--
-- 而续约那一天**太晚了** —— 到那天才知道，已经没得救。
-- 能提早看的是：**他还在不在开**。三个月不打开的客户，第十二个月不会续。
--
-- 而 console 今天数的是线索 · 客户 · 营收 · 阶段 · 模块 ——
-- **没有一栏在数「他上一次打开是什么时候」跟「这个月官网进来几笔」**。
-- [任务 133](#133) 那一行 `- [ ] console 加两栏` 就是这一支。
--
-- ── 🔴 为什么是这两栏，不是别的 ────────────────────────────────────
--   · **最后一次登入** —— 他还在不在用。**问 auth 自己那一栏**，
--     不自己再记一次（自己记就是同一件事两个答案）
--   · **这个月的询价** —— [重点 9c](./founder-points.md) 那根最深的柱子是
--     「**钱跟客人从那里进来**」。一个官网上个月进来五笔、这个月零笔的客户，
--     不是不满意，是那条线断了 —— 而那是续约之前唯一看得到的讯号
--
-- ⚠️ 而它**只加不改** —— 原本那十七栏一栏都没有动，
-- 画面那一边照旧读得到（[重点 31](./founder-points.md)：先做「加」）。
-- ⚠️ 回传的表多两栏 = 签名变了 → **先 drop**（同一条第二项）。
--
-- ⚠️ 而这一份数字要到五个客户以上才拿得来做决定
-- （[任务 43](#43) 立过同一条规矩，那一段照旧成立）。

drop function if exists public.console_customers();

create or replace function public.console_customers()
returns table (
  project_id uuid,
  account_id uuid,
  email text,
  business_name text,
  owner_name text,
  industry_name text,
  industry_name_en text,
  style text,
  paid boolean,
  stage text,
  dev_fee_myr integer,
  monthly_fee_myr integer,
  page_count bigint,
  founder_note text,
  created_at timestamptz,
  updated_at timestamptz,
  /* 🔴 新的两栏，加在最后 —— 中间插一栏会把每一个照位置读的地方错开。 */
  last_seen_at timestamptz,
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

  return query
  select
    p.id, a.id, a.email, p.business_name, p.owner_name,
    i.name_zh, i.name_en, p.style, p.paid, p.stage, p.dev_fee_myr, p.monthly_fee_myr,
    (select count(*) from public.project_pages pp where pp.project_id = p.id),
    p.founder_note, p.created_at, p.updated_at,
    /* 问 auth 自己那一栏 —— 我们不另外记一次。 */
    u.last_sign_in_at,
    (select count(*) from public.site_enquiries e
      where e.project_id = p.id
        and e.created_at >= date_trunc('month', public.today_myt()::timestamptz))
  from public.projects p
  join public.accounts a on a.id = p.account_id
  left join auth.users u on u.id = a.id
  left join public.leads l on l.id = a.lead_id
  left join public.industries i on i.id = l.industry_id
  where a.role = 'customer'
  order by p.updated_at desc nulls last, p.created_at desc;
end;
$$;

revoke execute on function public.console_customers() from public, anon;
grant execute on function public.console_customers() to authenticated;


/* 整间公司一眼看得到的那一句：**有几个客户超过三十天没有开过。**
   🔴 三十天是**一个写下来的门槛**，而这一次它站得住:
   一个月不开一次的老板，那个系统已经不在他每天要做的事里面了。
   ⚠️ 而它不挡任何东西、不发任何讯息 —— 它只是一个数字，
   让他知道要打哪几通电话。 */
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

revoke execute on function public.console_quiet_customers(integer) from public, anon;
grant execute on function public.console_quiet_customers(integer) to authenticated;

comment on function public.console_quiet_customers(integer) is
  'Task 133: renewal is the business, and the renewal date is too late to learn anything. The early signal is whether he still opens it.';
