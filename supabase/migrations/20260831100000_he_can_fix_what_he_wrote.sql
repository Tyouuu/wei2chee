-- supabase/migrations/20260831100000_he_can_fix_what_he_wrote.sql
--
-- Until now a business could WRITE its own records and nothing else. Type the
-- amount wrong and there was no way back: no edit, no archive, and the one
-- correction that did exist -- reverse_ledger_entry, built 20260831020000 --
-- had no button anywhere in the product.
--
-- 「他加得进去，改不了，也删不掉。」
--
-- ── THE LINE THIS DRAWS, AND WHY IT IS NOT THE SAME EVERYWHERE ────────────
--
--   pipeline    EDITABLE. A quotation is a working document until it is not:
--               the price changes twice before the customer says yes, and an
--               owner who cannot change it keeps the real one in WhatsApp.
--
--   directory   EDITABLE. A phone number is a fact about the world, and facts
--               about the world change. There is nothing to audit.
--
--   ledger      NOT EDITABLE, and this is the important one. Money is
--               corrected by writing an opposite entry, never by changing the
--               original -- a corrected figure with no trace of the correction
--               cannot be told apart from a lie. That is what `adjusts_id` is
--               for, and it is the one instinct in the founder's own
--               vibe-dealer that this product copied without argument.
--
--               What CAN be fixed is the words: a note, a method, a cheque
--               number. None of them is the money.
--
-- ── ARCHIVE, NOT DELETE ───────────────────────────────────────────────────
--
-- A lost job is next year's answer to 「上次我们报多少」. Deleting it throws
-- that away, and deleting is also what makes a numbering sequence look broken
-- (20260831040000 already learnt this: a spent number stays spent).
--
-- So the shelf-clearing action is `archived_at`, which both tables already
-- carry and which the projection already filters -- this is the wire, not the
-- column. Ledger entries are NOT archivable: money does not leave the book.

-- ── FIXING A DOCUMENT ─────────────────────────────────────────────────────

create or replace function public.update_pipeline_record(
  in_id uuid,
  in_title text default null,
  in_party text default null,
  in_amount_cents bigint default null,
  in_stage text default null,
  in_issued_on date default null,
  in_due_on date default null,
  in_extra jsonb default null,
  in_party_id uuid default null,
  /* Explicit, because null means 「leave it alone」 for every field above and a
     caller has to be able to say 「actually, nobody」. Without this an owner
     could attach a job to a customer and never detach it. */
  in_clear_party boolean default false
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.pipeline_records;
  the_party uuid;
begin
  select * into row from public.pipeline_records r
   where r.id = in_id
     and exists (
       select 1 from public.projects p
       where p.id = r.project_id and p.account_id = auth.uid()
     );
  if not found then
    raise exception 'no such record in your project';
  end if;

  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id and project_id = row.project_id;
    if not found then
      raise exception 'that party is not in this project';
    end if;
    the_party := in_party_id;
  elsif in_clear_party then
    the_party := null;
  elsif in_party is not null and btrim(in_party) is distinct from btrim(row.party) then
    /* The name changed and nobody said who: resolve it again, so correcting a
       typo in 「陈先生」 also fixes who the job is with. Falls to null when two
       people share the name -- the same refusal as everywhere else. */
    the_party := public.party_by_name(row.project_id, in_party);
  else
    the_party := row.party_id;
  end if;

  /* ⚠️ NEVER the document number. It is on paper the customer has already
     seen, and 20260831050000 exists to make sure two of them cannot collide;
     letting it be edited would undo both. */
  update public.pipeline_records set
    title = coalesce(left(btrim(in_title), 200), title),
    party = coalesce(left(btrim(in_party), 200), party),
    party_id = the_party,
    amount_cents = coalesce(in_amount_cents, amount_cents),
    stage = coalesce(left(btrim(in_stage), 60), stage),
    issued_on = coalesce(in_issued_on, issued_on),
    due_on = coalesce(in_due_on, due_on),
    extra = coalesce(in_extra, extra)
  where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.update_pipeline_record(uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean) from public;
grant execute on function public.update_pipeline_record(uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean) to authenticated;

-- ── FIXING A PERSON ───────────────────────────────────────────────────────

create or replace function public.update_directory_entry(
  in_id uuid,
  in_name text default null,
  in_kind text default null,
  in_contact_person text default null,
  in_phone text default null,
  in_whatsapp text default null,
  in_email text default null,
  in_address text default null,
  in_region text default null,
  in_reg_no text default null,
  in_tax_id text default null,
  in_status text default null,
  in_note text default null,
  in_extra jsonb default null
)
returns public.directory_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.directory_entries;
begin
  select * into row from public.directory_entries d
   where d.id = in_id
     and exists (
       select 1 from public.projects p
       where p.id = d.project_id and p.account_id = auth.uid()
     );
  if not found then
    raise exception 'no such entry in your project';
  end if;

  if in_name is not null and btrim(in_name) = '' then
    raise exception 'a directory entry needs a name';
  end if;

  /* ⚠️ Renaming a party does NOT rewrite the documents that point at it. Every
     quotation keeps the text it was written with (see 20260831080000): the
     link follows the person, the paper keeps what the paper said. */
  update public.directory_entries set
    name = coalesce(left(btrim(in_name), 200), name),
    kind = case when lower(btrim(coalesce(in_kind, ''))) in ('person', 'company')
                then lower(btrim(in_kind)) else kind end,
    contact_person = coalesce(left(btrim(in_contact_person), 200), contact_person),
    phone = coalesce(left(btrim(in_phone), 40), phone),
    whatsapp = coalesce(left(btrim(in_whatsapp), 40), whatsapp),
    email = coalesce(left(btrim(in_email), 200), email),
    address = coalesce(left(btrim(in_address), 400), address),
    region = coalesce(left(btrim(in_region), 120), region),
    reg_no = coalesce(left(btrim(in_reg_no), 60), reg_no),
    tax_id = coalesce(left(btrim(in_tax_id), 60), tax_id),
    status = coalesce(left(btrim(in_status), 60), status),
    note = coalesce(left(in_note, 2000), note),
    extra = coalesce(in_extra, extra)
  where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.update_directory_entry(uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb) from public;
grant execute on function public.update_directory_entry(uuid, text, text, text, text, text, text, text, text, text, text, text, text, jsonb) to authenticated;

-- ── FIXING THE WORDS ON A PAYMENT, AND ONLY THE WORDS ─────────────────────

create or replace function public.update_ledger_words(
  in_id uuid,
  in_note text default null,
  in_method text default null,
  in_reference text default null,
  in_receipt_url text default null
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.ledger_entries;
begin
  select * into row from public.ledger_entries e
   where e.id = in_id
     and exists (
       select 1 from public.projects p
       where p.id = e.project_id and p.account_id = auth.uid()
     );
  if not found then
    raise exception 'no such entry in your project';
  end if;

  /* ⚠️ THE AMOUNT, THE DIRECTION, THE PARTY AND THE DATE ARE NOT HERE, AND
     THAT IS THE FEATURE. Money is corrected by writing an opposite entry --
     reverse_ledger_entry -- so that the correction is visible. A figure that
     changed with no trace of the change cannot be told apart from a lie, and
     the whole reason this shape carries adjusts_id is to make that impossible.

     A wrong date is corrected the same way. It is stricter than an owner
     expects on the day; it is what makes the book worth keeping. */
  update public.ledger_entries set
    note = coalesce(left(in_note, 2000), note),
    method = coalesce(left(btrim(in_method), 60), method),
    reference = coalesce(left(btrim(in_reference), 120), reference),
    receipt_url = coalesce(in_receipt_url, receipt_url)
  where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.update_ledger_words(uuid, text, text, text, text) from public;
grant execute on function public.update_ledger_words(uuid, text, text, text, text) to authenticated;

-- ── OFF THE SHELF, NOT OUT OF THE BOOK ────────────────────────────────────

create or replace function public.set_pipeline_archived(in_id uuid, in_archived boolean default true)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.pipeline_records;
begin
  update public.pipeline_records r
     set archived_at = case when in_archived then now() else null end
   where r.id = in_id
     and exists (
       select 1 from public.projects p
       where p.id = r.project_id and p.account_id = auth.uid()
     )
  returning * into row;
  if not found then
    raise exception 'no such record in your project';
  end if;
  return row;
end;
$$;

revoke execute on function public.set_pipeline_archived(uuid, boolean) from public;
grant execute on function public.set_pipeline_archived(uuid, boolean) to authenticated;

create or replace function public.set_directory_archived(in_id uuid, in_archived boolean default true)
returns public.directory_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.directory_entries;
begin
  update public.directory_entries d
     set archived_at = case when in_archived then now() else null end
   where d.id = in_id
     and exists (
       select 1 from public.projects p
       where p.id = d.project_id and p.account_id = auth.uid()
     )
  returning * into row;
  if not found then
    raise exception 'no such entry in your project';
  end if;
  return row;
end;
$$;

revoke execute on function public.set_directory_archived(uuid, boolean) from public;
grant execute on function public.set_directory_archived(uuid, boolean) to authenticated;

-- ── THE REVERSAL LEARNS WHO IT IS FOR ─────────────────────────────────────
--
-- reverse_ledger_entry was written on 20260831020000, before party_id existed,
-- so a reversal carried the NAME and not the link -- and 「这个客户的全部钱」
-- would then show the payment and not its cancellation. Re-declared in full,
-- for the reason 090000 records.

create or replace function public.reverse_ledger_entry(
  in_entry_id uuid,
  in_note text default ''
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  original public.ledger_entries;
  row public.ledger_entries;
  already uuid;
begin
  select * into original
  from public.ledger_entries e
  where e.id = in_entry_id
    and exists (
      select 1 from public.projects p
      where p.id = e.project_id and p.account_id = auth.uid()
    );
  if not found then
    raise exception 'no such entry in your project';
  end if;

  if original.adjusts_id is not null then
    raise exception 'that entry is itself a reversal';
  end if;

  select id into already
  from public.ledger_entries where adjusts_id = in_entry_id;
  if already is not null then
    raise exception 'that entry has already been reversed';
  end if;

  insert into public.ledger_entries (
    project_id, module_key, doc_no, party, party_id, direction, amount_cents,
    allocated_cents, against_id, adjusts_id, entry_on, method, reference,
    note, recorded_by, extra
  ) values (
    original.project_id,
    original.module_key,
    public.next_doc_no(original.project_id, original.module_key),
    original.party,
    original.party_id,
    case original.direction when 'in' then 'out' else 'in' end,
    original.amount_cents,
    original.allocated_cents,
    original.against_id,
    original.id,
    public.today_myt(),
    original.method,
    original.reference,
    left(coalesce(nullif(btrim(in_note), ''), '冲正 ' || original.doc_no), 2000),
    auth.uid(),
    original.extra
  )
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.reverse_ledger_entry(uuid, text) from public;
grant execute on function public.reverse_ledger_entry(uuid, text) to authenticated;
