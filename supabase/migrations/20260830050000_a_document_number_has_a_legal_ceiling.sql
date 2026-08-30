-- supabase/migrations/20260830050000_a_document_number_has_a_legal_ceiling.sql
--
-- LHDN's own MyInvois SDK gives the field a limit, and ours had none.
--
--     e-Invoice Code / Number
--     "Document reference number used by Supplier for internal tracking"
--     Mandatory · NUMBER OF CHARS: 50
--
-- (sdk.myinvois.hasil.gov.my, invoice v1.1, read 2026-08-30.)
--
-- We are not building e-Invoice -- that decision stands, and the reasons are in
-- task 22. But the ceiling is free to respect and expensive to discover later:
-- a customer who sets a long prefix today would be handed a number that no
-- Malaysian tax document can carry, and finding that out means renumbering
-- their history.
--
-- next_doc_no() composes prefix + '-' + YYYY + '-' + 4 digits, so the default
-- QT-2026-0042 is twelve characters and nothing here constrains anything a
-- customer would plausibly type. It bounds the case where a prefix is pasted
-- rather than typed.

alter table public.pipeline_records
  add constraint pipeline_records_doc_no_fits
  check (char_length(doc_no) between 1 and 50);

comment on constraint pipeline_records_doc_no_fits on public.pipeline_records is
  'Fifty characters, matching the e-Invoice Code / Number field in LHDN''s MyInvois SDK. We do not file e-Invoices; we do not want to hand a business a number its tax documents cannot hold.';

-- The prefix is the customer's, so bound it where they set it too. Nine leaves
-- room for the year, the separator and the counter inside fifty.
alter table public.project_doc_prefixes
  add constraint project_doc_prefixes_fits
  check (char_length(prefix) between 1 and 9);
