-- 故意弄坏：连**还在进行的那个月**也锁。
--
-- 拿掉的是 20260905740000 那条规矩 ①。红出来的样子，就是一道收紧真正会造成
-- 的那种伤害 —— **不是挡不住，是挡到不该挡的**：
--
--     FAIL  🔴 这个月签了字，钱照样进得来 — period_locked: 2026-09 …
--
-- 而那一笔在真实世界里是**客人从付款连结付进来的钱**
-- （`settle_payment_request`，日子不是任何人挑的）。挡下去就是
-- **钱收到了而记不进去**，比一个会动的总数糟得多。
--
-- ⚠️ **单独推一次** —— 弄坏跟改回去在同一次推送里，红的那一刻没有人看得到
--    （重点 31 第三条）。20260905760000 改回去。

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
      /* ② 只锁他签过的那一边。 */
      and (r.direction = 'net' or r.direction = in_direction)
  );
$$;

revoke execute on function public.period_lock_hit(uuid, date, text)
  from public, anon, authenticated, service_role;
