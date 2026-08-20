-- supabase/migrations/20260820160000_pages_per_industry.sql
--
-- Gives each business the pages ITS trade actually needs, instead of the same
-- five for everyone.
--
-- WHY: every account was provisioned with dashboard / customers / quotations /
-- projects / payments regardless of industry. A salon owner was handed a
-- 「报价单」page they will never send and a 「项目」page for work they do not do,
-- while the thing their whole business runs on -- 「预约」-- did not exist. A
-- restaurant got the same. That is the most concrete possible contradiction of
-- the promise this product makes, which is that it understands your business:
-- the customer's own vocabulary was being applied to someone else's structure.
--
-- Two new page keys cover the gap for the seven seeded trades: `bookings` for
-- appointment-led businesses (beauty, education) and `orders` for
-- transaction-led ones (retail, F&B, wholesale).

-- ---------------------------------------------------------------------------
-- 1. Allow the two new page keys
-- ---------------------------------------------------------------------------
alter table public.project_pages
  drop constraint if exists project_pages_page_key_check;

alter table public.project_pages
  add constraint project_pages_page_key_check
  check (page_key in (
    'dashboard', 'customers', 'quotations', 'projects', 'payments',
    'bookings', 'orders'
  ));

-- ---------------------------------------------------------------------------
-- 2. Nav order needs to be data, not luck
-- ---------------------------------------------------------------------------
-- Pages are read back as a set, and a business's pages have a natural order
-- (总览 first, 收款 last). Without a column for it the editor's navigation
-- order depends on whatever order Postgres returns rows in, which is not a
-- guarantee at all.
alter table public.project_pages
  add column if not exists sort_order integer not null default 0;

-- Existing accounts keep their five pages; this just gives them the order the
-- app previously hardcoded.
update public.project_pages set sort_order = case page_key
  when 'dashboard' then 0
  when 'customers' then 1
  when 'quotations' then 2
  when 'bookings' then 2
  when 'orders' then 3
  when 'projects' then 3
  when 'payments' then 4
  else 5
end;

-- ---------------------------------------------------------------------------
-- 3. Which pages each trade gets
-- ---------------------------------------------------------------------------
-- Kept in SQL rather than in the app because the signup TRIGGER is what
-- provisions the rows, and a trigger cannot call into application code. The
-- app's own copy of this mapping (lib/templates/industry-template.ts) builds
-- the CONTENT of each page and is checked against this list by
-- scripts/check-tenant-isolation.mjs's sibling test.
--
-- `immutable` because the mapping is a pure function of the slug -- that lets
-- Postgres inline it wherever it is used.
create or replace function public.pages_for_industry(industry_slug text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case industry_slug
    -- Appointment-led: the business day IS the booking calendar. No quotations.
    when 'beauty' then array['dashboard', 'customers', 'bookings', 'payments']
    when 'education' then array['dashboard', 'customers', 'bookings', 'payments']
    -- Transaction-led: many small orders, no per-job quoting.
    when 'fnb' then array['dashboard', 'customers', 'orders', 'payments']
    when 'retail' then array['dashboard', 'customers', 'orders', 'payments']
    -- Quote first, then fulfil against a purchase order.
    when 'wholesale' then array['dashboard', 'customers', 'quotations', 'orders', 'payments']
    -- Quote first, then run a job over time. Also the default for 'other' and
    -- for an account with no industry at all.
    else array['dashboard', 'customers', 'quotations', 'projects', 'payments']
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Provision per industry at signup
-- ---------------------------------------------------------------------------
-- Replaces the version in 20260819180000, keeping its lead_id hardening
-- verbatim (the malformed-uuid catch and the nonexistent-id lookup) and
-- changing only which pages get created.
create or replace function public.handle_new_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_project_id uuid;
  each_page_key text;
  raw_lead_id text;
  resolved_lead_id uuid;
  industry_slug text;
  page_keys text[];
  idx integer := 0;
begin
  raw_lead_id := nullif(new.raw_user_meta_data ->> 'lead_id', '');

  -- Unchanged from 20260819180000: a malformed uuid in user metadata must not
  -- take down signup, and a well-formed uuid naming no lead resolves to NULL
  -- rather than relying on a foreign-key failure.
  begin
    resolved_lead_id := raw_lead_id::uuid;
  exception
    when invalid_text_representation then
      resolved_lead_id := null;
  end;

  if resolved_lead_id is not null then
    select id into resolved_lead_id from public.leads where id = resolved_lead_id;
  end if;

  insert into public.accounts (id, email, lead_id)
  values (new.id, new.email, resolved_lead_id);

  insert into public.projects (account_id)
  values (new.id)
  returning id into new_project_id;

  -- The industry this business told us about during the acquisition flow. NULL
  -- for a direct signup, which pages_for_industry handles by returning the
  -- general-purpose set.
  if resolved_lead_id is not null then
    select i.slug into industry_slug
    from public.leads l
    join public.industries i on i.id = l.industry_id
    where l.id = resolved_lead_id;
  end if;

  page_keys := public.pages_for_industry(industry_slug);

  foreach each_page_key in array page_keys
  loop
    insert into public.project_pages (project_id, page_key, sort_order)
    values (new_project_id, each_page_key, idx);
    idx := idx + 1;
  end loop;

  return new;
end;
$$;
