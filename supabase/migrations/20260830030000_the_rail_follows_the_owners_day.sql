-- supabase/migrations/20260830030000_the_rail_follows_the_owners_day.sql
--
-- The sidebar listed 收款 before 报价单 -- the money page above the thing that
-- produces the money -- and a salon, whose entire day is appointments, opened
-- its system to
--
--     总览 → 客户 → 收款 → 预约 → 官网
--
-- with 预约 fourth. The order came from the order the modules happen to be
-- written in `lib/portal/module-catalog.ts`, which was grouped by data model:
-- the spine, then sell-side, then month-end, then reference.
--
-- ── WHY IT IS NOW THE OWNER'S DAY ─────────────────────────────────────────
--
-- The rail's own grouping function already argues this, and it argued it
-- better than the tiering I proposed: 「THE SECTIONS ARE THE OWNER'S DAY, not
-- the data model」. That comment was right and the flat order underneath it
-- disagreed with it. Now both say the same thing:
--
--     总览                                   what you open it for
--     报价单 预约 订单 项目 任务              the work, in the order it moves
--     收款 开销 佣金                          the money that work produced
--     客户 供应商 员工 库存                   the nouns the work referenced
--     对账 报表 排名                          month-end; adds no data at all
--     官网                                   the only page a stranger reads
--
--     沙龙   总览 → 预约 → 收款 → 客户 → 官网
--     装修   总览 → 报价单 → 项目 → 收款 → 客户 → 官网
--
-- ── WHY THIS FILE EXISTS AT ALL ───────────────────────────────────────────
--
-- `module_rank()` is a second copy of that order, in SQL, and
-- module-catalog.test.ts has a guard that fails when the two drift. Editing
-- the TypeScript alone made it fail on the first run, which is exactly what a
-- guard against a hand-maintained second list is for. Nothing else changes:
-- the function is display order, and a customer who has ever dragged a page
-- keeps their own order whole (see sortPages).

create or replace function public.module_rank(key text)
returns integer
language sql
immutable
set search_path = public
as $$
  select coalesce(
    array_position(
      array[
        'dashboard',
        'quotations', 'bookings', 'orders', 'projects', 'tasks',
        'payments', 'expenses', 'commission',
        'customers', 'suppliers', 'staff', 'inventory',
        'reconciliation', 'reports', 'ranking',
        'website'
      ]::text[],
      key
    ),
    999
  );
$$;

comment on function public.module_rank(text) is
  'Display rank for a module key: the owner''s day -- work, the money it produced, the nouns it referenced, month-end, then the public page. Mirrors MODULE_KEYS in lib/portal/module-catalog.ts, and module-catalog.test.ts fails if the two drift.';
