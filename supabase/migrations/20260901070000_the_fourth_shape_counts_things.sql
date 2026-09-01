-- supabase/migrations/20260901070000_the_fourth_shape_counts_things.sql
--
-- 库存. The fourth shape, and the first one whose numbers are not money.
--
-- ── WHY THIS ONE NEXT ─────────────────────────────────────────────────────
--
-- 「先做ERP就是要做主流的system 一个个主流的system拆解」. Three measurements,
-- not a preference:
--
--   · SQL Account and ERPNext both lead with Stock (任务 67, read off their own
--     feature lists)
--   · 进货单 went live 8-31 and the goods it buys have nowhere to go
--   · one shape lights up 零售 · 批发 · 五金 -- three of the eight trades
--
-- ── WHAT WAS READ FIRST, AND FROM WHERE ──────────────────────────────────
--
-- ERPNext's own doctype JSON (GPL, so this is DESIGN taken and not one line of
-- code -- the same footing as tailark): Item, Stock Ledger Entry, Bin, and
-- UOM Conversion Detail.
--
-- ── 🔴 THE ONE DECISION EVERYTHING ELSE FOLLOWS ──────────────────────────
--
-- HOW MUCH IS LEFT IS NOT A COLUMN. It is the sum of an append-only ledger of
-- movements.
--
-- ERPNext does exactly this and it is worth saying why, because a `qty` column
-- on the item is the obvious design and it is wrong. Stock Ledger Entry holds
-- one signed row per movement; `Bin` -- the per-item running total -- is
-- marked READ ONLY in their own schema, a cache and never a source.
--
-- A stored quantity is a number that anything can write, and unlike money
-- nobody can spot it going wrong by eye: a contractor does not know he should
-- have 84 bags. A ledger answers 「why is it 84」 with a list, which is the only
-- form of that answer anybody can act on.
--
-- ── WHAT IS TAKEN ────────────────────────────────────────────────────────
--
--   1. movements are the truth, the total is derived            (Stock Ledger Entry / Bin)
--   2. every movement names the document that caused it         (voucher_type + voucher_no)
--   3. an item needs almost nothing: a name and a unit          (Item: 180 fields, 3 required)
--   4. buying unit ≠ selling unit, so a pack size is a field    (UOM Conversion Detail)
--   5. a reorder level, so 「快没了」 is a fact and not a feeling  (SQL Account 补货建议)
--
-- ── WHAT IS DELIBERATELY NOT TAKEN, WITH THE REASON ──────────────────────
--
-- · 180 FIELDS. We take ten. Their Item is required to carry an `item_group`;
--   a hardware shop typing his first item does not have a taxonomy, and a
--   required field he cannot answer is a form he closes.
--
-- · VALUATION. `valuation_rate`, `stock_queue`, `stock_value_difference` --
--   FIFO costing is ACCOUNTING, and accounting is behind e-Invoice in the
--   order (任务 71). ⚠️ The place is left: `cost_cents` on the item and on the
--   movement, so the day 成本管理 is wanted the numbers are already there
--   rather than needing a backfill nobody can do.
--
-- · SERIAL NUMBERS. Nobody serialises a bag of cement.
--
-- · A WAREHOUSE TABLE. `branch_id` is already this schema's dimension for
--   「which shop」 (地基决定 2), and 「which shelf」 is a line of text on the page
--   today -- 「仓库 · 箱」. A master table for shelves is a second object
--   nobody has asked for.
--
-- ⚠️ AND WHAT THIS SHAPE IS NOT, SAID OUT LOUD SO NOBODY DISCOVERS IT LATER:
-- nothing moves stock BY ITSELF yet. Receiving a 进货单 does not write a
-- movement, and an 订单 does not take one out. That link is the next piece of
-- work and it is named in the task file rather than half-built here -- this
-- repository's most common failure is a capability whose wire was never
-- connected, and the honest way to ship half is to say which half.

-- ── THE THING ─────────────────────────────────────────────────────────────

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* Which of this business's pages it belongs to. 库存 today; a second catalog
     module (a salon's retail shelf beside its service list) costs nothing. */
  module_key text not null,

  /* A BARE uuid, NO FOREIGN KEY -- the same as pipeline_records and
     ledger_entries. There is no `branches` table yet: 地基决定 2 put the post
     in without building the feature, because a column added later has to be
     backfilled across every historical row and a column that sits null costs
     nothing. Copying that decision rather than inventing a table nobody asked
     for. */
  branch_id uuid,

  /* HIS OWN CODE, and optional. ERPNext requires `item_code` and generates one
     when you leave it blank; a five-man hardware shop calls it 「白水泥」 and
     has no codes at all. Unique per project only when he actually uses them --
     a partial index, the same shape the idempotency key uses. */
  sku text,

  /* The only thing an item cannot be without. */
  name text not null,

  /* 包 · 箱 · 尺 · 桶 · 罐. His word, never an enum -- the same call as `stage`
     and `record_lines.unit`, and here it has a market reason too: this is the
     word that will be printed on his own delivery order. */
  unit text not null default '',

  /* 仓库 · 货车 · 店面. Free text because the page already shows it as free
     text 「仓库 · 箱」, and because a shelf is not a branch. */
  location text not null default '',

  /* 「一箱 = 24 罐」. ERPNext's conversion factor, and 任务 61 named this as the
     field that decides whether a wholesaler's system is real: he buys in 箱
     and sells in 罐. Null when he only ever uses one unit, which is most
     trades. */
  pack_size numeric(14, 3),
  pack_unit text not null default '',

  /* 快没了 becomes a fact rather than a feeling. Null = he does not want to be
     told about this one. */
  reorder_at numeric(14, 3),

  /* Sen, like every other money column here. Both nullable and both unused by
     anything today -- see the note on valuation above. */
  cost_cents bigint,
  price_cents bigint,

  note text not null default '',
  extra jsonb not null default '{}'::jsonb,

  /* Never deleted. A discontinued item still appears on last year's purchase
     orders, and a row that vanishes takes the explanation with it -- the same
     call `directory_entries` and `pipeline_records` already made. */
  archived_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.catalog_items is
  'What this business keeps. THERE IS DELIBERATELY NO QUANTITY COLUMN -- how much is left is the sum of stock_moves. See the header of 20260901070000 for why ERPNext does the same and why a stored number is worse than it looks.';
comment on column public.catalog_items.pack_size is
  'How many `unit` are in one `pack_unit`. 一箱 = 24 罐. The field that decides whether a wholesaler''s system is real (任务 61).';
comment on column public.catalog_items.cost_cents is
  'Unused today, on purpose. Costing is accounting and accounting is behind e-Invoice -- but the column exists now so that the day it is wanted there is history rather than a backfill nobody can do.';

create index if not exists catalog_items_shelf_idx
  on public.catalog_items (project_id, module_key, created_at desc)
  where archived_at is null;

create unique index if not exists catalog_items_sku_idx
  on public.catalog_items (project_id, sku)
  where sku is not null and archived_at is null;

alter table public.catalog_items enable row level security;

create policy "catalog_items_members" on public.catalog_items
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

-- ── THE MOVEMENTS ─────────────────────────────────────────────────────────

create table if not exists public.stock_moves (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* Restrict, not cascade. Deleting an item that has movements would silently
     rewrite how much was ever there -- the same reason a customer with a
     quotation cannot be deleted (vibe-dealer 0011). Archiving is the way out. */
  item_id uuid not null references public.catalog_items(id) on delete restrict,

  branch_id uuid,

  /* A stock adjustment is a voucher: somebody has to be able to point at it
     next month and ask what happened. ST-2026-0001. */
  doc_no text not null,

  /* IN OR OUT, AND THE QUANTITY IS ALWAYS POSITIVE.

     ERPNext signs it (`actual_qty` can be negative). We do not, for the same
     reason `ledger_entries` does not: a mistyped minus sign is invisible, and
     here it is worse than in money -- stock appearing out of nowhere looks
     exactly like stock that arrived. */
  direction text not null check (direction in ('in', 'out')),
  qty numeric(14, 3) not null check (qty > 0),

  /* HIS OWN WORD for why. 进货 · 卖出 · 报损 · 盘点 · 退货. Not an enum: a
     bakery throws away, a hardware shop lends out, a workshop fits parts. */
  reason text not null default '',

  /* WHICH DOCUMENT CAUSED IT -- ERPNext's voucher_type + voucher_no, and here
     the voucher is always a pipeline record (a 进货单 receiving, an 订单
     shipping). Null for a stocktake, which is caused by counting. */
  against_id uuid references public.pipeline_records(id) on delete set null,

  /* What it was worth at that moment. Unused today; see the note on valuation. */
  cost_cents bigint,

  moved_on date not null default public.today_myt(),
  note text not null default '',
  extra jsonb not null default '{}'::jsonb,

  idempotency_key uuid,
  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  unique (project_id, doc_no)
);

comment on table public.stock_moves is
  'Every in and out, append-only. This is where 「how much is left」 actually lives -- catalog_items has no quantity column. Mirrors ERPNext''s Stock Ledger Entry, with in/out instead of a signed number for the same reason ledger_entries uses it.';

create index if not exists stock_moves_item_idx
  on public.stock_moves (item_id, moved_on desc);
create index if not exists stock_moves_doc_idx
  on public.stock_moves (project_id, against_id);
create unique index if not exists stock_moves_idempotency_idx
  on public.stock_moves (project_id, idempotency_key)
  where idempotency_key is not null;

alter table public.stock_moves enable row level security;

create policy "stock_moves_members" on public.stock_moves
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

-- ── WHICH MODULES ARE THIS SHAPE ──────────────────────────────────────────

create or replace function public.is_catalog_module(key text)
returns boolean
language sql
immutable
as $$
  select key in ('inventory');
$$;

comment on function public.is_catalog_module(text) is
  'Kept beside is_pipeline_module / is_ledger_module / is_directory_module, and kept in step with lib/portal/module-catalog.ts by module-catalog.test.ts.';

-- ── HOW MUCH IS LEFT ──────────────────────────────────────────────────────
--
-- A view rather than a cached column. ERPNext caches it in `Bin` because a
-- factory posts millions of movements; a hardware shop posts a few thousand a
-- year, and a cache that can disagree with its source is a class of bug we do
-- not have to buy yet. If it ever gets slow, the fix is a materialised total
-- keyed the same way -- and the ledger stays the source either way.

create or replace view public.stock_on_hand as
  select
    i.id as item_id,
    i.project_id,
    i.module_key,
    i.name,
    i.unit,
    i.location,
    i.reorder_at,
    coalesce(sum(m.qty) filter (where m.direction = 'in'), 0)
      - coalesce(sum(m.qty) filter (where m.direction = 'out'), 0) as on_hand,
    max(m.moved_on) as last_moved_on,
    count(m.id) as moves
  from public.catalog_items i
  left join public.stock_moves m on m.item_id = i.id
  where i.archived_at is null
  group by i.id;

comment on view public.stock_on_hand is
  'The derived total. Never write to it; write a movement. An item with no movements reads 0 rather than null -- 「we have none」 is a true answer and null is not one anybody can act on.';

/* A view runs as the CALLER, so RLS on the two tables underneath decides what
   it returns -- which is exactly right and is why no policy is written here. */
grant select on public.stock_on_hand to authenticated;

-- ── WRITING AN ITEM ───────────────────────────────────────────────────────

create or replace function public.add_catalog_item(
  in_project_id uuid,
  in_module_key text,
  in_name text,
  in_unit text default '',
  in_location text default '',
  in_sku text default '',
  in_pack_size numeric default null,
  in_pack_unit text default '',
  in_reorder_at numeric default null,
  in_cost_cents bigint default null,
  in_price_cents bigint default null,
  in_note text default '',
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null
)
returns public.catalog_items
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.catalog_items;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;
  if not public.is_catalog_module(in_module_key) then
    raise exception 'not a catalog module: %', in_module_key;
  end if;
  if coalesce(btrim(in_name), '') = '' then
    raise exception 'an item needs a name';
  end if;

  if in_idempotency_key is not null then
    select * into row from public.catalog_items
     where project_id = in_project_id and extra->>'idem' = in_idempotency_key::text;
    if found then return row; end if;
  end if;

  insert into public.catalog_items (
    project_id, module_key, name, unit, location, sku,
    pack_size, pack_unit, reorder_at, cost_cents, price_cents, note, extra, created_by
  ) values (
    in_project_id,
    in_module_key,
    left(btrim(in_name), 200),
    left(coalesce(btrim(in_unit), ''), 30),
    left(coalesce(btrim(in_location), ''), 60),
    nullif(left(coalesce(btrim(in_sku), ''), 60), ''),
    in_pack_size,
    left(coalesce(btrim(in_pack_unit), ''), 30),
    in_reorder_at,
    in_cost_cents,
    in_price_cents,
    left(coalesce(in_note, ''), 500),
    case when in_idempotency_key is null then coalesce(in_extra, '{}'::jsonb)
         else coalesce(in_extra, '{}'::jsonb) || jsonb_build_object('idem', in_idempotency_key) end,
    auth.uid()
  )
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.add_catalog_item(
  uuid, text, text, text, text, text, numeric, text, numeric, bigint, bigint, text, jsonb, uuid
) from public;
grant execute on function public.add_catalog_item(
  uuid, text, text, text, text, text, numeric, text, numeric, bigint, bigint, text, jsonb, uuid
) to authenticated;

create or replace function public.update_catalog_item(
  in_id uuid,
  in_name text default null,
  in_unit text default null,
  in_location text default null,
  in_sku text default null,
  in_pack_size numeric default null,
  in_pack_unit text default null,
  in_reorder_at numeric default null,
  in_cost_cents bigint default null,
  in_price_cents bigint default null,
  in_note text default null,
  in_extra jsonb default null
)
returns public.catalog_items
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.catalog_items;
begin
  select * into row from public.catalog_items where id = in_id;
  if row.id is null or not public.works_here(row.project_id) then
    raise exception 'no such item in your project';
  end if;

  /* Null means 「he did not touch this box」, not 「he cleared it」. Clearing is
     an empty string, which is why every text field reads nullif on '' rather
     than treating null as empty -- the same rule update_pipeline_record uses. */
  update public.catalog_items set
    name       = coalesce(left(btrim(in_name), 200), name),
    unit       = coalesce(left(btrim(in_unit), 30), unit),
    location   = coalesce(left(btrim(in_location), 60), location),
    sku        = case when in_sku is null then sku
                      else nullif(left(btrim(in_sku), 60), '') end,
    pack_size  = coalesce(in_pack_size, pack_size),
    pack_unit  = coalesce(left(btrim(in_pack_unit), 30), pack_unit),
    reorder_at = coalesce(in_reorder_at, reorder_at),
    cost_cents = coalesce(in_cost_cents, cost_cents),
    price_cents = coalesce(in_price_cents, price_cents),
    note       = coalesce(left(in_note, 500), note),
    extra      = coalesce(in_extra, extra),
    updated_at = now()
  where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.update_catalog_item(
  uuid, text, text, text, text, numeric, text, numeric, bigint, bigint, text, jsonb
) from public;
grant execute on function public.update_catalog_item(
  uuid, text, text, text, text, numeric, text, numeric, bigint, bigint, text, jsonb
) to authenticated;

create or replace function public.set_catalog_archived(in_id uuid, in_archived boolean default true)
returns public.catalog_items
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.catalog_items;
begin
  select * into row from public.catalog_items where id = in_id;
  if row.id is null or not public.works_here(row.project_id) then
    raise exception 'no such item in your project';
  end if;
  update public.catalog_items
     set archived_at = case when in_archived then now() else null end, updated_at = now()
   where id = in_id
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.set_catalog_archived(uuid, boolean) from public;
grant execute on function public.set_catalog_archived(uuid, boolean) to authenticated;

-- ── MOVING STOCK ──────────────────────────────────────────────────────────

create or replace function public.move_stock(
  in_item_id uuid,
  in_direction text,
  in_qty numeric,
  in_reason text default '',
  in_against_id uuid default null,
  in_moved_on date default null,
  in_cost_cents bigint default null,
  in_note text default '',
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null
)
returns public.stock_moves
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.catalog_items;
  row public.stock_moves;
begin
  select * into item from public.catalog_items where id = in_item_id;
  if item.id is null or not public.works_here(item.project_id) then
    raise exception 'no such item in your project';
  end if;
  if in_direction not in ('in', 'out') then
    raise exception 'a movement is in or out, not %', in_direction;
  end if;
  if coalesce(in_qty, 0) <= 0 then
    raise exception 'how many?';
  end if;

  if in_idempotency_key is not null then
    select * into row from public.stock_moves
     where project_id = item.project_id and idempotency_key = in_idempotency_key;
    if found then return row; end if;
  end if;

  /* The document, if there is one, has to belong to the same business. A
     movement pointing at a stranger's purchase order would file this
     business's goods against somebody else's paperwork. */
  if in_against_id is not null then
    perform 1 from public.pipeline_records
      where id = in_against_id and project_id = item.project_id;
    if not found then
      raise exception 'that document is not in your project';
    end if;
  end if;

  insert into public.stock_moves (
    project_id, item_id, branch_id, doc_no, direction, qty, reason,
    against_id, cost_cents, moved_on, note, extra, idempotency_key, recorded_by
  ) values (
    item.project_id,
    in_item_id,
    item.branch_id,
    public.next_doc_no(item.project_id, item.module_key),
    in_direction,
    in_qty,
    left(coalesce(btrim(in_reason), ''), 60),
    in_against_id,
    in_cost_cents,
    coalesce(in_moved_on, public.today_myt()),
    left(coalesce(in_note, ''), 500),
    coalesce(in_extra, '{}'::jsonb),
    in_idempotency_key,
    auth.uid()
  )
  returning * into row;

  return row;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row from public.stock_moves
       where project_id = item.project_id and idempotency_key = in_idempotency_key;
      if found then return row; end if;
    end if;
    raise;
end;
$$;

revoke execute on function public.move_stock(
  uuid, text, numeric, text, uuid, date, bigint, text, jsonb, uuid
) from public;
grant execute on function public.move_stock(
  uuid, text, numeric, text, uuid, date, bigint, text, jsonb, uuid
) to authenticated;

/* ── AND THERE IS NO 「correct the quantity」 FUNCTION ──────────────────────
   On purpose, and it is the same rule the money side already follows: a wrong
   movement is corrected by writing the opposite one, not by editing history.
   `reverse_ledger_entry` exists for exactly this on the ledger; here the
   opposite movement IS the operation, so move_stock in the other direction
   with reason 「盘点」 is the whole answer. */

-- ── THE DOCUMENT NUMBER PREFIX ────────────────────────────────────────────
--
-- ST, and the owner can change it -- the same as every other module. Seeded
-- for every project that has an inventory page so the first movement does not
-- have to invent one.

insert into public.project_doc_prefixes (project_id, module_key, prefix)
select pp.project_id, pp.page_key, 'ST'
from public.project_pages pp
where public.is_catalog_module(pp.page_key)
on conflict (project_id, module_key) do nothing;
