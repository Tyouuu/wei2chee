-- 把 20260910080000 倒过来的那一句排回去。
--
-- ⚠️ **原样从 20260910070000 抽出来**（[重点 31] 第 1 条）。
--
-- 弄坏那一版红出来的 —— **两把尺一起红**，而那正是这一次要证明的：
--   check:backbar     FAIL  🔴 少的是快过期那一批（3 → 1）
--   check:treatments  FAIL  （医美那一边同一件事）

create or replace function public.pick_batch(
  in_item_id uuid,
  in_qty numeric
)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  /* 效期最早、而且**还够**的那一支。排法逐字来自 20260906120000 的出货那一段 ——
     两个地方给的答案要一样。找不到就回 null：那一笔照样记，
     而不假装它属於某一批。 */
  select b.id
    from public.stock_batches b
   where b.item_id = in_item_id
     and b.archived_at is null
     and coalesce((
           select sum(case when m.direction = 'in' then m.qty else -m.qty end)
             from public.stock_moves m where m.batch_id = b.id
         ), 0) >= in_qty
   order by b.expiry_on nulls last, b.received_on, b.code
   limit 1;
$$;


revoke execute on function public.pick_batch(uuid, numeric) from public, anon;
grant execute on function public.pick_batch(uuid, numeric) to authenticated;
