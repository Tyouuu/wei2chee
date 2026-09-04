-- 🔴 故意把逐项的内部注解漏出去，**看那条守卫红**。
--
-- [重点 24]：一条没有人看过它红的守卫，等於没有守卫。
-- 而这一条守的不是一个功能，是**别人的生意会不会被摊出去** ——
-- 那正是最不能靠「我读过代码，应该没问题」的一条。
--
-- 下一支（20260905250000）把它改回去。两支都留在历史里，
-- 因为它们就是那个证据。
create or replace function public.public_shared_record(in_ref uuid)
returns table (
  business_name text, style text, palette text, system_language text,
  module_key text, doc_no text, title text, party text, stage text,
  amount_cents bigint, issued_on date, due_on date,
  is_expired boolean, can_answer boolean,
  answer text, answered_at timestamptz, answered_name text, answer_note text,
  site_address text, lines jsonb, terms jsonb
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
  if in_ref is null then return; end if;
  select * into rec from public.pipeline_records r where r.share_ref = in_ref;
  if rec.id is null or rec.archived_at is not null then return; end if;
  select * into proj from public.projects p where p.id = rec.project_id;
  if proj.id is null then return; end if;

  return query
  select
    coalesce(proj.business_name, ''), proj.style, proj.palette, proj.system_language,
    rec.module_key, rec.doc_no, rec.title, rec.party, rec.stage,
    rec.amount_cents, rec.issued_on, rec.due_on,
    (rec.module_key = 'quotations' and rec.due_on is not null
      and rec.due_on < public.today_myt()),
    (public.is_answerable_module(rec.module_key)
      and rec.answer is distinct from 'accepted'
      and not (rec.module_key = 'quotations' and rec.due_on is not null
               and rec.due_on < public.today_myt())),
    rec.answer, rec.answered_at, rec.answered_name, rec.answer_note,
    coalesce((
      select btrim(concat_ws(', ',
        nullif(btrim(a.label), ''), nullif(btrim(a.line), ''),
        nullif(btrim(a.region), '')))
      from public.directory_addresses a where a.id = rec.site_address_id
    ), ''),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', l.description, 'qty', l.qty, 'unit', l.unit,
        'unit_price_cents', l.unit_price_cents, 'amount_cents', l.amount_cents,
        /* 🔴 这一行就是那个洞。 */
        'note', l.note
      ) order by l.sort_order)
      from public.record_lines l where l.record_id = rec.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', t.description, 'portion', t.portion,
        'amount_cents', t.amount_cents, 'due_on', t.due_on
      ) order by t.sort_order)
      from public.record_terms t where t.record_id = rec.id
    ), '[]'::jsonb);
end;
$$;
