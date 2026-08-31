-- supabase/migrations/20260831130000_the_rail_learns_the_buying_side.sql
--
-- The THIRD list of the same keys, and the one that decides what order the
-- owner's sidebar is in. module-catalog.test.ts went red the moment 进货单 was
-- added to the catalogue, which is the whole reason that guard exists.
--
-- 进货单 sits with the WORK, not with the money: the group's own comment reads
-- 「the owner's day -- work, the money it produced, the nouns it referenced,
-- month-end, then the public page」, and buying is part of a day rather than a
-- consequence of one. So the rail reads 卖的单 → 买的单 → 钱 → 人 → 月底 → 官网.
--
-- ⚠️ THREE COPIES OF ONE LIST, and this file is the third one touched in an
-- hour. They are not merged because two of them are SQL and one is TypeScript
-- and neither language can import the other -- which is exactly why every one
-- of them is walked by module-catalog.test.ts rather than trusted.

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
        'quotations', 'bookings', 'orders', 'projects', 'tasks', 'purchases',
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
  'Display rank for a module key: the owner''s day -- work (sold and bought), the money it produced, the nouns it referenced, month-end, then the public page. Mirrors MODULE_KEYS in lib/portal/module-catalog.ts, and module-catalog.test.ts fails if the two drift.';
