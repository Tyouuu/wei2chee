-- 🔴 故意弄坏：把他收到的那一张钞票整个记成收入。
-- **单独推一次**（重点 31 第三条）。下一支 20260906850000 原样搬回去。
--
-- 它该红的那一条是 `check:counter` 的②：
--   🔴 帐上记的是 RM 8.20，不是他手上那张 RM 10
-- —— 而一间店一天两百笔，每一笔都多算找出去的那几块。

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

  take := coalesce(in_paid_cents, 0);  /* 🔴 弄坏：把他手上那张钞票整个记成收入 */

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
