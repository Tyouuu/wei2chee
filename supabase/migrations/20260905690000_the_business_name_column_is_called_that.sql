-- `projects` 那一栏叫 `business_name`，不叫 `company_name`。
--
-- 🔴 **`db push` 一句话都没讲，而那一支从头到尾是坏的。** plpgsql 到**执行**
-- 才解析栏位名，所以推上去成功证明不了任何事 —— 而路人打开那条连结拿到的是
--
--     column p.company_name does not exist
--
-- 也就是**每一次都打不开**。抓到它的是拿真的 anon 钥匙打了一次
-- （[重点 26](../docs/founder-points.md)：每一支都要用真的身分真的呼叫一次）。
--
-- ⚠️ 而尺子那一边我也犯了同一个：`update projects set company_name = …`
--    **没有看回传的错误**，所以那一句静静地什么都没做。
--    一句不看错误的写入，跟一句没有写过的写入，在报告里长得一模一样。
--
-- 底下这一段是**从 20260905680000 原样搬出来的**，只换了那一个栏位名。

create or replace function public.party_portal(in_ref uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d record;
  biz text;
begin
  if in_ref is null then
    return jsonb_build_object('found', false);
  end if;

  select de.id, de.name, de.project_id
    into d
  from public.directory_entries de
  where de.portal_ref = in_ref and de.archived_at is null;

  /* 🔴 收起来的人、关掉的连结、根本不存在的号码 —— **同一个答案**。
     告诉一个陌生人「这条连结存在过」，就是在告诉他别人的事。 */
  if d.id is null then
    return jsonb_build_object('found', false);
  end if;

  select coalesce(nullif(btrim(p.business_name), ''), 'this business')
    into biz
  from public.projects p where p.id = d.project_id;

  return jsonb_build_object(
    'found', true,
    'business', biz,
    'you', d.name,
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'what', r.what,
               'qty', r.qty,
               'amountCents', r.amount_cents,
               'status', r.status,
               'askedOn', r.created_at
             ) order by r.created_at desc)
      from public.party_requests r
      where r.party_id = d.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.party_portal(uuid) from public;
grant execute on function public.party_portal(uuid) to anon, authenticated;
