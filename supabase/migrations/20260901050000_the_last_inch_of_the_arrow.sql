-- supabase/migrations/20260901050000_the_last_inch_of_the_arrow.sql
--
-- 询价 → 报价单. One press.
--
-- ── WHY THIS IS THE ONE THAT WAS MISSING ──────────────────────────────────
--
-- 「官网表格 → 系统出单」 has been the product's own sentence since 8-25, and
-- both ends of it have been real for a while now: `site_enquiries` holds rows a
-- stranger actually typed, and `pipeline_records` has held real quotations
-- since 20260830040000. Between them there was nothing. The inbox gave the
-- owner one button per row -- 「WhatsApp them」 -- and then stopped, so turning
-- an enquiry into a job meant reading it, opening another page, and typing the
-- name and the message in again.
--
-- 任务 22 named this as the smallest next step back when the pipeline was still
-- a drawing: 「site_enquiries 已经是真表真资料，那条箭头只差最后一段」. The
-- pipeline stopped being a drawing on 8-30 and nobody came back for the inch.
--
-- ── AND WHY IT MATTERS MORE THAN ITS SIZE ────────────────────────────────
--
-- It is the one thing in this product a website builder cannot copy. Durable
-- and Wix bolt a CRM onto a site builder; the site and the system are two
-- products that email each other. Here they are one object -- the same
-- business description generated both -- and this function is where that stops
-- being an argument and becomes a button.
--
-- ── WHAT ONE PRESS PRODUCES, AND WHY IT IS TWO THINGS ────────────────────
--
--   · a row on his 报价单 page, carrying the stranger's name, what they asked
--     for, and its own document number
--   · that person in his 客户 list, linked to the row
--
-- Two, because that is what the trade does and what a mature system does:
-- ERPNext's own lead-to-quotation turns the lead into a customer on the way
-- past (任务 61 wrote that down and nothing had used it). A quotation whose
-- 「陈先生」 is a loose string is a quotation that cannot answer 「how much have
-- we quoted this man before」.
--
-- ⚠️ IT REUSES A CUSTOMER, IT DOES NOT MAKE A SECOND ONE. Matched on contact
-- first and name second, because a returning enquirer is the normal case in
-- this trade -- he asks in March and again in August -- and two 陈先生 in the
-- customer list is worse than none.
--
-- ⚠️ AND IT CANNOT FIRE TWICE. Pressing it again returns the row it already
-- made rather than opening a second quotation with a second document number.
-- Same rule as `idempotency_key` and for the same reason: the owner cannot
-- know whether the first press landed, so the only true answer is the row that
-- exists.

alter table public.site_enquiries
  add column if not exists converted_record_id uuid
    references public.pipeline_records(id) on delete set null,
  add column if not exists converted_party_id uuid
    references public.directory_entries(id) on delete set null,
  add column if not exists converted_at timestamptz;

comment on column public.site_enquiries.converted_record_id is
  'The job this enquiry became. `on delete set null` rather than cascade -- deleting a quotation must not delete the evidence that somebody once asked.';
comment on column public.site_enquiries.converted_at is
  'Set once. It is what makes a second press return the first row instead of opening a second quotation -- see the header of 20260901050000.';

-- ── WHICH PAGE DOES IT LAND ON ────────────────────────────────────────────
--
-- `lands_in` has recorded the intended page against every enquiry since the
-- table was written, resolved from the analysis at submit time. It is the right
-- first answer and it is not always usable: it defaults to 'customers' (a
-- directory, not a job), and the owner may have removed or never had that page.
--
-- So: what was asked for, then what was intended, then whatever pipeline page
-- this business actually has. Null is a legitimate answer -- a business with no
-- pipeline page at all still gets the customer.

create or replace function public.enquiry_target(
  in_project_id uuid,
  in_wanted text,
  in_lands_in text default null
)
returns text
language sql
stable
security definer
set search_path = public
as $$
  with usable as (
    select pp.page_key, pp.sort_order
    from public.project_pages pp
    where pp.project_id = in_project_id
      and public.is_pipeline_module(pp.page_key)
  )
  select coalesce(
    (select page_key from usable where page_key = in_wanted),
    (select page_key from usable where page_key = in_lands_in),
    (select page_key from usable order by sort_order nulls last, page_key limit 1)
  );
$$;

comment on function public.enquiry_target(uuid, text, text) is
  'Which of THIS business''s pipeline pages an enquiry becomes a row on: what was asked for, then what was intended at submit time, then whatever it actually has. Null is a real answer -- a business with no pipeline page still gets the customer.';

revoke execute on function public.enquiry_target(uuid, text, text) from public;
grant execute on function public.enquiry_target(uuid, text, text) to authenticated;

-- ── THE PRESS ─────────────────────────────────────────────────────────────

create or replace function public.convert_enquiry(
  in_enquiry_id uuid,
  in_module_key text default null
)
returns table (record_id uuid, party_id uuid, module_key text, doc_no text, already boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  e public.site_enquiries;
  proj uuid;
  target text;
  party public.directory_entries;
  rec public.pipeline_records;
  customers_page text;
  subject text;
  detail text;
begin
  select * into e from public.site_enquiries where id = in_enquiry_id;
  if e.id is null then
    raise exception 'no such enquiry';
  end if;

  /* The owner, not merely somebody who works here. An enquiry is the public
     site's output and the public site is his marketing -- the same reason the
     portal does not show a 师傅 this page at all. */
  select p.id into proj from public.projects p
   where p.id = e.project_id and p.account_id = auth.uid();
  if proj is null then
    raise exception 'that enquiry is not yours';
  end if;

  /* PRESSED BEFORE. Hand back what it made, and say so, so the caller can
     navigate there instead of reporting a success that opened nothing. */
  if e.converted_at is not null then
    select * into rec from public.pipeline_records where id = e.converted_record_id;
    return query select e.converted_record_id, e.converted_party_id,
                        coalesce(rec.module_key, ''), coalesce(rec.doc_no, ''), true;
    return;
  end if;

  target := public.enquiry_target(proj, in_module_key, e.lands_in);

  /* ── THE PERSON ──────────────────────────────────────────────────────
     Contact first: a phone number is the thing that is actually the same
     person twice. Name second, for an enquiry that left only a name. */
  select pp.page_key into customers_page
  from public.project_pages pp
  where pp.project_id = proj and public.is_directory_module(pp.page_key)
  order by (pp.page_key = 'customers') desc, pp.sort_order nulls last
  limit 1;

  if customers_page is not null then
    select d.* into party
    from public.directory_entries d
    where d.project_id = proj
      and d.module_key = customers_page
      and d.archived_at is null
      and (
        (coalesce(btrim(e.contact), '') <> ''
          and (d.phone = btrim(e.contact) or d.whatsapp = btrim(e.contact)))
        or lower(btrim(d.name)) = lower(btrim(e.name))
      )
    order by d.created_at
    limit 1;

    if party.id is null then
      /* Through the same function a person presses (重点 23). It applies the
         length limits, the trigger and the row-level rules, and there is
         exactly one place that knows how to write a customer. */
      party := public.add_directory_entry(
        proj,
        customers_page,
        left(btrim(e.name), 120),
        'person',
        '',                                    -- contact_person
        /* The one field the form asks for, and it is either a phone or an
           email. Digits and a leading + mean a phone; anything else is an
           address. Guessing wrong is cheap here and never silent -- both
           columns are on screen the moment he opens the customer. */
        case when btrim(e.contact) ~ '^[+0-9][0-9 ()+-]{5,}$' then btrim(e.contact) else '' end,
        case when btrim(e.contact) ~ '^[+0-9][0-9 ()+-]{5,}$' then btrim(e.contact) else '' end,
        case when btrim(e.contact) ~ '^[+0-9][0-9 ()+-]{5,}$' then '' else btrim(e.contact) end,
        '', '', '', '', '',                    -- address · region · reg_no · tax_id · status
        'From the website',
        jsonb_build_object('from_enquiry', e.id)
      );
    end if;
  end if;

  /* ── THE JOB ─────────────────────────────────────────────────────────
     The title is what he asked for, not 「Enquiry from 陈先生」. The answers
     are this trade's own questions -- 「哪一间房」「几时开工」 -- so the first
     of them is the closest thing to a subject line that exists. */
  if target is not null then
    select value into detail
    from jsonb_each_text(coalesce(e.answers, '{}'::jsonb))
    limit 1;
    subject := coalesce(nullif(btrim(coalesce(detail, '')), ''), btrim(e.name));

    rec := public.add_pipeline_record(
      proj,
      target,
      left(subject, 200),
      left(btrim(e.name), 120),
      null,                                    -- amount: he has not quoted yet
      null,                                    -- stage: the module's own first step
      null, null,                              -- issued_on · due_on
      jsonb_build_object('from_enquiry', e.id),
      null,                                    -- idempotency key: converted_at is ours
      party.id
    );
  end if;

  update public.site_enquiries
     set converted_record_id = rec.id,
         converted_party_id  = party.id,
         converted_at        = now(),
         /* 'done' is what this inbox's third state was always for. */
         status = 'done'
   where id = in_enquiry_id;

  return query select rec.id, party.id, coalesce(rec.module_key, ''), coalesce(rec.doc_no, ''), false;
end;
$$;

comment on function public.convert_enquiry(uuid, text) is
  '询价 → 报价单, one press. Produces the job AND the customer, reuses a customer it has seen before, and cannot fire twice. See the header of 20260901050000.';

revoke execute on function public.convert_enquiry(uuid, text) from public;
grant execute on function public.convert_enquiry(uuid, text) to authenticated;

-- ── AND THE INBOX HAS TO SAY SO ───────────────────────────────────────────
--
-- `my_site_enquiries` returns `setof site_enquiries`, so the three new columns
-- ride along without touching it. Restated here only so the next reader does
-- not go looking for a second reader that needs updating.
