-- supabase/migrations/20260821040000_ai_chooses_the_modules.sql
--
-- Lets the analysis decide what the system is made of.
--
-- WHY: `pages_for_industry()` (migration 20260820160000) was a CASE over eight
-- industry slugs returning four or five pages. It was a real improvement on the
-- five-for-everyone that preceded it -- but it meant the AI analysed a business
-- in detail and then had no say in what got built from that analysis. Its
-- output schema had no field for pages or modules at all, and the word 模块
-- never appeared on the screen the visitor is asked to convert from.
--
-- Measured against a real case before changing anything: a Master Dealer for
-- SIM top-ups, run through the live endpoint three times. The model correctly
-- named monthly reconciliation, 2% commission and the missing dealer activity
-- ranking. The system it was handed contained 报价单 and 项目 -- neither exists
-- in that business -- and could not contain 对账, 佣金 or 排名, because the
-- page_key check constraint did not include them.
--
-- The catalogue of what CAN be built lives in lib/portal/module-catalog.ts and
-- is mirrored here, the same way PAGES_FOR_INDUSTRY mirrors pages_for_industry.
-- The two must agree: a key the trigger writes but the app cannot build renders
-- as a blank canvas for a paying customer.

-- ---------------------------------------------------------------------------
-- 1. Where the recommendation is stored
-- ---------------------------------------------------------------------------
-- Nullable, because every analysis written before today has none and back-
-- filling one would be inventing a recommendation nothing made.
alter table public.analysis_results
  add column if not exists modules jsonb;

comment on column public.analysis_results.modules is
  'What the AI recommended this system be made of: [{key,label,why}]. NULL for analyses generated before 2026-08-21.';

-- ---------------------------------------------------------------------------
-- 2. The buildable catalogue
-- ---------------------------------------------------------------------------
alter table public.project_pages
  drop constraint if exists project_pages_page_key_check;

-- The custom-page escape hatch (`custom_<hex>`, migration 20260820200000) is
-- carried over verbatim, regex and all -- it is deliberately stricter than a
-- prefix test so a caller cannot invent `custom_../../admin` or a 4KB key.
alter table public.project_pages
  add constraint project_pages_page_key_check
  check (
    page_key in (
      'dashboard', 'customers', 'payments',
      'quotations', 'orders', 'bookings', 'projects', 'tasks',
      'reconciliation', 'commission', 'expenses', 'reports',
      'ranking', 'suppliers', 'staff',
      'inventory'
    )
    or page_key ~ '^custom_[a-z0-9]{8,32}$'
  );

-- ---------------------------------------------------------------------------
-- 3. Catalogue order, so a system reads in a designed sequence
-- ---------------------------------------------------------------------------
-- Mirrors MODULE_KEYS' own order in module-catalog.ts. Used only when the
-- recommendation carries no order of its own.
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
        'inventory'
      ],
      key
    ),
    99
  );
$$;

-- ---------------------------------------------------------------------------
-- 4. The default set, kept as the floor
-- ---------------------------------------------------------------------------
-- Replaces 20260820160000's version. Same shape, two trades gain 库存 now that
-- it exists -- a retailer without a stock page was a gap the old catalogue
-- simply could not express.
create or replace function public.pages_for_industry(industry_slug text)
returns text[]
language sql
immutable
set search_path = public
as $$
  select case industry_slug
    when 'beauty' then array['dashboard', 'customers', 'bookings', 'payments']
    when 'education' then array['dashboard', 'customers', 'bookings', 'payments']
    when 'fnb' then array['dashboard', 'customers', 'orders', 'payments']
    when 'retail' then array['dashboard', 'customers', 'orders', 'inventory', 'payments']
    when 'wholesale' then array['dashboard', 'customers', 'quotations', 'orders', 'inventory', 'payments']
    else array['dashboard', 'customers', 'quotations', 'projects', 'payments']
  end;
$$;

-- ---------------------------------------------------------------------------
-- 5. Provision from the recommendation
-- ---------------------------------------------------------------------------
-- Replaces 20260820160000's handle_new_account, keeping its lead_id hardening
-- verbatim (the malformed-uuid catch and the nonexistent-id lookup) and
-- changing only where the page list comes from.
--
-- The recommendation is read defensively at every step, because it is the one
-- input here that a language model produced. A malformed or empty modules array
-- must degrade to the trade's default set, never to an account with no pages --
-- an account with no pages is a customer who signs up and lands on nothing,
-- which is strictly worse than the wrong five pages.
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

  -- Unchanged from 20260819180000.
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

    -- The most recent analysis for this lead. `order by generated_at desc`
    -- rather than assuming one row: a visitor who re-ran the questionnaire has
    -- more than one, and the newest is the one they were shown.
    select a.modules into recommended
    from public.analysis_results a
    where a.lead_id = resolved_lead_id
    order by a.generated_at desc
    limit 1;
  end if;

  if recommended is not null and jsonb_typeof(recommended) = 'array' then
    -- Only keys that survive the check constraint. A key the app cannot build
    -- would abort signup here rather than at render time, which is a worse
    -- place to find out.
    select array_agg(m.key order by public.module_rank(m.key))
    into page_keys
    from (
      select distinct jsonb_array_elements(recommended) ->> 'key' as key
    ) m
    where m.key in (
      'dashboard', 'customers', 'payments',
      'quotations', 'orders', 'bookings', 'projects', 'tasks',
      'reconciliation', 'commission', 'expenses', 'reports',
      'ranking', 'suppliers', 'staff', 'inventory'
    );

    -- The business's own noun for each page, e.g. 经销商 instead of 客户.
    -- Stored as project_pages.title so the rail, the editor and the spec all
    -- read one value rather than each re-deriving it.
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

  -- Fall back whenever the recommendation produced nothing usable.
  if page_keys is null or array_length(page_keys, 1) is null then
    page_keys := public.pages_for_industry(industry_slug);
    page_titles := '{}'::jsonb;
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
-- 6. Let the customer add the new module types too
-- ---------------------------------------------------------------------------
-- Re-declares add_project_page from 20260820200000 with ONLY its built-in-key
-- list widened. Without this the AI could provision 对账 but the customer could
-- never add one back after deleting it -- a page type that exists in their
-- system and not in the dialog that adds pages.
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

  -- A ceiling, because the rail is a fixed-width column and the specification
  -- document is something a person reads: forty pages is not a system anybody
  -- designed on purpose, it is a runaway loop or a stuck button.
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
    -- 12 hex chars from a fresh uuid: inside the constraint's 8-32 range, and
    -- collision-free in practice for a table this small.
    v_key := 'custom_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  else
    if requested_key not in (
      'dashboard', 'customers', 'payments',
      'quotations', 'orders', 'bookings', 'projects', 'tasks',
      'reconciliation', 'commission', 'expenses', 'reports',
      'ranking', 'suppliers', 'staff', 'inventory'
    ) then
      raise exception 'unknown page type: %', requested_key;
    end if;
    v_key := requested_key;
    -- Adding a built-in type the project already has is a no-op rather than an
    -- error: the customer's intent ("I want a bookings page") is already
    -- satisfied, and an error here would read as a broken button.
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
