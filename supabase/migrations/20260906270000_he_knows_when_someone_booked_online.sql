-- 有人在官网上订了时段，而他不知道。
--
-- 交接那一份（[任务 204] · [206]）数出的六条链，第一条「预约」断掉的第一节
-- 就是这一句：**老板不知道有人订了**。而它今天真的一个地方都没有 ——
-- `appointments.source` 从 20260902030000 就分得出「官网来的」跟「他自己打的」
-- （那一份报告写「没有来源」是错的，量过了，来源在），
-- **缺的只有「他看过没有」**。
--
-- 🔴 而它不开新表，也不做第三套机制:
--   · 询价那一边 20260828070000 已经解过一次（`site_enquiries.status`），
--     照它的形状做
--   · 「客人按了同意」**不做第二个** —— 20260906130000 的 `agreed_unpaid`
--     已经在讲那件事，而且它讲的是可以动手的那一半（同意了而且还没付订金）。
--     再加一个「你还没看过这个同意」就是同一个问题两个答案
--
-- 所以只有一栏 ＋ 一支，而且那一栏**只对官网来的有意义** ——
-- 他自己在柜台打进去的那一笔，他本来就知道。

alter table public.appointments
  add column if not exists seen_at timestamptz,
  add column if not exists seen_by uuid references auth.users(id) on delete set null;

comment on column public.appointments.seen_at is
  '他看过这一笔了没有。只对 source = website 的有意义 -- 他自己打进去的那一笔他本来就知道。See 20260906270000.';

create index if not exists appointments_unseen_idx
  on public.appointments (project_id, starts_at)
  where source = 'website' and seen_at is null and status <> 'cancelled';


/* 照 20260828070000 那一支的形状：**一次全部标掉，不收参数**。
   他打开的是那一份清单，不是某一笔 —— 一笔一笔按是一个他不会做的动作。 */
create or replace function public.mark_bookings_seen(in_project_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  touched integer;
begin
  /* 🔴 `sees_money`，不是 `works_here`。
     一个师傅按掉那个徽章，老板就再也不知道有人订过 ——
     而那是这条链上他唯一会收到的讯号。
     ⚠️ 而**看**是 works_here（前台要知道今天谁要来）——
     看得到跟按得掉是两件事。 */
  if not public.sees_money(in_project_id) then
    raise exception 'that is not yours to clear';
  end if;

  update public.appointments a
     set seen_at = now()
   where a.project_id = in_project_id
     and a.source = 'website'
     and a.seen_at is null;

  get diagnostics touched = row_count;
  return touched;
end;
$$;

revoke execute on function public.mark_bookings_seen(uuid) from public, anon;
grant execute on function public.mark_bookings_seen(uuid) to authenticated;
