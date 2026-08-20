-- supabase/migrations/20260820220000_page_version_history.sql
--
-- Version history for a customer's pages, and the thing that makes autosave
-- safe enough to turn on.
--
-- WHY THESE TWO ARE ONE MIGRATION. `save_project_page` overwrote `layout_json`
-- in place, so every save destroyed the previous state permanently. That was
-- survivable while saving was a deliberate button press -- a customer who
-- wrecked their page could simply not press it. The moment the editor starts
-- saving on its own, that escape route closes: a bad edit would be committed
-- to the database within seconds, with nothing behind it. Autosave without
-- history is not a convenience, it is a way to lose work faster. So the history
-- lands first, in the same change.
--
-- WHY THE SNAPSHOT IS THE *PREVIOUS* LAYOUT. A row here answers "what did this
-- page look like before that save", which is the question someone asks when
-- they want to go back. Snapshotting the incoming layout instead would fill the
-- table with copies of the current state, which is the one state nobody needs a
-- copy of.

create table if not exists public.page_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  page_key text not null,
  layout_json jsonb not null,
  created_at timestamptz not null default now()
);

-- The only access pattern: the newest N versions of one page.
create index if not exists page_versions_page_idx
  on public.page_versions (project_id, page_key, created_at desc);

alter table public.page_versions enable row level security;

-- Read-only to the customer, and only their own. Every WRITE goes through the
-- security-definer functions below, which is what keeps the paid gate in
-- exactly one place -- a customer who could insert here directly could use this
-- table as unpaid storage.
drop policy if exists page_versions_select_own on public.page_versions;
create policy page_versions_select_own on public.page_versions
  for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = page_versions.project_id
        and p.account_id = auth.uid()
    )
  );

/**
 * Saving a page, now with a history behind it.
 *
 * Re-declared rather than altered: same signature, same paid gate, same "page
 * not found" behaviour. The only addition is the snapshot, so nothing that
 * already calls this has to change.
 */
create or replace function public.save_project_page(target_page_key text, new_layout jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  is_paid boolean;
  previous jsonb;
  newest timestamptz;
begin
  select id, paid into target_project_id, is_paid
  from public.projects
  where account_id = auth.uid();

  if target_project_id is null then
    raise exception 'project not found';
  end if;

  if not is_paid then
    raise exception 'payment required';
  end if;

  select layout_json into previous
  from public.project_pages
  where project_id = target_project_id
    and page_key = target_page_key;

  if not found then
    raise exception 'page not found: %', target_page_key;
  end if;

  select max(created_at) into newest
  from public.page_versions
  where project_id = target_project_id
    and page_key = target_page_key;

  -- THE THROTTLE, and the reason autosave does not produce an unreadable list.
  -- Left to itself, a save every few seconds would put a hundred entries in
  -- front of a customer looking for "the way it was this morning" -- which is
  -- not history, it is noise wearing history's clothes. One entry per three
  -- minutes of actual work reads as a session, which is how people remember
  -- what they did.
  --
  -- `previous <> '{}'` skips the very first save of a generated page: the
  -- layout it would preserve is the draft the customer has never seen as
  -- their own, and offering to "restore" a blank row is a trap.
  if previous is not null
     and previous <> '{}'::jsonb
     and previous is distinct from new_layout
     and (newest is null or newest < now() - interval '3 minutes')
  then
    insert into public.page_versions (project_id, page_key, layout_json)
    values (target_project_id, target_page_key, previous);

    -- A ceiling per page. Twenty entries is more than anyone scrolls, and the
    -- alternative is a table that grows for ever off a background timer.
    delete from public.page_versions
    where project_id = target_project_id
      and page_key = target_page_key
      and id not in (
        select id from public.page_versions
        where project_id = target_project_id
          and page_key = target_page_key
        order by created_at desc
        limit 20
      );
  end if;

  update public.project_pages
  set layout_json = new_layout, updated_at = now()
  where project_id = target_project_id
    and page_key = target_page_key;
end;
$$;

revoke execute on function public.save_project_page(text, jsonb) from public;
revoke execute on function public.save_project_page(text, jsonb) from anon;
grant execute on function public.save_project_page(text, jsonb) to authenticated;

/** The history of one page, newest first. Returns metadata only -- the layouts
 *  themselves are large, and the list is rendered as timestamps. */
create or replace function public.list_page_versions(target_page_key text)
returns table (id uuid, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select v.id, v.created_at
  from public.page_versions v
  join public.projects p on p.id = v.project_id
  where p.account_id = auth.uid()
    and v.page_key = target_page_key
  order by v.created_at desc
  limit 20;
$$;

revoke execute on function public.list_page_versions(text) from anon;
grant execute on function public.list_page_versions(text) to authenticated;

/**
 * Puts an older version back, and returns it so the editor can show it
 * immediately.
 *
 * Snapshots the CURRENT layout first, so restoring is itself undoable -- a
 * customer who restores the wrong version must not be worse off than one who
 * never opened the list. The three-minute throttle is deliberately NOT applied
 * to this snapshot: a restore is a deliberate, destructive act on the live page,
 * and it is exactly the moment a safety copy is worth having.
 */
create or replace function public.restore_page_version(version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  is_paid boolean;
  v_page_key text;
  v_layout jsonb;
  current_layout jsonb;
begin
  select id, paid into target_project_id, is_paid
  from public.projects
  where account_id = auth.uid();

  if target_project_id is null then
    raise exception 'project not found';
  end if;

  if not is_paid then
    raise exception 'payment required';
  end if;

  -- Scoped to the caller's own project, so a guessed uuid reads as "not found"
  -- rather than reaching into someone else's history.
  select page_key, layout_json into v_page_key, v_layout
  from public.page_versions
  where id = version_id
    and project_id = target_project_id;

  if v_page_key is null then
    raise exception 'version not found';
  end if;

  select layout_json into current_layout
  from public.project_pages
  where project_id = target_project_id
    and page_key = v_page_key;

  if current_layout is not null and current_layout <> '{}'::jsonb then
    insert into public.page_versions (project_id, page_key, layout_json)
    values (target_project_id, v_page_key, current_layout);
  end if;

  update public.project_pages
  set layout_json = v_layout, updated_at = now()
  where project_id = target_project_id
    and page_key = v_page_key;

  return v_layout;
end;
$$;

revoke execute on function public.restore_page_version(uuid) from anon;
grant execute on function public.restore_page_version(uuid) to authenticated;
