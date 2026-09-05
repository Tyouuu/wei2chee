-- 那个标签，跟画面上那个数字，要讲同一份办法。
--
-- ── 20260905640000 的尺子第一次跑就抓到我造的一个 ────────────────────────
--
-- 那一支给 `commission_schemes_of` 加了一栏 `in_force_now`，意思是
-- **「今天」在跑的那一份**。而画面上那个佣金数字用的是
-- **「这个月一号」在跑的那一份**（`staff_earnings.rate_from`）。
--
-- 两个在很正常的情况下就会不一样，实测：
--
--   上个月一号  一成      ← 这个月的数字照它算
--   今天        一成半    ← `in_force_now` 指的是它
--   上个月一号  两成（回头改的，created_at 比较晚）← 这个月的数字其实照它算
--
--   → 画面会写「现在在跑：一成半」，而旁边那个数字是照**两成**算出来的。
--
-- 🔴 **一个跟旁边那个数字对不上的标签，比没有标签糟** —— 而它不会报错，
--    不会变红，只会让他每个月看一次然后有一天问「为什么对不上」。
--    这正是这个仓库出过二十次的那个形状，只是这一次是标签不是按钮。
--
-- ⚠️ **不加第三个标签，把错的那个换掉。**「今天在跑哪一份」这个问题
--    画面上没有人在问 —— 他问的永远是「这个月这个数字怎么来的」。
--
-- ⚠️ 改回传型别跟改签名一样，`create or replace` 会直接拒绝，所以先 drop。

drop function if exists public.commission_schemes_of(uuid);

create or replace function public.commission_schemes_of(in_party_id uuid)
returns table (
  id uuid,
  effective_from date,
  tiers jsonb,
  changed_at timestamptz,
  /* 🔴 这个月那个数字，照的就是这一份。
     跟 `staff_earnings(本月).rate_from` 永远是同一份 —— 两边问的是
     同一支 `commission_scheme_at`，同一个日子（这个月一号）。 */
  used_this_month boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  mine boolean;
  month_start date;
  using_from date;
begin
  select exists (
    select 1 from public.directory_entries d
    where d.id = in_party_id and public.sees_money(d.project_id)
  ) into mine;
  if not mine then
    return;
  end if;

  month_start := date_trunc('month', public.today_myt())::date;

  /* 同一支函式，同一个日子 —— 所以标签跟数字不可能分开。 */
  select s.effective_from into using_from
  from public.commission_scheme_at(in_party_id, month_start) s
  limit 1;

  return query
    select s.id,
           s.effective_from,
           s.tiers,
           s.created_at,
           /* 同一天可能有两份（他改了两次），而算的时候是 created_at 晚的
              那一份赢。所以这里也要挑同一份，不是「日期一样就都算」。 */
           (s.id = (
             select s2.id from public.commission_schemes s2
             where s2.party_id = in_party_id
               and s2.effective_from is not distinct from using_from
             order by s2.created_at desc
             limit 1
           ))
    from public.commission_schemes s
    where s.party_id = in_party_id
    order by s.effective_from desc, s.created_at desc;
end;
$$;

revoke execute on function public.commission_schemes_of(uuid) from public, anon;
grant execute on function public.commission_schemes_of(uuid) to authenticated;

comment on function public.commission_schemes_of(uuid) is
  'Every commission scheme this person has had, newest first. used_this_month marks the one THIS MONTH''S figure is computed from -- the same function and the same date staff_earnings uses, so the label can never disagree with the number beside it. See 20260905650000.';
