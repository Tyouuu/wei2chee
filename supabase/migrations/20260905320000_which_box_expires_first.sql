-- 批号跟效期 —— 药行 · 美容 · 食品。
--
-- ── 为什么这一件排在这里 ────────────────────────────────────────────────
--
-- 它同时补两个洞：**对标那张表上还差的三件之一**，而且是
-- **附属功能清单上的一件**。而对那三行生意，少了它这一套完不完整不是
-- 一个判断题 —— **一盒过期的货卖出去是一件会出事的事。**
--
-- 老板真正在问的只有一句：**「什么快过期了？」**
-- 那一句今天答不了，而答不了的代价是货烂在架上。
--
-- ── 🔴 先读 ERPNext，然后只抄三栏 ────────────────────────────────────────
--
-- 他们的 `Batch` 有 batch_id · item · expiry_date · manufacturing_date ·
-- **batch_qty** · supplier · 一整套 `Serial and Batch Bundle`。
--
-- **`batch_qty` 那一栏我们不抄** —— 又是同一件事：一个**存起来的数量**。
-- 这里的「这一批还剩几件」是**从流水加出来的**，跟架上有几件 · 里程 ·
-- 帐龄 · 保养到期日同一条。这是这套 schema 第六次做同一个判断了。
--
-- 抄：批号 · 效期 · 哪一件货。**不抄**：数量 · 序号 · 那一整套 bundle。
--
-- ── 🔴 出货要**自动**照效期先出，而这不是「猜」 ──────────────────────────
--
-- 一间药行出货的时候，不会有人去打「这一次出的是 A123 那一批」。
-- 而如果不指定就不扣任何一批，那「这一批还剩几件」立刻变成一个假数字 ——
-- **一个半真的数字比没有数字更糟。**
--
-- 所以：**没讲哪一批，就照效期最早的先出**（FEFO）。
-- 这不是猜，这是这三行生意本来就在做的事，而反过来（让快过期的留在架上）
-- 才是错的。一行不够就往下一批拿，一行可以拆成两笔。
--
-- ⚠️ **他真的拿了别一盒，改那一笔就好** —— 而因为数量是算出来的，改完就对了。
--
-- ── 🔴 盘点：有批号的货不准在「货品」这一层数 ────────────────────────────
--
-- 数出来 84，而这一件货有三批 —— **那 84 是哪一批的？**
-- 答不出来就只有三条路：随便挑一批（毁资料）· 记在没有批号的那一边
-- （批号加起来不等於架上，一个半真的数字）· **拒绝**。
--
-- 拒绝，而且讲得出该怎么做 —— 跟[任务 148] 那条「两间店没讲哪一间就拒绝」
-- 同一个理由：**猜错会毁掉资料的地方就拒绝**。

create table if not exists public.stock_batches (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  item_id uuid not null references public.catalog_items(id) on delete cascade,

  /* 盒子上印的那一串。他打什么就是什么。 */
  code text not null,

  /* 🔴 这一整张表存在的理由。可以空 —— 有些货有批号没有效期
     （一批钢筋、一批瓷砖）。 */
  expiry_on date,

  received_on date not null default public.today_myt(),
  note text not null default '',
  archived_at timestamptz,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint stock_batches_code_not_blank check (btrim(code) <> ''),
  constraint stock_batches_one_per_item unique (item_id, code)
);

create index if not exists stock_batches_expiry_idx
  on public.stock_batches (project_id, expiry_on)
  where archived_at is null and expiry_on is not null;

alter table public.stock_batches enable row level security;

drop policy if exists stock_batches_read on public.stock_batches;
create policy stock_batches_read on public.stock_batches
  for select using (public.works_here(project_id));

comment on table public.stock_batches is
  'A lot on the shelf. ERPNext''s Batch keeps batch_qty as a column; here the remaining quantity is summed from the movements, like everything else in this schema that can drift. See 20260905320000.';

-- ── 每一笔进出属於哪一批 ──────────────────────────────────────────────────
alter table public.stock_moves
  add column if not exists batch_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'stock_moves_batch_fkey'
  ) then
    alter table public.stock_moves
      add constraint stock_moves_batch_fkey
      foreign key (batch_id) references public.stock_batches(id) on delete restrict;
  end if;
end $$;

create index if not exists stock_moves_batch_idx
  on public.stock_moves (batch_id) where batch_id is not null;

-- ── 单据那一行写得下批号跟效期 ────────────────────────────────────────────
--
-- 供应商的单上印的就是这两样，而那正是一批货**出生**的地方。
alter table public.record_lines
  add column if not exists batch_code text,
  add column if not exists expiry_on date;

comment on column public.record_lines.batch_code is
  'The lot printed on the supplier''s invoice line. Receiving turns it into a stock_batches row -- that is where a batch is born. See 20260905320000.';

-- ── 那一批要跟那一件货同一家 ──────────────────────────────────────────────
create or replace function public.stock_batches_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  select c.project_id into owner_project
  from public.catalog_items c where c.id = new.item_id;
  if owner_project is null then
    raise exception 'no such item';
  end if;
  new.project_id := owner_project;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists stock_batches_own_project_trg on public.stock_batches;
create trigger stock_batches_own_project_trg
  before insert or update on public.stock_batches
  for each row execute function public.stock_batches_own_project();

-- ── 开一批 ────────────────────────────────────────────────────────────────
create or replace function public.add_stock_batch(
  in_item_id uuid,
  in_code text,
  in_expiry_on date default null,
  in_received_on date default null,
  in_note text default ''
)
returns public.stock_batches
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.catalog_items;
  made public.stock_batches;
begin
  select * into item from public.catalog_items where id = in_item_id;
  if item.id is null or not public.works_here(item.project_id) then
    raise exception 'no such item in your project';
  end if;
  if coalesce(btrim(in_code), '') = '' then
    raise exception 'a batch needs the code printed on the box';
  end if;

  /* 已经有这一批就把它还给他 —— 同一批货分两车到是常态。 */
  select * into made from public.stock_batches b
  where b.item_id = in_item_id and b.code = btrim(in_code);
  if made.id is not null then
    /* 效期第一次讲出来的时候补上去。**已经有的不覆盖** ——
       一张打错的单不该改掉一整批货的效期。 */
    if made.expiry_on is null and in_expiry_on is not null then
      update public.stock_batches set expiry_on = in_expiry_on, updated_at = now()
      where id = made.id
      returning * into made;
    end if;
    return made;
  end if;

  insert into public.stock_batches (
    project_id, item_id, code, expiry_on, received_on, note, created_by
  ) values (
    item.project_id, in_item_id, left(btrim(in_code), 60), in_expiry_on,
    coalesce(in_received_on, public.today_myt()),
    left(btrim(coalesce(in_note, '')), 500), auth.uid()
  )
  returning * into made;

  return made;
end;
$$;

revoke execute on function public.add_stock_batch(uuid, text, date, date, text)
  from public, anon;
grant execute on function public.add_stock_batch(uuid, text, date, date, text)
  to authenticated;

-- ── 这一件货有哪几批，各剩几件 ────────────────────────────────────────────
--
-- 🔴 **效期最早的排前面** —— 那个顺序不是好看，那是出货的顺序。
create or replace function public.batches_of(in_item_id uuid)
returns table (
  batch_id uuid,
  code text,
  expiry_on date,
  received_on date,
  on_hand numeric,
  days_left integer,
  is_expired boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  item public.catalog_items;
begin
  select * into item from public.catalog_items where id = in_item_id;
  if item.id is null or not public.works_here(item.project_id) then
    return;
  end if;

  return query
  select b.id, b.code, b.expiry_on, b.received_on,
         coalesce((
           select sum(case when m.direction = 'in' then m.qty else -m.qty end)
           from public.stock_moves m where m.batch_id = b.id
         ), 0)::numeric,
         case when b.expiry_on is not null
              then (b.expiry_on - public.today_myt())::integer end,
         (b.expiry_on is not null and b.expiry_on < public.today_myt())
  from public.stock_batches b
  where b.item_id = in_item_id and b.archived_at is null
  order by b.expiry_on nulls last, b.received_on, b.code;
end;
$$;

revoke execute on function public.batches_of(uuid) from public, anon;
grant execute on function public.batches_of(uuid) to authenticated;

-- ── 🔴 什么快过期了 ──────────────────────────────────────────────────────
--
-- 这一支就是这一整件事的用处。
-- ⚠️ **架上没有货的那几批不列** —— 一批卖完了的货过不过期没有人在乎，
-- 而一份塞满已经卖完的批号的清单，没有人会看第二次。
create or replace function public.expiring_soon(
  in_project_id uuid,
  in_days integer default 90
)
returns table (
  batch_id uuid,
  item_id uuid,
  item_name text,
  code text,
  expiry_on date,
  days_left integer,
  on_hand numeric,
  unit text,
  location text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  if in_days is null or in_days < 0 or in_days > 1095 then
    raise exception 'ask for between 0 and about three years';
  end if;

  return query
  select b.id, b.item_id, c.name, b.code, b.expiry_on,
         (b.expiry_on - public.today_myt())::integer,
         h.left_over, c.unit, c.location
  from public.stock_batches b
  join public.catalog_items c on c.id = b.item_id
  cross join lateral (
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)::numeric
             as left_over
    from public.stock_moves m where m.batch_id = b.id
  ) h
  where b.project_id = in_project_id
    and b.archived_at is null
    and c.archived_at is null
    and b.expiry_on is not null
    and b.expiry_on <= public.today_myt() + in_days
    /* 架上还有货的才算。 */
    and h.left_over > 0
  /* 已经过期的排最前面 —— 那几批是他今天要处理的。 */
  order by b.expiry_on, c.name;
end;
$$;

revoke execute on function public.expiring_soon(uuid, integer) from public, anon;
grant execute on function public.expiring_soon(uuid, integer) to authenticated;

comment on function public.expiring_soon(uuid, integer) is
  'The one question this whole table exists to answer. Batches with nothing left are not listed -- a list full of sold-out lots gets read once. See 20260905320000.';

-- ── 🔴 签名变了，先 drop（20260905180000 那一课）────────────────────────
drop function if exists public.move_stock(
  uuid, text, numeric, text, uuid, date, bigint, text, jsonb, uuid, uuid
);
drop function if exists public.count_stock(uuid, numeric, text, text, uuid, uuid);

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
  in_idempotency_key uuid default null,
  in_branch_id uuid default null,
  /* 这一笔属於哪一批。**最后而且有预设**，所以既有的每一个呼叫端一个字都不用改。 */
  in_batch_id uuid default null
)
returns public.stock_moves
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.catalog_items;
  lot public.stock_batches;
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

  if in_batch_id is not null then
    select * into lot from public.stock_batches where id = in_batch_id;
    if lot.id is null or lot.item_id <> in_item_id then
      raise exception 'that batch is not a batch of this item';
    end if;
  end if;

  if in_idempotency_key is not null then
    select * into row from public.stock_moves
     where project_id = item.project_id and idempotency_key = in_idempotency_key;
    if found then return row; end if;
  end if;

  if in_against_id is not null then
    perform 1 from public.pipeline_records
      where id = in_against_id and project_id = item.project_id;
    if not found then
      raise exception 'that document is not in your project';
    end if;
  end if;

  if not public.branch_is_ours(item.project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  insert into public.stock_moves (
    project_id, item_id, branch_id, batch_id, doc_no, direction, qty, reason,
    against_id, cost_cents, moved_on, note, extra, idempotency_key, recorded_by
  ) values (
    item.project_id, in_item_id,
    coalesce(in_branch_id, item.branch_id),
    in_batch_id,
    public.next_doc_no(item.project_id, item.module_key),
    in_direction, in_qty,
    left(coalesce(btrim(in_reason), ''), 60),
    in_against_id, in_cost_cents,
    coalesce(in_moved_on, public.today_myt()),
    left(coalesce(in_note, ''), 500),
    coalesce(in_extra, '{}'::jsonb),
    in_idempotency_key, auth.uid()
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
  uuid, text, numeric, text, uuid, date, bigint, text, jsonb, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.move_stock(
  uuid, text, numeric, text, uuid, date, bigint, text, jsonb, uuid, uuid, uuid)
  to authenticated;

-- ── 盘点 ──────────────────────────────────────────────────────────────────
create or replace function public.count_stock(
  in_item_id uuid,
  in_counted numeric,
  in_reason text default '',
  in_note text default '',
  in_idempotency_key uuid default null,
  in_branch_id uuid default null,
  in_batch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.catalog_items;
  lot public.stock_batches;
  have numeric;
  gap numeric;
  which text;
  lots integer;
  made public.stock_moves;
begin
  select * into item from public.catalog_items where id = in_item_id;
  if item.id is null or not public.works_here(item.project_id) then
    raise exception 'no such item in your project';
  end if;
  if in_counted is null or in_counted < 0 then
    raise exception 'how many are on the shelf?';
  end if;
  if not public.branch_is_ours(item.project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  if in_batch_id is not null then
    select * into lot from public.stock_batches where id = in_batch_id;
    if lot.id is null or lot.item_id <> in_item_id then
      raise exception 'that batch is not a batch of this item';
    end if;
  else
    /* 🔴 有批号的货，数出来的 84 是哪一批的？答不出来就不准记。
       讲得出该怎么做 —— 一句「违反约束」会让他去关掉这个功能。 */
    select count(*) into lots
    from public.stock_batches b
    where b.item_id = in_item_id and b.archived_at is null;
    if lots > 0 then
      raise exception
        'this item is kept in % batches -- count the batch, not the item', lots;
    end if;
  end if;

  /* 🔴 现在有几件**在资料库里算**，不是浏览器算的 ——
     两个人同时盘点，两边都读到 91 再各自送「出 7」，架上会变成 77。 */
  if in_batch_id is not null then
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
      into have
    from public.stock_moves m
    where m.batch_id = in_batch_id
    for update;
  elsif in_branch_id is not null then
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
      into have
    from public.stock_moves m
    where m.item_id = in_item_id and m.branch_id = in_branch_id
    for update;
  else
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
      into have
    from public.stock_moves m where m.item_id = in_item_id
    for update;
  end if;

  gap := in_counted - have;

  /* 数出来跟系统一样，什么都不写，而且讲出来 ——
     一笔 0 的流水是他帐上一行没有发生过的事。 */
  if gap = 0 then
    return jsonb_build_object(
      'counted', in_counted, 'was', have, 'diff', 0, 'wrote', false
    );
  end if;

  select case when p.system_language = 'en' then 'Stocktake' else '盘点' end
    into which
  from public.projects p where p.id = item.project_id;

  made := public.move_stock(
    in_item_id,
    case when gap > 0 then 'in' else 'out' end,
    abs(gap),
    coalesce(nullif(btrim(in_reason), ''), which),
    null, null, null,
    coalesce(in_note, ''), '{}'::jsonb,
    in_idempotency_key, in_branch_id, in_batch_id
  );

  return jsonb_build_object(
    'counted', in_counted, 'was', have, 'diff', gap,
    'wrote', true, 'move_id', made.id
  );
end;
$$;

revoke execute on function public.count_stock(uuid, numeric, text, text, uuid, uuid, uuid)
  from public, anon;
grant execute on function public.count_stock(uuid, numeric, text, text, uuid, uuid, uuid)
  to authenticated;

comment on function public.count_stock(uuid, numeric, text, text, uuid, uuid, uuid) is
  'Refuses to count a batched item at item level, because the difference cannot be attributed and a guess would poison every expiry answer afterwards. Says what to do instead. See 20260905320000.';
