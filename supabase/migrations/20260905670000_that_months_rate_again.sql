-- 改回去 —— 那个月开始那天在跑的那一份。
--
-- 20260905660000 拿掉的那一句 `and s.effective_from <= in_on` 回来了。
-- 那一支单独推过、单独跑过，红出来九条，其中两条读起来就是他在
-- vibe-dealer 那一次看到的东西：
--
--     FAIL  上个月还是 RM 800，一分都没动 — 120000
--     FAIL  上个月还是 RM 1,600 — 0
--
-- **一个已经付掉的月份，第一次变多、第二次归零，而画面上不会讲。**
--
-- ⚠️ 底下这一段是**从 20260905640000 原样搬回来的**，不是照记忆重打。
--    整支重打漏掉一条守卫，这个仓库咬过三次（20260831080000 漏掉防重复 ·
--    20260905370000 漏掉分店守卫 · 20260905330000 漏掉分批出货的数量比对）。

create or replace function public.commission_scheme_at(
  in_party_id uuid,
  in_on date
)
returns table (effective_from date, tiers jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  /* ① 那一天在跑的那一份。同一天存过两次，最后存的那一次赢。 */
  return query
    select s.effective_from, s.tiers
    from public.commission_schemes s
    where s.party_id = in_party_id
      and s.effective_from <= in_on
    order by s.effective_from desc, s.created_at desc
    limit 1;
  if found then return; end if;

  /* ② 那一天之前一份都没有 → 最早那一份。
        「我们本来就是这样算的」。 */
  return query
    select s.effective_from, s.tiers
    from public.commission_schemes s
    where s.party_id = in_party_id
    order by s.effective_from asc, s.created_at asc
    limit 1;
  if found then return; end if;

  /* ③ 一份世代都没有 —— 有人绕过 set_commission_tiers 直接写了那张表
        （policy 是 for all，所以写得了）。退回现在那一份，
        **也就是今天的行为**，而不是回一个凭空的零。 */
  return query
    select null::date,
           coalesce(
             jsonb_agg(jsonb_build_object('from_cents', t.from_cents, 'percent', t.percent)
                       order by t.from_cents),
             '[]'::jsonb)
    from public.commission_tiers t
    where t.party_id = in_party_id
    having count(*) > 0;
end;
$$;

revoke execute on function public.commission_scheme_at(uuid, date) from public, anon, authenticated;
