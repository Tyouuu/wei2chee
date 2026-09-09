-- 🔴 故意弄坏，看它红（[重点 31] 第 3 条）。**单独推一次**。
--
-- 把「效期最早的先出」倒过来 —— 变成先用最新的那一批。
--
-- 坏起来的样子：快过期那几支**永远轮不到**，放到过期整批丢掉，
-- 而新的那一批一直在被消耗。一间店一年丢掉的染膏就是这样来的。
-- 🔴 而这一次弄坏要证明的是**另一件事**：
-- 沙龙那一边跟医美那一边**共用同一份挑法** ——
-- 所以 `check:backbar` 跟 `check:treatments` **会一起红**。
-- 两份的那一天，「哪一批快过期」就会因为她走了哪一条路而不同。
-- 20260910090000 把它原样搬回去。

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
   order by b.expiry_on desc nulls last, b.received_on, b.code
   limit 1;
$$;


revoke execute on function public.pick_batch(uuid, numeric) from public, anon;
grant execute on function public.pick_batch(uuid, numeric) to authenticated;
