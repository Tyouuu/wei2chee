-- 🔴 我在同一个 session 里，把刚修好的那个洞又造了一次 —— 换一种形状。
--
-- 20260906270000 给 `appointments` 加了 `seen_at` 跟 `seen_by`，而
-- `seen_by references auth.users(id) on delete set null` 让那个帐号又删不掉了。
-- 资料库的原话（第三支临时探针）:
--
--     23503 | insert or update on table "appointments"
--             violates foreign key constraint "appointments_project_id_fkey"
--
-- ⚠️ 这一次跟 20260906150000 那一次**不是同一个毛病**，值得分清楚:
--   · 那一次是**守卫开火**（P0001，我自己 raise 的）
--   · 这一次是**外键重新验证**（23503，Postgres 自己）——
--     cascade 把 project 删掉之后，那一句 set null 还是对着 appointments
--     发了一次 update，而 update 会重验 `project_id` 那个外键，
--     这时候那家公司已经不在了
--
-- 🔴 而正确的修法不是再加一层放行，是**问那一栏值不值得存**:
--   「谁按掉了那个徽章」—— 没有人会问这一句。
--   `seen_at`（看过没有）答得了这条链上全部的问题。
--
-- **少一栏，少一个外键，少一种删不掉的方式。**（[重点 7d-2]）

alter table public.appointments drop column if exists seen_by;

comment on column public.appointments.seen_at is
  '他看过这一笔了没有。只对 source = website 的有意义。故意不记「谁按的」-- 没有人会问那一句，而那一栏会让一家公司关不掉。See 20260906300000.';

drop function if exists public.probe_delete_user_5(uuid);

/* 那一支跟着改 —— 从 20260906270000 原样抽出来，只拿掉那一栏。 */
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
