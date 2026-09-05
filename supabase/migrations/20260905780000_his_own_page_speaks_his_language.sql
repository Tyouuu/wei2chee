-- 那一页多两样：这套系统讲什么话，跟他自己那一笔的单号。
--
-- ── 洞是接画面的时候撞到的（重点 26：db push 证明不了任何事）─────────────
--
-- `party_portal` 一支就是这个产品对陌生人的整个出口，所以要审的是它 ——
-- 而接画面的时候才看到它少两样，而少的那两样各自造成一个真的毛病：
--
-- ① **没有语言。** 那一页只好写死英文，而一个讲华语的经销商打开
--    自己那条连结，看到的是一页他读不顺的字。
--    ⚠️ 这不是新的外泄：那套系统讲什么话，`/s/<slug>` 那一页
--    （get_public_site，20260823010000）本来就回给每一个路人。
--
-- ② **没有单号。** 他送的那一笔已经开成单了，那一页写得出「已经开单了」，
--    **而写不出是哪一张**。他下一句要问的正好是那一句 ——
--    於是他回到 WhatsApp 上问，而这一整件事存在的理由就是不要他回去问。
--    ⚠️ 那是**他自己那一笔**变出来的单号，不是别人的。
--
-- ── 这一支的边界一个字都没有变 ──────────────────────────────────────────
--
-- 还是只有：这家公司叫什么 · 他自己的名字 · 他自己送过的那几笔。
-- 一个 id 都不回（`party_requests.id` 照旧不给）· 别的客户不回 ·
-- 自己人不回 · 他欠多少不回。
--
-- ⚠️ **收起来的人、关掉的连结、乱猜的号码，答案照旧一模一样** ——
-- 那一段原样搬过来，一个字没动。

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
  lang text;
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

  select coalesce(nullif(btrim(p.business_name), ''), 'this business'),
         coalesce(nullif(btrim(p.system_language), ''), 'en')
    into biz, lang
  from public.projects p where p.id = d.project_id;

  return jsonb_build_object(
    'found', true,
    'business', biz,
    'you', d.name,
    /* 那套系统讲什么话 —— 这一页是那门生意在跟它的下游讲话，
       所以它该讲那门生意的语言，不是我们的。 */
    'lang', lang,
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'what', r.what,
               'qty', r.qty,
               'amountCents', r.amount_cents,
               'status', r.status,
               /* 他自己那一笔变出来的单号。没开单就是 null。 */
               'docNo', pr.doc_no,
               'askedOn', r.created_at
             ) order by r.created_at desc)
      from public.party_requests r
      left join public.pipeline_records pr on pr.id = r.record_id
      where r.party_id = d.id
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.party_portal(uuid) is
  'The whole anonymous surface for a downstream party: the business name, their own name, the system language, and the requests THEY have sent -- with the doc number of the order their own request became. No ids, no other parties, no money owed. A closed link, an archived party and a guessed uuid all answer the same. See 20260905680000 and 20260905780000.';
