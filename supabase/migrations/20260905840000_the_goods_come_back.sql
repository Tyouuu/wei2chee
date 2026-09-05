-- 退货：客人拿回来了。
--
-- ── 先读别人真的表 ────────────────────────────────────────────────────────
--
-- ERPNext 的退货读了原文（`sales_and_purchase_return.py` · 两份 doctype）：
-- 一张退货是**一份全新的单据**，`is_return = 1` ＋ `return_against` 指着原单，
-- 数量是**负的**；而它拆成**两份**——「送货退」把货放回去，「贷记单」把钱冲掉。
--
-- 🔴 **那两份对我们不成立，而理由是写在 20260905570000 里的**：
-- 他们是权责发生制，所以退货要同时冲销货收入跟应收；
-- **我们是收付实现制** —— 收入是钱进来那一刻算的，退货没有收入要冲。
-- 剩下的只有两件真的事：**架上多了几件** · **他欠的少了多少**。
--
-- 所以这里是**一张挂在原单上的记录**，跟 `deliveries` 同一个形状 ——
-- 不是第三种单据（[重点 7d-2]：读完之后要挑最简单那一版）。
--
-- ── 抄他们四条，每一条都有理由 ────────────────────────────────────────────
--
--   ① **不能退比卖出去的多**（含已经退过的）—— 他们的 `validate_quantity`
--   ② 🔴 **退的钱不能高过单上的钱** —— 他们那句
--      「Rate cannot be greater than the rate used in ...」。
--      少了它，退货就是一条**凭空生出钱**的路
--   ③ **每一行指着原本那一行** —— 不然「已经退过几件」是猜的
--   ④ 同一个客人 —— 我们不用检查，它长在那张单上
--
-- ── 不抄的四条 ────────────────────────────────────────────────────────────
--
--   · **负数量。** `stock_moves` 的注解写过为什么：一个打错的减号是隐形的，
--     而在货这一边比在钱那一边更糟 —— 凭空多出来的货，
--     跟真的到货长得一模一样。他们自己那句
--     「At least one item should be entered with negative quantity」
--     就是负数量带出来的
--   · **`per_returned` 存成一栏。** 退了几成是**数出来的** ——
--     这个 schema 判过九次同一条：架上几件 · 过期 · 帐龄 · 保养到期 ·
--     里程 · 批号剩几件 · 租借逾期几天 · 税额 · 逾期几天
--   · **单号。** `deliveries` 也没有，而且理由一样：一笔退货挂在一张
--     有号码的单上，「QT-2026-0001 九月五号那一笔」认得出来。
--     ⚠️ 哪天电子发票要一个贷记单号，那时候它才赚到那个号码
--   · 序号／批号那一整套 bundle
--
-- ── 🔴 只有客人那一边 ─────────────────────────────────────────────────────
--
-- 退给**供应商**（五金店把破的货退回去）是同一件事的镜像，**这一支没有做**，
-- 而理由不是懒：钱那一半**今天没有地方落** —— 「我欠供应商多少」
-- 全仓库没有任何地方算得出来（[任务 81] 记着供应商那一页的「未付」是空的）。
-- 做一半会变成「货退回去了，而帐上他还欠人家全额」。
--
-- ── ⚠️ 它还不是什么 ──────────────────────────────────────────────────────
--
--   · 画面上没有那一段（这是底下那一层）
--   · 不通知客人（卡在同一条管道）
--   · 不碰成本 —— 退回来的货用什么价入帐是会计那一层

-- ── 哪几种单退得了 ────────────────────────────────────────────────────────
--
-- 报价单 · 订单 · 工程 —— 客人本来就是另一方的那几种。
-- `purchases` 是买的那一边（见上面）；`tasks` 是内部的，没有人退一件任务。
create or replace function public.is_returnable_module(k text)
returns boolean
language sql
immutable
as $$
  select k in ('quotations', 'orders', 'projects');
$$;

comment on function public.is_returnable_module(text) is
  '客人那一边的单。买那一边要先有「我欠供应商多少」才做得了，见 20260905840000 档头。';

-- ── 一笔退货 ──────────────────────────────────────────────────────────────
create table if not exists public.returns (
  id uuid primary key default gen_random_uuid(),

  /* 原本那张单。Cascade：一笔退货离开它就没有意思了。 */
  record_id uuid not null references public.pipeline_records(id) on delete cascade,

  /* 跟每一张表一样反正规化，让 RLS 不用每一次 join。触发器守着它。 */
  project_id uuid not null references public.projects(id) on delete cascade,

  returned_on date not null default public.today_myt(),

  /* 🔴 **他自己的词**：尺寸不对 · 破了 · 多买了 · 客人改主意。
     不是 enum —— 跟 `stage`、`category`、`reason` 同一条。
     一份下拉会把他真正的理由挤掉，而那个理由正是他下个月要读的东西。 */
  reason text not null default '',

  /* 退多少钱 —— 存起来，不是从行加出来的。
     `record_lines.amount_cents` 的注解写过同一条理由：
     当天谈好的一个折让是真的，而 qty × price 讲不出来。
     一笔**没有货**的退款（沙龙退一次服务）在这里也表达得了。 */
  credit_cents bigint not null default 0 check (credit_cents >= 0),

  note text not null default '',

  /* 按两下只进一笔。 */
  idempotency_key uuid,

  recorded_by uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists returns_record_idx on public.returns (record_id, returned_on desc);
create index if not exists returns_project_idx on public.returns (project_id, returned_on desc);
create unique index if not exists returns_idem_idx
  on public.returns (project_id, idempotency_key) where idempotency_key is not null;

-- ── 退回来的那几行 ────────────────────────────────────────────────────────
create table if not exists public.return_lines (
  id uuid primary key default gen_random_uuid(),
  return_id uuid not null references public.returns(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 🔴 指着原本那一行 —— 这就是「已经退过几件」查得到的全部诀窍
     （抄 ERPNext 的第 ③ 条）。原单的行整批换掉的时候设成 null，
     那时候那一笔退货还在，只是不再指得回去。 */
  line_id uuid references public.record_lines(id) on delete set null,

  description text not null,
  qty numeric(14, 3) not null check (qty > 0),
  unit text not null default '',
  amount_cents bigint not null default 0,

  /* 他指名退回哪一批。空的时候照原本出去那一批（见 record_return）。 */
  batch_code text,

  sort_order integer not null default 0,
  created_at timestamptz not null default now()
);

create index if not exists return_lines_return_idx on public.return_lines (return_id, sort_order);
create index if not exists return_lines_line_idx
  on public.return_lines (line_id) where line_id is not null;

-- 那几笔进货是这一笔退货造成的。
-- ⚠️ **set null 不是 cascade** —— 删掉一笔退货不可以静静地把架上的数字改写，
-- 那是 `stock_moves.against_id` 当初选 set null 的同一条理由。
alter table public.stock_moves
  add column if not exists return_id uuid references public.returns(id) on delete set null;

create index if not exists stock_moves_return_idx
  on public.stock_moves (return_id) where return_id is not null;

-- ── 权限 ──────────────────────────────────────────────────────────────────
--
-- 🔴 `works_here`，不是 `sees_money`。**柜台那个人就是收退货的人** ——
-- 而这张表上确实有一个金额，那是刻意的取舍：一笔退货的钱就是这张单的一部分，
-- 跟 `pipeline_records.amount_cents` 一样师傅本来就看得到。
-- 真正只有老板看得到的是**「他还欠多少」**，而那住在 `party_debts`（sees_money）。
alter table public.returns enable row level security;
drop policy if exists "returns_members" on public.returns;
create policy "returns_members" on public.returns
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

alter table public.return_lines enable row level security;
drop policy if exists "return_lines_members" on public.return_lines;
create policy "return_lines_members" on public.return_lines
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

-- 🔴 那一笔属於那张单的那一家 —— 两个 id 各自都合法，外键挡不住。
create or replace function public.returns_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $fn$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from public.pipeline_records where id = new.record_id;
  if owner_project is null then
    raise exception 'no such document';
  end if;
  new.project_id := owner_project;
  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists returns_own_project_trg on public.returns;
create trigger returns_own_project_trg
  before insert or update of record_id, project_id on public.returns
  for each row execute function public.returns_own_project();

create or replace function public.return_lines_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $fn$
declare
  owner_project uuid;
begin
  select project_id into owner_project from public.returns where id = new.return_id;
  if owner_project is null then
    raise exception 'no such return';
  end if;
  new.project_id := owner_project;
  return new;
end;
$fn$;

drop trigger if exists return_lines_own_project_trg on public.return_lines;
create trigger return_lines_own_project_trg
  before insert or update of return_id, project_id on public.return_lines
  for each row execute function public.return_lines_own_project();

-- ── 这张单退过多少 ────────────────────────────────────────────────────────
--
-- 数出来的，不是存起来的（见档头第二条不抄的）。
create or replace function public.record_credited(in_record_id uuid)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(t.credit_cents), 0)::bigint
  from public.returns t
  join public.pipeline_records r on r.id = t.record_id
  where t.record_id = in_record_id
    and public.works_here(r.project_id);
$$;

revoke execute on function public.record_credited(uuid) from public, anon;
grant execute on function public.record_credited(uuid) to authenticated;

-- ── 记一笔退货 ────────────────────────────────────────────────────────────
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
  lot record;
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

      lot := null;
      if code is not null then
        select b.* into lot from public.stock_batches b
        where b.item_id = item.id and b.code = code and b.archived_at is null
        limit 1;
        if lot.id is null then
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
        in_record_id, ln.id, lot.id, ret.id,
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

-- ── 这张单退过哪几笔 ──────────────────────────────────────────────────────
create or replace function public.returns_of(in_record_id uuid)
returns table (
  id uuid,
  returned_on date,
  reason text,
  credit_cents bigint,
  note text,
  lines jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id, t.returned_on, t.reason, t.credit_cents, t.note,
         coalesce((
           select jsonb_agg(jsonb_build_object(
                    'id', l.id, 'lineId', l.line_id, 'description', l.description,
                    'qty', l.qty, 'unit', l.unit, 'amountCents', l.amount_cents,
                    'batchCode', l.batch_code)
                  order by l.sort_order, l.created_at)
           from public.return_lines l where l.return_id = t.id
         ), '[]'::jsonb)
  from public.returns t
  join public.pipeline_records r on r.id = t.record_id
  where t.record_id = in_record_id
    and public.works_here(r.project_id)
  order by t.returned_on desc, t.created_at desc;
$$;

revoke execute on function public.returns_of(uuid) from public, anon;
grant execute on function public.returns_of(uuid) to authenticated;

-- ── 撤销一笔退货 ──────────────────────────────────────────────────────────
--
-- 🔴 跟「收起一趟货」（20260905500000）不一样，这一支**真的会把货再拿出去**。
-- 那一支不敢动，是因为一趟收错有两种情况（根本没出去 · 出去了但记在另一张单上）
-- 而它分不出是哪一种。这里分得出来：那几笔进货身上写着 `return_id`。
--
-- **写反方向的一笔，不是删掉那几笔。** 一本会掉行的流水帐答不了
-- 「为什么是 84」，而那是这本帐存在的唯一理由。
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

  for m in select * from public.stock_moves where return_id = in_id and direction = 'in'
  loop
    insert into public.stock_moves (
      project_id, item_id, branch_id, doc_no, direction, qty, reason,
      against_id, line_id, batch_id, moved_on, recorded_by
    ) values (
      m.project_id, m.item_id, m.branch_id,
      public.next_doc_no(m.project_id, coalesce(shelf, 'inventory')),
      'out', m.qty,
      case when is_en then 'Return undone' else '退货撤销' end,
      m.against_id, m.line_id, m.batch_id, public.today_myt(), auth.uid()
    );
    n := n + 1;
  end loop;

  delete from public.returns where id = in_id;
  return n;
end;
$fn$;

revoke execute on function public.drop_return(uuid) from public, anon;
grant execute on function public.drop_return(uuid) to authenticated;
