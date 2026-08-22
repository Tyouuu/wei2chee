-- supabase/migrations/20260822040000_the_page_customers_see.sql
--
-- Adds 官网 -- the one page in a customer's system that a STRANGER reads.
--
-- WHY: every page this product builds so far is somewhere the OWNER works. The
-- business's own customers never see any of it, which means the product's most
-- concrete promise -- the founder's own 「官网表格 → 系统出单」 -- had nowhere to
-- live. A form on somebody else's website and a row in this system are two
-- separate things until one page holds both ends of the arrow.
--
-- Building it as one more page_key rather than a separate product is the whole
-- point: the same editor, the same eight registers, the same save. The
-- customer changes a heading on their website with the press they already know.
--
-- Mirrors lib/portal/module-catalog.ts, which gained the same key in the same
-- position. industry-template.test.ts and module-catalog.test.ts both parse
-- this file and fail if the two drift -- a key the trigger writes and the app
-- cannot build renders as a blank canvas for a paying customer.

-- ---------------------------------------------------------------------------
-- 1. The buildable catalogue gains one key
-- ---------------------------------------------------------------------------
alter table public.project_pages
  drop constraint if exists project_pages_page_key_check;

-- Carried over verbatim from 20260821040000 with 'website' appended, custom-key
-- escape hatch and all.
alter table public.project_pages
  add constraint project_pages_page_key_check
  check (
    page_key in (
      'dashboard', 'customers', 'payments',
      'quotations', 'orders', 'bookings', 'projects', 'tasks',
      'reconciliation', 'commission', 'expenses', 'reports',
      'ranking', 'suppliers', 'staff',
      'inventory',
      'website'
    )
    or page_key ~ '^custom_[a-z0-9]{8,32}$'
  );

-- ---------------------------------------------------------------------------
-- 2. Reading order: last
-- ---------------------------------------------------------------------------
-- Appended rather than inserted, on purpose. Every key above is somewhere the
-- owner works and they are ordered by the working day; 官网 is the one page
-- facing the other way, so it sits at the end -- and appending leaves the rail
-- order of every system built before today exactly as it was.
create or replace function public.module_rank(key text)
returns integer
language sql
immutable
set search_path = public
as $$
  select coalesce(
    array_position(
      array[
        'dashboard', 'customers', 'payments',
        'quotations', 'orders', 'bookings', 'projects', 'tasks',
        'reconciliation', 'commission', 'expenses', 'reports',
        'ranking', 'suppliers', 'staff',
        'inventory',
        'website'
      ],
      key
    ),
    99
  );
$$;

-- ---------------------------------------------------------------------------
-- 3. Every trade's default set gains it
-- ---------------------------------------------------------------------------
create or replace function public.pages_for_industry(industry_slug text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case industry_slug
    when 'beauty' then array['dashboard', 'customers', 'bookings', 'payments', 'website']
    when 'education' then array['dashboard', 'customers', 'bookings', 'payments', 'website']
    when 'fnb' then array['dashboard', 'customers', 'orders', 'payments', 'website']
    when 'retail' then array['dashboard', 'customers', 'orders', 'inventory', 'payments', 'website']
    when 'wholesale' then array['dashboard', 'customers', 'quotations', 'orders', 'inventory', 'payments', 'website']
    else array['dashboard', 'customers', 'quotations', 'projects', 'payments', 'website']
  end;
$$;

-- ---------------------------------------------------------------------------
-- 4. Provisioning
-- ---------------------------------------------------------------------------
-- Replaces 20260821040000's handle_new_account. Two changes, everything else
-- verbatim: the accepted-key list gains 'website', and 'website' is FORCED into
-- the page set whether or not the recommendation names it.
--
-- The force is not defensive habit. Every analysis_results row written before
-- today was produced by a model that had never heard of this module, so a
-- customer signing up today from last week's analysis would otherwise be
-- provisioned a system with no website page at all -- and there is no later
-- moment that would notice.
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
  recommended jsonb;
  page_keys text[];
  page_titles jsonb := '{}'::jsonb;
  idx integer := 0;
begin
  raw_lead_id := nullif(new.raw_user_meta_data ->> 'lead_id', '');

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

  if resolved_lead_id is not null then
    select i.slug into industry_slug
    from public.leads l
    join public.industries i on i.id = l.industry_id
    where l.id = resolved_lead_id;

    select a.modules into recommended
    from public.analysis_results a
    where a.lead_id = resolved_lead_id
    order by a.generated_at desc
    limit 1;
  end if;

  if recommended is not null and jsonb_typeof(recommended) = 'array' then
    select array_agg(m.key order by public.module_rank(m.key))
    into page_keys
    from (
      select distinct jsonb_array_elements(recommended) ->> 'key' as key
    ) m
    where m.key in (
      'dashboard', 'customers', 'payments',
      'quotations', 'orders', 'bookings', 'projects', 'tasks',
      'reconciliation', 'commission', 'expenses', 'reports',
      'ranking', 'suppliers', 'staff', 'inventory',
      'website'
    );

    select jsonb_object_agg(m.key, m.label)
    into page_titles
    from (
      select distinct on (e ->> 'key')
        e ->> 'key' as key,
        nullif(trim(e ->> 'label'), '') as label
      from jsonb_array_elements(recommended) e
    ) m
    where m.label is not null;
  end if;

  if page_keys is null or array_length(page_keys, 1) is null then
    page_keys := public.pages_for_industry(industry_slug);
    page_titles := '{}'::jsonb;
  end if;

  -- Forced, and forced LAST so it keeps its place at the end of the rail.
  if not ('website' = any(page_keys)) then
    page_keys := page_keys || 'website';
  end if;

  foreach each_page_key in array page_keys
  loop
    insert into public.project_pages (project_id, page_key, sort_order, title)
    values (
      new_project_id,
      each_page_key,
      idx,
      nullif(page_titles ->> each_page_key, '')
    );
    idx := idx + 1;
  end loop;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 5. The customer can add it back after deleting it
-- ---------------------------------------------------------------------------
-- Re-declares add_project_page from 20260821040000 with ONLY its built-in-key
-- list widened. Without this, a customer who deletes their website page can
-- never get it back -- a page type that exists in the product and not in the
-- dialog that adds pages.
create or replace function public.add_project_page(
  requested_key text,
  new_title text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_key text;
  v_title text;
  v_count int;
  v_next int;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into v_project_id
  from public.projects
  where account_id = auth.uid();

  if v_project_id is null then
    raise exception 'no project for this account';
  end if;

  select count(*) into v_count from public.project_pages where project_id = v_project_id;
  if v_count >= 12 then
    raise exception 'page limit reached';
  end if;

  v_title := nullif(btrim(coalesce(new_title, '')), '');
  v_title := left(v_title, 24);

  if requested_key is null or requested_key = '' then
    if v_title is null then
      raise exception 'a custom page needs a title';
    end if;
    v_key := 'custom_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  else
    if requested_key not in (
      'dashboard', 'customers', 'payments',
      'quotations', 'orders', 'bookings', 'projects', 'tasks',
      'reconciliation', 'commission', 'expenses', 'reports',
      'ranking', 'suppliers', 'staff', 'inventory',
      'website'
    ) then
      raise exception 'unknown page type: %', requested_key;
    end if;
    v_key := requested_key;
    if exists (
      select 1 from public.project_pages
      where project_id = v_project_id and page_key = v_key
    ) then
      return v_key;
    end if;
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_next
  from public.project_pages
  where project_id = v_project_id;

  insert into public.project_pages (project_id, page_key, title, sort_order)
  values (v_project_id, v_key, v_title, v_next);

  return v_key;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6. Every system that already exists gets one
-- ---------------------------------------------------------------------------
-- Backfilled rather than left to the next signup. The alternative is a product
-- where the feature exists only for accounts created after today, which for a
-- pre-launch product with a handful of real projects means it exists for
-- nobody the founder can actually show it to.
--
-- `layout_json` is left at '{}' deliberately: that is what isUngeneratedLayout
-- reads as "never written", so the page builds itself from the business's own
-- analysis the first time it is opened, exactly as a fresh signup's would.
insert into public.project_pages (project_id, page_key, sort_order, layout_json)
select
  p.id,
  'website',
  coalesce((select max(pp.sort_order) from public.project_pages pp where pp.project_id = p.id), -1) + 1,
  '{}'::jsonb
from public.projects p
where not exists (
  select 1 from public.project_pages pp
  where pp.project_id = p.id and pp.page_key = 'website'
);
