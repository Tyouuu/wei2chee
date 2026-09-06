-- 柜台：扫码 · 找零 · 一按就结帐。
--
-- 他 2026-09-06 问「柜台那一屏能做到吗」。
-- **那一屏是画面那一边的**，而它底下这一半是这一支。
--
-- ---------------------------------------------------------------------------
-- 🔴 一笔柜台交易今天要打四次
-- ---------------------------------------------------------------------------
--   开一张单 → 写几行 → 出货（架上扣掉）→ 记一笔钱
-- 而柜台一天做两百笔。[重点 29](../docs/founder-points.md)：能不要他做的动作就不要他做。
--
-- ⚠️ **底下还是那四支** —— 单号 · 阶段 · 连到客户 · 防重复 · 分店守卫 ·
-- 卖价 · 批号先进先出 · 序号要讲哪一台 · 自动分摊，
-- 九样全部住在那四支里面（[重点 23](../docs/founder-points.md)：不准另开一条写入路径）。
--
-- ---------------------------------------------------------------------------
-- 🔴 三个判断，写下来
-- ---------------------------------------------------------------------------
-- ① **进帐记的是 min(收到的, 总额)，不是收到的那一张钞票。**
--    他收 RM 50、找回 RM 2，进这门生意的是 RM 48。
--    记 50 会让他今天的收入每一笔都多算找出去的那几块。
--
-- ② **付不够照样成交，然后讲出来。** 五金店的老客户赊数是真的事，
--    而挡下去他就在系统外面卖（跟额度不挡单 · 架上不够照样出货同一条）。
--    那张单会自己留在「谁欠我钱」上面。
--
-- ③ **一分钱都没付就不记帐** —— 一笔 RM 0 的收款，看起来像一笔真的收款。
--
-- ⚠️ 而**收据**是那张纸，打印是画面那一边；这一支只把该印的东西凑齐。

-- ---------------------------------------------------------------------------
-- 1. 扫一下
-- ---------------------------------------------------------------------------
-- 🔴 **完全相符，不是开头相符**：扫描枪送的是一整串码，
-- 而一个开头相符会回两件货 —— 那是一个停在柜台的收银员。
-- `suggest_items` 那一支照旧是开头相符：它是**给人打字用的**，不是给枪用的。
create or replace function public.scan_item(
  in_project_id uuid,
  in_code text
)
returns table (
  item_id uuid,
  name text,
  unit text,
  price_cents bigint,
  on_hand numeric,
  location text,
  tracks_serial boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.name, i.unit, i.price_cents,
         coalesce((
           select sum(case when m.direction = 'in' then m.qty else -m.qty end)
           from public.stock_moves m where m.item_id = i.id
         ), 0),
         i.location,
         coalesce(i.tracks_serial, false)
  from public.catalog_items i
  where i.project_id = in_project_id
    and i.archived_at is null
    and public.works_here(in_project_id)
    and btrim(coalesce(in_code, '')) <> ''
    and lower(btrim(i.sku)) = lower(btrim(in_code))
  limit 1;
$$;

revoke execute on function public.scan_item(uuid, text) from public, anon;
grant execute on function public.scan_item(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 一按结帐
-- ---------------------------------------------------------------------------
create or replace function public.ring_up_sale(
  in_project_id uuid,
  in_module_key text,
  in_lines jsonb,
  /* 他手上收到的那一张钞票。0 = 赊数。 */
  in_paid_cents bigint default 0,
  in_method text default '',
  in_party text default '',
  in_party_id uuid default null,
  in_branch_id uuid default null,
  in_title text default '',
  /* 🔴 柜台就是会按两下的地方。同一把钥匙 = 同一笔交易。 */
  in_idempotency_key uuid default null
)
returns table (
  record_id uuid,
  doc_no text,
  /* 这一篮多少钱 —— 明细加起来的，不是他打的。 */
  total_cents bigint,
  /* 他收到多少。 */
  paid_cents bigint,
  /* 🔴 找他多少 —— **在这里算，不在画面上算**：
     同一个问题两个答案，这个仓库栽过至少八次。 */
  change_cents bigint,
  /* 还欠多少（付不够的时候）。 */
  owed_cents bigint,
  /* 架上真的扣掉几行 · 不够的几行。 */
  moved integer,
  short integer,
  /* 这一按有没有真的做事 —— 按两下的第二下是 false。 */
  rang boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.pipeline_records;
  had_lines integer;
  total bigint;
  take bigint;
  n_moved integer := 0;
  n_short integer := 0;
  did boolean := true;
begin
  if not public.works_here(in_project_id) then
    raise exception 'that project is not yours';
  end if;
  if in_lines is null or jsonb_array_length(in_lines) = 0 then
    raise exception 'a sale needs at least one line';
  end if;
  if coalesce(in_paid_cents, 0) < 0 then
    raise exception 'money taken cannot be negative';
  end if;

  /* ① 开一张单 —— 单号 · 阶段 · 连到客户全部住在那一支里面。 */
  select * into rec from public.add_pipeline_record(
    in_project_id => in_project_id,
    in_module_key => in_module_key,
    in_title => left(btrim(coalesce(in_title, '')), 200),
    in_party => coalesce(in_party, ''),
    in_party_id => in_party_id,
    in_branch_id => in_branch_id,
    in_idempotency_key => in_idempotency_key
  );

  /* 🔴 按两下：同一把钥匙拿回来的是同一张单。
     那张单上已经有行了，就**什么都不再做** ——
     再写一次行会把已经出过的货的锚点断掉（20260905050000 付过一次学费）。 */
  select count(*) into had_lines
  from public.record_lines l where l.record_id = rec.id;

  if had_lines > 0 then
    did := false;
  else
    /* ② 写几行 —— 卖价 · 单位 · 指到架上哪一件，都在那一支里面。 */
    perform public.set_record_lines(rec.id, in_lines);

    /* ③ 出货 —— 架上自己扣掉。批号先进先出、序号要讲哪一台，
       两条守卫都住在那一支里面。
       ⚠️ `in_lines => null` 是「这张单剩下的全部送完」，
       而柜台本来就是一次全部拿走。 */
    select d.moved, d.short into n_moved, n_short
    from public.deliver_record(
      in_record_id => rec.id,
      in_idempotency_key => in_idempotency_key
    ) d;
  end if;

  /* 这一篮多少钱 —— **明细加起来的**。他打的那个总额不算数：
     一个跟明细对不上的总额，就是那张纸自己在打架（任务 155 量过一次）。 */
  select coalesce(sum(l.amount_cents), 0) into total
  from public.record_lines l where l.record_id = rec.id;

  take := least(coalesce(in_paid_cents, 0), total);

  /* ④ 记一笔钱 —— `in_against_id` 会自己写一笔分摊（20260906030000）。
     ⚠️ 一分都没付就不记：一笔 RM 0 的收款看起来像一笔真的收款。 */
  if did and take > 0 then
    perform public.add_ledger_entry(
      in_project_id => in_project_id,
      in_module_key => 'payments',
      in_direction => 'in',
      in_amount_cents => take,
      in_party => coalesce(in_party, ''),
      in_party_id => in_party_id,
      in_against_id => rec.id,
      in_method => left(btrim(coalesce(in_method, '')), 40),
      in_branch_id => in_branch_id,
      in_idempotency_key => in_idempotency_key
    );
  end if;

  return query
  select rec.id,
         rec.doc_no,
         total,
         coalesce(in_paid_cents, 0),
         /* 🔴 找零 = 收到的 − 这一篮，不会是负数。 */
         greatest(coalesce(in_paid_cents, 0) - total, 0)::bigint,
         /* 🔴 还欠 = 这一篮 − 收到的，也不会是负数。 */
         greatest(total - coalesce(in_paid_cents, 0), 0)::bigint,
         coalesce(n_moved, 0),
         coalesce(n_short, 0),
         did;
end;
$$;

revoke execute on function public.ring_up_sale(
  uuid, text, jsonb, bigint, text, text, uuid, uuid, text, uuid
) from public, anon;
grant execute on function public.ring_up_sale(
  uuid, text, jsonb, bigint, text, text, uuid, uuid, text, uuid
) to authenticated;

comment on function public.ring_up_sale(
  uuid, text, jsonb, bigint, text, text, uuid, uuid, text, uuid
) is
  'One press at the counter: opens the order, writes the lines, takes the stock off the shelf and books the money — through the four functions a person presses, not around them. Income is min(taken, basket) so the change handed back is not counted as takings. Under-paying is allowed and shows up as owed. See 20260906830000.';
