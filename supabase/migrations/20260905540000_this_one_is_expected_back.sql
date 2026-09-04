-- 押金 · 租赁 —— 器材租借 · 婚纱 · 桌椅帐篷 · 工地鹰架
--
-- ## 先去找别人的 schema，而这一次**找不到**
--
-- 照 [重点 26] 去读别人真的表，结果是一份空的：
--
--   · **Odoo 的租赁是 Enterprise 的** —— `odoo/enterprise` 是私有 repo
--     （[任务 68] 已经撞过一次），读不到
--   · GitHub 上 star 最多的开源租赁系统是 **2 颗星**；MIT 那一个
--     （DeliveryDevs-ERP/Rental-Management）打开是中东重机车队的东西 ——
--     CICPA 通行证 · 机票配额 · 司机轮班。不是我们这一行
--   · ERPNext 核心根本没有租赁这个 doctype
--
-- 🔴 **而这跟 [任务 63] 量到的是同一条规律**：钱 · 排程 · 库存 · 租赁 ——
-- 商业价值最高的那几块，作者要嘛闭源要嘛 AGPL。
-- 反过来看：**如果它随便拿得到，每一个对手早就都有了。**
--
-- 所以这一支是自己设计的，判准只有一条：**那个老板真正在问哪一句话。**
--
-- ## 他问的是「东西」，不是「钱」
--
--   > **「这几样东西现在在谁那里、几时要还、逾期了没有？」**
--
-- 而**押金那一半这个 schema 已经有了，不要做第二份**：
-- 一笔收进来还没分摊出去的钱，就是押金（[任务 131]，`amount − allocated`）。
-- 所以这张表**不存金额** —— 它只指着那一笔，钱永远只有一个答案。
--
-- ⚠️ 而那条边界自己会守：金额住在 `ledger_entries`（`sees_money`），
-- 这张表是 `works_here` —— 师傅交货收货看得到东西，看不到押金多少。
--
-- ## 🔴 而「借出去」几乎是白捡的：架上自己会少一件
--
-- `item_id` 填了就走 `move_stock`（人按的那一支，[重点 23]）——
-- 一件婚纱借出去，架上那一件当场变 0，**所以没有人订得了第二次**。
-- 那不是多写的功能，那是把租赁挂在既有零件上顺手拿到的。
--
-- ## 故意不做：按天算租金
--
-- 每一套租赁软件都在算 `天数 × 日租`。做那件事要一张费率表 ·
-- 一套进位规则 · 週末算不算 —— 而**逾期三天要不要收钱是他的判断**，
-- 不是一条公式。跟额度不挡单 · 架上不够照样出货同一条：
-- **我们讲事实（逾期三天），判断留给他。**

create table if not exists public.rentals (
  id uuid primary key default gen_random_uuid(),

  /* 借出去是哪一张单的事。cascade：单没了它没有意义。 */
  record_id uuid not null references public.pipeline_records(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 架上那一件。**可以是空的** —— 一件婚纱、一套音响，
     很多租赁的东西根本没有建成一件货品，而逼他先建才借得出去，
     就是他不用这一页的理由。填了就顺手动库存。 */
  item_id uuid references public.catalog_items(id) on delete set null,

  /* 借出去的是什么。永远有 —— 没有货品卡的时候它就是唯一的答案。 */
  descr text not null,

  qty numeric(14, 3) not null default 1 check (qty > 0),

  out_on date not null default public.today_myt(),

  /* 该几时还。空的是一个真的答案：「用完再讲」也是这一行会写的合约。 */
  due_back_on date,

  /* 🔴 还了没有 —— **一个日期，不是一个勾**。
     空的就是还在外面。而「逾期几天」是**算出来的**（today − due_back_on），
     不存 —— 一个存起来的逾期天数，隔天就在说谎。
     跟架上有几件 · 过期 · 帐龄 · 保养到期日 · 车子里程 · 一批还剩几件
     同一条判断，这是第七次。 */
  returned_on date,

  /* 🔴 押金那一笔，**指着它，不存金额**。
     一笔收进来还没分摊的钱就是押金（[任务 131]），
     存一份金额在这里就是同一件事两个答案，而它们迟早会不一样。 */
  deposit_entry_id uuid references public.ledger_entries(id) on delete set null,

  note text not null default '',

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz,
  idempotency_key uuid,

  constraint rentals_back_after_out check (returned_on is null or returned_on >= out_on)
);

create unique index if not exists rentals_idem_idx
  on public.rentals (record_id, idempotency_key) where idempotency_key is not null;
create index if not exists rentals_out_idx
  on public.rentals (project_id, due_back_on) where returned_on is null and archived_at is null;
create index if not exists rentals_doc_idx
  on public.rentals (record_id, out_on desc);

comment on table public.rentals is
  'One thing lent out and expected back. Carries no money: the deposit is an unallocated ledger entry (任务 131) and this row only points at it, so the amount has exactly one answer. Overdue is computed, never stored. See 20260905540000.';
comment on column public.rentals.item_id is
  'Optional. When set, lending moves stock out and returning moves it back -- so a single gown cannot be double-booked. Many rentals (a gown, a PA system) were never made into catalog items and must still be lendable.';
comment on column public.rentals.deposit_entry_id is
  'Points at the incoming deposit payment. Never a stored amount -- 任务 131 already answers 「还没用完的订金」 from amount - allocated.';

alter table public.rentals enable row level security;

drop policy if exists "rentals_members" on public.rentals;
create policy "rentals_members" on public.rentals
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

create or replace function public.rentals_own_project()
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

drop trigger if exists rentals_own_project_trg on public.rentals;
create trigger rentals_own_project_trg
  before insert or update on public.rentals
  for each row execute function public.rentals_own_project();

-- ── 借出去 ────────────────────────────────────────────────────────────────

create or replace function public.lend_item(
  in_record_id uuid,
  in_descr text,
  in_qty numeric default 1,
  in_item_id uuid default null,
  in_out_on date default null,
  in_due_back_on date default null,
  in_deposit_entry_id uuid default null,
  in_note text default '',
  in_idempotency_key uuid default null
)
returns public.rentals
language plpgsql
security definer
set search_path = public
as $fn$
declare
  rec public.pipeline_records;
  item public.catalog_items;
  dep public.ledger_entries;
  shelf text;
  row public.rentals;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null or not public.works_here(rec.project_id) then
    raise exception 'no such document in your project';
  end if;

  /* 借得出去的只有这两种：一张订单 · 一件工程（工地上的鹰架挂在那一件工程上）。 */
  if rec.module_key not in ('orders', 'projects') then
    raise exception 'only an order or a job lends things out';
  end if;

  if coalesce(btrim(in_descr), '') = '' then
    raise exception 'say what went out';
  end if;
  if coalesce(in_qty, 0) <= 0 then
    raise exception 'a lend of nothing is not a lend';
  end if;
  if in_out_on is not null and in_out_on > public.today_myt() then
    raise exception 'it cannot have gone out in the future';
  end if;
  if in_due_back_on is not null and in_due_back_on < coalesce(in_out_on, public.today_myt()) then
    raise exception 'it cannot be due back before it went out';
  end if;

  if in_item_id is not null then
    select * into item from public.catalog_items
     where id = in_item_id and project_id = rec.project_id and archived_at is null;
    if item.id is null then
      raise exception 'no such item on your shelf';
    end if;
  end if;

  /* 🔴 押金那一笔一定要是**这一家**的，而且是**收进来**的。
     指着一笔付出去的钱，会让他的画面写着「押金 RM 500」而那五百是他付的。 */
  if in_deposit_entry_id is not null then
    select * into dep from public.ledger_entries
     where id = in_deposit_entry_id and project_id = rec.project_id;
    if dep.id is null then
      raise exception 'no such payment in your project';
    end if;
    if dep.direction <> 'in' then
      raise exception 'a deposit is money that came in';
    end if;
  end if;

  insert into public.rentals (
    record_id, project_id, item_id, descr, qty, out_on, due_back_on,
    deposit_entry_id, note, created_by, idempotency_key
  ) values (
    in_record_id, rec.project_id, in_item_id,
    left(btrim(in_descr), 200), in_qty,
    coalesce(in_out_on, public.today_myt()), in_due_back_on,
    in_deposit_entry_id, left(coalesce(in_note, ''), 2000),
    auth.uid(), in_idempotency_key
  )
  returning * into row;

  /* 架上那一件当场少一件 —— 走人按的那一支（[重点 23]）。 */
  if item.id is not null then
    select pp.page_key into shelf
    from public.project_pages pp
    where pp.project_id = rec.project_id and public.is_catalog_module(pp.page_key)
    order by pp.sort_order nulls last limit 1;

    if shelf is not null then
      perform public.move_stock(
        in_item_id := item.id,
        in_direction := 'out',
        in_qty := in_qty,
        in_branch_id := rec.branch_id,
        in_reason := left(btrim(in_descr), 60),
        in_note := coalesce(rec.doc_no, ''),
        in_idempotency_key := null
      );
    end if;
  end if;

  return row;
exception
  when unique_violation then
    select * into row from public.rentals
     where record_id = in_record_id and idempotency_key = in_idempotency_key;
    return row;
end;
$fn$;

revoke execute on function public.lend_item(uuid, text, numeric, uuid, date, date, uuid, text, uuid)
  from public, anon;
grant execute on function public.lend_item(uuid, text, numeric, uuid, date, date, uuid, text, uuid)
  to authenticated;

comment on function public.lend_item(uuid, text, numeric, uuid, date, date, uuid, text, uuid) is
  'Lends one thing out against a document. Moves stock out through move_stock when the item exists on the shelf, so a single gown cannot be lent twice. Never stores the deposit amount, only points at the payment. See 20260905540000.';

-- ── 还回来 ────────────────────────────────────────────────────────────────

create or replace function public.return_rental(
  in_rental_id uuid,
  in_returned_on date default null,
  in_qty numeric default null,
  in_note text default null
)
returns public.rentals
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.rentals;
  rec public.pipeline_records;
  shelf text;
  back numeric;
begin
  select * into row from public.rentals where id = in_rental_id;
  if row.id is null or not public.works_here(row.project_id) then
    raise exception 'no such rental in your project';
  end if;

  /* 还过了不给再还 —— 第二次会把同一件东西放回架上两次。 */
  if row.returned_on is not null then
    raise exception 'this one is already back';
  end if;

  if in_returned_on is not null then
    if in_returned_on > public.today_myt() then
      raise exception 'it cannot come back in the future';
    end if;
    if in_returned_on < row.out_on then
      raise exception 'it cannot come back before it went out';
    end if;
  end if;

  /* 🔴 少还了一件也照样收，然后**在纸上留下差多少**。
     挡下去他就不记这一笔，而少的那一件从此没有人知道。
     跟架上不够照样出货同一条：讲事实，判断留给他。 */
  back := coalesce(in_qty, row.qty);
  if back <= 0 or back > row.qty then
    raise exception 'that is not how many went out';
  end if;

  update public.rentals
     set returned_on = coalesce(in_returned_on, public.today_myt()),
         qty = back,
         note = case
           when back < row.qty then
             btrim(coalesce(row.note, '') || ' | short ' || (row.qty - back)::text)
           else coalesce(row.note, '')
         end,
         updated_at = now()
   where id = in_rental_id
  returning * into row;

  if in_note is not null and btrim(in_note) <> '' then
    update public.rentals
       set note = left(btrim(coalesce(note, '') || ' | ' || btrim(in_note)), 2000),
           updated_at = now()
     where id = in_rental_id
    returning * into row;
  end if;

  if row.item_id is not null then
    select * into rec from public.pipeline_records where id = row.record_id;
    select pp.page_key into shelf
    from public.project_pages pp
    where pp.project_id = row.project_id and public.is_catalog_module(pp.page_key)
    order by pp.sort_order nulls last limit 1;

    if shelf is not null then
      perform public.move_stock(
        in_item_id := row.item_id,
        in_direction := 'in',
        in_qty := back,
        in_branch_id := rec.branch_id,
        in_reason := left(btrim(row.descr), 60),
        in_note := coalesce(rec.doc_no, ''),
        in_idempotency_key := null
      );
    end if;
  end if;

  return row;
end;
$fn$;

revoke execute on function public.return_rental(uuid, date, numeric, text) from public, anon;
grant execute on function public.return_rental(uuid, date, numeric, text) to authenticated;

comment on function public.return_rental(uuid, date, numeric, text) is
  'Takes one rental back and puts the stock on the shelf. Accepts a short return and writes the shortfall down rather than refusing it -- refusing is how a missing item stops being recorded at all. See 20260905540000.';

-- ── 现在有什么在外面 ──────────────────────────────────────────────────────
--
-- **逾期的排最前面** —— 一份每次都印全部的清单没有人看
-- （跟 purchase_mismatches · contracts_ending 同一条）。

create or replace function public.rentals_out(in_project_id uuid)
returns table (
  id uuid,
  record_id uuid,
  doc_no text,
  party text,
  descr text,
  qty numeric,
  out_on date,
  due_back_on date,
  days_over integer
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;

  return query
  select r.id, r.record_id, p.doc_no, p.party, r.descr, r.qty, r.out_on, r.due_back_on,
         case
           when r.due_back_on is null then 0
           when r.due_back_on < public.today_myt()
             then (public.today_myt() - r.due_back_on)::integer
           else 0
         end
  from public.rentals r
  join public.pipeline_records p on p.id = r.record_id
  where r.project_id = in_project_id
    and r.returned_on is null
    and r.archived_at is null
    and p.archived_at is null
  order by
    case when r.due_back_on is null then 1 else 0 end,
    r.due_back_on,
    r.out_on;
end;
$fn$;

revoke execute on function public.rentals_out(uuid) from public, anon;
grant execute on function public.rentals_out(uuid) to authenticated;

comment on function public.rentals_out(uuid) is
  'What is still out, overdue first. days_over is computed from the date, never stored -- a stored overdue count is a lie by tomorrow. See 20260905540000.';

create or replace function public.rentals_of(in_record_id uuid)
returns table (
  id uuid,
  descr text,
  qty numeric,
  out_on date,
  due_back_on date,
  returned_on date,
  days_over integer,
  note text
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  the_project uuid;
begin
  select r.project_id into the_project
  from public.pipeline_records r where r.id = in_record_id;
  if the_project is null or not public.works_here(the_project) then
    raise exception 'no such document in your project';
  end if;

  return query
  select r.id, r.descr, r.qty, r.out_on, r.due_back_on, r.returned_on,
         case
           when r.returned_on is not null and r.due_back_on is not null
             and r.returned_on > r.due_back_on
             then (r.returned_on - r.due_back_on)::integer
           when r.returned_on is null and r.due_back_on is not null
             and r.due_back_on < public.today_myt()
             then (public.today_myt() - r.due_back_on)::integer
           else 0
         end,
         r.note
  from public.rentals r
  where r.record_id = in_record_id and r.archived_at is null
  order by r.out_on desc, r.created_at desc;
end;
$fn$;

revoke execute on function public.rentals_of(uuid) from public, anon;
grant execute on function public.rentals_of(uuid) to authenticated;

comment on function public.rentals_of(uuid) is
  'The things lent out on one document. days_over reads late-when-returned for a closed one and late-so-far for an open one -- two different questions that share one column because the owner asks them the same way. See 20260905540000.';

-- ── 🔴 它还不是什么（自己讲，不要等他发现）────────────────────────────────
--
--   · **不算租金** —— 见档头。逾期三天要不要收钱是他的判断
--   · **押金退了没有，这张表答不了** —— 那是帐上的事：
--     退押金就是一笔付出去的钱，走 add_ledger_entry。
--     这张表只负责「东西」，而**钱只有一个答案**是这个 schema 一直在守的东西
--   · **画面上没有那一页** —— 这是底下那一层
--   · **逾期不会自动提醒他** —— 卡在同一条管道（[任务 59]）
