-- 同一样服务，不同的人不同的价钱 —— 墙上那张价目表多一栏，就这样。
--
-- ── 为什么（2026-09-10 深度研究，[任务 341](../docs/founder-tasks.md#341)）────
--
-- Fresha 的原话：「customize a service's cost and timing for specific team
-- members or locations… Clients will automatically see the price and duration
-- when booking with a specific team member.」Zenoti 卖两次（Premium Provider
-- Pricing · Custom service pricing）。
--
-- **而马来西亚几乎每一家沙龙就是这样定价的**：Ah Ming 剪 18，师傅剪 38。
-- 没有这一栏，老板只有两条路，两条都会咬人：
--   · 开两个服务（「剪发（资深）」「剪发（初级）」）→ 底下每一张报表、
--     每一条抽成规矩、每一个「他卖什么」的清单都被拆成两半
--   · 干脆不列初级价 → **丢掉整条走单的生意**（那是街边店的一半）
--
-- ── 🔴 只做价钱，不做时长 ─────────────────────────────────────────────────
--
-- Fresha 那一句里有 `cost and duration`，而**时长我们不做** ——
-- 他 2026-09-10 拍板过同一件事（[重点 34](../docs/founder-points.md)）：
-- `不一定要规范时间`。墙上那张价目表上没有分钟数，这里也不要有。
--
-- ── 纸上长什么样 ──────────────────────────────────────────────────────────
--
--     洗剪吹    学徒 18   师傅 38
--     染        学徒 --   师傅 180
--
-- 一格一个数字，**而空着的那一格是「跟原价走」，不是「不给做」**。
-- 所以这张表只存**不一样的那几格**，一样的那几格根本不进来。

create table if not exists public.staff_prices (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 哪一样服务 —— 他货品／服务那一页上的那一行。 */
  item_id uuid not null references public.catalog_items(id) on delete cascade,

  /* 哪一位。 */
  staff_id uuid not null references public.directory_entries(id) on delete cascade,

  /* 这一位做这一样收多少。**0 是真的**（学徒洗头不收钱）。 */
  price_cents bigint not null check (price_cents >= 0),

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,

  /* 一个人一样服务只有一个价 —— 两个价钱是一张吵架的价目表。 */
  constraint staff_prices_one_each unique (item_id, staff_id)
);

create index if not exists staff_prices_by_project
  on public.staff_prices (project_id, item_id);

alter table public.staff_prices enable row level security;

drop policy if exists "staff_prices_members" on public.staff_prices;
create policy "staff_prices_members" on public.staff_prices
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

comment on table public.staff_prices is
  'The wall price list with a column per stylist. Only the cells that DIFFER live here -- an absent row means the item''s own price, not "cannot do it". Price only: the founder ruled out durations on 2026-09-10. See 20260910040000.';

-- ── 写一格 ────────────────────────────────────────────────────────────────

create or replace function public.set_staff_price(
  in_item_id uuid,
  in_staff_id uuid,
  /* 不给（null）＝ **把这一格擦掉**，这一位回到原价。
     跟 0 是两件事：0 是「这一位做这一样不收钱」。 */
  in_price_cents bigint default null
)
returns public.staff_prices
language plpgsql
security definer
set search_path = public
as $$
declare
  item public.catalog_items;
  row public.staff_prices;
begin
  select * into item from public.catalog_items where id = in_item_id;
  if item.id is null or not public.works_here(item.project_id) then
    raise exception 'no such item in your business';
  end if;
  /* 🔴 定价是老板的事 —— 跟 `set_commission_tiers` · `set_class_fee` ·
     `set_booking_rules` 同一条。柜台照着收，不改那张表。 */
  if not public.sees_money(item.project_id) then
    raise exception 'the price list is for the owner';
  end if;
  perform 1 from public.directory_entries
   where id = in_staff_id and project_id = item.project_id;
  if not found then
    raise exception 'that person does not work here';
  end if;

  if in_price_cents is null then
    delete from public.staff_prices
     where item_id = in_item_id and staff_id = in_staff_id;
    return null;
  end if;
  if in_price_cents < 0 then
    raise exception 'a price cannot be less than nothing';
  end if;

  insert into public.staff_prices
    (project_id, item_id, staff_id, price_cents, updated_by)
  values (item.project_id, in_item_id, in_staff_id, in_price_cents, auth.uid())
  on conflict (item_id, staff_id) do update
    set price_cents = excluded.price_cents,
        updated_at = now(),
        updated_by = auth.uid()
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.set_staff_price(uuid, uuid, bigint) from public, anon;
grant execute on function public.set_staff_price(uuid, uuid, bigint) to authenticated;

-- ── 🔴 这一位做这一样，收多少 ─────────────────────────────────────────────

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
    coalesce(own, item.price_cents, 0)::bigint,
    own is not null;
end;
$$;

revoke execute on function public.price_for(uuid, uuid) from public, anon;
grant execute on function public.price_for(uuid, uuid) to authenticated;

comment on function public.price_for(uuid, uuid) is
  'What this person charges for this service, falling back to the item''s own price. Returns whether the number is theirs or the fallback, because a figure that cannot say where it came from is one he will not trust. See 20260910040000.';

-- ── 整张价目表，一次读完 ──────────────────────────────────────────────────

create or replace function public.staff_price_list(in_project_id uuid)
returns table (
  item_id uuid,
  item text,
  base_cents bigint,
  staff_id uuid,
  staff_name text,
  price_cents bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.name, c.price_cents, d.id, d.name, sp.price_cents
    from public.staff_prices sp
    join public.catalog_items c on c.id = sp.item_id
    join public.directory_entries d on d.id = sp.staff_id
   where sp.project_id = in_project_id
     and public.sees_money(in_project_id)
   order by c.name, sp.price_cents desc, d.name;
$$;

revoke execute on function public.staff_price_list(uuid) from public, anon;
grant execute on function public.staff_price_list(uuid) to authenticated;
