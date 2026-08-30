-- supabase/migrations/20260831010000_pressing_it_twice_is_one_quotation.sql
--
-- Proven before it was fixed: press 加一单, wait 400ms on a slow connection,
-- press again, and the same quotation exists twice under QT-2026-0001 and
-- QT-2026-0002. A contractor standing in somebody's kitchen on 4G will do this,
-- because the first press showed him nothing.
--
-- Two presses at the SAME instant were already safe, by accident: both compute
-- the same document number and the unique constraint rejects the loser. But it
-- rejects it with an error, which teaches the customer to press again -- and
-- the press after that is the sequential case, which duplicates.
--
-- ── TAKEN FROM HIS OWN DEALER SYSTEM ──────────────────────────────────────
--
-- `Tyouuu/vibe-dealer`, the SIM-dealer system the founder built himself,
-- carries `idempotency_key uuid` on its transactions table. He had already met
-- this problem in a real Malaysian business and solved it; this repo had not.
-- Four things from that schema are worth having here and this is the first --
-- see task 74 for the rest.
--
-- ── WHY RETURNING THE FIRST ROW AND NOT AN ERROR ──────────────────────────
--
-- A retry is not a mistake. The client that sends the same key twice is one
-- whose first request may have succeeded and whose reply was lost -- it has no
-- way to know which. Handing it the row it already created is the only answer
-- that is true whether the first call landed or not, and it means the button
-- can be pressed as many times as a bad connection demands.
--
-- The key is nullable, so every existing row and every caller that does not
-- send one keeps working exactly as before. Uniqueness is scoped per project:
-- two businesses generating the same uuid is not a thing, but scoping it costs
-- nothing and keeps one customer's keys from ever being a fact about another's.

alter table public.pipeline_records
  add column if not exists idempotency_key uuid;

comment on column public.pipeline_records.idempotency_key is
  'The client''s own id for one intended row. A second call carrying the same key returns the first row instead of writing another. Null for rows written before this existed and for callers that do not send one.';

create unique index if not exists pipeline_records_idempotency_idx
  on public.pipeline_records (project_id, idempotency_key)
  where idempotency_key is not null;

create or replace function public.add_pipeline_record(
  in_project_id uuid,
  in_module_key text,
  in_title text default '',
  in_party text default '',
  in_amount_cents bigint default null,
  in_stage text default null,
  in_issued_on date default null,
  in_due_on date default null,
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  row public.pipeline_records;
  first_stage text;
begin
  select exists (
    select 1 from public.projects
    where id = in_project_id and account_id = auth.uid()
  ) into mine;
  if not mine then
    raise exception 'not your project';
  end if;

  if not public.is_pipeline_module(in_module_key) then
    raise exception 'not a pipeline module: %', in_module_key;
  end if;

  /* Already written. Hand back what exists rather than a second row or an
     error -- see the note above on why a retry is not a mistake. */
  if in_idempotency_key is not null then
    select * into row
    from public.pipeline_records
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  /* The first stage of THIS business's own workflow. See 20260830040000 for
     why it is two joins away and not on the project. */
  if in_stage is null or btrim(in_stage) = '' then
    select case when p.system_language = 'en'
                then coalesce(ar.after_workflow_en, ar.after_workflow)
                else ar.after_workflow
           end ->> 0
      into first_stage
      from public.projects p
      join public.accounts a on a.id = p.account_id
      join public.analysis_results ar on ar.lead_id = a.lead_id
     where p.id = in_project_id;
  end if;

  insert into public.pipeline_records (
    project_id, module_key, doc_no, title, party, amount_cents, stage,
    issued_on, due_on, extra, idempotency_key
  ) values (
    in_project_id,
    in_module_key,
    public.next_doc_no(in_project_id, in_module_key),
    left(coalesce(in_title, ''), 200),
    left(coalesce(in_party, ''), 200),
    in_amount_cents,
    left(coalesce(nullif(btrim(coalesce(in_stage, '')), ''), coalesce(first_stage, '')), 60),
    coalesce(in_issued_on, current_date),
    in_due_on,
    coalesce(in_extra, '{}'::jsonb),
    in_idempotency_key
  )
  returning * into row;

  return row;

/* Two presses in the same instant both miss the check above and race to the
   insert. The unique index is what actually decides; the loser lands here and
   reads the winner's row, so both callers get the same answer and neither sees
   an error. This is the case that was already safe by accident and is now safe
   on purpose. */
exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row
      from public.pipeline_records
      where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise;
end;
$$;

drop function if exists public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb);

revoke execute on function public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid) from public;
grant execute on function public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid) to authenticated;
