-- 探针，用完即丢：拿几支「先读现在有多少、再决定扣不扣」形状的函式
-- 的真身，检查有没有跟 count_stock 那次一样的竞态坑（没有锁住会变的
-- 那一行，两笔并发都读到同一个「现在还有多少」）。
create or replace function public.probe_race_candidates()
returns table (fn_name text, src text)
language sql security definer set search_path = public as $$
  select p.proname::text, pg_get_functiondef(p.oid)
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public'
    and p.proname in (
      'use_package_session', 'use_credit', 'grant_credit',
      'owe_lesson', 'use_lesson_credit', 'take_walkin_turn'
    )
  order by p.proname;
$$;
grant execute on function public.probe_race_candidates() to authenticated;
