-- 盘点：架上数到 84，系统说 91。
--
-- ── 这是 catalog 那个零件今天唯一的洞 ────────────────────────────────────
--
-- 20260901070000 的档尾自己写着答案：
--
--   「AND THERE IS NO 「correct the quantity」 FUNCTION. On purpose…
--     move_stock in the other direction with reason 「盘点」 is the whole answer.」
--
-- 对的 —— **而没有任何一个画面呼叫得到它**。grep 全仓库，`move_stock`
-- 只有一个 caller：新增一个货品时那一次开帐数量。
-- 所以一个货品建好之后，**它的数量就再也改不动了**：破了三包水泥、
-- 少算了两箱、上个月盘点差七个 —— 一个都记不进去。
--
-- 而库存这件事的性质是**它一定会飘**。一个记不了差异的库存，
-- 三个月之后就是一个没有人再看的数字。
--
-- ── 🔴 差多少要在资料库里算，不是在浏览器里算 ────────────────────────────
--
-- 浏览器算：读到 91、他数到 84、送一笔「出 7」。
-- 而两个人同时在盘点的时候，两个人都读到 91、两个人都送「出 7」——
-- **架上 84，系统变成 77。**
--
-- 所以这一支**自己读现在有多少**，然后写差额。两个人同时按：
-- 第一个写「出 7」，第二个再读就是 84，差额 0，什么都不写。
-- 跟 20260831050000 那八个人同时按是同一类，而这一次是先想到才写的。
--
-- ── 抄 ERPNext 的 Stock Reconciliation，抄它最小的那一半 ──────────────────
--
-- 他们那张单可以一次盘一整个仓库、还带成本重估。我们这一支是
-- **一个货品、一个数字、一笔差异** —— 因为一个五金店老板的盘点，
-- 是拿着手机站在架子前面一样一样数。
--
-- ⚠️ 而且它**不是一个新的形状**：盘点写出来的还是一笔 `stock_moves`，
-- 跟进货收货写的那几笔一模一样。总数照旧是流水加起来的
-- （20260901070000 的那条判断），所以这一支没有第二个真相。

create or replace function public.count_stock(
  in_item_id uuid,
  in_counted numeric,
  in_reason text default '',
  in_note text default '',
  in_idempotency_key uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  the_project uuid;
  before_qty numeric;
  diff numeric;
  moved public.stock_moves;
  is_en boolean;
  the_reason text;
begin
  select i.project_id into the_project
  from public.catalog_items i
  where i.id = in_item_id and public.works_here(i.project_id);
  if the_project is null then
    raise exception 'no such item in your project';
  end if;

  if in_counted is null or in_counted < 0 then
    raise exception 'a count cannot be negative';
  end if;

  /* 🔴 自己读，不要相信浏览器送来的那个数字。见档头 ——
     两个人同时盘点的时候，那是唯一挡得住的地方。 */
  select coalesce(s.on_hand, 0) into before_qty
  from public.stock_on_hand s where s.item_id = in_item_id;
  before_qty := coalesce(before_qty, 0);

  diff := in_counted - before_qty;

  /* 数出来跟系统一样 —— **什么都不写**，而且要讲出来。
     写一笔 0 的流水，是在他的帐上加一行没有发生过的事。 */
  if diff = 0 then
    return jsonb_build_object('before', before_qty, 'counted', in_counted, 'moved', 0);
  end if;

  /* 🔴 那个词跟着**这个系统自己的语言**走，不是写死中文。
     前端传得出他自己的词就用他的（每一行生意讲法不一样）；
     传不出来才退回这两个。一个英文系统里的「盘点」，
     是[重点 22d] 讲的那件事：他会以为那是产品的毛病。 */
  the_reason := nullif(btrim(coalesce(in_reason, '')), '');
  if the_reason is null then
    select p.system_language = 'en' into is_en
      from public.projects p where p.id = the_project;
    the_reason := case when is_en then 'Stocktake' else '盘点' end;
  end if;

  moved := public.move_stock(
    in_item_id := in_item_id,
    in_direction := case when diff > 0 then 'in' else 'out' end,
    in_qty := abs(diff),
    in_reason := the_reason,
    in_note := left(coalesce(in_note, ''), 2000),
    in_idempotency_key := in_idempotency_key
  );

  return jsonb_build_object(
    'before', before_qty,
    'counted', in_counted,
    'moved', diff,
    'move_id', moved.id,
    'doc_no', moved.doc_no
  );
end;
$$;

revoke execute on function public.count_stock(uuid, numeric, text, text, uuid) from public, anon;
grant execute on function public.count_stock(uuid, numeric, text, text, uuid) to authenticated;

comment on function public.count_stock(uuid, numeric, text, text, uuid) is
  'A stocktake: he counts the shelf, this writes the DIFFERENCE as one movement. Reads the current on-hand itself so two people counting at once cannot both write the full difference. See 20260904050000.';
