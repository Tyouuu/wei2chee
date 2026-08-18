-- supabase/migrations/20260818120000_customer_portal_schema.sql

create table public.accounts (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  lead_id uuid references public.leads(id),
  created_at timestamptz not null default now()
);

-- One project per account in this version -- the `unique` constraint on
-- account_id is what makes "the caller's own project" a well-defined
-- lookup with no id ambiguity.
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  account_id uuid not null unique references public.accounts(id) on delete cascade,
  style text check (style in ('ledger', 'hearth', 'blueprint')),
  paid boolean not null default false,
  paid_marked_by text,
  paid_marked_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.project_pages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  page_key text not null check (page_key in ('dashboard', 'customers', 'quotations', 'projects', 'payments')),
  layout_json jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  unique (project_id, page_key)
);

alter table public.accounts enable row level security;
alter table public.projects enable row level security;
alter table public.project_pages enable row level security;

-- SELECT-only for end users. There are deliberately no insert/update/delete
-- policies here: account/project/page rows are created only by the trigger
-- below (runs as the function owner, bypasses RLS), style is set only via
-- set_project_style(), page content is saved only via save_project_page(),
-- and `paid` is flipped only by the founder in Supabase Studio (service
-- role, also bypasses RLS). A customer has no direct write path to any of
-- these tables at all -- every write is mediated by a function that can
-- enforce the one-time-style-choice and paid-gating rules that a bare RLS
-- policy can't express.
create policy "accounts_select_own" on public.accounts
  for select using (auth.uid() = id);

create policy "projects_select_own" on public.projects
  for select using (auth.uid() = account_id);

create policy "project_pages_select_own" on public.project_pages
  for select using (
    exists (
      select 1 from public.projects
      where projects.id = project_pages.project_id
        and projects.account_id = auth.uid()
    )
  );

-- Auto-provisioning: the moment someone finishes Supabase Auth sign-up,
-- give them an account row, a project row, and all five empty page rows,
-- atomically. `lead_id` comes from the signup call's user metadata (see
-- Task 2's signUp() call, which passes `options: { data: { lead_id } }`).
create or replace function public.handle_new_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_project_id uuid;
  each_page_key text;
begin
  insert into public.accounts (id, email, lead_id)
  values (
    new.id,
    new.email,
    nullif(new.raw_user_meta_data ->> 'lead_id', '')::uuid
  );

  insert into public.projects (account_id)
  values (new.id)
  returning id into new_project_id;

  foreach each_page_key in array array['dashboard', 'customers', 'quotations', 'projects', 'payments']
  loop
    insert into public.project_pages (project_id, page_key)
    values (new_project_id, each_page_key);
  end loop;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_account();

-- Write path 1: the one-time style choice. Fails (raises) if the project
-- doesn't exist for this caller, or if style was already set -- both
-- conditions collapse to the same "no row matched the update" case, which
-- Postgres exposes via `not found` after an UPDATE.
create or replace function public.set_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_style not in ('ledger', 'hearth', 'blueprint') then
    raise exception 'invalid style: %', new_style;
  end if;

  update public.projects
  set style = new_style, updated_at = now()
  where account_id = auth.uid()
    and style is null;

  if not found then
    raise exception 'style already set or project not found';
  end if;
end;
$$;

revoke execute on function public.set_project_style(text) from public;
grant execute on function public.set_project_style(text) to authenticated;

-- Write path 2: saving a page's layout. This is where the paid gate is
-- actually enforced -- not in the app layer, here, so there is exactly one
-- place in the whole system that can let an unpaid save through, and it's
-- this three-line check.
create or replace function public.save_project_page(target_page_key text, new_layout jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  is_paid boolean;
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

  update public.project_pages
  set layout_json = new_layout, updated_at = now()
  where project_id = target_project_id
    and page_key = target_page_key;

  if not found then
    raise exception 'page not found: %', target_page_key;
  end if;
end;
$$;

revoke execute on function public.save_project_page(text, jsonb) from public;
grant execute on function public.save_project_page(text, jsonb) to authenticated;
