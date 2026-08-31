-- supabase/migrations/20260831140000_buying_starts_at_ordered.sql
--
-- add_pipeline_record falls back to the first stage of the business's own
-- workflow when the caller names none. That workflow came from the
-- questionnaire, and the questionnaire asked how they SELL -- so a purchase
-- order written with no stage started at 「Enquiry」, over an order for cement.
--
-- Buying is 开了单 → 到货了 → 付清了 for everybody, which is why it is fixed
-- here rather than asked: ERPNext's Purchase Order status is a Select, not a
-- per-customer workflow. See stagesForModule() in industry-template.ts, which
-- draws the same three on the page.
--
-- ⚠️ The language follows the SYSTEM's, like everything else a customer reads.

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
  in_idempotency_key uuid default null,
  in_party_id uuid default null
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
  the_party uuid;
  is_en boolean;
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

  if in_idempotency_key is not null then
    select * into row from public.pipeline_records
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id
        and project_id = in_project_id
        and module_key = public.directory_side(in_module_key);
    if not found then
      raise exception 'that party is not on this side of the book';
    end if;
    the_party := in_party_id;
  else
    the_party := public.party_by_name(
      in_project_id, in_party, public.directory_side(in_module_key)
    );
  end if;

  if in_stage is null or btrim(in_stage) = '' then
    if in_module_key = 'purchases' then
      select p.system_language = 'en' into is_en
        from public.projects p where p.id = in_project_id;
      first_stage := case when is_en then 'Ordered' else '开了单' end;
    else
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
  end if;

  insert into public.pipeline_records (
    project_id, module_key, doc_no, title, party, party_id, amount_cents, stage,
    issued_on, due_on, extra, idempotency_key
  ) values (
    in_project_id,
    in_module_key,
    public.next_doc_no(in_project_id, in_module_key),
    left(coalesce(in_title, ''), 200),
    left(coalesce(in_party, ''), 200),
    the_party,
    in_amount_cents,
    left(coalesce(nullif(btrim(coalesce(in_stage, '')), ''), coalesce(first_stage, '')), 60),
    coalesce(in_issued_on, public.today_myt()),
    in_due_on,
    coalesce(in_extra, '{}'::jsonb),
    in_idempotency_key
  )
  returning * into row;

  return row;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row from public.pipeline_records
      where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise;
end;
$$;

revoke execute on function public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid) from public;
grant execute on function public.add_pipeline_record(uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid) to authenticated;
