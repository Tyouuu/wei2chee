-- supabase/migrations/20260901060000_two_men_named_tan_are_two_men.sql
--
-- 🔴 `convert_enquiry` filed a new enquirer under an existing customer who
-- happened to share his name and had a different phone number.
--
-- ── HOW IT WAS FOUND, WHICH IS THE POINT ─────────────────────────────────
--
-- Not by reading it. The standalone script I wrote first ran against a fresh
-- project where no 陈先生 existed, and passed 18/18. Folding the same
-- assertions into `check:records` -- where an earlier section has already
-- created a 陈先生 with the phone 03-7788 1234 -- turned one of them red on
-- the first run:
--
--     FAIL  电话认出来是电话，不是 email — 03-7788 1234|
--
-- The new enquiry gave 012-345 6789. The row it produced pointed at somebody
-- else. A checker that shares a project with the rest of the product is worth
-- more than a clean one for exactly this reason.
--
-- ── WHAT WAS WRONG WITH THE RULE ─────────────────────────────────────────
--
-- It matched 「contact OR name」, which reads as generous and is not: a name
-- match where the CONTACT DISAGREES is positive evidence of two different
-- people, and it was being treated as evidence of one. 陈 is one of the most
-- common surnames in this market; a contractor will have several 陈先生.
--
-- The cost is asymmetric and that decides it. Two 陈先生 in the customer list
-- is a tidiness problem the owner can merge in a second. One 陈先生 carrying
-- another man's phone number is a quotation sent to the wrong person, and
-- nothing on the screen ever says so.
--
-- ── THE RULE NOW ─────────────────────────────────────────────────────────
--
--   1. the contact matches something on file  -> the same person
--   2. the names match AND neither side has a contact to disagree with
--      -> the same person
--   3. otherwise -> a new customer
--
-- A contact match always wins over a name match, so an enquirer who changed
-- his display name still lands on his own record.

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
  contact text;
  looks_like_phone boolean;
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

  contact := btrim(coalesce(e.contact, ''));
  /* One field on the form, and it is either a phone or an email. Digits with a
     leading + or 0 is a phone; anything else is an address. Guessing wrong is
     cheap and never silent -- both columns are on screen the moment he opens
     the customer. */
  looks_like_phone := contact ~ '^[+0-9][0-9 ()+-]{5,}$';

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
        /* ① the number (or address) is on file already */
        (contact <> '' and (d.phone = contact or d.whatsapp = contact or d.email = contact))
        /* ② same name, and nothing on either side contradicts it */
        or (
          lower(btrim(d.name)) = lower(btrim(e.name))
          and (
            contact = ''
            or (coalesce(d.phone,'') = '' and coalesce(d.whatsapp,'') = ''
                and coalesce(d.email,'') = '')
          )
        )
      )
    /* A contact match beats a name match, so somebody who changed how he
       writes his name still lands on his own record. */
    order by (contact <> '' and (d.phone = contact or d.whatsapp = contact
                                 or d.email = contact)) desc,
             d.created_at
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
        '',                                                        -- contact_person
        case when looks_like_phone then contact else '' end,       -- phone
        case when looks_like_phone then contact else '' end,       -- whatsapp
        case when looks_like_phone then '' else contact end,       -- email
        '', '', '', '', '',        -- address · region · reg_no · tax_id · status
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
  '询价 → 报价单, one press. Produces the job AND the customer, reuses a customer only when the contact agrees, and cannot fire twice. See 20260901050000 and 20260901060000.';

revoke execute on function public.convert_enquiry(uuid, text) from public;
grant execute on function public.convert_enquiry(uuid, text) to authenticated;
