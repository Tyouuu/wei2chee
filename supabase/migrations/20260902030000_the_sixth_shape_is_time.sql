-- supabase/migrations/20260902030000_the_sixth_shape_is_time.sql
--
-- 预约 stops being a drawing. It is the last of the ten shapes, the biggest,
-- and the only one whose primary axis is time rather than a row.
--
-- ---------------------------------------------------------------------------
-- What was read first
-- ---------------------------------------------------------------------------
-- `alextselegidis/easyappointments` (GPL, so its DESIGN and not a line of its
-- code), which is the most widely deployed open-source appointment system, and
-- ERPNext's own Appointment doctype. Three things taken from them:
--
--   * TWO TIMESTAMPS, not a start and a duration. easyappointments carries
--     `start_datetime` and `end_datetime`; a duration would have to be added to
--     a start every time anything asks 「does this clash」, and the question is
--     asked on every write.
--
--   * TIME OFF LIVES IN THE SAME TABLE. Their `is_unavailability` flag is the
--     cleverest thing in that schema: lunch, leave, a stylist away at a wedding
--     are all rows here, so 「is this slot free」 has ONE place to look. A second
--     table would mean two queries that can disagree.
--
--   * A LINK THAT NEEDS NO LOGIN. Their `hash`. A stranger books from the
--     business's own website and later wants to move it; making them sign up
--     for an account to cancel a haircut is how a booking becomes a no-show.
--
-- ERPNext adds one: `created_through_portal`. Where a booking came from is
-- worth keeping -- a salon reading its week wants to know which of these it
-- took by hand and which arrived while it was closed.
--
-- NOT TAKEN: their availability engine (working plans, breaks, holiday lists,
-- Google and CalDAV sync, captcha, verification emails). That is a product on
-- its own, and every one of those is a setting somebody has to fill in before
-- the first booking can exist. 「一进来就很方便」 is the whole promise; a page
-- that opens on a working-hours form has already broken it.
--
-- ---------------------------------------------------------------------------
-- The rule that is not written in application code
-- ---------------------------------------------------------------------------
-- Two customers must not get the same stylist at the same time, and that is
-- enforced by an EXCLUSION CONSTRAINT rather than by a check-then-insert.
--
-- easyappointments checks for clashes in PHP. Between its SELECT and its INSERT
-- another request can do the same thing -- and a booking page is exactly where
-- two people press at once, because they are both looking at the same three
-- free slots on a Saturday morning. The database can refuse the second one
-- without anybody writing a lock, and that is what this does.
--
-- ⚠️ WHAT COMPETES FOR A SLOT WHEN NOBODY IS NAMED. The resource is the staff
-- member -- but a one-person salon books nothing to anybody, so `staff_id` is
-- null and a per-staff rule would protect the businesses that need it least.
-- The expression is `coalesce(staff_id, project_id)`: name a stylist and you
-- compete with that stylist; name nobody and you compete with the shop. A
-- three-chair salon that has not yet said who is doing what will be refused a
-- second 10am, and the answer to that is to say who -- which is the same
-- sentence the owner would have to say out loud anyway.
create extension if not exists btree_gist;

create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 预约 today. A clinic running two diaries costs nothing. */
  module_key text not null,

  /* A bare uuid and no foreign key, as the other five shapes do -- 地基决定 2
     put the post in without building the feature. */
  branch_id uuid,

  /* BOOKING or BLOCK, in one table, which is easyappointments' best idea. A
     block is lunch, leave, a wedding: it holds time without being anybody's
     appointment, and putting it here means 「is this free」 never has to ask
     two questions and reconcile the answers. */
  kind text not null default 'booking' check (kind in ('booking', 'block')),

  /* TWO INSTANTS. timestamptz, so an appointment is a moment rather than a
     wall-clock string that means different things to the server and to him --
     the same eight hours today_myt() exists over, except that here it is not a
     rounding question, it is who turns up when. */
  starts_at timestamptz not null,
  ends_at timestamptz not null,

  /* WHO IT IS FOR. The typed words and the link, exactly as pipeline_records
     and ledger_entries carry them (任务 81): the text is what was written that
     day and never changes; the id is who they are now. A block has neither. */
  party text not null default '',
  party_id uuid references public.directory_entries(id) on delete restrict,

  /* WHO IS DOING IT. A row on his own 师傅 page -- the staff directory is
     already a directory, and inventing a second table of people would mean two
     lists of the same faces. */
  staff_id uuid references public.directory_entries(id) on delete restrict,

  /* WHAT IT IS. His own word -- 剪 + 染, 洗牙, 上门看现场 -- never an enum, the
     same call as `stage` and `unit`. */
  service text not null default '',

  /* ⚠️ THIS ONE IS CONSTRAINED AND `stage` IS NOT, and the difference is not an
     oversight. A pipeline's stages are the business's own words because every
     trade sells differently. 「Did they turn up」 has the same four answers in
     every trade on earth, and the exclusion constraint below has to know which
     of them still holds the slot -- a free-text status would mean a cancelled
     booking blocking a chair forever because somebody typed 「cancel」. */
  status text not null default 'booked'
    check (status in ('booked', 'done', 'no_show', 'cancelled')),

  /* WHERE IT CAME FROM. ERPNext's created_through_portal, widened: a salon
     reading its week wants to know which of these it took by hand and which
     arrived from its own website while the shop was shut. */
  source text not null default 'staff' check (source in ('staff', 'website')),

  /* THE LINK THAT NEEDS NO LOGIN. easyappointments' hash. Nothing serves it
     yet -- 官网 booking is the next piece -- but it is issued from the first
     row, because handing them out later means the bookings taken before that
     day are the only ones a customer cannot move. */
  public_ref uuid not null default gen_random_uuid(),

  /* WHEN IT WAS MADE, which is not when it is. A booking taken three weeks
     ahead and one taken this morning are different facts about a business. */
  booked_at timestamptz not null default now(),

  note text not null default '',
  extra jsonb not null default '{}'::jsonb,

  /* Never deleted, like the other five. Last year's cancellations are the
     answer to 「this customer never turns up」. */
  archived_at timestamptz,

  recorded_by uuid references auth.users(id) on delete set null,
  idempotency_key uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* An appointment that ends before it starts is not a short appointment. */
  constraint appointments_ends_after_start check (ends_at > starts_at)
);

comment on table public.appointments is
  'Bookings AND the time that is not bookable, in one table -- see the header of 20260902030000 for why that is easyappointments'' best idea and why the no-clash rule is a constraint rather than application code.';
comment on column public.appointments.status is
  'Constrained where `stage` is free text on purpose: the exclusion constraint has to know which statuses still hold the slot, and a cancelled booking blocking a chair because somebody typed 「cancel」 is not a bug anybody would find.';
comment on column public.appointments.public_ref is
  'The link a customer uses to move or cancel without an account. Issued from the first row so that no booking is ever the one that cannot be changed.';

create index if not exists appointments_day_idx
  on public.appointments (project_id, module_key, starts_at)
  where archived_at is null;

create index if not exists appointments_staff_idx
  on public.appointments (staff_id, starts_at)
  where archived_at is null;

create unique index if not exists appointments_public_ref_idx
  on public.appointments (public_ref);

/* A double tap on a phone is one booking. Partial, because most writes pass no
   key -- the same shape the other five carry. */
create unique index if not exists appointments_idempotency_idx
  on public.appointments (project_id, idempotency_key)
  where idempotency_key is not null;

/* ── THE SLOT CANNOT BE TAKEN TWICE ────────────────────────────────────────
   `&&` is range overlap and `=` is equality, which is why btree_gist is needed:
   a gist index does not otherwise know how to compare a uuid.

   A cancelled booking releases its slot; everything else holds it, blocks
   included -- which is the whole reason a block lives in this table. */
alter table public.appointments
  drop constraint if exists appointments_no_double_booking;
alter table public.appointments
  add constraint appointments_no_double_booking
  exclude using gist (
    (coalesce(staff_id, project_id)) with =,
    tstzrange(starts_at, ends_at) with &&
  )
  where (archived_at is null and status <> 'cancelled');

alter table public.appointments enable row level security;

create policy "appointments_members" on public.appointments
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

-- ── WHICH PAGES ARE THIS SHAPE ────────────────────────────────────────────

create or replace function public.is_calendar_module(key text)
returns boolean
language sql
immutable
as $$
  select key in ('bookings');
$$;

comment on function public.is_calendar_module(text) is
  'Kept beside the other five membership functions, and kept in step with lib/portal/module-catalog.ts by module-catalog.test.ts.';

-- ── MAKING ONE ────────────────────────────────────────────────────────────

create or replace function public.add_appointment(
  in_project_id uuid,
  in_module_key text,
  in_starts_at timestamptz,
  in_ends_at timestamptz,
  in_party text default '',
  in_party_id uuid default null,
  in_staff_id uuid default null,
  in_service text default '',
  in_kind text default 'booking',
  in_source text default 'staff',
  in_note text default '',
  in_branch_id uuid default null,
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;

  if not public.is_calendar_module(in_module_key) then
    raise exception 'not a calendar module: %', in_module_key;
  end if;

  if in_starts_at is null or in_ends_at is null then
    raise exception 'an appointment needs a time';
  end if;

  if in_ends_at <= in_starts_at then
    raise exception 'it has to end after it starts';
  end if;

  /* A BOOKING IS FOR SOMEBODY; A BLOCK IS NOT. Lunch has no customer, and
     demanding one would make the owner type a name to close his own shop. */
  if coalesce(in_kind, 'booking') = 'booking'
     and btrim(coalesce(in_party, '')) = ''
     and in_party_id is null then
    raise exception 'a booking needs to say who it is for';
  end if;

  insert into public.appointments (
    project_id, module_key, branch_id, kind, starts_at, ends_at,
    party, party_id, staff_id, service, source, note, extra,
    recorded_by, idempotency_key
  ) values (
    in_project_id, in_module_key, in_branch_id,
    coalesce(nullif(btrim(coalesce(in_kind, '')), ''), 'booking'),
    in_starts_at, in_ends_at,
    left(btrim(coalesce(in_party, '')), 120), in_party_id, in_staff_id,
    left(btrim(coalesce(in_service, '')), 120),
    coalesce(nullif(btrim(coalesce(in_source, '')), ''), 'staff'),
    btrim(coalesce(in_note, '')),
    coalesce(in_extra, '{}'::jsonb),
    auth.uid(), in_idempotency_key
  )
  returning id into new_id;

  return new_id;

exception
  /* Pressing twice on a slow phone gives back the booking that exists. The
     tail 20260831080000 dropped and 20260831090000 had to put back. */
  when unique_violation then
    select id into new_id
    from public.appointments
    where project_id = in_project_id
      and in_idempotency_key is not null
      and idempotency_key = in_idempotency_key
    limit 1;
    return new_id;

  /* 🔴 THE ONE THIS TABLE EXISTS FOR, and it must not reach a person as
     「conflicting key value violates exclusion constraint」. That sentence
     teaches a salon owner nothing he can act on. */
  when exclusion_violation then
    raise exception 'that time is already taken'
      using errcode = 'check_violation';
end;
$$;

revoke execute on function public.add_appointment(
  uuid, text, timestamptz, timestamptz, text, uuid, uuid, text, text, text, text, uuid, jsonb, uuid
) from public;
grant execute on function public.add_appointment(
  uuid, text, timestamptz, timestamptz, text, uuid, uuid, text, text, text, text, uuid, jsonb, uuid
) to authenticated;

-- ── MOVING ONE ────────────────────────────────────────────────────────────

create or replace function public.update_appointment(
  in_id uuid,
  in_starts_at timestamptz,
  in_ends_at timestamptz,
  in_party text default '',
  in_party_id uuid default null,
  in_staff_id uuid default null,
  in_service text default '',
  in_note text default '',
  in_extra jsonb default '{}'::jsonb,
  in_clear_party boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proj uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select project_id into proj from public.appointments where id = in_id;
  if proj is null or not public.works_here(proj) then
    raise exception 'not your appointment';
  end if;

  if in_ends_at <= in_starts_at then
    raise exception 'it has to end after it starts';
  end if;

  update public.appointments
  set starts_at = in_starts_at,
      ends_at = in_ends_at,
      party = left(btrim(coalesce(in_party, '')), 120),
      party_id = case when in_clear_party then null else in_party_id end,
      staff_id = in_staff_id,
      service = left(btrim(coalesce(in_service, '')), 120),
      note = btrim(coalesce(in_note, '')),
      extra = coalesce(in_extra, '{}'::jsonb),
      updated_at = now()
  where id = in_id;

exception
  when exclusion_violation then
    raise exception 'that time is already taken'
      using errcode = 'check_violation';
end;
$$;

revoke execute on function public.update_appointment(
  uuid, timestamptz, timestamptz, text, uuid, uuid, text, text, jsonb, boolean
) from public;
grant execute on function public.update_appointment(
  uuid, timestamptz, timestamptz, text, uuid, uuid, text, text, jsonb, boolean
) to authenticated;

-- ── DID THEY TURN UP ──────────────────────────────────────────────────────
--
-- ⚠️ NO MONEY HERE YET, AND THAT IS A DECISION SOMEBODY ELSE HAS TO MAKE. 任务
-- 44 lists 「no-show 怎么处理」 as one of four things to settle with the salon
-- before signing, and the other three now have answers. Whether a no-show costs
-- the customer a session off their package or a forfeited deposit is a
-- commercial rule, not a technical one -- so this records what happened and
-- touches nothing else. When the answer arrives it is a call into the ledger
-- from here, not a change to this table.
create or replace function public.set_appointment_status(
  in_id uuid,
  in_status text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proj uuid;
begin
  select project_id into proj from public.appointments where id = in_id;
  if proj is null or not public.works_here(proj) then
    raise exception 'not your appointment';
  end if;

  if in_status not in ('booked', 'done', 'no_show', 'cancelled') then
    raise exception 'not a status an appointment can be in: %', in_status;
  end if;

  update public.appointments
  set status = in_status, updated_at = now()
  where id = in_id;

exception
  /* Re-booking a cancelled slot somebody else has taken since. Reachable
     because a cancelled row does not hold its time. */
  when exclusion_violation then
    raise exception 'that time is already taken'
      using errcode = 'check_violation';
end;
$$;

revoke execute on function public.set_appointment_status(uuid, text) from public;
grant execute on function public.set_appointment_status(uuid, text) to authenticated;

create or replace function public.set_appointment_archived(
  in_id uuid,
  in_archived boolean default true
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proj uuid;
begin
  select project_id into proj from public.appointments where id = in_id;
  if proj is null or not public.works_here(proj) then
    raise exception 'not your appointment';
  end if;

  update public.appointments
  set archived_at = case when in_archived then now() else null end,
      updated_at = now()
  where id = in_id;

exception
  when exclusion_violation then
    raise exception 'that time is already taken'
      using errcode = 'check_violation';
end;
$$;

revoke execute on function public.set_appointment_archived(uuid, boolean) from public;
grant execute on function public.set_appointment_archived(uuid, boolean) to authenticated;
