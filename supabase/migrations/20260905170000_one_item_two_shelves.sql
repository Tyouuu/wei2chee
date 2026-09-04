-- 一件货，两间店 —— 而在今天之前，架上的数字是把两间加起来的一个数。
--
-- ── 为什么这一格排在这里 ──────────────────────────────────────────────────
--
-- [任务 67] 实查 SQL Account，它 `Stock` 那一栏自己列的第一个卖点就是
-- **多仓**；而 Tunai · Aoikumo · StoreHub **三家马来西亚对手全部按分店收费**
-- —— 一个市场的对手按什么收钱，就是那个市场的客户有什么。
--
-- [任务 127] 8-31 立分店柱子的时候，白纸黑字把这一格划出去：
--
--   「库存不挂分店（故意的）：那不是多一个参数，它会改变 `stock_on_hand`
--     的意思，而盘点 · 收货 · 补货线全部要跟着变。**那是它自己的一格。**」
--
-- 这就是那一格。
--
-- ── 🔴 一件货，不是两件货 ────────────────────────────────────────────────
--
-- 最省事的做法是让每一间店各建一条「水泥 50kg」。ERPNext 跟 SQL 都不这样做，
-- 而理由很实际：那样他就**再也答不出「我一共有几包水泥」**，
-- 补货线要设两次，卖价要改两次，而两条同名的货在报表上是两样东西。
--
-- 所以：**一件货，余额分店算**。那一根维度住在**每一笔进出**上
-- （`stock_moves.branch_id`，从 20260901070000 就在），不住在货品上。
--
-- ── 🔴 `stock_on_hand` 一个字都不改 ──────────────────────────────────────
--
-- 它今天回的是**全公司的总数**，而画面上那几页读的就是它。
-- 把它偷偷改成分店的，等於让每一个已经在读它的地方**换了一个意思而不出错** ——
-- 那比少一个功能糟得多。
--
-- 所以新的是**另一个 view**：`stock_by_branch`。两个各自回答一个问题：
--
--   stock_on_hand    我一共有几包        （既有，不动）
--   stock_by_branch  每一间店各有几包    （新的）
--
-- ⚠️ 一间店的生意完全没有变化：它每一笔的 branch 都是 null，
-- 两个 view 回的是同一件事。**多分店不用他去开任何设定。**

-- ── 每一间店各有几件 ──────────────────────────────────────────────────────
create or replace view public.stock_by_branch
with (security_invoker = true)
as
  select
    i.id as item_id,
    i.project_id,
    i.module_key,
    i.name,
    i.unit,
    /* null = 还没分店，或者一间店的生意。**要留着，不可以丢掉** ——
       丢掉它，一间店的生意在这张表上会是空的。 */
    m.branch_id,
    b.name as branch_name,
    coalesce(sum(m.qty) filter (where m.direction = 'in'), 0)
      - coalesce(sum(m.qty) filter (where m.direction = 'out'), 0) as on_hand,
    max(m.moved_on) as last_moved_on,
    count(m.id) as moves
  from public.catalog_items i
  join public.stock_moves m on m.item_id = i.id
  left join public.branches b on b.id = m.branch_id
  where i.archived_at is null
  group by i.id, m.branch_id, b.name;

comment on view public.stock_by_branch is
  'On hand per item PER BRANCH. `security_invoker = true` is load-bearing -- without it this reads past RLS, which cost one business four rows of another shelf on the day stock shipped (20260901080000). stock_on_hand still answers the whole-business total and is unchanged; these two answer different questions on purpose. See 20260905170000.';

grant select on public.stock_by_branch to authenticated;

-- ── 一笔进出说得出它在哪一间店 ────────────────────────────────────────────
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
  /* 这一笔发生在哪一间店。**加在最后而且有预设**，所以既有的每一个
     呼叫端一个字都不用改 —— 不给就还是跟着货品自己那一间走。 */
  in_branch_id uuid default null
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

  /* 那一间店要是这一家自己的。一笔挂在别人家店号上的进出，
     在画面上完全正常，而它会让月底那张分店表把别人的货算进来。 */
  if not public.branch_is_ours(item.project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  insert into public.stock_moves (
    project_id, item_id, branch_id, doc_no, direction, qty, reason,
    against_id, cost_cents, moved_on, note, extra, idempotency_key, recorded_by
  ) values (
    item.project_id,
    in_item_id,
    /* 🔴 这一笔讲的那一间赢过货品身上那一间。
       货品身上那一栏讲的是「它平常放在哪」；这一笔讲的是
       「这一次是在哪一间店进/出的」，而后者才是帐。 */
    coalesce(in_branch_id, item.branch_id),
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


-- ── 盘点数的是那一间店的架子 ──────────────────────────────────────────────
create or replace function public.count_stock(
  in_item_id uuid,
  in_counted numeric,
  in_reason text default '',
  in_note text default '',
  in_idempotency_key uuid default null,
  /* 数的是哪一间店的架子。 */
  in_branch_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  the_project uuid;
  open_branches integer;
  before_qty numeric;
  diff numeric;
  moved public.stock_moves;
  is_en boolean;
  the_reason text;
begin
  select i.project_id into the_project
  from public.catalog_items i
  where i.id = in_item_id and public.works_here(i.project_id);
  if the_project is null then
    raise exception 'no such item in your project';
  end if;

  if in_counted is null or in_counted < 0 then
    raise exception 'a count cannot be negative';
  end if;

  if not public.branch_is_ours(the_project, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  /* ── 🔴 两间店以上，一定要讲是哪一间 ───────────────────────────────
     这一条不是龟毛，它挡的是**静静毁掉库存**：
     一间店在 Puchong 数出 84，而全公司有 91（那边 84 ＋ 吉隆坡 7）。
     不问哪一间，这一支会写 −7，把吉隆坡那 7 包抹掉，
     **而画面上没有任何东西会讲**。

     其余每一处我们都是「讲事实，判断留给他」（额度不挡单、
     架上不够照样出货）—— 这里问，是因为**猜错会毁掉资料**，
     而那两处猜错只是少一句提醒。 */
  select count(*) into open_branches
  from public.branches b where b.project_id = the_project and b.active;

  if open_branches > 1 and in_branch_id is null then
    select p.system_language = 'en' into is_en
      from public.projects p where p.id = the_project;
    if is_en then
      raise exception
        'You have more than one branch, so say which shelf you counted -- counting without one would wipe the stock at the others.';
    else
      raise exception
        '你有不止一间店，所以要讲清楚数的是哪一间的架子 —— 不讲会把其他店的库存抹掉。';
    end if;
  end if;

  /* 🔴 自己读，不要相信浏览器送来的那个数字。见档头 ——
     两个人同时盘点的时候，那是唯一挡得住的地方。
     ⚠️ 而且读的是**那一间店**的数量，不是全公司的。 */
  select coalesce(sum(case when m.direction = 'in' then m.qty else -m.qty end), 0)
    into before_qty
  from public.stock_moves m
  where m.item_id = in_item_id
    and (in_branch_id is null or m.branch_id = in_branch_id);
  before_qty := coalesce(before_qty, 0);

  diff := in_counted - before_qty;

  /* 数出来跟系统一样 —— **什么都不写**，而且要讲出来。
     写一笔 0 的流水，是在他的帐上加一行没有发生过的事。 */
  if diff = 0 then
    return jsonb_build_object('before', before_qty, 'counted', in_counted, 'moved', 0);
  end if;

  /* 🔴 那个词跟着**这个系统自己的语言**走，不是写死中文。
     前端传得出他自己的词就用他的（每一行生意讲法不一样）；
     传不出来才退回这两个。一个英文系统里的「盘点」，
     是[重点 22d] 讲的那件事：他会以为那是产品的毛病。 */
  the_reason := nullif(btrim(coalesce(in_reason, '')), '');
  if the_reason is null then
    select p.system_language = 'en' into is_en
      from public.projects p where p.id = the_project;
    the_reason := case when is_en then 'Stocktake' else '盘点' end;
  end if;

  moved := public.move_stock(
    in_item_id := in_item_id,
    in_direction := case when diff > 0 then 'in' else 'out' end,
    in_qty := abs(diff),
    in_branch_id := in_branch_id,
    in_reason := the_reason,
    in_note := left(coalesce(in_note, ''), 2000),
    in_idempotency_key := in_idempotency_key
  );

  return jsonb_build_object(
    'before', before_qty,
    'counted', in_counted,
    'moved', diff,
    'move_id', moved.id,
    'doc_no', moved.doc_no
  );
end;
$$;

