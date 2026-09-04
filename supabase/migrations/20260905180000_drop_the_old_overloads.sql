-- 🔴 加一个有预设的参数 = 多一个多载，不是改一个函式。
--
-- 20260905170000 给 `move_stock` 跟 `count_stock` 各加了一个
-- `in_branch_id uuid default null`，而 `create or replace` **只认签名** ——
-- 参数个数变了就不是同一支，於是旧的那两支还留在库里。
--
-- PostgREST 当场讲得很清楚：
--
--   Could not choose the best candidate function between:
--     public.count_stock(in_item_id, in_counted, in_reason, in_note, in_idempotency_key),
--     public.count_stock(in_item_id, in_counted, in_reason, in_note, in_idempotency_key, in_branch_id)
--
-- 结果是**库存那一整条线当场瘫掉**：开帐进不去、盘点打不了，
-- 而这个错跟「功能坏了」在画面上长得一模一样。
--
-- ⚠️ 这个仓库**已经有一条守卫在守这件事**（20260904010000：签名变了才必须
-- drop 旧的），而我把那句话读成了「参数的型别或顺序变了」。
-- **多一个有预设的参数也是签名变了** —— 那是最容易读漏的一种，
-- 因为它对呼叫端是相容的，对资料库不是。
drop function if exists public.move_stock(
  uuid, text, numeric, text, uuid, date, bigint, text, jsonb, uuid
);
drop function if exists public.count_stock(uuid, numeric, text, text, uuid);
