-- 放回去——原样从 20260910430000 抽出来，不是重打。看过 20260910440000 红过。

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
