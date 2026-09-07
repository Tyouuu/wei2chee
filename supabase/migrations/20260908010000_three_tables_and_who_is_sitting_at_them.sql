-- 三号桌点了什么 · 几号桌空着。
--
-- 餐饮是八个行业里唯一一个今天用不了这套东西的：它开局拿到
-- 总览 · 客户 · 订单 · 收款 · 官网，而一间茶餐室一整天在问的那一句
-- 「三号桌点了什么」，今天没有任何地方答得了。
--
-- ---------------------------------------------------------------------------
-- 先读别人真的表（重点 26）：frappe/hospitality（GPL-3.0 → 拿设计不拿代码）
-- ---------------------------------------------------------------------------
--   Restaurant Table        restaurant · no_of_seats · minimum_seating（三栏全必填）
--   Restaurant Order Entry  restaurant_table · items(子表) · grand_total · last_sales_invoice
--   Order Entry Item        item · qty · **served(Int)** · rate
--
-- ✅ 抄两样：**一张桌就是一个名字加几个位子** · **`served` 是一个数字**（厨房那一半，下一支）
-- ❌ **Order Entry 那张表整个不抄** —— 那是一张中转单，最后才吐一张发票。
--    我们的单（pipeline_records）跟明细（record_lines）本来就在，
--    再开一张就是同一件事两条路（重点 23）。**一张餐台单就是一张单，一碟菜就是一行。**
-- ❌ `minimum_seating` 不抄 —— 那是给一个我们没有的订位引擎决定
--    「两个人该给哪一桌」用的。没有那个引擎，那一栏就是一格他要先填完的东西。
-- ❌ Restaurant Menu / Menu Item 不抄 —— 那是 catalog_items。
-- ❌ Restaurant Reservation 不抄 —— 那是 appointments。
--
-- ---------------------------------------------------------------------------
-- 🔴 「谁坐着」是存起来的，而这一次它不该被算出来
-- ---------------------------------------------------------------------------
-- 这个 schema 判过十五次「算出来的，不是存起来的」（架上几件 · 过期 · 帐龄 ·
-- 里程 · 出勤 · 保养到期 · 来的节奏…）。**这一个不是那一种。**
--
-- 最省事的算法是「桌上那张单收到钱没有」。而**赊数在茶餐室是真的**：
-- 客人走了，帐还挂着。所以
--   「谁坐着」 跟 「收了钱没有」 是两个问题，而前者从后者算不出来。
-- 它是真的状态，跟 stage 同一类。而它自己会修正一件事：
-- `on delete set null` —— 那张单删了，桌子自己空。
--
-- ---------------------------------------------------------------------------
-- 🔴 两栏，两个不一样的问题（跟 party / party_id 同一条）
-- ---------------------------------------------------------------------------
--   pipeline_records.table_id      **那一晚它在哪一桌** —— 历史，永不改。
--                                  明年那一桌改名叫「A3」，去年那张单还是三号桌。
--   dining_tables.seated_record_id **现在谁坐着** —— 状态，天天变。
--
-- ---------------------------------------------------------------------------
-- 🔴 结帐一按做两件（重点 29 / 任务 225 的形状）
-- ---------------------------------------------------------------------------
-- 开台 1 · 加菜 n · 收钱 1 · 清桌 1 —— 一天一百桌，那多出来的一按就是一百按。
-- 所以 `close_table` 收钱**顺手**清桌，而且**讲出发生了什么**
-- （收了多少 · 还欠多少 · 桌子放开了没有）。
--
-- ⚠️ 而收钱那一半故意**不塞进 add_ledger_entry_core** —— 那一支每一个行业都在打，
-- 为餐饮在里面加一句，正是任务 41 禁的那件事。它照旧走人按的那一支（重点 23）。
--
-- ⚠️ **赊数照样清桌，然后讲出还欠多少** —— 挡下去他就在系统外面做
-- （跟额度不挡单 · 架上不够照样出货同一条）。
--
-- ---------------------------------------------------------------------------
-- 谁做得了什么
-- ---------------------------------------------------------------------------
--   开台 · 清桌 · 看哪一桌空着   works_here —— 那是伙计一整天的工作
--   开／关一张桌本身              sees_money —— 跟 branches 一样，那是店的设定
--   收钱                          add_ledger_entry 自己那条（老板）。
--   🔴 所以伙计按得了「这桌走了」，**按不了收钱**，而这一支会先讲一句人话，
--      不是让他读到一句资料库的错。
--      ⚠️ 而 ring_up_sale（柜台那一支）今天有同一个形状：它自己是 works_here，
--         而它的收钱那一腿会被 add_ledger_entry 挡下来。**那是既有的，只登记不动。**

-- ---------------------------------------------------------------------------
-- 1. 一张桌
-- ---------------------------------------------------------------------------
create table if not exists public.dining_tables (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects(id) on delete cascade,

  /* 他自己的话：「3」「A3」「包厢一」「外面第二张」。 */
  name text not null,

  /* 几个位子。抄的是 no_of_seats —— 他排位真的会用。可以不填。 */
  seats integer,

  /* 关掉的桌留着，不删 —— 去年在那一桌吃过的每一单还挂在它身上。
     跟 branches / archived_at 同一条。 */
  active boolean not null default true,

  /* 🔴 现在坐着的那一张单。null = 空桌。见上面那一段：
     它是状态不是快取，而且单删了它自己空。 */
  seated_record_id uuid references public.pipeline_records(id) on delete set null,
  /* 几点开的台 —— 「这一桌坐多久了」是他会问的第二句。 */
  seated_at timestamptz,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint dining_tables_name_not_blank check (btrim(name) <> ''),
  /* 两张同名的桌不是两张桌，是一次打错。 */
  constraint dining_tables_name_unique unique (project_id, name),
  /* 坐着就一定有开台的时间；空着就一定没有。两栏一起动，不可以只动一栏。 */
  constraint dining_tables_seated_pair check (
    (seated_record_id is null and seated_at is null)
    or (seated_record_id is not null and seated_at is not null)
  ),
  constraint dining_tables_seats_sane check (seats is null or seats between 1 and 200)
);

create index if not exists dining_tables_project_idx
  on public.dining_tables (project_id, sort_order, name);

alter table public.dining_tables enable row level security;

drop policy if exists "dining_tables_members" on public.dining_tables;
create policy "dining_tables_members" on public.dining_tables
  for select using (public.works_here(project_id));

drop policy if exists "dining_tables_owner_writes" on public.dining_tables;
create policy "dining_tables_owner_writes" on public.dining_tables
  for all using (public.sees_money(project_id)) with check (public.sees_money(project_id));

-- 桌上挂的那张单，一定是这一家自己的。
create or replace function public.dining_tables_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $fn$
declare
  owner_project uuid;
begin
  /* 🔴 公司都不在了就放行 —— 见 20260906150000 那一整段：
     删一个使用者的时候 `on delete set null` 会对这张表发一次 update，
     而那时候上面那几张表可能已经被 cascade 删掉了。一 raise 就把整句删除挡下来。 */
  if not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;

  if new.seated_record_id is not null then
    select project_id into owner_project
    from public.pipeline_records where id = new.seated_record_id;
    if owner_project is null then
      raise exception 'no such document';
    end if;
    if owner_project <> new.project_id then
      raise exception 'that document belongs to another business';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$fn$;

drop trigger if exists dining_tables_own_project_trg on public.dining_tables;
create trigger dining_tables_own_project_trg
  before insert or update on public.dining_tables
  for each row execute function public.dining_tables_own_project();

-- ---------------------------------------------------------------------------
-- 2. 那一单在哪一桌 —— 历史，永不改
-- ---------------------------------------------------------------------------
-- ⚠️ 照 vehicle_id / site_address_id / branch_id 的样子：一栏可空的外键，
-- **不加触发器**，同一家的检查住在写它的那一支函式里（20260905290000 的
-- `set_record_vehicle` 就是这样做的）。pipeline_records 是这个 schema 打得最凶的
-- 一张表，为一个行业在它上面挂一支触发器，每一次写入都要付钱。
alter table public.pipeline_records
  add column if not exists table_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pipeline_records_table_fk'
  ) then
    alter table public.pipeline_records
      add constraint pipeline_records_table_fk
      foreign key (table_id) references public.dining_tables(id) on delete set null;
  end if;
end $$;

create index if not exists pipeline_records_table_idx
  on public.pipeline_records (table_id, issued_on desc)
  where table_id is not null;

-- ---------------------------------------------------------------------------
-- 3. 开一张桌 · 改一张桌
-- ---------------------------------------------------------------------------
create or replace function public.add_dining_table(
  in_project_id uuid,
  in_name text,
  in_seats integer default null,
  in_sort_order integer default 0
)
returns public.dining_tables
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.dining_tables;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your business';
  end if;
  if btrim(coalesce(in_name, '')) = '' then
    raise exception 'a table needs a name';
  end if;

  insert into public.dining_tables (project_id, name, seats, sort_order)
  values (in_project_id, left(btrim(in_name), 60), in_seats, coalesce(in_sort_order, 0))
  returning * into row;
  return row;
exception
  /* 同名那一张已经在了 —— 把它还给他，不要开第二张。 */
  when unique_violation then
    select * into row from public.dining_tables
     where project_id = in_project_id and name = left(btrim(in_name), 60);
    return row;
end;
$fn$;

revoke execute on function public.add_dining_table(uuid, text, integer, integer) from public, anon;
grant execute on function public.add_dining_table(uuid, text, integer, integer) to authenticated;

create or replace function public.update_dining_table(
  in_table_id uuid,
  in_name text default null,
  in_seats integer default null,
  in_clear_seats boolean default false,
  in_active boolean default null,
  in_sort_order integer default null
)
returns public.dining_tables
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.dining_tables;
begin
  select * into row from public.dining_tables where id = in_table_id;
  if not found then
    raise exception 'no such table';
  end if;
  if not public.sees_money(row.project_id) then
    raise exception 'not your table';
  end if;
  if in_name is not null and btrim(in_name) = '' then
    raise exception 'a table needs a name';
  end if;

  update public.dining_tables
     set name = coalesce(left(btrim(in_name), 60), name),
         /* 一栏两种意思分开：不给 = 不动，清掉要自己讲（跟 in_clear_due_on 同一条）。 */
         seats = case when in_clear_seats then null else coalesce(in_seats, seats) end,
         active = coalesce(in_active, active),
         sort_order = coalesce(in_sort_order, sort_order)
   where id = in_table_id
  returning * into row;
  return row;
end;
$fn$;

revoke execute on function public.update_dining_table(uuid, text, integer, boolean, boolean, integer) from public, anon;
grant execute on function public.update_dining_table(uuid, text, integer, boolean, boolean, integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. 开台 —— 客人坐下
-- ---------------------------------------------------------------------------
-- 🔴 走 `add_pipeline_record`（重点 23）：单号 · 阶段 · 连到客户 · 防重复 · 分店守卫，
--    五样全部住在那一支里面。这里一样都不重写。
create or replace function public.seat_table(
  in_project_id uuid,
  in_table_id uuid,
  in_module_key text,
  in_party text default '',
  in_party_id uuid default null,
  in_title text default '',
  in_idempotency_key uuid default null
)
returns table (
  record_id uuid,
  doc_no text,
  table_name text,
  seated_at timestamptz,
  /* 🔴 这一按有没有真的开台 —— 那一桌本来就坐着人的话是 false。
     一支静静开出第二张单的函式，会让三号桌今晚有两张帐。 */
  seated boolean
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  tbl public.dining_tables;
  rec public.pipeline_records;
  fresh boolean := true;
begin
  if not public.works_here(in_project_id) then
    raise exception 'that project is not yours';
  end if;
  if not public.is_pipeline_module(in_module_key) then
    raise exception 'that page does not hold documents';
  end if;

  /* 🔴 锁住那一行：两个伙计同一秒替三号桌开台，只准开出一张。 */
  select * into tbl from public.dining_tables
   where id = in_table_id and project_id = in_project_id
   for update;
  if not found then
    raise exception 'no such table in this business';
  end if;
  if not tbl.active then
    raise exception 'that table is closed — open it again first';
  end if;

  /* 已经坐着人了：把那一张单还给他，不开第二张。 */
  if tbl.seated_record_id is not null then
    select * into rec from public.pipeline_records where id = tbl.seated_record_id;
    if found then
      return query select rec.id, rec.doc_no, tbl.name, tbl.seated_at, false;
      return;
    end if;
    /* 那张单不见了（被删掉）—— 桌子其实是空的，照常开。 */
  end if;

  select * into rec from public.add_pipeline_record(
    in_project_id => in_project_id,
    in_module_key => in_module_key,
    in_title => left(btrim(coalesce(in_title, '')), 200),
    in_party => coalesce(in_party, ''),
    in_party_id => in_party_id,
    in_idempotency_key => in_idempotency_key
  );

  /* 那一晚它在哪一桌 —— 历史，之后再也不改。 */
  update public.pipeline_records
     set table_id = tbl.id, updated_at = now()
   where id = rec.id;

  update public.dining_tables
     set seated_record_id = rec.id, seated_at = now()
   where id = tbl.id
  returning * into tbl;

  return query select rec.id, rec.doc_no, tbl.name, tbl.seated_at, fresh;
end;
$fn$;

revoke execute on function public.seat_table(uuid, uuid, text, text, uuid, text, uuid) from public, anon;
grant execute on function public.seat_table(uuid, uuid, text, text, uuid, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. 结帐 —— 一按做两件
-- ---------------------------------------------------------------------------
create or replace function public.close_table(
  in_project_id uuid,
  in_table_id uuid,
  /* 他手上收到的那一张钞票。0 = 赊数，桌子照样放开。 */
  in_paid_cents bigint default 0,
  in_method text default '',
  in_idempotency_key uuid default null
)
returns table (
  record_id uuid,
  doc_no text,
  /* 这一桌吃了多少 —— **明细加起来的**，不是他打的（跟 ring_up_sale 同一条）。 */
  total_cents bigint,
  paid_cents bigint,
  /* 找他多少 —— 在这里算，不在画面上算。 */
  change_cents bigint,
  /* 还欠多少（赊数）。 */
  owed_cents bigint,
  /* 🔴 桌子放开了没有 —— 第二下按的时候是 false。 */
  freed boolean
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  tbl public.dining_tables;
  rec public.pipeline_records;
  total bigint;
  take bigint;
begin
  if not public.works_here(in_project_id) then
    raise exception 'that project is not yours';
  end if;
  if coalesce(in_paid_cents, 0) < 0 then
    raise exception 'money taken cannot be negative';
  end if;

  select * into tbl from public.dining_tables
   where id = in_table_id and project_id = in_project_id
   for update;
  if not found then
    raise exception 'no such table in this business';
  end if;

  /* 🔴 收钱是老板的事，而伙计按得了「这桌走了」。
     先讲一句人话，不要让他读到 add_ledger_entry 那句 `not your project`。 */
  if coalesce(in_paid_cents, 0) > 0 and not public.sees_money(in_project_id) then
    raise exception 'taking money is the owner''s — you can free the table, and the owner rings it up';
  end if;

  if tbl.seated_record_id is null then
    /* 空桌上按结帐：什么都没发生，而且讲出来。 */
    return query select null::uuid, null::text, 0::bigint,
                        coalesce(in_paid_cents, 0), 0::bigint, 0::bigint, false;
    return;
  end if;

  select * into rec from public.pipeline_records where id = tbl.seated_record_id;

  select coalesce(sum(l.amount_cents), 0) into total
  from public.record_lines l where l.record_id = tbl.seated_record_id;

  take := least(coalesce(in_paid_cents, 0), total);

  /* 记一笔钱 —— `in_against_id` 会自己写一笔分摊（20260906030000）。
     ⚠️ 一分都没付就不记：一笔 RM 0 的收款看起来像一笔真的收款。 */
  if take > 0 then
    perform public.add_ledger_entry(
      in_project_id => in_project_id,
      in_module_key => 'payments',
      in_direction => 'in',
      in_amount_cents => take,
      in_party => coalesce(rec.party, ''),
      in_party_id => rec.party_id,
      in_against_id => rec.id,
      in_method => left(btrim(coalesce(in_method, '')), 40),
      in_branch_id => rec.branch_id,
      in_idempotency_key => in_idempotency_key
    );
  end if;

  /* 放开那一桌。那张单一个字都不动 —— 它还记得自己在三号桌。 */
  update public.dining_tables
     set seated_record_id = null, seated_at = null
   where id = tbl.id;

  return query select rec.id, rec.doc_no, total,
                      coalesce(in_paid_cents, 0),
                      greatest(coalesce(in_paid_cents, 0) - total, 0)::bigint,
                      greatest(total - coalesce(in_paid_cents, 0), 0)::bigint,
                      true;
end;
$fn$;

revoke execute on function public.close_table(uuid, uuid, bigint, text, uuid) from public, anon;
grant execute on function public.close_table(uuid, uuid, bigint, text, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. 几号桌空着 —— 他一整天在看的那一屏
-- ---------------------------------------------------------------------------
-- ⚠️ 金额**不遮** —— 一张单的总额伙计本来就看得到（任务 117 判过同一条：
--    报价单总额是 works_here）。而一间茶餐室的伙计就是那个念帐单的人。
create or replace function public.tables_now(in_project_id uuid)
returns table (
  table_id uuid,
  name text,
  seats integer,
  sort_order integer,
  record_id uuid,
  doc_no text,
  title text,
  party text,
  seated_at timestamptz,
  /* 坐多久了 —— 「这一桌坐多久了」是他会问的第二句。算出来的，不存。 */
  seated_minutes integer,
  lines integer,
  total_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select t.id,
         t.name,
         t.seats,
         t.sort_order,
         r.id,
         r.doc_no,
         nullif(btrim(coalesce(r.title, '')), ''),
         nullif(btrim(coalesce(r.party, '')), ''),
         t.seated_at,
         case when t.seated_at is null then null
              else greatest(0, floor(extract(epoch from (now() - t.seated_at)) / 60))::integer
         end,
         case when r.id is null then null else (
           select count(*)::integer from public.record_lines l where l.record_id = r.id
         ) end,
         case when r.id is null then null else (
           select coalesce(sum(l.amount_cents), 0)::bigint
           from public.record_lines l where l.record_id = r.id
         ) end
  from public.dining_tables t
  left join public.pipeline_records r on r.id = t.seated_record_id
  where t.project_id = in_project_id
    and t.active
    and public.works_here(t.project_id)
  order by t.sort_order, t.name;
$$;

revoke execute on function public.tables_now(uuid) from public, anon;
grant execute on function public.tables_now(uuid) to authenticated;
