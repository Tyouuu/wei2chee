-- supabase/migrations/20260902010000_every_business_gets_an_address.sql
--
-- THE GAP THIS CLOSES. `site_slug` has existed since 20260823010000 and the
-- only thing that has ever written it is set_my_site_slug -- which the owner
-- has to go and press. Measured 2026-09-02: six projects, ONE address.
--
-- The dead end is not the panel, it is everything in front of it. Signup runs
-- `insert into public.projects (account_id)` and nothing else, so the column is
-- null; the only place it can be filled is a collapsed <details> inside the
-- website page's editor; and that field opens EMPTY -- `useState(initialSlug ??
-- "")` -- so the owner is asked to invent a name with no suggestion. A business
-- that never finds that panel has a website nobody can open, and the product's
-- whole promise is that they can send someone the link.
--
-- ---------------------------------------------------------------------------
-- Why a machine-chosen address may be replaced and a human's may not
-- ---------------------------------------------------------------------------
-- At signup there IS no company name. The questionnaire never asks for one
-- (checked: `leads.answers` holds tracking_today / biggest_time_sink /
-- new_customer_flow and nothing else), and business_name is written much later
-- by update_business_identity, from a dialog behind a gear icon. So an address
-- assigned at signup can only be built out of the trade, and it should give way
-- the moment the owner tells us who they actually are.
--
-- One boolean carries that: `site_slug_auto` means WE made this up. It stays
-- improvable until either a human picks a slug or the site is published --
-- after publication the address may already be on a name card, which is the
-- same reason 20260823010000 kept slug and published as two columns.
alter table public.projects
  add column if not exists site_slug_auto boolean not null default false;

-- ---------------------------------------------------------------------------
-- 1. One reserved list, not two
-- ---------------------------------------------------------------------------
-- set_my_site_slug had this list inline. A second hand-written copy is how this
-- repository has been bitten at least four times -- the copy outlives the thing
-- it describes -- and here it would mean the machine handing out an address the
-- owner is then forbidden to type. Both writers ask this one function.
create or replace function public.site_slug_is_reserved(candidate text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select lower(coalesce(candidate, '')) in (
    'api', 'auth', 'admin', 'portal', 'login', 'signup', 'logout',
    'account', 'settings', 'formae', 'www', 'app', 'help', 'support',
    'legal', 'privacy', 'terms', 'about', 'contact', 'blog', 'new', 's'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. A name in, an address out -- or nothing
-- ---------------------------------------------------------------------------
-- Returns null rather than a guess when there is nothing usable, because the
-- caller has other sources to try and a bad slug is a broken URL forever.
--
-- A wholly Chinese name yields null here and that is correct: the shape
-- constraint is [a-z0-9-] and there is no transliteration table in this
-- database. Postgres cannot get "xingfa" out of those characters, and inventing
-- something that merely looks Malaysian would be worse than admitting it. The
-- trade fallback in claim_auto_site_slug is what serves that business.
create or replace function public.slug_from_name(raw text)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  s text;
begin
  s := lower(coalesce(raw, ''));
  -- Every run of anything else collapses to ONE hyphen, so "A & W" becomes
  -- a-w rather than a---w, which the shape constraint would reject.
  s := regexp_replace(s, '[^a-z0-9]+', '-', 'g');
  s := trim(both '-' from s);

  if char_length(s) > 40 then
    -- Trimmed AFTER cutting: left() can land on a hyphen, and a trailing
    -- hyphen fails the shape constraint.
    s := trim(both '-' from left(s, 40));
  end if;

  if char_length(s) < 3 then
    return null;
  end if;

  return s;
end;
$$;

-- Second, third, fourth attempt at the same base. Kept out of the loop that
-- uses it so the truncation rule can be tested on its own.
create or replace function public.site_slug_variant(base text, n integer)
returns text
language plpgsql
immutable
set search_path = public
as $$
declare
  suffix text;
begin
  if n <= 1 then
    return base;
  end if;
  suffix := '-' || n::text;
  -- rtrim before appending: left('kuala-lumpur-reno', 12) ends in a hyphen and
  -- 'kuala-lumpur--2' is not a legal slug.
  return rtrim(left(base, 40 - char_length(suffix)), '-') || suffix;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Claiming one on the business's behalf
-- ---------------------------------------------------------------------------
-- TAKES A PROJECT ID AND IS GRANTED TO NOBODY. It has to take an id because
-- handle_new_account runs as a trigger where auth.uid() is not the customer,
-- and an id parameter granted to `authenticated` would let any signed-in person
-- name somebody else's website. It is reachable only from the two security
-- definer functions below, each of which resolves the project itself.
create or replace function public.claim_auto_site_slug(target_project uuid)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  proj record;
  base text;
  trade text;
  candidate text;
  n integer := 1;
begin
  select p.id, p.site_slug, p.site_slug_auto, p.site_published,
         p.business_name, p.owner_name, p.account_id
    into proj
  from public.projects p
  where p.id = target_project;

  if proj.id is null then
    return null;
  end if;

  -- Never over an address a person chose, and never over one that is already
  -- answering: a published URL may be printed on something by now.
  if proj.site_slug is not null and (not proj.site_slug_auto or proj.site_published) then
    return proj.site_slug;
  end if;

  -- The business first, the owner second. A sole trader who writes only
  -- "Tan Wei Chee" still gets an address a stranger reads as a person's
  -- business rather than as a serial number.
  base := public.slug_from_name(proj.business_name);
  if base is null then
    base := public.slug_from_name(proj.owner_name);
  end if;

  -- The trade last, which is all that exists at signup. Four hex characters of
  -- the project id rather than a counter: "renovation-2" tells a stranger how
  -- many renovation customers we have, and this address is public.
  if base is null then
    select i.slug into trade
    from public.accounts a
    join public.leads l on l.id = a.lead_id
    join public.industries i on i.id = l.industry_id
    where a.id = proj.account_id;

    if trade is not null then
      base := public.slug_from_name(trade) || '-' ||
              substr(replace(proj.id::text, '-', ''), 1, 4);
    end if;
  end if;

  -- No name, no owner, no questionnaire. Leaving it null is the honest answer:
  -- there is nothing to build an address out of, and this account has not told
  -- us anything a stranger would recognise.
  if base is null then
    return proj.site_slug;
  end if;

  -- Already sitting on exactly the address this would choose.
  if proj.site_slug is not null and proj.site_slug = base then
    return proj.site_slug;
  end if;

  loop
    candidate := public.site_slug_variant(base, n);

    if not public.site_slug_is_reserved(candidate)
       and not exists (
         select 1 from public.projects
         where lower(site_slug) = candidate and id <> proj.id
       )
    then
      begin
        update public.projects
        set site_slug = candidate, site_slug_auto = true, updated_at = now()
        where id = proj.id;
        return candidate;
      exception
        -- Two signups landing on the same base in the same instant. The unique
        -- index is the real arbiter; this takes the next number rather than
        -- failing a signup over an address.
        when unique_violation then
          null;
      end;
    end if;

    n := n + 1;
    if n > 50 then
      return proj.site_slug;
    end if;
  end loop;
end;
$$;

revoke execute on function public.claim_auto_site_slug(uuid) from public;
revoke execute on function public.claim_auto_site_slug(uuid) from anon;
revoke execute on function public.claim_auto_site_slug(uuid) from authenticated;

-- ---------------------------------------------------------------------------
-- 4. The three places an address can now appear
-- ---------------------------------------------------------------------------
-- Each of these is RE-DECLARED WHOLE rather than patched. plpgsql resolves
-- names at execution, not at `db push`, so a body edited by hand in three
-- places is three chances to ship a function that only fails when a real
-- customer calls it -- which is how the 42702 in 20260825050000 and again in
-- 20260831060000 reached production.

-- 4a. Signup. Everything here is carried over verbatim from 20260822040000 --
--     the forced website page and its position, the lead resolution and its
--     exception handler are decisions already made, and re-typing them
--     differently would be a silent regression rather than a visible one --
--     apart from the PERFORM at the end and one repair, below.
--
--     ⚠️ THE REPAIR: 'purchases' was missing from this key list. Task 85 found
--     the same key living in three lists and fixed all three (the page_key
--     constraint in 20260831110000, add_project_page in 20260831120000,
--     module_rank in 20260831130000). This was a FOURTH copy and nobody
--     touched it. The analysis schema enumerates MODULE_KEYS straight out of
--     module-catalog, so the model can and does return 進貨單 -- and this
--     filter dropped it on the floor at signup. The customer was told their
--     system would have that page and then it was not there, which is this
--     repository's signature defect wearing a fourth hat.
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
      'ranking', 'suppliers', 'staff', 'inventory', 'purchases',
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

  -- The new line. There is no company name yet, so this can only reach the
  -- trade fallback -- and that is the point: the website page exists from this
  -- moment, so its address should too.
  perform public.claim_auto_site_slug(new_project_id);

  return new;
end;
$$;

-- 4b. The moment the business says who it is. Carried over verbatim from
--     20260820180000 apart from capturing the project id and the PERFORM: the
--     "empty means clear it" rule and the truncate-rather-than-reject rule are
--     both deliberate and both easy to lose in a retype.
create or replace function public.update_business_identity(
  new_business_name text,
  new_owner_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_business text;
  v_owner text;
  v_project uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  v_business := nullif(btrim(coalesce(new_business_name, '')), '');
  v_owner := nullif(btrim(coalesce(new_owner_name, '')), '');

  v_business := left(v_business, 60);
  v_owner := left(v_owner, 40);

  update public.projects
     set business_name = v_business,
         owner_name = v_owner,
         updated_at = now()
   where account_id = auth.uid()
   returning id into v_project;

  if v_project is null then
    raise exception 'no project for this account';
  end if;

  -- Upgrades the signup guess to the real name. Returns without touching
  -- anything if a person has already picked an address, or if the site is
  -- published -- see claim_auto_site_slug.
  perform public.claim_auto_site_slug(v_project);
end;
$$;

revoke execute on function public.update_business_identity(text, text) from anon;
grant execute on function public.update_business_identity(text, text) to authenticated;

-- 4c. A person picking one. Same signature, so `create or replace` cannot leave
--     an overload behind. Two changes: the reserved list moves out to the one
--     function that owns it, and the address stops being ours the moment a
--     human types it.
create or replace function public.set_my_site_slug(new_slug text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cleaned text := lower(trim(coalesce(new_slug, '')));
  taken boolean;
begin
  if cleaned = '' then
    return 'empty';
  end if;

  if cleaned !~ '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$' then
    return 'shape';
  end if;

  if public.site_slug_is_reserved(cleaned) then
    return 'reserved';
  end if;

  select exists (
    select 1 from public.projects
    where lower(site_slug) = cleaned
      and account_id <> auth.uid()
  ) into taken;

  if taken then
    return 'taken';
  end if;

  update public.projects
  set site_slug = cleaned, site_slug_auto = false, updated_at = now()
  where account_id = auth.uid();

  if not found then
    return 'no_project';
  end if;

  return 'ok';
end;
$$;

revoke execute on function public.set_my_site_slug(text) from public;
grant execute on function public.set_my_site_slug(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The businesses that are already here
-- ---------------------------------------------------------------------------
-- Only rows with NO address. A project that already has one either had a person
-- choose it or was published, and both are cases this file refuses to touch
-- anywhere else; the filter says so here too rather than leaning on the guard
-- inside the function.
do $$
declare
  p record;
begin
  for p in select id from public.projects where site_slug is null loop
    perform public.claim_auto_site_slug(p.id);
  end loop;
end;
$$;
