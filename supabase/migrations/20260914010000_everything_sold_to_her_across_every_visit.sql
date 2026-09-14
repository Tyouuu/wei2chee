-- 客户那一页问的是「我们卖过什么给她」，不是某一笔预约问的「这一次做了什么」。
--
-- ── 为什么要多一支，不是把 `visit_lines_of` 改宽 ──────────────────────────
--
-- `visit_lines_of`（20260910010000）答的是**一笔预约**底下有哪几行——
-- 老板站在某一张预约前面问「这一次做了什么」。这一支答的是**一个客人**
-- 名下所有预约的所有行加起来——老板站在客户那一页问「上次跟以前
-- 都卖过她什么」。同一张表，两个不同的问题（[重点 31] 第 1 条：
-- 加一支答新问题，不去改老的那一支）。
--
-- 手写簿上这本来就是一件事：柜台一页页往前翻这个客人的旧记录，
-- 看她上次做了什么、买了什么。`appointment_lines` 不分「服务」跟
-- 「零售商品」——洗剪吹跟一瓶带回家的洗发精，在这张表上是同一种行
-- （做什么 · 谁做 · 多少钱），跟一间沙龙真的收银条一样，不假装
-- 分得清楚一件我们数据里从来没有分开过的事。
create or replace function public.visit_lines_for_party(
  in_project_id uuid,
  in_party_id uuid
)
returns table (
  id uuid,
  service text,
  staff_id uuid,
  staff_name text,
  price_cents bigint,
  on_date date,
  appointment_id uuid
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.service, l.staff_id, coalesce(d.name, ''), l.price_cents,
         a.starts_at::date, a.id
    from public.appointment_lines l
    join public.appointments a on a.id = l.appointment_id
    left join public.directory_entries d on d.id = l.staff_id
   where a.project_id = in_project_id
     and a.party_id = in_party_id
     and public.works_here(in_project_id)
   order by a.starts_at desc, l.sort_order, l.created_at;
$$;

revoke execute on function public.visit_lines_for_party(uuid, uuid) from public, anon;
grant execute on function public.visit_lines_for_party(uuid, uuid) to authenticated;

comment on function public.visit_lines_for_party(uuid, uuid) is
  'Every appointment_line ever recorded against this customer, most recent visit first. Services and retail products both live in appointment_lines with no flag to tell them apart, so this answers the honest question the data can answer ("what have we done/sold her, across every visit") rather than inventing a product/service split that does not exist. See 20260914010000.';
