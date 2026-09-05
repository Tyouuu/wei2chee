-- 序号 —— 一台车、一支手机、一颗电池，一个一个记。
--
-- [任务 181] 拿我们自己扫到的名单数过：怡保 262 家里
-- **车行 90 ＋ 电器 19 ＋ 手机店 13 = 122 家，47%** 要它，
-- 而**车行是怡保排第一的行业**。[任务 91] 那句「没有人给一包水泥编序号」
-- 是对着五金建材讲的（那一栏 48 家，18%），被我当成了对所有行业的判断。
--
-- 🔴 而做出来只有这么小，是因为**批号那套机器就是序号的机器**：
-- 一个序号就是一批**只有一件**的批。所以效期 · 分店 · 退货 · 出货拆批
-- 全部白捡，一栏都不用加。
--
-- 真正要加的只有三样，每一样后面都有一句他会问的话：
--   1. `catalog_items.tracks_serial`   这一件是不是一台一台管的
--   2. `stock_batches.unit_cost_cents` **这一台**进价多少（一台车一个价）
--   3. `deliver_record` 不准替他挑是哪一台
--
-- ⚠️ 而「车场里现在有哪几台」**不用新函式** —— `batches_of` 本来就答得了，
-- 今天只是多回一栏进价。少写一支，因为多一支就多一个会漂的答案。

alter table public.catalog_items
  add column if not exists tracks_serial boolean not null default false;

comment on column public.catalog_items.tracks_serial is
  '一台一台管：一个序号一件东西。预设关 —— 一包水泥永远看不到那一栏。';

alter table public.stock_batches
  add column if not exists unit_cost_cents bigint;

comment on column public.stock_batches.unit_cost_cents is
  '这一批/这一台自己的进价，sen。一台车一个价，货品身上那个 cost_cents 答不了。';


/* 开关自己一支，不去动 `add_catalog_item` 那十四个参数 ——
   多一个有预设的参数**对呼叫端相容、对资料库不相容**，加了不 drop
   那支函式整个选不到（[重点 31] 第 2 条，今天已经踩过一次）。
   而且它要带一句自己的守卫。 */
create or replace function public.set_item_serial_tracking(
  in_item_id uuid,
  in_on boolean
)
returns public.catalog_items
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.catalog_items;
  loose numeric;
begin
  select * into item from public.catalog_items where id = in_item_id;
  if item.id is null or not public.works_here(item.project_id) then
    raise exception 'no such item in your project';
  end if;

  /* 🔴 架上还有**没挂在任何一批上**的货，就不准开。
     开了之后那几件永远没有序号 —— 而画面上会同时写着
     「架上 5 件」跟「有序号的 0 件」，**同一个问题两个答案**。
     讲得出出路：先盘成零，或者一件一件补上序号。
     （关掉永远可以 —— 那是放宽。） */
  if in_on and not item.tracks_serial then
    select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
      into loose
    from public.stock_moves m
    where m.item_id = in_item_id and m.batch_id is null;
    if loose > 0 then
      raise exception
        'there are % on the shelf with no serial — count them out or give each one a serial first',
        loose;
    end if;
  end if;

  update public.catalog_items
     set tracks_serial = in_on, updated_at = now()
   where id = in_item_id
  returning * into item;
  return item;
end;
$$;

revoke execute on function public.set_item_serial_tracking(uuid, boolean) from public, anon;
grant execute on function public.set_item_serial_tracking(uuid, boolean) to authenticated;


/* 多一个有预设的参数 = 签名变了 = **先 drop 旧的**（[重点 31] 第 2 条）。
   呼叫端用具名参数，所以旧的那五个照旧打得进来。
   ⚠️ 函式本体是从 20260905320000 **原样抽出来**改两处，不是重打 ——
   第一版我重打了一遍，把它那条「已经有的效期不覆盖」的守卫
   换成了一个会覆盖的 upsert。[重点 31] 第 1 条，今天第二次差点踩到。 */
drop function if exists public.add_stock_batch(uuid, text, date, date, text);

create or replace function public.add_stock_batch(
  in_item_id uuid,
  in_code text,
  in_expiry_on date default null,
  in_received_on date default null,
  in_note text default '',
  in_unit_cost_cents bigint default null
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
    if (made.expiry_on is null and in_expiry_on is not null)
       or (made.unit_cost_cents is null and in_unit_cost_cents is not null) then
      update public.stock_batches
         set expiry_on = coalesce(made.expiry_on, in_expiry_on),
             /* 进价照抄效期那一条：**第一次讲出来的时候补上去，已经有的不覆盖**。
                同一批货分两车到是常态，而第二车的单价不该改掉整批的进价。 */
             unit_cost_cents = coalesce(made.unit_cost_cents, in_unit_cost_cents),
             updated_at = now()
       where id = made.id
      returning * into made;
    end if;
    return made;
  end if;

  insert into public.stock_batches (
    project_id, item_id, code, expiry_on, received_on, note,
    unit_cost_cents, created_by
  ) values (
    item.project_id, in_item_id, left(btrim(in_code), 60), in_expiry_on,
    coalesce(in_received_on, public.today_myt()),
    left(btrim(coalesce(in_note, '')), 500), in_unit_cost_cents, auth.uid()
  )
  returning * into made;

  return made;
end;
$$;

revoke execute on function public.add_stock_batch(uuid, text, date, date, text, bigint)
  from public, anon;
grant execute on function public.add_stock_batch(uuid, text, date, date, text, bigint)
  to authenticated;


/* 「WA 1234 A 这一台 —— 几时进的、哪一张单、卖给谁、几时出的」。
   🔴 这是唯一一支新的查询，因为它是唯一一句今天答不了的话。 */
create or replace function public.serial_history(
  in_project_id uuid,
  in_code text
)
returns table (
  item_id uuid,
  item_name text,
  code text,
  on_hand numeric,
  unit_cost_cents bigint,
  moved_on date,
  direction text,
  qty numeric,
  reason text,
  doc_no text,
  party text
)
language sql
stable
security definer
set search_path = public
as $$
  select i.id, i.name, b.code,
         coalesce((
           select sum(case when x.direction = 'in' then x.qty else -x.qty end)
           from public.stock_moves x where x.batch_id = b.id
         ), 0)::numeric,
         /* 🔴 进价只给看得到钱的人。师傅查得到「这一台在不在」，
            查不到「老板买它多少钱」—— 而回 null 不是 0，
            因为「不给看」跟「免费」是两句话。
            跟套票那一张表同一条：师傅看得到次数，看不到价钱。 */
         case when public.sees_money(in_project_id) then b.unit_cost_cents end,
         m.moved_on, m.direction, m.qty, m.reason,
         coalesce(r.doc_no, m.doc_no, ''),
         /* 对方的名字长在那张单上 —— 一笔搬货自己不知道是谁。 */
         coalesce(r.party, '')
  from public.stock_batches b
  join public.catalog_items i on i.id = b.item_id
  left join public.stock_moves m on m.batch_id = b.id
  left join public.pipeline_records r on r.id = m.against_id
  where b.project_id = in_project_id
    and lower(btrim(b.code)) = lower(btrim(in_code))
    /* `works_here` —— 柜台查一台车在不在，是他一天的工作。 */
    and public.works_here(in_project_id)
  order by m.moved_on nulls first, m.created_at nulls first;
$$;

revoke execute on function public.serial_history(uuid, text) from public, anon;
grant execute on function public.serial_history(uuid, text) to authenticated;

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

      /* 🔴 **一台一台管的东西，不准替他挑。**
         效期最早的先出，对一箱奶粉是对的 —— 哪一箱出去都一样。
         对一台车、一支手机不是：客人买的是**那一台**，
         而序号会印在保用卡跟过户文件上。挑错一台，画面上完全正常，
         而错的地方在客人手上。

         跟 [任务 148]（两间店没讲哪一间）跟 [任务 160]（盘点分不清哪一批）
         同一条：**有规则的地方照规则，没有规则的地方问他** ——
         而这里没有任何规则挑得出「对的那一台」。 */
      if item.tracks_serial then
        if nullif(btrim(coalesce(ln.batch_code, '')), '') is null then
          raise exception 'this one is tracked unit by unit — say which serial is going out';
        end if;
        if take_qty <> 1 then
          raise exception 'one serial is one unit — put each one on its own line';
        end if;
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

/* 多回一栏 = **回传型别变了** = 一样要先 drop。
   [重点 31] 第 2 条我只想到「多一个参数」，而 `returns table` 多一栏
   资料库一样拒绝：cannot change return type of existing function。
   两种都是签名变了。 */
drop function if exists public.batches_of(uuid);

create or replace function public.batches_of(in_item_id uuid)
returns table (
  batch_id uuid,
  code text,
  expiry_on date,
  received_on date,
  on_hand numeric,
  days_left integer,
  is_expired boolean,
  /* 这一台/这一箱**自己的**进价。一台车一个价，货品身上那个
     `cost_cents` 答不了。🔴 只给看得到钱的人。 */
  unit_cost_cents bigint
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
         (b.expiry_on is not null and b.expiry_on < public.today_myt()),
         case when public.sees_money(item.project_id) then b.unit_cost_cents end
  from public.stock_batches b
  where b.item_id = in_item_id and b.archived_at is null
  order by b.expiry_on nulls last, b.received_on, b.code;
end;
$$;
