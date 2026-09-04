-- 送货单 · 签收
--
-- ## 先读别人的，然后**不抄**（[重点 7d-2]）
--
-- ERPNext 的 `Delivery Note`（读的是 doctype 原文）：**169 个栏位，12 个必填**，
-- 明细子表再 **112 个**。里面有整整一段 transporter · driver · vehicle_no ·
-- **lr_no**（Lorry Receipt，印度的运输收据编号）· lr_date · dispatch_address。
--
-- 🔴 **而它一个签名栏位都没有。** 整份单据里搜 sign / proof / pod —— **零个**。
-- ERPNext 根本不做「客人签收」这件事。做那件事的是外勤那一群
-- （ServiceM8 商店页第四张就是 Take Job Photos，Jobber · Housecall 把
-- on-site signature 印在头版）。
--
-- 所以两边各拿一半：**单据的形状从 ERPNext 拿，签收从外勤那一群拿。**
--
-- ## 而一个五金店老板真正在问的是三句话
--
--   > **「这批货几时送到、谁收的、他签了没有？」**
--
-- 那是**一个日期 · 一个名字 · 一个签名**，不是一份 169 栏的单据。
-- 跟 [任务 149] 的三方核对（不是三份单据，是一张单上的三个数字）、
-- [任务 151] 的部分收货（不是八个数量栏，是一行多一个数字）同一条判断。
--
-- ## 所以不开第三份单据 —— **订单本身就是送货单**，缺的是「一趟」
--
-- `deliveries` 只有表头，**没有明细子表** —— 一趟送了哪几行几件，
-- `stock_moves` 本来就一笔一笔记着（带 line_id · qty），
-- 差的只是一根把同一趟的几笔串起来的绳子。**一张表加一栏。**
--
-- ⚠️ 而它同时服务两种完全不同的生意，这也是不开子表的第二个理由：
--
--   · **批发 · 零售**：一趟带着几笔搬货
--   · **装修 · 服务**：一趟**一笔货都没有**（交的是做完的工，不是货）——
--     open_delivery_run 因此可以单独呼叫，那不是一个残缺的状态，
--     那是那一行的正常形状
--
-- ## 🔴 而写这一件的时候，翻出一个我自己造的回归，比这一件本身大
--
-- 20260905210000（部分收货）把 deliver_record 的「送过了没有」
-- 改成了**数量比数量**。而 20260905330000（批号那一轮）**照记忆重打了一支**，
-- 於是它退回 exists(...)。
--
--   > **从那一轮起，一张分两车出的单，第二车永远出不去 ——
--   > 而画面上不会讲，db push 也不会讲。**
--
-- **这是「整支重写」第三次咬人**（20260831080000 漏掉防重复，於是按两下
-- 开两张单；20260905370000 漏掉分店守卫）。
-- 这一支是从 20260905400000 的原文**改出来的**，不是重打的。

-- ── 一趟 ──────────────────────────────────────────────────────────────────

create table if not exists public.deliveries (
  id uuid primary key default gen_random_uuid(),

  /* 这一趟送的是哪一张单。cascade：单没了，这一趟没有意义。 */
  record_id uuid not null references public.pipeline_records(id) on delete cascade,

  /* 反正规化，让 RLS 不用每一次读都 join —— 靠下面那支触发器保持真。 */
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 几时送到。补记昨天那一趟是常态，所以给得了日期，预设是今天。 */
  run_on date not null default public.today_myt(),

  /* 谁去送的。一串字不是外键 —— 送货的常常是临时叫的罗厘，
     而逼他先把罗厘司机建成一个员工，就是他不记这一趟的理由。 */
  driver text not null default '',

  /* 🔴 谁在门口收的 —— **他自己打的**。
     它跟下面那三栏是两回事，而分得开是这张表的重点：
     这一栏是我们这一边的说法，那三栏是客人自己按的。 */
  received_by text not null default '',

  /* ── 🔴 客人自己按的那一格 ───────────────────────────────────────────
     signed_at is null = **没有人按过**。
     一个老板打进去的名字，跟一个客人自己在他手机上按下去的确认，
     在争执的时候是完全不同重量的两样东西 —— 所以它们是不同的栏位，
     而不是同一栏配一个「是不是真的」的勾。
     跟 20260905020000 的 recorded_by is null（没有人打过这一笔）同一条。 */
  signed_at timestamptz,
  signed_name text,
  signed_note text,

  note text not null default '',

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* 收起来，不删掉 —— 一趟真的开出去过的车是历史。 */
  archived_at timestamptz,

  /* 按两下只算一趟。 */
  idempotency_key uuid,

  constraint deliveries_signed_together check (
    (signed_at is null and signed_name is null)
    or (signed_at is not null and signed_name is not null)
  )
);

create unique index if not exists deliveries_idem_idx
  on public.deliveries (record_id, idempotency_key) where idempotency_key is not null;
create index if not exists deliveries_doc_idx
  on public.deliveries (record_id, run_on desc, created_at desc);

comment on table public.deliveries is
  'One delivery run against one document: when it went, who drove, who took it, and -- separately -- whether the customer signed for it himself. No child table: what left on a run is already in stock_moves.delivery_id. A run with zero moves is legitimate (a renovation handover). See 20260905500000.';
comment on column public.deliveries.received_by is
  'What the owner typed at the door. Weaker evidence than signed_name, and deliberately a different column so the two can never be confused.';
comment on column public.deliveries.signed_at is
  'Null means nobody signed. Set only when the customer pressed it himself on his own link -- we did not type it.';

alter table public.stock_moves add column if not exists delivery_id uuid
  references public.deliveries(id) on delete set null;
create index if not exists stock_moves_delivery_idx
  on public.stock_moves (delivery_id) where delivery_id is not null;

comment on column public.stock_moves.delivery_id is
  'Which run took this out. Null for everything that is not a delivery (opening stock, receiving, stocktake).';

-- ── 谁看得到 ──────────────────────────────────────────────────────────────
--
-- works_here()，**不是** sees_money()：送货的就是师傅，而一趟货上面
-- 一分钱都没有。跟 record_lines · service_packages 同一条界线。

alter table public.deliveries enable row level security;

drop policy if exists "deliveries_members" on public.deliveries;
create policy "deliveries_members" on public.deliveries
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

create or replace function public.deliveries_own_project()
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

drop trigger if exists deliveries_own_project_trg on public.deliveries;
create trigger deliveries_own_project_trg
  before insert or update on public.deliveries
  for each row execute function public.deliveries_own_project();

-- ── 开一趟 ────────────────────────────────────────────────────────────────
--
-- 一份逻辑，两个入口（[重点 23]）：deliver_record 搬货之前呼叫它，
-- 而一间不动库存的装修公司直接呼叫它 —— **两条路开出来的是同一种东西**。

create or replace function public.open_delivery_run(
  in_record_id uuid,
  in_run_on date default null,
  in_driver text default null,
  in_received_by text default null,
  in_note text default null,
  in_idempotency_key uuid default null
)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $fn$
declare
  rec public.pipeline_records;
  run public.deliveries;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null or not public.works_here(rec.project_id) then
    raise exception 'no such document in your project';
  end if;

  /* 送得出去的只有这两种：一张订单（货）· 一件工程（做完的工）。
     报价单还没有人答应，进货单是供应商送给他的，任务是内部的。 */
  if rec.module_key not in ('orders', 'projects') then
    raise exception 'only an order or a job is delivered';
  end if;

  if in_run_on is not null and in_run_on > public.today_myt() then
    raise exception 'a delivery cannot be in the future';
  end if;

  insert into public.deliveries (
    record_id, project_id, run_on, driver, received_by, note,
    created_by, idempotency_key
  ) values (
    in_record_id, rec.project_id,
    coalesce(in_run_on, public.today_myt()),
    left(btrim(coalesce(in_driver, '')), 120),
    left(btrim(coalesce(in_received_by, '')), 120),
    left(coalesce(in_note, ''), 2000),
    auth.uid(), in_idempotency_key
  )
  returning * into run;

  return run;
exception
  when unique_violation then
    /* 按两下 —— 把已经开好的那一趟还给他，不要开第二趟。 */
    select * into run from public.deliveries
    where record_id = in_record_id and idempotency_key = in_idempotency_key;
    return run;
end;
$fn$;

revoke execute on function public.open_delivery_run(uuid, date, text, text, text, uuid)
  from public, anon;
grant execute on function public.open_delivery_run(uuid, date, text, text, text, uuid)
  to authenticated;

comment on function public.open_delivery_run(uuid, date, text, text, text, uuid) is
  'Opens one delivery run. Called by deliver_record before it moves anything, and callable on its own by a business that keeps no stock -- one body of write logic, two doors. See 20260905500000.';

-- ── 搬货那一支 ────────────────────────────────────────────────────────────
--
-- 🔴 **签名变了，所以旧的那一支一定要先 drop** —— 多一个有预设的参数
-- 对呼叫端相容，对资料库不相容，PostgREST 会直接拒绝选
-- （Could not choose the best candidate function）。20260905180000 踩过。

drop function if exists public.deliver_record(uuid);
create or replace function public.deliver_record(
  in_record_id uuid,
  /* 这一趟每一行送几件。null = 剩下的全部送完，也就是旧的那个行为。
     形状跟 receive_purchase 的 in_received 一模一样（20260905210000）——
     进货跟出货是同一件事的两个方向，两边不该有两种写法。 */
  in_lines jsonb default null,
  in_run_on date default null,
  in_driver text default null,
  in_received_by text default null,
  in_note text default null,
  in_idempotency_key uuid default null
)
returns table (moved integer, short integer, unknown integer, skipped integer, stage text,
               delivery_id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.pipeline_records;
  shelf text;
  ln public.record_lines;
  item public.catalog_items;
  lot record;
  on_hand numeric;
  want numeric;
  take numeric;
  n_moved integer := 0;
  n_short integer := 0;
  n_unknown integer := 0;
  n_skipped integer := 0;
  has_lots integer;
  is_en boolean;
  gone text;
  run public.deliveries;
  ordered_qty numeric;
  already_qty numeric;
  said jsonb;
  take_qty numeric;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null or not public.works_here(rec.project_id) then
    raise exception 'no such document in your project';
  end if;
  if rec.module_key <> 'orders' then
    raise exception 'only an order sends goods out';
  end if;

  select p.system_language = 'en' into is_en
    from public.projects p where p.id = rec.project_id;
  gone := case when is_en then 'Delivered' else '交货了' end;

  /* 🔴 一趟就是一趟。开在搬货之前，因为每一笔搬出去的货都要挂在它身上 ——
     不然「这一车送了什么」是从时间戳猜出来的，而猜出来的东西不能拿去对帐。 */
  run := public.open_delivery_run(
    in_record_id      := in_record_id,
    in_run_on         := in_run_on,
    in_driver         := in_driver,
    in_received_by    := in_received_by,
    in_note           := in_note,
    in_idempotency_key := in_idempotency_key
  );

  select pp.page_key into shelf
  from public.project_pages pp
  where pp.project_id = rec.project_id and public.is_catalog_module(pp.page_key)
  order by pp.sort_order nulls last
  limit 1;

  if shelf is not null then
    for ln in
      select * from public.record_lines
       where record_id = in_record_id
       order by sort_order
    loop
      /* 没有数量的是一口价那种行 —— 「安装费 RM 300」—— 架上没有东西要动。 */
      if coalesce(ln.qty, 0) <= 0 then
        n_skipped := n_skipped + 1;
        continue;
      end if;

      ordered_qty := coalesce(ln.qty, 0);

      /* 🔴 **已经送出去几件**，不是「送过了没有」。
         这一句 20260905210000 就写对过，而 20260905330000 抄批号那一轮
         **照记忆重打了一支**，於是它退回 `exists(...)` —— 一张分两车出的单，
         第二车从那天起永远出不去，而没有任何东西会讲。
         这是「整支重写」第三次咬人（前两次：20260831080000 的防重复、
         20260905370000 的分店守卫）。 */
      select coalesce(sum(m.qty), 0) into already_qty
      from public.stock_moves m
      where m.line_id = ln.id and m.direction = 'out';

      /* 他讲了这一行这一车送几件就照他讲的；没讲就是「剩下的全部送完」。 */
      said := null;
      if in_lines is not null then
        select x into said
        from jsonb_array_elements(in_lines) x
        where (x->>'line_id')::uuid = ln.id
        limit 1;
        if said is null then
          /* 他这一次没提到这一行 = 这一行这一车没有上车。 */
          n_skipped := n_skipped + 1;
          if already_qty < ordered_qty then n_short := n_short + 1; end if;
          continue;
        end if;
        take_qty := coalesce((said->>'qty')::numeric, 0);
      else
        take_qty := ordered_qty - already_qty;
      end if;

      if take_qty <= 0 then
        n_skipped := n_skipped + 1;
        if already_qty < ordered_qty then n_short := n_short + 1; end if;
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

      select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
        into on_hand
      from public.stock_moves m where m.item_id = item.id;

      if on_hand < take_qty then
        n_short := n_short + 1;
      end if;

      select count(*) into has_lots
      from public.stock_batches b
      where b.item_id = item.id and b.archived_at is null;

      if has_lots = 0 then
        insert into public.stock_moves (
          project_id, item_id, branch_id, doc_no, direction, qty, reason,
          against_id, line_id, moved_on, recorded_by, delivery_id
        ) values (
          rec.project_id, item.id, rec.branch_id,
          public.next_doc_no(rec.project_id, shelf),
          'out', take_qty, coalesce(rec.doc_no, ''),
          in_record_id, ln.id, public.today_myt(), auth.uid(), run.id
        );
      else
        /* 🔴 照效期最早的先出。一批不够就往下一批拿 ——
           **一行可以拆成两笔**，而那正是仓库里真的发生的事。 */
        want := take_qty;
        for lot in
          select b.id,
                 coalesce((
                   select sum(case when m.direction = 'in' then m.qty else -m.qty end)
                   from public.stock_moves m where m.batch_id = b.id
                 ), 0)::numeric as have
          from public.stock_batches b
          where b.item_id = item.id
            and b.archived_at is null
            /* 他指名了就只用那一批。 */
            and (nullif(btrim(coalesce(ln.batch_code, '')), '') is null
                 or b.code = btrim(ln.batch_code))
          order by b.expiry_on nulls last, b.received_on, b.code
        loop
          exit when want <= 0;
          if lot.have <= 0 then
            continue;
          end if;
          take := least(want, lot.have);
          insert into public.stock_moves (
            project_id, item_id, branch_id, batch_id, doc_no, direction, qty, reason,
            against_id, line_id, moved_on, recorded_by, delivery_id
          ) values (
            rec.project_id, item.id, rec.branch_id, lot.id,
            public.next_doc_no(rec.project_id, shelf),
            'out', take, coalesce(rec.doc_no, ''),
            in_record_id, ln.id, public.today_myt(), auth.uid(), run.id
          );
          want := want - take;
        end loop;

        /* 🔴 每一批都空了还差一些 —— **照样出，然后讲出来**。
           挡下去他就绕过系统卖，而那是他停用它的那一天
           （20260905050000 定的同一条）。那一笔不挂批号，
           因为它不属於任何一批，而假装它属於某一批才是说谎。 */
        if want > 0 then
          insert into public.stock_moves (
            project_id, item_id, branch_id, doc_no, direction, qty, reason,
            against_id, line_id, moved_on, recorded_by, delivery_id
          ) values (
            rec.project_id, item.id, rec.branch_id,
            public.next_doc_no(rec.project_id, shelf),
            'out', want, coalesce(rec.doc_no, ''),
            in_record_id, ln.id, public.today_myt(), auth.uid(), run.id
          );
        end if;
      end if;

      if ln.item_id is null then
        update public.record_lines set item_id = item.id where id = ln.id;
      end if;
      n_moved := n_moved + 1;
    end loop;
  end if;

  if coalesce(rec.stage, '') <> gone
     and coalesce(rec.stage, '') not in ('付清了', 'Paid') then
    update public.pipeline_records
       set stage = gone, updated_at = now()
     where id = in_record_id;
  end if;

  select r.stage into stage from public.pipeline_records r where r.id = in_record_id;
  moved := n_moved; short := n_short; unknown := n_unknown; skipped := n_skipped;
  delivery_id := run.id;
  return next;
end;
$$;

revoke execute on function public.deliver_record(uuid, jsonb, date, text, text, text, uuid)
  from public, anon;
grant execute on function public.deliver_record(uuid, jsonb, date, text, text, text, uuid)
  to authenticated;

comment on function public.deliver_record(uuid, jsonb, date, text, text, text, uuid) is
  'Opens one delivery run and sends out what is still owed on each line -- accumulated quantity, never existence, so a second lorry can leave. Extended from 20260905400000 rather than retyped; the exists() check it replaced was a regression 20260905330000 reintroduced. See 20260905500000.';

-- ── 他那一边的清单 ────────────────────────────────────────────────────────

create or replace function public.deliveries_of(in_record_id uuid)
returns table (
  id uuid,
  run_on date,
  driver text,
  received_by text,
  signed_at timestamptz,
  signed_name text,
  signed_note text,
  note text,
  lines jsonb
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
  select d.id, d.run_on, d.driver, d.received_by,
         d.signed_at, d.signed_name, d.signed_note, d.note,
         coalesce((
           /* 这一趟送了什么。**从搬货那几笔算出来的**，不是另外存一份 ——
              存一份就是同一件事两个答案，而它们迟早会不一样。 */
           select jsonb_agg(jsonb_build_object(
                    'description', l.description,
                    'qty', x.qty,
                    'unit', l.unit,
                    'batch_code', b.code,
                    'expiry_on', b.expiry_on
                  ) order by l.sort_order)
           from (
             select m.line_id, m.batch_id, sum(m.qty) as qty
             from public.stock_moves m
             where m.delivery_id = d.id
             group by m.line_id, m.batch_id
           ) x
           join public.record_lines l on l.id = x.line_id
           left join public.stock_batches b on b.id = x.batch_id
         ), '[]'::jsonb)
  from public.deliveries d
  where d.record_id = in_record_id and d.archived_at is null
  order by d.run_on desc, d.created_at desc;
end;
$fn$;

revoke execute on function public.deliveries_of(uuid) from public, anon;
grant execute on function public.deliveries_of(uuid) to authenticated;

comment on function public.deliveries_of(uuid) is
  'The runs against one document, newest first, each carrying what actually left -- computed from stock_moves, never stored twice. See 20260905500000.';

-- ── 还没送到的 ────────────────────────────────────────────────────────────
--
-- 「叫了 100，送了 90」在他画面上是一句话，而这一支就是那句话底下的算术。
-- 跟 20260905190000 的 purchase_mismatches 同一个形状：**它是一个「读」**，
-- 不是第三份单据。

create or replace function public.delivery_shortfall(in_record_id uuid)
returns table (
  line_id uuid,
  description text,
  unit text,
  ordered numeric,
  gone numeric,
  still numeric
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
  select l.id, l.description, l.unit,
         coalesce(l.qty, 0),
         coalesce(g.qty, 0),
         coalesce(l.qty, 0) - coalesce(g.qty, 0)
  from public.record_lines l
  left join (
    select m.line_id, sum(m.qty) as qty
    from public.stock_moves m
    where m.direction = 'out' and m.against_id = in_record_id
    group by m.line_id
  ) g on g.line_id = l.id
  where l.record_id = in_record_id
    /* 一口价那种行没有数量，架上也没有东西要动 —— 它永远不会「还没送到」。
       把它算进来会让每一张有运费的单都对不上（20260905190000 同一条）。 */
    and coalesce(l.qty, 0) > 0
    and coalesce(l.qty, 0) > coalesce(g.qty, 0)
  order by l.sort_order;
end;
$fn$;

revoke execute on function public.delivery_shortfall(uuid) from public, anon;
grant execute on function public.delivery_shortfall(uuid) to authenticated;

comment on function public.delivery_shortfall(uuid) is
  'What is still owed on an order, line by line. A read, not a third document -- the same shape as purchase_mismatches. Lump-sum lines (no quantity) never appear. See 20260905500000.';

-- ── 收起一趟 ──────────────────────────────────────────────────────────────
--
-- 🔴 **不删，而且搬出去的货一笔都不会自己回来。**
--
-- 那不是偷懒。一趟开错了有两种：**根本没有开出去**（那些货还在架上，
-- 而系统说它走了）· **开出去了，但是记错在另一张单上**。
-- 两种要做的事不一样，而这一支答不出是哪一种 —— 所以它只收掉这一趟的表头，
-- 货照旧要他自己去盘点（reason 写「送错了」），
-- 而那一笔盘点会留在流水上，跟这一趟一起说明发生过什么。
--
-- 一支「顺手把货搬回来」的函式，会在第二种情况下把架上的数字弄成两倍错。

create or replace function public.archive_delivery(in_delivery_id uuid)
returns public.deliveries
language plpgsql
security definer
set search_path = public
as $fn$
declare
  run public.deliveries;
begin
  select * into run from public.deliveries where id = in_delivery_id;
  if run.id is null or not public.works_here(run.project_id) then
    raise exception 'no such delivery in your project';
  end if;

  /* 🔴 客人自己签过的那一趟收不掉。
     那是他按下去的一句话，不是我们的记录 —— 我们没有资格把它拿掉。 */
  if run.signed_at is not null then
    raise exception 'the customer signed for this run -- it cannot be taken back';
  end if;

  update public.deliveries
     set archived_at = now(), updated_at = now()
   where id = in_delivery_id
  returning * into run;

  return run;
end;
$fn$;

revoke execute on function public.archive_delivery(uuid) from public, anon;
grant execute on function public.archive_delivery(uuid) to authenticated;

comment on function public.archive_delivery(uuid) is
  'Takes a run off the list without deleting it, and without pulling the stock back -- see the header for why moving it back would double the error. Refuses a run the customer signed. See 20260905500000.';

-- ── 🔴 它还不是什么（自己讲，不要等他发现）────────────────────────────────
--
--   · **画面上没有那一页** —— 这是底下那一层
--   · **签收那一半在下一支**（20260905510000）：客人在他自己那条连结上按
--   · **没有电子签名板** —— 一个用手指画出来的歪线，在争执的时候
--     证明不了任何事。**有时间戳、而且是他自己在他自己手机上按的**那一下，
--     比一条线强得多
--   · **一趟不会自动通知客人** —— 卡在同一条管道（[任务 59]）
