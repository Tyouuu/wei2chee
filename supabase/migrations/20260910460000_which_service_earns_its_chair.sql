-- 哪一样服务做得最多、赚得最多 —— 跟货架那件事同一个骨架，换成服务。
--
-- ── 为什么（founder 2026-09-10,[重点 35]）───────────────────────────────
--
-- 排查[任务 359] 那件事的时候量到的第二个洞,跟货架分析一模一样的形状：
-- `appointment_lines`（20260910010000）一次来访记得下做了哪几样、
-- 多少钱,**而从来没有人把那些行堆起来问一句「哪一样最常做、赚最多」**。
-- `RankList` 只排过「谁欠我最多钱」——一间沙龙真正想知道的还有
-- 「客人最常点的是哪一项」「哪一项该多排一点时段给它」。
--
-- ── 只用已经在的资料,跟 product_performance 同一个判准 ─────────────────
--
-- 服务是他自己的话（洗 · 剪 · 染,从来不是一个代号,20260910010000 档头
-- 写得很清楚),这里就照他打的原字堆——不猜一套分类,他打「染」跟打
-- 「染发」是两行,这是老实的读法，不是没做完：**堆错比不堆更贵**。
--
-- 🔴 `sees_money`,不是 `works_here`——这一支带着金额（跟 `visit_earnings`
-- 同一条,20260910010000 那一支已经这样判过)，一个美发师不用知道
-- 哪一项赚最多钱，那是老板排时段、排价钱要用的数字。
--
-- 只数**做完的**那几次（跟 `visit_earnings` 同一条：还没来的客人身上的
-- 生意是一个愿望）。

create or replace function public.service_performance(
  in_project_id uuid,
  in_days int default 30
)
returns table (
  service text,
  times_done bigint,
  total_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sees_money(in_project_id) then
    return;
  end if;

  return query
  select
    l.service,
    count(*)::bigint,
    coalesce(sum(l.price_cents), 0)::bigint
  from public.appointment_lines l
  join public.appointments a on a.id = l.appointment_id
  where l.project_id = in_project_id
    and a.archived_at is null
    and a.status = 'done'
    and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date
        > public.today_myt() - greatest(1, coalesce(in_days, 30))
  group by l.service
  order by count(*) desc, l.service;
end;
$$;

revoke execute on function public.service_performance(uuid, int) from public, anon;
grant execute on function public.service_performance(uuid, int) to authenticated;

comment on function public.service_performance(uuid, int) is
  'Which service he actually did the most in the window, and what it earned -- his own words, grouped as typed, never reclassified. sees_money-gated like visit_earnings, and only counts finished visits for the same reason. See 20260910460000.';
