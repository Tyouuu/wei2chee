-- 改回去 —— 只锁已经过完的月份。
--
-- 20260905750000 那一版连还在进行的月份也锁，单独推过、单独跑过，红出来两条：
--
--     FAIL  🔴 这个月签了字，钱照样进得来 — period_locked: 2026-09 …
--     FAIL  而且它老实讲这个月没锁 — true
--
-- 🔴 **而这两条正好是一道「收紧」真正的危险长什么样**：不是挡不住，
-- 是**挡到了不该挡的**，而画面上只会写「存不了」。
-- 那一笔在真实世界里是客人从付款连结付进来的钱 —— **钱收到了而记不进去**。
--
-- ⚠️ 底下这一段是**从 20260905740000 原样搬回来的**，不是照记忆重打。

create or replace function public.period_lock_hit(
  in_project_id uuid,
  in_on date,
  in_direction text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reconciliations r
    where r.project_id = in_project_id
      and r.settled_at is not null
      and r.archived_at is null
      and r.period = date_trunc('month', in_on)::date
      /* ① 只锁已经过完的月份。 */
      and r.period < date_trunc('month', public.today_myt())::date
      /* ② 只锁他签过的那一边。 */
      and (r.direction = 'net' or r.direction = in_direction)
  );
$$;

revoke execute on function public.period_lock_hit(uuid, date, text)
  from public, anon, authenticated, service_role;
