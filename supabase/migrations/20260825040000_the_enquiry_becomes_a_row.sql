-- 官网表格 → 系统出单. The arrow, actually connected.
--
-- WHY THIS IS THE MOST IMPORTANT TABLE IN THE PRODUCT.
--
-- The founder, asked what 「你的询价会自动变成你的单」 means: 「我还是不明白什么
-- 意思」 -- which is the correct reaction, and the same one he had months ago at
-- 「官网表格 → 系统出单」: 「这个我一直不懂是什么来的」. Nothing on either side of
-- that arrow shows it. A form on a website looks like a form; a row in a table
-- looks like a row.
--
-- And until today the arrow was not there at all. design-system/components/
-- enquiry-form.tsx says so in its own header -- WHY IT IS INERT HERE. Nothing
-- submits -- so the line under the button, 「填完送出 → 你的系统会开一张『报价单』，
-- 不用有人转抄」, was a sentence rather than a behaviour. There was no table for
-- a customer's enquiries to land in, only `leads`, which is Formae's own
-- pipeline and belongs to us, not to them.
--
-- This is also the only thing in this product Wix and Durable cannot copy. They
-- can build a prettier page faster; what they cannot do is put the enquiry into
-- an operating system on the other side, because they do not have one. That is
-- the whole argument for not selling landing pages as a separate business.
--
-- ── WHAT IS AND IS NOT STORED ────────────────────────────────────────────
--
-- The enquiry is stored as the visitor typed it: a name, a way to reach them,
-- and their answers to whatever THIS trade asks (the analysis decides those --
-- see migration 20260825020000). `answers` is jsonb because a workshop asks for
-- a car and a clinic asks for a time, and a fixed column set would be the same
-- mistake the four-column RecordTable already made.
--
-- No IP address and no user agent. They would be the obvious anti-spam
-- material, and they are personal data under PDPA 2010 collected from a member
-- of the public who came to ask a small business a question. The rate limit
-- below is per PROJECT and per minute, which stops a flood without keeping a
-- log of who visited a contractor's website.
--
-- ── WHY A SECURITY-DEFINER FUNCTION AND NOT AN INSERT POLICY ─────────────
--
-- The submitter is `anon`: a stranger on a phone with no account. An insert
-- policy permissive enough for them is a policy that lets anyone write any row
-- into any project. The function takes a SLUG -- the published address, the one
-- thing a stranger legitimately knows -- resolves the project itself, refuses
-- unpublished sites, applies the rate limit, and never exposes a project id.
-- Nothing a caller sends can reach a project other than the one whose site they
-- are standing on.

create table if not exists public.site_enquiries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  -- Which of THIS business's pages it becomes a row in, resolved at submit
  -- time from the analysis. Stored rather than derived so a customer who later
  -- renames or removes that page still sees where each enquiry was headed.
  lands_in text not null default 'customers',
  name text not null,
  contact text not null,
  answers jsonb not null default '{}'::jsonb,
  -- 'new' until the owner opens it. Deliberately three states and not a
  -- workflow: this table is an inbox, and the moment it tries to be a pipeline
  -- it is competing with the customer's own 报价单 page.
  status text not null default 'new' check (status in ('new', 'read', 'done')),
  created_at timestamptz not null default now()
);

create index if not exists site_enquiries_project_idx
  on public.site_enquiries (project_id, created_at desc);

alter table public.site_enquiries enable row level security;

-- The owner reads and updates their own; nobody inserts through the API.
drop policy if exists site_enquiries_owner_select on public.site_enquiries;
create policy site_enquiries_owner_select on public.site_enquiries
  for select using (
    project_id in (select id from public.projects where account_id = auth.uid())
  );

drop policy if exists site_enquiries_owner_update on public.site_enquiries;
create policy site_enquiries_owner_update on public.site_enquiries
  for update using (
    project_id in (select id from public.projects where account_id = auth.uid())
  );

-- ---------------------------------------------------------------------------
-- The write, from a stranger
-- ---------------------------------------------------------------------------
create or replace function public.submit_site_enquiry(
  site_slug text,
  visitor_name text,
  visitor_contact text,
  visitor_answers jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  recent int;
begin
  if coalesce(trim(visitor_name), '') = '' or coalesce(trim(visitor_contact), '') = '' then
    return 'incomplete';
  end if;

  -- Length caps here rather than in the API, because this function is the
  -- only door and a cap that lives on one side of a door is not a cap.
  if length(visitor_name) > 120 or length(visitor_contact) > 120
     or length(visitor_answers::text) > 4000 then
    return 'too_long';
  end if;

  select p.id into target
  from public.projects p
  where p.site_slug = site_slug
    and p.site_published = true;

  if target is null then
    -- Deliberately the same answer as a slug that does not exist. Telling a
    -- caller "this site exists but is not published" is telling them something
    -- about somebody else's business.
    return 'not_found';
  end if;

  select count(*) into recent
  from public.site_enquiries e
  where e.project_id = target
    and e.created_at > now() - interval '1 minute';

  -- Per project, per minute. A real small business does not receive six
  -- enquiries in a minute, and a script does.
  if recent >= 5 then
    return 'too_many';
  end if;

  insert into public.site_enquiries (project_id, lands_in, name, contact, answers)
  values (
    target,
    coalesce(
      (select a.enquiry ->> 'lands_in'
       from public.accounts ac
       join public.analysis_results a on a.lead_id = ac.lead_id
       where ac.id = (select account_id from public.projects where id = target)
       order by a.generated_at desc
       limit 1),
      'customers'
    ),
    trim(visitor_name),
    trim(visitor_contact),
    coalesce(visitor_answers, '{}'::jsonb)
  );

  return 'ok';
end;
$$;

revoke execute on function public.submit_site_enquiry(text, text, text, jsonb) from public;
grant execute on function public.submit_site_enquiry(text, text, text, jsonb) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The read, for the owner
-- ---------------------------------------------------------------------------
create or replace function public.my_site_enquiries()
returns setof public.site_enquiries
language sql
security definer
set search_path = public
as $$
  select e.*
  from public.site_enquiries e
  join public.projects p on p.id = e.project_id
  where p.account_id = auth.uid()
  order by e.created_at desc
  limit 200;
$$;

revoke execute on function public.my_site_enquiries() from anon;
grant execute on function public.my_site_enquiries() to authenticated;
