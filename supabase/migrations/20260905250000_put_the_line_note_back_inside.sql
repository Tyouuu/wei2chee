-- 把那个洞补回去。20260905240000 故意漏，这一支改回来 —— 而
-- 中间那一次红是这条守卫唯一的证据（[重点 24]）。
--
-- 内容跟 20260905230000 那一版一模一样，只差 'note' 那一行不在了。
create or replace function public.public_shared_record(in_ref uuid)
returns table (
  business_name text,
  style text,
  palette text,
  system_language text,
  module_key text,
  doc_no text,
  title text,
  party text,
  stage text,
  amount_cents bigint,
  issued_on date,
  due_on date,
  is_expired boolean,
  can_answer boolean,
  answer text,
  answered_at timestamptz,
  answered_name text,
  answer_note text,
  site_address text,
  lines jsonb,
  terms jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec public.pipeline_records;
  proj public.projects;
begin
  if in_ref is null then
    return;
  end if;

  select * into rec from public.pipeline_records r where r.share_ref = in_ref;

  /* 门牌不存在、单被收起来了、那一家关掉了 —— **回一样的东西**。
     跟 submit_site_enquiry 同一句：告诉一个陌生人「这张单存在但你不能看」，
     就是在讲别人生意的事。 */
  if rec.id is null or rec.archived_at is not null then
    return;
  end if;

  select * into proj from public.projects p where p.id = rec.project_id;
  if proj.id is null then
    return;
  end if;

  return query
  select
    coalesce(proj.business_name, ''),
    proj.style,
    proj.palette,
    proj.system_language,
    rec.module_key,
    rec.doc_no,
    rec.title,
    rec.party,
    rec.stage,
    rec.amount_cents,
    rec.issued_on,
    rec.due_on,
    /* 过期是**算出来的**，不是存起来的（[任务 115]）——
       一个存起来的旗子，在排程没跑的那一天就在说谎。 */
    (rec.module_key = 'quotations'
      and rec.due_on is not null
      and rec.due_on < public.today_myt()),
    (public.is_answerable_module(rec.module_key)
      and rec.answer is distinct from 'accepted'
      and not (rec.module_key = 'quotations'
               and rec.due_on is not null
               and rec.due_on < public.today_myt())),
    rec.answer,
    rec.answered_at,
    rec.answered_name,
    rec.answer_note,
    coalesce((
      select btrim(concat_ws(', ',
        nullif(btrim(a.label), ''), nullif(btrim(a.line), ''),
        nullif(btrim(a.region), '')))
      from public.directory_addresses a
      where a.id = rec.site_address_id
    ), ''),
    /* 🔴 逐项：只给客人本来就该在那张纸上读到的那几栏。
       `note` 跟 `extra` **不给** —— 没有人规定过那两栏是写给谁的，
       而一句「这个我们进价 12」写在那里完全合理。 */
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', l.description,
        'qty', l.qty,
        'unit', l.unit,
        'unit_price_cents', l.unit_price_cents,
        'amount_cents', l.amount_cents
      ) order by l.sort_order)
      from public.record_lines l where l.record_id = rec.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', t.description,
        'portion', t.portion,
        'amount_cents', t.amount_cents,
        'due_on', t.due_on
      ) order by t.sort_order)
      from public.record_terms t where t.record_id = rec.id
    ), '[]'::jsonb);
end;
$$;
