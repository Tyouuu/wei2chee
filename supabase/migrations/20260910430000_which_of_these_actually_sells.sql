-- 进的货,卖得好不好,还要多久才会没货。
--
-- ── 为什么（founder 2026-09-10 讲的,[重点 35]）──────────────────────────
--
-- `有人讲用完了 就要去扣库存 然后客户可以分析到他们进的产品 卖了多少份
--  然后一些details是要有的 销量好吗 总共用了多久才能卖完 要不要补货
--  这些东西跟板块才是客户真正需要的东西 信息`
--
-- 「用完了扣库存」那一半已经在跑了——`move_stock`（20260901070000）·
-- 美容那边用掉一支就真的少一支（`add_visit_product`,20260910070000）。
-- **缺的是第二半**：那些移动堆起来之后,老板打开一页,答不答得出
-- 「这一件卖得好不好、要不要补货」。今天一个查得到这句话的地方都没有——
-- `RankList` 那一块只排过「谁欠我最多钱」,没有一处排过「哪一件东西动得快」。
--
-- ── 只用已经在的资料,不发明新的记帐方式 ───────────────────────────────────
--
-- `stock_moves` 本来就有**每一次**出货的数量跟日子（20260901070000）。
-- **不分「卖给客人」跟「疗程用掉」**——对老板来说两者都是「这瓶东西离开了
-- 架子,要补货」,分那两种反而是在替他多问一个他不会问的问题。
--
-- 三个数字,没有一个是猜的：
--   `sold_recent`  近 N 天出去了多少——**销量好不好**
--   `days_of_stock` 照这个速度还撑几天——**要不要补**。
--                   没有出过货就是 null（不知道就不编——[重点 33]）
--   `below_reorder` 沿用他自己订的补货线（`reorder_at`,一直都有）
--
-- 「总共用了多久才卖完」（已经清空那一批的历史）今天不算——
-- 那要追一整套「哪一批进的、哪一批卖的」配对,比这三个数字复杂得多,
-- 而**这三个数字已经答得了他真正要做的那个决定**（要不要现在下单）。
-- 复杂那一版留着,登记进任务档,不在这一支里生出来。

create or replace function public.product_performance(
  in_project_id uuid,
  in_days int default 30
)
returns table (
  item_id uuid,
  name text,
  unit text,
  on_hand numeric,
  sold_recent numeric,
  days_of_stock numeric,
  reorder_at numeric,
  below_reorder boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    i.id,
    i.name,
    i.unit,
    coalesce(sum(m.qty) filter (where m.direction = 'in'), 0)
      - coalesce(sum(m.qty) filter (where m.direction = 'out'), 0) as on_hand,
    coalesce(
      sum(m.qty) filter (
        where m.direction = 'out'
          and m.moved_on > public.today_myt() - greatest(1, coalesce(in_days, 30))
      ),
      0
    ) as sold_recent,
    /* 卖完这些还要几天——出货速度是 0 就答不出来,不硬填一个无穷大。 */
    case
      when coalesce(
             sum(m.qty) filter (
               where m.direction = 'out'
                 and m.moved_on > public.today_myt() - greatest(1, coalesce(in_days, 30))
             ),
             0
           ) > 0
      then round(
        (
          coalesce(sum(m.qty) filter (where m.direction = 'in'), 0)
            - coalesce(sum(m.qty) filter (where m.direction = 'out'), 0)
        )
        / (
          sum(m.qty) filter (
            where m.direction = 'out'
              and m.moved_on > public.today_myt() - greatest(1, coalesce(in_days, 30))
          ) / greatest(1, coalesce(in_days, 30))::numeric
        ),
        1
      )
    end as days_of_stock,
    i.reorder_at,
    i.reorder_at is not null
      and (
        coalesce(sum(m.qty) filter (where m.direction = 'in'), 0)
          - coalesce(sum(m.qty) filter (where m.direction = 'out'), 0)
      ) < i.reorder_at as below_reorder
  from public.catalog_items i
  left join public.stock_moves m on m.item_id = i.id
  where i.project_id = in_project_id
    and i.archived_at is null
    and public.works_here(in_project_id)
  group by i.id
  order by sold_recent desc, i.name;
$$;

revoke execute on function public.product_performance(uuid, int) from public, anon;
grant execute on function public.product_performance(uuid, int) to authenticated;

comment on function public.product_performance(uuid, int) is
  'Per item: how much left, how much moved out in the window, and at that pace how many days of stock remain (null when nothing has moved -- not guessed). The one page nobody had built: which of what he stocked is actually earning its shelf space. See 20260910430000.';
