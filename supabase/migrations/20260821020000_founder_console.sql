-- supabase/migrations/20260821020000_founder_console.sql
--
-- The data layer behind the founder's console.
--
-- WHY RPCs AND NOT RLS POLICIES. The founder needs to read across every
-- account, which means either widening a policy on each of five tables or
-- putting the reads behind functions. Functions win here for one reason that
-- matters more than taste: with policies, "can the founder see this" is decided
-- in five places and a future policy edit can silently widen or break one of
-- them. With `security definer` functions each gated on `is_founder()`, there
-- is exactly one gate per question and it is the first line of every body. RLS
-- on the underlying tables stays exactly as it was for customers.
--
-- WHY `stage` EXISTS ALONGSIDE `paid`. `paid` is a GATE — save_project_page
-- reads it and nothing else should. `stage` is where a customer is in the
-- business: designing, quoted, paid, building, live. Keeping them as one
-- column would mean the moment the founder marked someone "building" he would
-- also be re-deciding whether they can save. They move together (see
-- console_set_stage) but they answer different questions.
--
-- WHY THE FEES ARE COLUMNS AND NOT A CONSTANT. Revenue computed as
-- `count(paid) * 5000` is a guess presented as a number. A contractor quoted
-- RM5,000 and a wholesaler quoted RM8,000 are both real, and the founder is the
-- only one who knows which. Defaults match the current price list so nothing
-- has to be filled in for the common case.

alter table public.projects
  add column if not exists stage text not null default 'designing',
  add column if not exists dev_fee_myr integer not null default 5000,
  add column if not exists monthly_fee_myr integer not null default 150,
  add column if not exists founder_note text;

alter table public.projects drop constraint if exists projects_stage_check;
alter table public.projects add constraint projects_stage_check
  check (stage in ('designing', 'quoted', 'paid', 'building', 'live'));

alter table public.projects drop constraint if exists projects_fees_check;
alter table public.projects add constraint projects_fees_check
  check (dev_fee_myr between 0 and 1000000 and monthly_fee_myr between 0 and 100000);

alter table public.projects drop constraint if exists projects_founder_note_len;
alter table public.projects add constraint projects_founder_note_len
  check (founder_note is null or char_length(founder_note) <= 2000);

-- Existing paid projects predate `stage`; without this they would all read
-- "designing" on the console's first load, which is the console being wrong
-- about the only customer it has.
update public.projects set stage = 'paid' where paid and stage = 'designing';

/**
 * The operating picture: one row, every number the console's header shows.
 *
 * Returned as a single json object rather than a table because these are
 * unrelated scalars, and a one-row table of twelve columns is a shape nobody
 * reads twice.
 */
create or replace function public.console_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_founder() then
    raise exception 'not permitted';
  end if;

  select jsonb_build_object(
    'leads_total', (select count(*) from public.leads),
    'leads_analyzed', (select count(distinct lead_id) from public.analysis_results),
    'leads_converted', (select count(*) from public.accounts where lead_id is not null),
    -- The founder's own account is not a customer. Counting it would make the
    -- console's very first number wrong.
    'customers_total', (select count(*) from public.accounts where role = 'customer'),
    'customers_paid', (
      select count(*) from public.projects p
      join public.accounts a on a.id = p.account_id
      where a.role = 'customer' and p.paid
    ),
    -- Booked, not invoiced: the dev fee counts once a customer has paid, the
    -- monthly fee only once their system is actually running.
    'revenue_dev', coalesce((
      select sum(p.dev_fee_myr) from public.projects p
      join public.accounts a on a.id = p.account_id
      where a.role = 'customer' and p.stage in ('paid', 'building', 'live')
    ), 0),
    'revenue_monthly', coalesce((
      select sum(p.monthly_fee_myr) from public.projects p
      join public.accounts a on a.id = p.account_id
      where a.role = 'customer' and p.stage in ('building', 'live')
    ), 0),
    'by_stage', coalesce((
      select jsonb_object_agg(stage, n) from (
        select p.stage, count(*) as n
        from public.projects p
        join public.accounts a on a.id = p.account_id
        where a.role = 'customer'
        group by p.stage
      ) s
    ), '{}'::jsonb)
  ) into result;

  return result;
end;
$$;

revoke execute on function public.console_overview() from anon;
grant execute on function public.console_overview() to authenticated;

/** Every customer, with everything the list view shows. */
create or replace function public.console_customers()
returns table (
  project_id uuid,
  account_id uuid,
  email text,
  business_name text,
  owner_name text,
  industry_name text,
  style text,
  paid boolean,
  stage text,
  dev_fee_myr integer,
  monthly_fee_myr integer,
  page_count bigint,
  founder_note text,
  created_at timestamptz,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_founder() then
    raise exception 'not permitted';
  end if;

  return query
  select
    p.id, a.id, a.email, p.business_name, p.owner_name,
    i.name_zh, p.style, p.paid, p.stage, p.dev_fee_myr, p.monthly_fee_myr,
    (select count(*) from public.project_pages pp where pp.project_id = p.id),
    p.founder_note, p.created_at, p.updated_at
  from public.projects p
  join public.accounts a on a.id = p.account_id
  left join public.leads l on l.id = a.lead_id
  left join public.industries i on i.id = l.industry_id
  where a.role = 'customer'
  order by p.updated_at desc nulls last, p.created_at desc;
end;
$$;

revoke execute on function public.console_customers() from anon;
grant execute on function public.console_customers() to authenticated;

/**
 * Every questionnaire lead, with its analysis and whether it ever became an
 * account.
 *
 * These are the ten rows sitting in this database that the founder has never
 * been able to see inside his own product. A lead that answered the
 * questionnaire and never signed up is the most actionable thing in here, which
 * is why `converted` is returned rather than left to be inferred.
 */
create or replace function public.console_leads()
returns table (
  id uuid,
  created_at timestamptz,
  language text,
  industry_name text,
  style_selected text,
  answers jsonb,
  summary text,
  bottlenecks jsonb,
  converted boolean,
  account_email text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_founder() then
    raise exception 'not permitted';
  end if;

  return query
  select
    l.id, l.created_at, l.language, i.name_zh, l.style_selected, l.answers,
    ar.summary, ar.bottlenecks,
    (a.id is not null), a.email
  from public.leads l
  left join public.industries i on i.id = l.industry_id
  -- Newest analysis only. A lead can be re-analysed, and joining them all would
  -- multiply the row out once per attempt.
  left join lateral (
    select r.summary, r.bottlenecks
    from public.analysis_results r
    where r.lead_id = l.id
    order by r.generated_at desc
    limit 1
  ) ar on true
  left join public.accounts a on a.lead_id = l.id
  order by l.created_at desc;
end;
$$;

revoke execute on function public.console_leads() from anon;
grant execute on function public.console_leads() to authenticated;

/**
 * One customer's whole design.
 *
 * THIS IS THE FUNCTION THAT FIXES THE BROKEN STEP. When a customer messages
 * "build my system", the founder could not see what they had designed:
 * /portal/spec resolves the project from auth.uid() and RLS restricts
 * project_pages to its owner, so the only available view was raw layout_json in
 * a table editor. Returning the layouts here is what lets the console render
 * their actual pages.
 */
create or replace function public.console_project(target_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  result jsonb;
begin
  if not public.is_founder() then
    raise exception 'not permitted';
  end if;

  select jsonb_build_object(
    'project', to_jsonb(p) - 'account_id',
    'email', a.email,
    'account_created_at', a.created_at,
    'industry', to_jsonb(i),
    'lead', to_jsonb(l),
    'analysis', (
      select to_jsonb(r) from public.analysis_results r
      where r.lead_id = l.id order by r.generated_at desc limit 1
    ),
    'pages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'page_key', pp.page_key,
        'title', pp.title,
        'sort_order', pp.sort_order,
        'updated_at', pp.updated_at,
        'layout_json', pp.layout_json
      ) order by pp.sort_order)
      from public.project_pages pp where pp.project_id = p.id
    ), '[]'::jsonb)
  ) into result
  from public.projects p
  join public.accounts a on a.id = p.account_id
  left join public.leads l on l.id = a.lead_id
  left join public.industries i on i.id = l.industry_id
  where p.id = target_project_id;

  if result is null then
    raise exception 'project not found';
  end if;

  return result;
end;
$$;

revoke execute on function public.console_project(uuid) from anon;
grant execute on function public.console_project(uuid) to authenticated;

/**
 * Moves a customer along the pipeline, and keeps `paid` in step.
 *
 * ONE CONTROL, NOT TWO. The founder should not have to remember that marking
 * someone "building" also means ticking a separate box before they can save
 * their own work. `paid` is derived here so the two can never disagree — which
 * is the failure mode of every admin screen that exposes both.
 */
create or replace function public.console_set_stage(target_project_id uuid, new_stage text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_founder() then
    raise exception 'not permitted';
  end if;

  if new_stage not in ('designing', 'quoted', 'paid', 'building', 'live') then
    raise exception 'unknown stage: %', new_stage;
  end if;

  update public.projects
  set stage = new_stage,
      paid = (new_stage in ('paid', 'building', 'live')),
      updated_at = now()
  where id = target_project_id;

  if not found then
    raise exception 'project not found';
  end if;
end;
$$;

revoke execute on function public.console_set_stage(uuid, text) from anon;
grant execute on function public.console_set_stage(uuid, text) to authenticated;

/** What this customer is actually being charged. */
create or replace function public.console_set_fees(
  target_project_id uuid,
  new_dev_fee integer,
  new_monthly_fee integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_founder() then
    raise exception 'not permitted';
  end if;

  update public.projects
  set dev_fee_myr = new_dev_fee,
      monthly_fee_myr = new_monthly_fee,
      updated_at = now()
  where id = target_project_id;

  if not found then
    raise exception 'project not found';
  end if;
end;
$$;

revoke execute on function public.console_set_fees(uuid, integer, integer) from anon;
grant execute on function public.console_set_fees(uuid, integer, integer) to authenticated;

/** The founder's own notes on a customer. Never shown to the customer. */
create or replace function public.console_set_note(target_project_id uuid, new_note text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_founder() then
    raise exception 'not permitted';
  end if;

  update public.projects
  set founder_note = nullif(btrim(coalesce(new_note, '')), ''),
      updated_at = now()
  where id = target_project_id;

  if not found then
    raise exception 'project not found';
  end if;
end;
$$;

revoke execute on function public.console_set_note(uuid, text) from anon;
grant execute on function public.console_set_note(uuid, text) to authenticated;
