-- 导航改名 / 拖拽 — the customer names their own pages and puts them in their
-- own order.
--
-- WHY. Durable's per-block Content tab lists the navigation as a drag-list with
-- an Edit and a delete on every row, and the founder marked it 拿 on
-- 2026-08-25 with the reason attached: 「老板第一个想改的就是这个 —— 他不叫
-- Quotations，他叫『报价单』」. Renaming a page has been possible in the data
-- since `project_pages.title` was added (20260820200000) and there has never
-- been a way to do it. Reordering was not possible at all.
--
-- WHY sort_order IS NULLABLE AND NOT A DEFAULT SEQUENCE. A null means "this
-- customer has never expressed an opinion about where this page goes", and that
-- is a different state from "they put it first". Pages with no opinion keep the
-- designed order in lib/templates/industry-template.ts -- overview, then who
-- you serve, then what you sell them, then the money -- which is a reading
-- order most customers should never have to think about. The moment one of
-- them drags anything, every page gets a number and the customer owns the list.

alter table public.project_pages
  add column if not exists sort_order smallint;

comment on column public.project_pages.sort_order is
  'The customer''s own ordering. NULL means they have never reordered, and '
  'sortPages() in lib/templates/industry-template.ts keeps the designed order.';

-- ---------------------------------------------------------------------------
-- Rename. The title is what pageLabel() already prefers over the trade's own
-- noun, so this needs no reader changes anywhere.
create or replace function public.rename_project_page(
  target_key text,
  new_title text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_title text;
begin
  select id into v_project_id
  from public.projects
  where account_id = auth.uid();

  if v_project_id is null then
    raise exception 'project not found';
  end if;

  -- An empty title is how a customer says "go back to the trade's own word",
  -- which is a real thing to want and must not be stored as an empty string:
  -- pageLabel() tests `title?.trim()`, so '' would render as a nameless page.
  v_title := nullif(btrim(coalesce(new_title, '')), '');

  if v_title is not null and length(v_title) > 24 then
    raise exception 'title too long';
  end if;

  update public.project_pages
  set title = v_title, updated_at = now()
  where project_id = v_project_id
    and page_key = target_key;

  if not found then
    raise exception 'page not found';
  end if;
end;
$$;

revoke execute on function public.rename_project_page(text, text) from public;
grant execute on function public.rename_project_page(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Reorder. The whole list arrives at once rather than one page at a time: a
-- drag moves ONE page and changes the position of every page after it, so a
-- per-page setter would be a sequence of writes that is briefly, visibly wrong
-- if any of them fails.
create or replace function public.reorder_project_pages(ordered_keys text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_count int;
begin
  select id into v_project_id
  from public.projects
  where account_id = auth.uid();

  if v_project_id is null then
    raise exception 'project not found';
  end if;

  -- Every page the customer has, and nothing else. A short array would leave
  -- the omitted pages holding stale numbers and the list would settle into an
  -- order nobody chose.
  select count(*) into v_count
  from public.project_pages
  where project_id = v_project_id;

  if array_length(ordered_keys, 1) is distinct from v_count then
    raise exception 'expected % keys, got %', v_count, coalesce(array_length(ordered_keys, 1), 0);
  end if;

  update public.project_pages p
  set sort_order = k.ord, updated_at = now()
  from (
    select key, (ordinality - 1)::smallint as ord
    from unnest(ordered_keys) with ordinality as t(key, ordinality)
  ) k
  where p.project_id = v_project_id
    and p.page_key = k.key;
end;
$$;

revoke execute on function public.reorder_project_pages(text[]) from public;
grant execute on function public.reorder_project_pages(text[]) to authenticated;
