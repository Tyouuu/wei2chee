-- supabase/migrations/20260823010000_a_website_someone_can_open.sql
--
-- THE GAP THIS CLOSES. Six 官网版面 have existed since 20260822040000, each
-- rendered from the customer's own trade, brand and analysed workflow, with a
-- gallery to compare them in. And there was no way to open one from outside.
-- No public route, no slug, no published flag -- the page a business's own
-- customers are supposed to read lived only inside that business's admin.
--
-- Audited 2026-08-22: `app/` had zero anonymous routes. A customer could build
-- a website and could not send anyone the link.
--
-- ---------------------------------------------------------------------------
-- Two columns, and why they are two
-- ---------------------------------------------------------------------------
-- `site_slug` is the address. `site_published` is whether the address answers.
-- Collapsing them into "published means slug is not null" would mean taking a
-- site down destroys the address, and somebody else could then take it --
-- which is how a business loses a URL it has already printed on a name card.
alter table public.projects
  add column if not exists site_slug text,
  add column if not exists site_published boolean not null default false;

-- Lowercase-unique. The address `WeiChee` and the address `weichee` are the
-- same address to everyone who types one, so they cannot both exist.
create unique index if not exists projects_site_slug_key
  on public.projects (lower(site_slug))
  where site_slug is not null;

-- The shape rule lives here rather than only in the form, because the form is
-- not the only way rows change and a bad slug is a broken URL forever.
alter table public.projects drop constraint if exists projects_site_slug_shape;
alter table public.projects add constraint projects_site_slug_shape
  check (
    site_slug is null
    or site_slug ~ '^[a-z0-9](?:[a-z0-9]|-(?=[a-z0-9])){2,39}$'
  );

-- ---------------------------------------------------------------------------
-- Claiming an address
-- ---------------------------------------------------------------------------
-- Returns a status string rather than raising, because every failure here is
-- something the customer has to read and fix in a text field -- 「已经有人用了」
-- is an answer, not an error. Raising would surface a Postgres message in a
-- form, which is the one thing this product never does.
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

  -- Words that are already routes, or that a stranger would read as Formae
  -- speaking rather than as a business. `s` is here because the public route
  -- itself is /s/<slug> and /s/s reads as a bug.
  if cleaned in (
    'api', 'auth', 'admin', 'portal', 'login', 'signup', 'logout',
    'account', 'settings', 'formae', 'www', 'app', 'help', 'support',
    'legal', 'privacy', 'terms', 'about', 'contact', 'blog', 'new', 's'
  ) then
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
  set site_slug = cleaned, updated_at = now()
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
-- Turning it on
-- ---------------------------------------------------------------------------
-- TWO PRECONDITIONS, both of them about not publishing a lie.
--
-- 1. An address must exist. Obvious.
-- 2. The website page must have been SAVED. A page that has never been written
--    to renders from a read-side default (see the portal route) -- it is a
--    draft the customer has looked at, not one they have agreed to. Publishing
--    it would put a page the business has never approved in front of that
--    business's own customers, and every later edit would change it silently.
--
-- The second precondition also puts publishing behind the paid gate, because
-- save_project_page raises for an unpaid project. That is a consequence rather
-- than a decision made here, and it is a real product question -- a free public
-- landing page is a strong hook -- but it belongs in one place, and that place
-- is the save gate.
create or replace function public.set_my_site_published(publish boolean)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  proj record;
  saved boolean;
begin
  select id, site_slug into proj
  from public.projects
  where account_id = auth.uid();

  if proj.id is null then
    return 'no_project';
  end if;

  if publish then
    if proj.site_slug is null then
      return 'no_slug';
    end if;

    select exists (
      select 1 from public.project_pages
      where project_id = proj.id
        and page_key = 'website'
        and layout_json ? 'content'
    ) into saved;

    if not saved then
      return 'not_saved';
    end if;
  end if;

  update public.projects
  set site_published = publish, updated_at = now()
  where account_id = auth.uid();

  return 'ok';
end;
$$;

revoke execute on function public.set_my_site_published(boolean) from public;
grant execute on function public.set_my_site_published(boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- Reading it as a stranger
-- ---------------------------------------------------------------------------
-- SECURITY DEFINER because the reader has no session at all: RLS on `projects`
-- and `project_pages` is scoped to auth.uid(), and an anonymous visitor has
-- none. This function is the entire anonymous surface of the database, so what
-- it returns is deliberately narrow:
--
--   * the website page and NOTHING else -- not the dashboard, not customers,
--     not payments;
--   * the paint the page needs (style, palette, language);
--   * the business name, which is already on the page;
--
-- and never the account, the email, the lead, the analysis, the fees or the
-- other pages. A published site says nothing about the business that the site
-- itself does not already say.
--
-- Returns no rows for an unpublished or unknown slug, which the route turns
-- into a 404 -- indistinguishable from each other on purpose, so the URL space
-- cannot be probed for who is a customer.
create or replace function public.get_public_site(slug text)
returns table (
  business_name text,
  style text,
  palette text,
  system_language text,
  layout_json jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    p.business_name,
    p.style,
    p.palette,
    p.system_language,
    pg.layout_json
  from public.projects p
  join public.project_pages pg
    on pg.project_id = p.id and pg.page_key = 'website'
  where p.site_published
    and p.site_slug is not null
    and lower(p.site_slug) = lower(trim(coalesce(slug, '')))
    and pg.layout_json ? 'content'
  limit 1;
$$;

revoke execute on function public.get_public_site(text) from public;
grant execute on function public.get_public_site(text) to anon, authenticated;
