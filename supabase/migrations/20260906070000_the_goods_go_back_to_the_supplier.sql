-- 退给供应商 — 货送回去，而且我不用付那一笔。
--
-- [任务 208] 做完客户那一边的时候自己写着为什么做不了这一半：
-- 「钱那一半今天没有地方落」。20260906020000 之后那个地方有了。
--
-- 它是同一件事的镜像，所以用**同一张表**，不开第二张：
-- 一张退货就是「这一单退了什么、退了多少钱」，卖跟买差的只有方向。
--
-- 🔴 而方向是**从那张单自己算出来的**，不是一个参数 —
-- 呼叫端挑错一次，架上的数字就反了，而那是没有人用眼睛看得出来的。
--
-- 四支一起改，因为少任何一支都会让同一个问题有两个答案：
--   · `is_returnable_module`  放行进货单（**放宽**）
--   · `record_return`          方向 · 批号 · 那句拒绝全部跟着那张单走
--   · `drop_return`            **把每一笔原样反过来**，不写死方向
--   · `purchase_match` / `party_payables`  退过的那一部分不用付
--
-- ⚠️ 四支都是从**最后一次定义它的那个档案**原样抽出来改一段，
-- 不是照记忆重打。整支重打漏守卫，这个仓库咬过三次。

create or replace function public.is_returnable_module(k text)
returns boolean
language sql
immutable
as $$
  /* 卖的那三种，加上买的那一种。
     🔴 这是**放宽**（[重点 31]）：本来拒绝的现在放行，所以先问一句
     「原本那条守卫在保护什么」-- 它保护的正是「退给供应商做不了，
     因为钱那一半没有地方落」。20260906020000 之后那个地方有了。 */
  select k in ('quotations', 'orders', 'projects', 'purchases');
$$;

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
  buying boolean;
  came text;
  went text;
  code text;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null or not public.works_here(rec.project_id) then
    raise exception 'no such document in your project';
  end if;
  if not public.is_returnable_module(rec.module_key) then
    raise exception 'this page does not take returns — a return is against something you sold or bought';
  end if;

  /* 🔴 **方向从那张单自己算出来，不是从一个参数。**
     一张进货单退货 = 货**送回给供应商**（架上少几件）+ 我欠他的少多少；
     一张卖的单退货 = 货**回到架上** + 他欠我的少多少。
     写成参数的话，呼叫端挑错一次，架上的数字就反了 —
     而那是没有人用眼睛看得出来的（[任务 123]：装修师傅不知道自己应该有几包）。 */
  buying := rec.module_key = 'purchases';
  came := case when buying then 'in' else 'out' end;   -- 它当初怎么进来的
  went := case when buying then 'out' else 'in' end;   -- 退货那一笔往哪走
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
        raise exception '% — % of % already came back',
          case when buying then 'more than arrived on that line'
               else 'more than was sold on that line' end,
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
      from public.stock_moves m where m.line_id = ln.id and m.direction = came;
      select coalesce(sum(m.qty), 0) into back_qty
      from public.stock_moves m where m.line_id = ln.id and m.direction = went;
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
        where m.line_id = ln.id and m.direction = came and m.batch_id is not null;
        if want > 1 then
          raise exception 'that line went out on more than one batch — say which one is coming back';
        end if;
        select b.code into code
        from public.stock_moves m
        join public.stock_batches b on b.id = m.batch_id
        where m.line_id = ln.id and m.direction = came
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
        went, take,
        case
          when buying and is_en then 'Returned to supplier'
          when buying then '退回供应商'
          when is_en then 'Returned'
          else '退货'
        end,
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

create or replace function public.drop_return(in_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $fn$
declare
  ret public.returns;
  rec public.pipeline_records;
  m public.stock_moves;
  shelf text;
  is_en boolean;
  n integer := 0;
begin
  select * into ret from public.returns where id = in_id;
  if ret.id is null or not public.works_here(ret.project_id) then
    raise exception 'no such return in your project';
  end if;
  select * into rec from public.pipeline_records where id = ret.record_id;
  select p.system_language = 'en' into is_en
    from public.projects p where p.id = ret.project_id;

  select pp.page_key into shelf
  from public.project_pages pp
  where pp.project_id = ret.project_id and public.is_catalog_module(pp.page_key)
  order by pp.sort_order nulls last
  limit 1;

  /* 🔴 **把每一笔原样反过来，不要写死方向。**
     本来这里写的是「找方向是 in 的那几笔，写一笔 out」-- 那句话
     假设了退货永远是「货回到架上」。供应商那一边正好相反。
     反转它自己的方向，两边都对，而且以后多一种单也不用回来改。 */
  for m in select * from public.stock_moves where return_id = in_id
  loop
    insert into public.stock_moves (
      project_id, item_id, branch_id, doc_no, direction, qty, reason,
      against_id, line_id, batch_id, moved_on, recorded_by
    ) values (
      m.project_id, m.item_id, m.branch_id,
      public.next_doc_no(m.project_id, coalesce(shelf, 'inventory')),
      case when m.direction = 'in' then 'out' else 'in' end, m.qty,
      case when is_en then 'Return undone' else '退货撤销' end,
      m.against_id, m.line_id, m.batch_id, public.today_myt(), auth.uid()
    );
    n := n + 1;
  end loop;

  delete from public.returns where id = in_id;
  return n;
end;
$fn$;

create or replace function public.purchase_match(in_record_id uuid)
returns table (
  ordered_cents bigint,
  paid_cents bigint,
  unpaid_cents bigint,
  lines_total integer,
  lines_arrived integer,
  arrived boolean,
  overpaid_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec public.pipeline_records;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  /* 🔴 `sees_money`，不是 `works_here`：这一支回的是他付了多少给供应商，
     跟开销那一页是同一件事。 */
  if rec.id is null or not public.sees_money(rec.project_id) then
    raise exception 'no such document in your project';
  end if;
  if rec.module_key <> 'purchases' then
    raise exception 'only a purchase order is matched this way';
  end if;

  ordered_cents := coalesce(rec.amount_cents, 0);

  /* 付了多少 —— 分摊到这张单上的、真的出去的钱。
     冲正过的、跟自己是冲正的都不算，跟 party_debts 同一条规矩。 */
  select coalesce(sum(a.amount_cents), 0)::bigint into paid_cents
  from public.ledger_allocations a
  join public.ledger_entries e on e.id = a.entry_id
  where a.record_id = in_record_id
    and e.direction = 'out'
    and e.adjusts_id is null
    and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id);

  /* 🔴 退回去的那一部分不用付了。少了这一句，一张退了一半的
     进货单还写着欠全额 -- 跟 20260905870000 对客户那一边补的是同一句。 */
  unpaid_cents := greatest(
    ordered_cents - public.record_credited(in_record_id) - paid_cents, 0);
  overpaid_cents := greatest(paid_cents - ordered_cents, 0);

  /* 到了多少。**按行算**，因为一张单上常常是一半到了一半没到。
     ⚠️ 只数**有数量**的行 —— 一口价那种行（「运费 RM 300」）
     架上没有东西要动，把它算成「没到」会让每一张单都对不上。 */
  select count(*)::integer into lines_total
  from public.record_lines l
  where l.record_id = in_record_id and coalesce(l.qty, 0) > 0;

  select count(distinct m.line_id)::integer into lines_arrived
  from public.stock_moves m
  where m.against_id = in_record_id and m.line_id is not null;

  /* 一张单上一行都没有的时候（他只写了一个总额），
     「到了没有」看那张单自己走到哪一步 —— 而不是回一个假的 true。 */
  if lines_total = 0 then
    arrived := exists (
      select 1 from public.stock_moves m where m.against_id = in_record_id
    );
  else
    arrived := lines_arrived >= lines_total;
  end if;

  return next;
end;
$$;

create or replace function public.party_payables(in_project_id uuid)
returns table (
  party_id uuid,
  ordered_cents bigint,
  paid_cents bigint,
  owed_cents bigint,
  open_docs integer,
  oldest_days integer
)
language sql
stable
security definer
set search_path = public
as $$
  with live as (
    select r.id, r.party_id, coalesce(r.amount_cents, 0) as worth, r.issued_on as since
    from public.pipeline_records r
    where r.project_id = in_project_id
      and r.module_key = 'purchases'
      and r.party_id is not null
      and r.archived_at is null
      and coalesce(r.amount_cents, 0) > 0
  ),
  paid as (
    select a.record_id, sum(a.amount_cents) as taken
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where e.project_id = in_project_id
      /* 🔴 只有出去的钱算付过供应商。 */
      and e.direction = 'out'
      /* 冲正过的、跟自己是冲正的，都不算付出去。
         同一条规矩写在 lib/portal/allocations.ts 的 countsAsReceived。 */
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
    group by a.record_id
  ),
  credited as (
    /* 🔴 退回去给他的货，我不用付那一笔了。
       跟 20260905870000 对客户那一边补的是同一句。 */
    select t.record_id, sum(t.credit_cents) as given
    from public.returns t
    where t.project_id = in_project_id
    group by t.record_id
  ),
  outstanding as (
    select l.party_id,
           l.worth,
           coalesce(p.taken, 0) as taken,
           greatest(l.worth - coalesce(c.given, 0) - coalesce(p.taken, 0), 0) as still_owed,
           l.since
    from live l
    left join paid p on p.record_id = l.id
    left join credited c on c.record_id = l.id
  )
  select o.party_id,
         sum(o.worth)::bigint,
         sum(o.taken)::bigint,
         sum(o.still_owed)::bigint,
         count(*) filter (where o.still_owed > 0)::integer,
         /* 最老的那一张**还没付清**的单，几天。付清的不算 --
            一张三年前付清的单不该让这一家看起来欠了三年。 */
         max(
           case when o.still_owed > 0 and o.since is not null
                then (public.today_myt() - o.since)
                else null end
         )::integer
  from outstanding o
  join public.directory_entries d on d.id = o.party_id
  /* 🔴 `sees_money`，不是 `works_here` -- 跟 `party_debts` 同一条:
     这一支是 security definer，所以它绕过 RLS，而「我欠人家多少」
     是老板一个人的事。 */
  where public.sees_money(in_project_id)
  group by o.party_id
  having sum(o.still_owed) > 0;
$$;
