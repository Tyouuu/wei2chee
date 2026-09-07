-- 三碟粿条，出了一碟。
--
-- 桌台那一支（20260908010000）之后，餐饮那一条链剩最后一节：
-- **厨房还有什么没出**。今天没有任何地方答得了。
--
-- ---------------------------------------------------------------------------
-- 抄的那一样，是 frappe/hospitality 唯一真正值钱的一栏
-- ---------------------------------------------------------------------------
--   Restaurant Order Entry Item：item · qty · **served (Int)** · rate
--
-- 🔴 served 是一个**数字**，不是一个勾。三碟粿条出了一碟，剩两碟 ——
--    一个勾答不了那一句，而那正好是厨房整天在问的那一句。
--
-- ---------------------------------------------------------------------------
-- 🔴 而它有一个会咬人的地方，先量出来才做
-- ---------------------------------------------------------------------------
-- 加菜今天只有一条路：set_record_lines —— 而它是**整批换掉**
-- （全删再全插，20260905380000）。所以一张单每加一碟菜，
-- **已经出的那几碟会归零，厨房重做一次**，而画面上什么都不会讲。
-- 那正是任务 93 付过学费的那个形状（整批换让每一行拿到新 id，
-- 收货的锚点就断了）。
--
-- → 所以这一支连 append_record_line 一起做：
--   **一间茶餐室加菜不是「整批换掉这张单的行」，是「多加一行」** ——
--   那本来就是两个不同的动作，而这个 schema 今天只有前一个。
--
-- ⚠️ 而 set_record_lines **一个字都没改**（重点 31：先做「加」）。
--    它在出过菜的单上照样会把 served 洗掉 —— 那是一个**收紧**，
--    要单独做，而且要在这一支之后（见 20260908050000）。

alter table public.record_lines
  add column if not exists served_qty numeric(14, 3) not null default 0;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'record_lines_served_sane'
  ) then
    alter table public.record_lines
      add constraint record_lines_served_sane check (served_qty >= 0);
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- 1. 加一碟 —— 不动已经在的那几碟
-- ---------------------------------------------------------------------------
-- ⚠️ 它**不吃** set_record_lines 那条「货动过了就锁住」的守卫，而那不是漏掉：
--    那一条护的是**已经在的那几行**（它们已经出过货了，改它们等於让库存说谎），
--    而加一行一个字都没有动到它们。
create or replace function public.append_record_line(
  in_record_id uuid,
  in_description text,
  in_qty numeric default null,
  in_unit text default '',
  in_unit_price_cents bigint default null,
  in_amount_cents bigint default null,
  in_item_id uuid default null,
  in_note text default ''
)
returns public.record_lines
language plpgsql
security definer
set search_path = public
as $fn$
declare
  rec public.pipeline_records;
  how_many integer;
  next_sort integer;
  row public.record_lines;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if not found then
    raise exception 'no such document';
  end if;
  if not public.works_here(rec.project_id) then
    raise exception 'no such document in your project';
  end if;
  if btrim(coalesce(in_description, '')) = '' then
    raise exception 'every line needs a description';
  end if;

  select count(*), coalesce(max(sort_order), -1) + 1
    into how_many, next_sort
  from public.record_lines where record_id = in_record_id;
  if how_many >= 200 then
    raise exception 'too many lines on one document';
  end if;

  /* 那件货一定要在他自己的货架上（跟 set_record_lines 同一条）。 */
  if in_item_id is not null
     and not exists (
       select 1 from public.catalog_items i
       where i.id = in_item_id and i.project_id = rec.project_id
     ) then
    raise exception 'that item is not on your shelf';
  end if;

  insert into public.record_lines (
    record_id, project_id, description, qty, unit,
    unit_price_cents, amount_cents, item_id, note, sort_order
  ) values (
    in_record_id, rec.project_id, left(btrim(in_description), 300),
    in_qty, left(btrim(coalesce(in_unit, '')), 30),
    in_unit_price_cents,
    /* 他没给金额就用 数量 × 单价 算 —— 两样都没有就是 0
       （一口价那种行的金额是他自己填的）。 */
    coalesce(in_amount_cents,
             case when in_qty is not null and in_unit_price_cents is not null
                  then round(in_qty * in_unit_price_cents)::bigint
                  else 0 end),
    in_item_id, left(btrim(coalesce(in_note, '')), 500), next_sort
  ) returning * into row;

  /* 那一行上的总额跟着走 —— 跟 set_record_lines 一样，不然那张单自己打架。 */
  update public.pipeline_records
     set amount_cents = (
           select coalesce(sum(l.amount_cents), 0)
           from public.record_lines l where l.record_id = in_record_id
         ),
         updated_at = now()
   where id = in_record_id;

  return row;
end;
$fn$;

revoke execute on function public.append_record_line(uuid, text, numeric, text, bigint, bigint, uuid, text) from public, anon;
grant execute on function public.append_record_line(uuid, text, numeric, text, bigint, bigint, uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 2. 出菜 —— 出几件，不是出了没有
-- ---------------------------------------------------------------------------
create or replace function public.serve_line(
  in_line_id uuid,
  /* 这一次出几件。可以是负的 —— 菜退回来、按错了。 */
  in_qty numeric default 1
)
returns table (
  line_id uuid,
  description text,
  ordered numeric,
  served numeric,
  /* 还有几件没出 —— 算出来的，厨房要看的就是它。 */
  still_due numeric
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  ln public.record_lines;
  after numeric;
begin
  select * into ln from public.record_lines where id = in_line_id for update;
  if not found then
    raise exception 'no such line';
  end if;
  if not public.works_here(ln.project_id) then
    raise exception 'no such line in your project';
  end if;
  if in_qty is null or in_qty = 0 then
    raise exception 'say how many came out';
  end if;

  /* 🔴 没有数量的那种行出不了 —— 一行「防水工程 RM 4,500」没有「几件」，
     而替它猜一个 1 就是发明一个他没有讲过的数字（重点 29 / 任务 89）。 */
  if ln.qty is null then
    raise exception 'this line has no quantity, so there is nothing to count out';
  end if;

  after := ln.served_qty + in_qty;
  if after < 0 then
    raise exception 'that would take it below zero — % have gone out so far', ln.served_qty;
  end if;
  /* 🔴 出得比点的多 → 拒绝，而且讲差多少。
     一个静静让它超过的厨房屏，会让下一碟菜永远排不进队。 */
  if after > ln.qty then
    raise exception 'only % of % are still to come out', ln.qty - ln.served_qty, ln.qty;
  end if;

  update public.record_lines
     set served_qty = after
   where id = in_line_id
  returning * into ln;

  return query select ln.id, ln.description, ln.qty, ln.served_qty,
                      (ln.qty - ln.served_qty)::numeric;
end;
$fn$;

revoke execute on function public.serve_line(uuid, numeric) from public, anon;
grant execute on function public.serve_line(uuid, numeric) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. 厨房还有什么没出
-- ---------------------------------------------------------------------------
-- ⚠️ **一分钱都不回** —— 厨房不需要知道那一碟卖多少。
--    （所以它是 works_here，而且那个人看到的每一栏都跟钱无关。）
--
-- 🔴 「几个钟头以内」是一个参数，不是一条我发明的结帐规矩。
--    一个厨房的屏只看今天 —— 而少了这一条，一碟三个星期前忘了出的菜
--    会永远挂在上面，然后整块屏没有人看（跟一把天天叫狼的尺同一件事）。
create or replace function public.kitchen_queue(
  in_project_id uuid,
  in_since_hours integer default 24
)
returns table (
  line_id uuid,
  record_id uuid,
  doc_no text,
  /* 哪一桌 —— 打包单没有桌子，那一栏就是空的。 */
  table_name text,
  description text,
  ordered numeric,
  served numeric,
  still_due numeric,
  unit text,
  note text,
  ordered_at timestamptz,
  /* 点了多久了 —— 排队排最前那一碟就是等最久的那一碟。 */
  waiting_minutes integer
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id,
         r.id,
         r.doc_no,
         t.name,
         l.description,
         l.qty,
         l.served_qty,
         (l.qty - l.served_qty)::numeric,
         nullif(btrim(l.unit), ''),
         nullif(btrim(l.note), ''),
         l.created_at,
         greatest(0, floor(extract(epoch from (now() - l.created_at)) / 60))::integer
  from public.record_lines l
  join public.pipeline_records r on r.id = l.record_id
  left join public.dining_tables t on t.id = r.table_id
  where l.project_id = in_project_id
    and r.archived_at is null
    and l.qty is not null
    and l.served_qty < l.qty
    and l.created_at >= now() - make_interval(hours => greatest(1, coalesce(in_since_hours, 24)))
    and public.works_here(l.project_id)
  order by l.created_at, l.sort_order;
$$;

revoke execute on function public.kitchen_queue(uuid, integer) from public, anon;
grant execute on function public.kitchen_queue(uuid, integer) to authenticated;
