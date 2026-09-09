-- 🔴 故意弄坏，看它红（[重点 31] 第 3 条）。**单独推一次**。
--
-- 弄坏的方式是把 **0 跟「没写」混成一句话**（`nullif(own, 0)`）——
-- 今晚第二次同一个形状（学费那一边是 20260909280000）。
--
-- 坏起来的样子：老板讲好「学徒洗头不收钱」，而柜台问价钱的时候
-- 系统回**原价 RM 38** —— 於是那个客人被收了一笔老板讲过不收的钱。
-- ⚠️ 而画面上完全正常：一个数字，一个价目表，没有任何东西会红。
-- 20260910060000 把它原样搬回去。

create or replace function public.price_for(
  in_item_id uuid,
  /* 不给就是「还没派人」—— 回原价。走单进来的那一刻就是这样。 */
  in_staff_id uuid default null
)
returns table (
  price_cents bigint,
  /* 🔴 这个数字是**他自己为这一位定的**，还是**原价**。
     少了这一栏，画面上没有办法讲「这是师傅的价」——
     而一个讲不出理由的数字，他不会信。 */
  theirs boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  item public.catalog_items;
  own bigint;
begin
  select * into item from public.catalog_items where id = in_item_id;
  if item.id is null or not public.works_here(item.project_id) then
    raise exception 'no such item in your business';
  end if;

  if in_staff_id is not null then
    select sp.price_cents into own from public.staff_prices sp
     where sp.item_id = in_item_id and sp.staff_id = in_staff_id;
  end if;

  /* ⚠️ `found` 在这里不可靠（上面那一句可能根本没跑），所以看 `own` 本身。
     而 `own` 是 0 的时候**照样是他定的价** —— 那就是「这一位做这一样不收钱」。 */
  return query select
    coalesce(nullif(own, 0), item.price_cents, 0)::bigint,
    nullif(own, 0) is not null;
end;
$$;


revoke execute on function public.price_for(uuid, uuid) from public, anon;
grant execute on function public.price_for(uuid, uuid) to authenticated;
