-- 一件没有分批的货，退回来的时候炸掉。
--
-- plpgsql 的 `record` 变数指派 `null` 之后**还是「未指派」** ——
-- 读它任何一栏都会 raise `record "lot" is not assigned yet`。
-- 而这条路每一件没有批号的货都会走到（也就是绝大多数五金店的货）。
--
-- 🔴 `db push` 一句话都没讲，`create or replace` 也照样成功 ——
-- 抓到它的是**拿真的登入身分打了一次**（重点 26 第 N 次成立）。
--
-- ⚠️ 这一支是从 20260905840000 **原样抽出来**改那三行的，不是照记忆重打。
-- 「整支重写」在这个仓库咬过三次（20260831080000 的防重复 ·
-- 20260905370000 的分店守卫 · 20260905330000 的分批出货）。

create or replace function public.record_return(
  in_record_id uuid,
  /* [{line_id, qty, amount_cents?, batch_code?}] —— 形状跟 deliver_record 的
     `in_lines` 一样，因为出货跟退货是同一件事的两个方向。
     null 或者空阵列 = 只退钱不退货（沙龙退一次服务）。 */
  in_lines jsonb default null,
  in_credit_cents bigint default 0,
  in_reason text default '',
  in_returned_on date default null,
  in_note text default '',
  in_idempotency_key uuid default null
)
returns table (
  return_id uuid,
  back integer,          -- 几行真的放回架上
  not_out integer,       -- 🔴 几行退的比真的出去过的多
  unknown integer,       -- 几行找不到那件货
  skipped integer,       -- 几行没有数量（一口价那种）
  credit_cents bigint
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  rec public.pipeline_records;
  shelf text;
  ret public.returns;
  said jsonb;
  ln public.record_lines;
  item public.catalog_items;
  lot_id uuid;
  want numeric;
  take numeric;
  out_qty numeric;
  back_qty numeric;
  already numeric;
  n_back integer := 0;
  n_not_out integer := 0;
  n_unknown integer := 0;
  n_skipped integer := 0;
  credited_already bigint;
  is_en boolean;
  code text;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null or not public.works_here(rec.project_id) then
    raise exception 'no such document in your project';
  end if;
  if not public.is_returnable_module(rec.module_key) then
    raise exception 'this page does not take returns — a return is against something you sold';
  end if;
  if rec.archived_at is not null then
    raise exception 'this one is put away — take it back out before recording a return against it';
  end if;

  select p.system_language = 'en' into is_en
    from public.projects p where p.id = rec.project_id;

  /* 按两下只进一笔 —— 柜台上按两次是常态，不是错。 */
  if in_idempotency_key is not null then
    select * into ret from public.returns
    where project_id = rec.project_id and idempotency_key = in_idempotency_key;
    if ret.id is not null then
      return query
        select ret.id, 0, 0, 0, 0, ret.credit_cents;
      return;
    end if;
  end if;

  /* 🔴 抄他们的第 ② 条：**退的钱不能高过单上的钱**（扣掉已经退过的）。
     少了它，一笔退货就是一条凭空生出钱的路 ——
     而它会一路走到「他还欠我多少」上面去。 */
  credited_already := public.record_credited(in_record_id);
  if coalesce(in_credit_cents, 0) > 0
     and credited_already + in_credit_cents > coalesce(rec.amount_cents, 0) then
    raise exception 'that is more than this document is worth — % has already been credited of %',
      (credited_already / 100.0), (coalesce(rec.amount_cents, 0) / 100.0);
  end if;

  insert into public.returns (
    record_id, project_id, returned_on, reason, credit_cents, note,
    idempotency_key, recorded_by
  ) values (
    in_record_id, rec.project_id,
    coalesce(in_returned_on, public.today_myt()),
    coalesce(btrim(in_reason), ''),
    greatest(coalesce(in_credit_cents, 0), 0),
    coalesce(btrim(in_note), ''),
    in_idempotency_key, auth.uid()
  )
  returning * into ret;

  select pp.page_key into shelf
  from public.project_pages pp
  where pp.project_id = rec.project_id and public.is_catalog_module(pp.page_key)
  order by pp.sort_order nulls last
  limit 1;

  if in_lines is not null then
    for said in select x from jsonb_array_elements(in_lines) x
    loop
      select * into ln from public.record_lines
      where id = (said->>'line_id')::uuid and record_id = in_record_id;
      if ln.id is null then
        n_unknown := n_unknown + 1;
        continue;
      end if;

      take := coalesce((said->>'qty')::numeric, 0);
      if take <= 0 then
        n_skipped := n_skipped + 1;
        continue;
      end if;

      /* 🔴 抄他们的第 ① 条：不能退比卖出去的多，含已经退过的。 */
      select coalesce(sum(l.qty), 0) into already
      from public.return_lines l where l.line_id = ln.id;
      if already + take > coalesce(ln.qty, 0) then
        raise exception 'more than was sold on that line — % of % already came back',
          already, coalesce(ln.qty, 0);
      end if;

      insert into public.return_lines (
        return_id, project_id, line_id, description, qty, unit,
        amount_cents, batch_code, sort_order
      ) values (
        ret.id, rec.project_id, ln.id, ln.description, take, ln.unit,
        greatest(coalesce((said->>'amount_cents')::bigint, 0), 0),
        nullif(btrim(coalesce(said->>'batch_code', '')), ''),
        ln.sort_order
      );

      if shelf is null then
        n_skipped := n_skipped + 1;
        continue;
      end if;

      /* 🔴 **架上只加回真的出去过的那部分。**
         一张还没交货的单退三件，加回去就是凭空生出三件货 ——
         而凭空多出来的货跟真的到货长得一模一样。
         钱那一半照记（他可能就是要给一个折让），然后讲出来。 */
      select coalesce(sum(m.qty), 0) into out_qty
      from public.stock_moves m where m.line_id = ln.id and m.direction = 'out';
      select coalesce(sum(m.qty), 0) into back_qty
      from public.stock_moves m where m.line_id = ln.id and m.direction = 'in';
      if out_qty - back_qty < take then
        n_not_out := n_not_out + 1;
        continue;
      end if;

      item := null;
      if ln.item_id is not null then
        select * into item from public.catalog_items where id = ln.item_id;
      end if;
      if item.id is null then
        select * into item
        from public.catalog_items
        where project_id = rec.project_id
          and module_key = shelf
          and archived_at is null
          and lower(btrim(name)) = lower(btrim(ln.description))
        order by created_at
        limit 1;
      end if;
      if item.id is null then
        n_unknown := n_unknown + 1;
        continue;
      end if;

      /* 🔴 **回哪一批**：他指名了就用那一批；没指名就回它出去的那一批。
         出去的时候只用了一批 → 回那一批，不用问；
         出去的时候拆了两批 → **问他**（跟盘点分不清哪一间店、
         盘点分不清哪一批，是同一条：有规则的地方照规则，
         没有规则的地方问他）。 */
      code := nullif(btrim(coalesce(said->>'batch_code', '')), '');
      if code is null then
        select count(distinct m.batch_id) into want
        from public.stock_moves m
        where m.line_id = ln.id and m.direction = 'out' and m.batch_id is not null;
        if want > 1 then
          raise exception 'that line went out on more than one batch — say which one is coming back';
        end if;
        select b.code into code
        from public.stock_moves m
        join public.stock_batches b on b.id = m.batch_id
        where m.line_id = ln.id and m.direction = 'out'
        limit 1;
      end if;

      lot_id := null;
      if code is not null then
        select b.id into lot_id from public.stock_batches b
        where b.item_id = item.id and b.code = code and b.archived_at is null
        limit 1;
        if lot_id is null then
          raise exception 'no batch % on that item', code;
        end if;
      end if;

      insert into public.stock_moves (
        project_id, item_id, branch_id, doc_no, direction, qty, reason,
        against_id, line_id, batch_id, return_id, moved_on, recorded_by
      ) values (
        rec.project_id, item.id, rec.branch_id,
        public.next_doc_no(rec.project_id, shelf),
        'in', take,
        case when is_en then 'Returned' else '退货' end,
        in_record_id, ln.id, lot_id, ret.id,
        coalesce(in_returned_on, public.today_myt()), auth.uid()
      );
      n_back := n_back + 1;
    end loop;
  end if;

  return query
    select ret.id, n_back, n_not_out, n_unknown, n_skipped, ret.credit_cents;
end;
$fn$;

revoke execute on function public.record_return(uuid, jsonb, bigint, text, date, text, uuid)
  from public, anon;
grant execute on function public.record_return(uuid, jsonb, bigint, text, date, text, uuid)
  to authenticated;
