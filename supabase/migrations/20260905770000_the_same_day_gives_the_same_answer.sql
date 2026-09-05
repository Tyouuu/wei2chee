-- 同一天存过两次，两条路要给同一个答案。
--
-- ── 洞是用眼睛看那张图看到的（重点 7l），尺子一条都没红 ─────────────────────
--
-- 「Earlier」那一段把同一天存过的两份都列出来，而资料库只认其中一份。
-- 去查它认哪一份，才看到 `commission_scheme_at` 两条退路的排序是**反的**：
--
--   ① 那一天在跑的那一份   order by effective_from desc, created_at **desc**
--   ② 那一天之前一份都没有 order by effective_from asc,  created_at **asc**   <- 反的
--
-- 🔴 **後果是一个真的错，而且画面上永远不会讲**：
--    他今天第一次写抽成，打错了（15%），当天发现、改成对的（30%）。
--    · 这个月走 ② → 拿**先存的那一份**，也就是**他打错的那一份**
--    · 下个月走 ① → 拿**后存的那一份**，也就是对的
--    同一份办法，这个月一个答案，下个月另一个答案。
--
-- 改的是一个字：② 的 `created_at asc` -> `desc`。
-- 「最早那一天」不变（那是 ② 存在的理由：一份世代都还没有的时候，
-- 「我们本来就是这样算的」）；变的只有**同一天里哪一次算数** ——
-- 而那件事只有一个说得通的答案：**他最后一次讲的那一次。**
--
-- ⚠️ 签名没有变，所以不用先 drop（重点 31 第 2 条讲的是签名变了那一种）。
-- ⚠️ 整支从 20260905640000 原样搬过来、只改那一句 —— 不是照记忆重打
--    （重点 31 第 1 条；这个仓库栽在「整支重写」上三次）。

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
    order by s.effective_from asc, s.created_at desc
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
