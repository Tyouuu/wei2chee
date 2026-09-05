-- 故意弄坏：不管问哪个月，都读**现在**那一份办法。
--
-- 这就是 20260905640000 之前的行为，而红的那一行读起来就是他在
-- vibe-dealer 那一次看到的东西：上个月本来 RM 800，改完率之后变 RM 1,200。
--
-- ⚠️ **单独推一次。** 弄坏跟改回去在同一次推送里，红的那一刻没有人看得到
--    —— 20260905070000 那次就是那样，什么都没证明到（重点 31 第三条）。
--    20260905670000 把它改回去。

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
  /* 🔴 少了 `and s.effective_from <= in_on` 这一句。 */
  return query
    select s.effective_from, s.tiers
    from public.commission_schemes s
    where s.party_id = in_party_id
    order by s.effective_from desc, s.created_at desc
    limit 1;
  if found then return; end if;

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
