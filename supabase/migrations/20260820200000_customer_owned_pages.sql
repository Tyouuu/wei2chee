-- supabase/migrations/20260820200000_customer_owned_pages.sql
--
-- Lets a customer add and remove pages in their own system.
--
-- WHY THIS IS THE CORE PROMISE AND NOT A FEATURE REQUEST: the product sells
-- "design your own system", and until now the page set was chosen entirely by
-- trade -- `pages_for_industry()` handed a contractor five pages and there was
-- no way to add a sixth or drop one. A renovation business that also runs a
-- small showroom could not add 「预约」. A wholesaler who never quotes could not
-- remove 「报价单」. What the customer actually got to design was the CONTENTS
-- of a page set somebody else picked, which is a meaningfully smaller claim
-- than the one on the landing page.
--
-- TWO KINDS OF PAGE, ONE TABLE. A customer can either add one of the page
-- types this product already knows how to build (`bookings`, `orders`, ...)
-- or a page of their own that it has never heard of ("员工排班", "材料库存").
-- The second is the important one -- it is the difference between picking from
-- a menu and designing -- and it is why `page_key` has to stop being an
-- enum of seven literals.
--
-- Custom keys are `custom_<uuid-ish>` rather than a slug of the customer's
-- title. A title is renameable and non-unique ("收款" twice), while the key is
-- what every layout, route and save call is addressed by; deriving one from
-- the other would make renaming a page either break its route or silently
-- collide with a sibling.

-- The customer's own name for the page. NULL for the built-in types, which
-- take their label from the industry vocabulary as they always have -- so
-- this column adds a capability without rewriting what already works.
alter table public.project_pages
  add column if not exists title text;

alter table public.project_pages
  drop constraint if exists project_pages_title_len;
alter table public.project_pages
  add constraint project_pages_title_len
  check (title is null or char_length(title) between 1 and 24);

-- Known types stay an explicit list so a typo in application code still fails
-- loudly; custom pages get a bounded, structured pattern rather than a free
-- string, so a caller cannot invent `../../admin` or a 4KB key.
alter table public.project_pages
  drop constraint if exists project_pages_page_key_check;
alter table public.project_pages
  add constraint project_pages_page_key_check
  check (
    page_key in (
      'dashboard', 'customers', 'quotations', 'projects',
      'payments', 'bookings', 'orders'
    )
    or page_key ~ '^custom_[a-z0-9]{8,32}$'
  );

/**
 * Adds a page to the caller's own project.
 *
 * `requested_key` is either one of the known types or NULL, in which case a
 * custom key is generated here. Generated server-side on purpose: a key
 * supplied by the browser is a value the browser chose, and the uniqueness that
 * makes routing work should not depend on a client getting that right.
 */
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
      'dashboard', 'customers', 'quotations', 'projects',
      'payments', 'bookings', 'orders'
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

revoke execute on function public.add_project_page(text, text) from anon;
grant execute on function public.add_project_page(text, text) to authenticated;

/**
 * Removes a page from the caller's own project.
 *
 * The dashboard is not removable. Every generated page's rail links back to it,
 * `/portal` sends people there, and a system with no overview is not a smaller
 * system, it is a broken one. Refusing here rather than in the UI means the
 * rule holds even if a future screen forgets it.
 */
create or replace function public.remove_project_page(target_page_key text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if target_page_key = 'dashboard' then
    raise exception 'the dashboard cannot be removed';
  end if;

  select id into v_project_id
  from public.projects
  where account_id = auth.uid();

  if v_project_id is null then
    raise exception 'no project for this account';
  end if;

  delete from public.project_pages
  where project_id = v_project_id
    and page_key = target_page_key;

  if not found then
    raise exception 'page not found: %', target_page_key;
  end if;
end;
$$;

revoke execute on function public.remove_project_page(text) from anon;
grant execute on function public.remove_project_page(text) to authenticated;
