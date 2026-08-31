-- supabase/migrations/20260831120000_the_second_list_of_the_same_keys.sql
--
-- 110000 opened `project_pages.page_key` for 进货单 and stopped one function
-- short. `add_project_page` carries its OWN copy of the same list, so the
-- table would have accepted the page while the only function that inserts one
-- refused it -- and the customer, who had just chosen 进货单 from the
-- catalogue, would have read 「not a page we build」.
--
-- ⚠️ A SEPARATE FILE BECAUSE 110000 IS ALREADY APPLIED. Editing it would make
-- git disagree with production, and every rebuild from migrations would then
-- be a different database from the one running.
--
-- ⚠️ AND THE REASON IT WAS MISSED IS WORTH MORE THAN THE FIX. The list exists
-- twice. module-catalog.test.ts already walks MODULE_KEYS against this
-- function's body and would have gone red on the next run -- the guard was
-- right, the order of operations was not: pushed before the tests ran.

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
      'ranking', 'suppliers', 'staff', 'inventory', 'purchases',
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
