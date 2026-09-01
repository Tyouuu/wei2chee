-- supabase/migrations/20260901010000_more_than_one_person_works_here.sql
--
-- 员工帐号跟权限. 地基决定 3, approved 2026-08-30 and unbuilt since:
-- 「谁看得到钱 —— 权限留在资料库（RLS），加员工帐号 + 角色」.
--
-- Every table in this product answers one question to decide who may read it:
-- `projects.account_id = auth.uid()`. One owner, one project, nobody else.
-- A contractor with two site supervisors has no way to let them near the job
-- list without handing over the login that also shows every payment.
--
-- ── READ FIRST: THE FOUNDER'S OWN SYSTEM ─────────────────────────────────
--
-- vibe-dealer has run staff roles in production for months, and four of its
-- decisions are taken here whole:
--
--   1. ONE FUNCTION, NOT DOZENS OF POLICIES. Its 0038 says it plainly:
--      「Every RLS policy in the schema resolves the caller through one
--      function, so one predicate fixes all of them at once rather than
--      editing dozens of policies and missing some.」 This repo has 125 copies
--      of `account_id = auth.uid()` across 59 files. Rewriting them by hand is
--      how one gets missed, and a missed one is a business reading another
--      business's money.
--
--   2. security definer + fixed search_path, so the function can read the
--      membership table without the policy recursing into itself.
--
--   3. NOBODY IS DELETED, THEY ARE SWITCHED OFF. `recorded_by` and
--      `created_by` point at people, and 「the whole value of an append-only
--      ledger is that you can still see who did what two years later」.
--
--   4. 🔴 SWITCHING OFF IN THE APP IS NOT SWITCHING OFF. He measured it:
--      with both test accounts set inactive, the accountant still read all 284
--      dealers straight from PostgREST with a valid token. The revoke has to
--      live in the database or it is decoration.
--
-- ── WHAT IS DIFFERENT HERE, AND WHY THERE IS NO BOOTSTRAP PROBLEM ────────
--
-- His schema had one: the first master could not be inserted by a master, so
-- it was created by hand in the SQL editor. Ours cannot have one, because the
-- owner is already recorded -- `projects.account_id`. The owner is a member by
-- CONSTRUCTION rather than by a row, which also means every existing account
-- keeps working with nothing inserted anywhere.
--
-- ── TWO ROLES, AND THE AXIS IS THE ONE HE NAMED ─────────────────────────
--
--   owner  everything, including the money
--   staff  the work: jobs, customers, suppliers, purchase orders. NOT the money
--
-- Not three, not a permission matrix. 「谁看得到钱」 is the question he asked,
-- and a third role costs one line in one function when somebody actually needs
-- it. A matrix built before anyone has two staff is a matrix built from
-- imagination.

create table if not exists public.project_members (
  project_id uuid not null references public.projects(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,

  /* 'staff' only. The owner is not a row here -- see the header. Constrained
     rather than free text: this one IS ours, not the customer's vocabulary,
     because the database's own behaviour branches on it. */
  role text not null default 'staff' check (role in ('staff')),

  /* Switched off, never deleted. Their name still has to render on the
     quotation they wrote last year. */
  active boolean not null default true,

  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  primary key (project_id, user_id)
);

comment on table public.project_members is
  'Who else works in this business. The OWNER is not in here -- projects.account_id already says who that is, which is why adding this table breaks nothing and needs no bootstrap row.';
comment on column public.project_members.active is
  'False means they can no longer see anything. Their rows stay exactly as they are -- this is how somebody leaves without their history leaving with them (vibe-dealer 0036).';

alter table public.project_members enable row level security;

-- ── THE ONE FUNCTION EVERYTHING ASKS ──────────────────────────────────────

create or replace function public.my_role(in_project_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1 from public.projects
      where id = in_project_id and account_id = auth.uid()
    ) then 'owner'
    else (
      select m.role from public.project_members m
      where m.project_id = in_project_id
        and m.user_id = auth.uid()
        and m.active
    )
  end;
$$;

comment on function public.my_role(uuid) is
  'owner, staff, or null. The single predicate every policy in this schema resolves through -- see the header of 20260901010000 for why there is exactly one.';

/** Anyone who works here at all. */
create or replace function public.works_here(in_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role(in_project_id) is not null;
$$;

/** ⚠️ THE WHOLE POINT OF THIS MIGRATION. Only the owner sees the money.
 *  A third role that also sees it costs one line here and nothing anywhere
 *  else, which is the reason the question is asked in one place. */
create or replace function public.sees_money(in_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.my_role(in_project_id) = 'owner';
$$;

revoke execute on function public.my_role(uuid) from public;
revoke execute on function public.works_here(uuid) from public;
revoke execute on function public.sees_money(uuid) from public;
grant execute on function public.my_role(uuid) to authenticated;
grant execute on function public.works_here(uuid) to authenticated;
grant execute on function public.sees_money(uuid) to authenticated;

-- ── WHO CAN SEE THE MEMBERSHIP LIST ───────────────────────────────────────
--
-- A staff member reads their OWN row -- they have to be able to learn that
-- they were switched off, the same reason vibe-dealer keeps that policy. Only
-- the owner reads the whole list or changes it.

create policy "project_members_select" on public.project_members
  for select using (
    user_id = auth.uid()
    or exists (
      select 1 from public.projects p
      where p.id = project_members.project_id and p.account_id = auth.uid()
    )
  );

create policy "project_members_write_owner" on public.project_members
  for all using (
    exists (
      select 1 from public.projects p
      where p.id = project_members.project_id and p.account_id = auth.uid()
    )
  );

-- ── EVERY TABLE ASKS THE FUNCTION NOW ─────────────────────────────────────
--
-- The policies are dropped and rewritten rather than edited, so that what is
-- in force is what is written here rather than a layer over something older.
--
-- ⚠️ THE MONEY IS THE ONE THAT DIFFERS. Everything else asks works_here();
-- ledger_entries asks sees_money(). That single difference is the feature.

do $$
declare
  t text;
  p record;
begin
  foreach t in array array[
    'project_pages', 'pipeline_records', 'directory_entries',
    'record_lines', 'ledger_entries', 'project_doc_prefixes'
  ]
  loop
    for p in select policyname from pg_policies
             where schemaname = 'public' and tablename = t
    loop
      execute format('drop policy if exists %I on public.%I', p.policyname, t);
    end loop;
  end loop;
end $$;

create policy "project_pages_members" on public.project_pages
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

create policy "pipeline_records_members" on public.pipeline_records
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

create policy "directory_entries_members" on public.directory_entries
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

create policy "record_lines_members" on public.record_lines
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

create policy "doc_prefixes_members" on public.project_doc_prefixes
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

/* 🔴 收款 · 开销 · 佣金. The only table a staff member cannot see at all. */
create policy "ledger_entries_owner_only" on public.ledger_entries
  for all using (public.sees_money(project_id)) with check (public.sees_money(project_id));

-- The project itself, and the pages' history, read the same way.
drop policy if exists "projects_select_own" on public.projects;
create policy "projects_select_member" on public.projects
  for select using (public.works_here(id));

-- ── AND THE FUNCTIONS THAT WRITE ──────────────────────────────────────────
--
-- Each of them checks `account_id = auth.uid()` inside its own body, which RLS
-- cannot reach. Without this a staff member would be refused by the function
-- while the policy let them through -- or worse on the money side, allowed to
-- WRITE a payment they are not allowed to read.

create or replace function public.add_directory_entry(
  in_project_id uuid,
  in_module_key text,
  in_name text,
  in_kind text default null,
  in_contact_person text default '',
  in_phone text default '',
  in_whatsapp text default '',
  in_email text default '',
  in_address text default '',
  in_region text default '',
  in_reg_no text default '',
  in_tax_id text default '',
  in_status text default '',
  in_note text default '',
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null
)
returns public.directory_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.directory_entries;
  the_kind text;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;

  if not public.is_directory_module(in_module_key) then
    raise exception 'not a directory module: %', in_module_key;
  end if;

  if in_idempotency_key is not null then
    select * into row from public.directory_entries
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  if coalesce(btrim(in_name), '') = '' then
    raise exception 'a directory entry needs a name';
  end if;

  the_kind := lower(btrim(coalesce(in_kind, '')));
  if the_kind not in ('person', 'company') then
    the_kind := 'person';
  end if;

  insert into public.directory_entries (
    project_id, module_key, kind, name, contact_person, phone, whatsapp,
    email, address, region, reg_no, tax_id, status, note, extra,
    created_by, idempotency_key
  ) values (
    in_project_id, in_module_key, the_kind,
    left(btrim(in_name), 200),
    left(btrim(coalesce(in_contact_person, '')), 200),
    left(btrim(coalesce(in_phone, '')), 40),
    left(btrim(coalesce(in_whatsapp, '')), 40),
    left(btrim(coalesce(in_email, '')), 200),
    left(btrim(coalesce(in_address, '')), 400),
    left(btrim(coalesce(in_region, '')), 120),
    left(btrim(coalesce(in_reg_no, '')), 60),
    left(btrim(coalesce(in_tax_id, '')), 60),
    left(btrim(coalesce(in_status, '')), 60),
    left(coalesce(in_note, ''), 2000),
    coalesce(in_extra, '{}'::jsonb),
    auth.uid(),
    in_idempotency_key
  )
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.add_directory_entry(
  uuid, text, text, text, text, text, text, text, text, text, text, text,
  text, text, jsonb, uuid
) from public;
grant execute on function public.add_directory_entry(
  uuid, text, text, text, text, text, text, text, text, text, text, text,
  text, text, jsonb, uuid
) to authenticated;

-- ── ADDING SOMEBODY ───────────────────────────────────────────────────────
--
-- By email, because that is what an owner knows about his own supervisor. The
-- person has to have signed up already -- inviting a stranger by email is a
-- different feature that needs mail sending, and saying so plainly is better
-- than a row pointing at nobody.

create or replace function public.add_project_member(
  in_email text,
  in_role text default 'staff'
)
returns public.project_members
language plpgsql
security definer
set search_path = public
as $$
declare
  my_project uuid;
  them uuid;
  row public.project_members;
begin
  select id into my_project from public.projects where account_id = auth.uid();
  if my_project is null then
    raise exception 'only the owner of a project can add people to it';
  end if;

  select id into them from auth.users
   where lower(email) = lower(btrim(coalesce(in_email, '')));
  if them is null then
    raise exception 'that email has no account yet -- they sign up first';
  end if;
  if them = auth.uid() then
    raise exception 'you are the owner already';
  end if;

  insert into public.project_members (project_id, user_id, role, invited_by)
  values (my_project, them, 'staff', auth.uid())
  on conflict (project_id, user_id)
    do update set active = true, role = 'staff'
  returning * into row;

  return row;
end;
$$;

create or replace function public.set_member_active(
  in_user_id uuid,
  in_active boolean
)
returns public.project_members
language plpgsql
security definer
set search_path = public
as $$
declare
  my_project uuid;
  row public.project_members;
begin
  select id into my_project from public.projects where account_id = auth.uid();
  if my_project is null then
    raise exception 'only the owner of a project can change who works in it';
  end if;

  update public.project_members
     set active = in_active
   where project_id = my_project and user_id = in_user_id
  returning * into row;
  if not found then
    raise exception 'that person does not work here';
  end if;
  return row;
end;
$$;

revoke execute on function public.add_project_member(text, text) from public;
revoke execute on function public.set_member_active(uuid, boolean) from public;
grant execute on function public.add_project_member(text, text) to authenticated;
grant execute on function public.set_member_active(uuid, boolean) to authenticated;

-- ── AND THE SIX WRITERS ON THE WORK SIDE ──────────────────────────────────
--
-- Each of these checks ownership INSIDE its own body, where RLS cannot reach.
-- Left alone, a supervisor would be let through by the policy and refused by
-- the function -- able to read the job list and unable to add to it.
--
-- ⚠️ GENERATED FROM THEIR OWN CURRENT DEFINITIONS, not retyped. 090000 exists
-- because a hand-transcribed re-declaration dropped its `unique_violation`
-- tail, and there are six of them here. The script pulls each newest body,
-- swaps the ownership predicate, and asserts that the swap actually happened
-- and that no `account_id = auth.uid()` survives -- so a function that did not
-- match cannot slip through as unchanged.
--
-- ⚠️ THE MONEY WRITERS ARE NOT IN THIS LIST, and that is the feature:
-- add_ledger_entry, update_ledger_words and reverse_ledger_entry keep asking
-- for the owner. A staff member who could write a payment he cannot read would
-- be worse than one who can read it.

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
  /* works_here, not account_id: a site supervisor writes jobs too. The money
     functions are the ones that still ask sees_money. See 20260901010000. */
  if not public.works_here(in_project_id) then
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
     and public.works_here(r.project_id);
  if not found then
    raise exception 'no such record in your project';
  end if;

  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id
        and project_id = row.project_id
        and module_key = public.directory_side(row.module_key);
    if not found then
      raise exception 'that party is not on this side of the book';
    end if;
    the_party := in_party_id;
  elsif in_clear_party then
    the_party := null;
  elsif in_party is not null and btrim(in_party) is distinct from btrim(row.party) then
    the_party := public.party_by_name(
      row.project_id, in_party, public.directory_side(row.module_key)
    );
  else
    the_party := row.party_id;
  end if;

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
     and public.works_here(r.project_id)
  returning * into row;
  if not found then
    raise exception 'no such record in your project';
  end if;
  return row;
end;
$$;

create or replace function public.set_record_lines(
  in_record_id uuid,
  in_lines jsonb
)
returns setof public.record_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  item jsonb;
  i integer := 0;
begin
  select exists (
    select 1 from public.pipeline_records r
    where r.id = in_record_id and public.works_here(r.project_id)
  ) into mine;
  if not mine then
    raise exception 'no such document in your project';
  end if;

  if jsonb_typeof(coalesce(in_lines, 'null'::jsonb)) <> 'array' then
    raise exception 'lines must be an array';
  end if;

  /* Twenty is a document; two hundred is an import, and an import is a
     different feature with a different set of questions. */
  if jsonb_array_length(in_lines) > 60 then
    raise exception 'too many lines on one document';
  end if;

  delete from public.record_lines where record_id = in_record_id;

  for item in select * from jsonb_array_elements(in_lines)
  loop
    if coalesce(btrim(item->>'description'), '') = '' then
      raise exception 'every line needs a description';
    end if;
    insert into public.record_lines (
      record_id, project_id, description, qty, unit,
      unit_price_cents, amount_cents, sort_order, note, extra
    ) values (
      in_record_id,
      /* Overwritten by the trigger; a value is needed for the not-null. */
      '00000000-0000-0000-0000-000000000000'::uuid,
      left(btrim(item->>'description'), 300),
      nullif(item->>'qty', '')::numeric,
      left(coalesce(btrim(item->>'unit'), ''), 30),
      nullif(item->>'unit_price_cents', '')::bigint,
      coalesce(nullif(item->>'amount_cents', '')::bigint, 0),
      i,
      left(coalesce(item->>'note', ''), 500),
      coalesce(item->'extra', '{}'::jsonb)
    );
    i := i + 1;
  end loop;

  /* An emptied list has to put the total back under the owner's control
     rather than leaving the last computed sum standing as if it were typed.
     The trigger stays silent on zero lines, on purpose, so this says it. */
  if jsonb_array_length(in_lines) = 0 then
    update public.pipeline_records set amount_cents = null, updated_at = now()
     where id = in_record_id;
  end if;

  return query
    select * from public.record_lines
     where record_id = in_record_id
     order by sort_order;
end;
$$;

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
     and public.works_here(d.project_id);
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
     and public.works_here(d.project_id)
  returning * into row;
  if not found then
    raise exception 'no such entry in your project';
  end if;
  return row;
end;
$$;
