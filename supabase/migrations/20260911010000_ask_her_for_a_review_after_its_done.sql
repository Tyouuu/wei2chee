-- 完工请她给一句评价 —— 那个门牌今天只做得了一件事：取消。
--
-- ── 为什么（[任务 341] 沙龙其余那一组 · [重点 30] 第 4 步早就列过这一件）────
--
-- [重点 30] 那张「更方便人们」的表 2026-09-05 就写着：
-- 「完工请他给评价 · 老带新 —— 这四件本地一家都没有」。
-- `appointments.public_ref`（20260902030000）建表那天就在，九天后
-- 才被 20260910630000 接上第一件事（取消）。这一支接第二件：
-- 做完了的那一笔，同一个门牌可以留一句评价。
--
-- ── 只做「留一句」，不做「老带新」——两件不一样大小的事 ───────────────────
--
-- 老带新要一个推荐码、一条给推荐人的奖励规则，那是另一件要先问清楚
-- 「怎么算」的事（跟储值卡那次一样，[重点 26]：钱那一层不可以猜）。
-- 这一支只做评价本身：一个 1–5 的数字、一句话，留得下、看得到。
--
-- ── 加栏，不碰 status —— 跟 arrived_at 那次一样的做法（20260910570000）────
--
-- 评价是「做完之后」才可能发生的事实，不是第五个状态。四栏都从
-- null／false 开始，没有人留过评价的每一笔都不受影响。
--
-- ── 陌生人看得到什么——照 public_appointment 那一支的规矩，只加不改 ───────
--
-- 这支函式的返回栏位要多三个（can_review · review_rating · review_text），
-- Postgres 不准用 create or replace 改一个已经在跑的 returns table 栏位，
-- 所以先 drop 再重建（[重点 31] 第 2 条：签名变了先 drop 旧的）——
-- 而函式体本身，原来六行 select 一个字都没有变，只是多接三个栏位。
--
-- ── 回一个词，不抛例外——跟 cancel_shared_appointment 同一个契约 ─────────

alter table public.appointments
  add column if not exists review_rating smallint
    check (review_rating between 1 and 5),
  add column if not exists review_text text,
  add column if not exists review_submitted_at timestamptz,
  add column if not exists review_may_show boolean not null default false;

comment on column public.appointments.review_rating is
  'What she said after it was done, 1-5. Null means she has not been asked, or asked and has not answered yet. See 20260911010000.';

comment on column public.appointments.review_may_show is
  'Whether she agreed this can appear in public (e.g. on the site) -- defaults false, same policy as record_photos.may_show. See 20260911010000.';

drop function if exists public.public_appointment(uuid);

create or replace function public.public_appointment(in_ref uuid)
returns table (
  business_name text,
  style text,
  palette text,
  system_language text,
  party_name text,
  service text,
  starts_at timestamptz,
  ends_at timestamptz,
  status text,
  can_cancel boolean,
  can_review boolean,
  review_rating smallint,
  review_text text
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  appt public.appointments;
  proj public.projects;
begin
  if in_ref is null then
    return;
  end if;

  select * into appt from public.appointments a where a.public_ref = in_ref;
  if appt.id is null then
    return;
  end if;

  select * into proj from public.projects p where p.id = appt.project_id;
  if proj.id is null then
    return;
  end if;

  return query
  select
    coalesce(proj.business_name, ''),
    proj.style,
    proj.palette,
    proj.system_language,
    coalesce(appt.party, ''),
    coalesce(appt.service, ''),
    appt.starts_at,
    appt.ends_at,
    appt.status,
    appt.status = 'booked' and appt.archived_at is null,
    appt.status = 'done' and appt.archived_at is null and appt.review_submitted_at is null,
    appt.review_rating,
    appt.review_text;
end;
$fn$;

revoke execute on function public.public_appointment(uuid) from public;
grant execute on function public.public_appointment(uuid) to anon, authenticated;

comment on function public.public_appointment(uuid) is
  'One booking as the person holding the link sees it -- her own name, what, when, whether she can still cancel it, and whether she can (or already did) leave a review. Never an id, never her other bookings, never money. See 20260910630000, extended 20260911010000.';

-- ── 她留一句评价 ──────────────────────────────────────────────────────────

create or replace function public.submit_appointment_review(
  in_ref uuid,
  in_rating smallint,
  in_text text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  appt public.appointments;
begin
  if in_ref is null then
    return 'not_found';
  end if;

  select * into appt from public.appointments a where a.public_ref = in_ref;
  if appt.id is null then
    return 'not_found';
  end if;

  if appt.archived_at is not null then
    return 'not_found';
  end if;

  if appt.status <> 'done' then
    return 'not_yet';
  end if;

  if appt.review_submitted_at is not null then
    return 'already_submitted';
  end if;

  if in_rating is null or in_rating < 1 or in_rating > 5 then
    return 'invalid';
  end if;

  if length(coalesce(in_text, '')) > 2000 then
    return 'too_long';
  end if;

  update public.appointments
     set review_rating = in_rating,
         review_text = left(btrim(coalesce(in_text, '')), 2000),
         review_submitted_at = now()
   where id = appt.id;

  return 'ok';
end;
$fn$;

revoke execute on function public.submit_appointment_review(uuid, smallint, text) from public;
grant execute on function public.submit_appointment_review(uuid, smallint, text) to anon, authenticated;

comment on function public.submit_appointment_review(uuid, smallint, text) is
  'She leaves a rating (1-5) and an optional line of text after the job is done. Returns a word, never an exception -- same contract as cancel_shared_appointment. Reviewing before it is done, or twice, is refused with a plain word. See 20260911010000.';

-- ── 老板看得到的那一份清单 ────────────────────────────────────────────────

create or replace function public.reviews_of(in_project_id uuid)
returns table (
  id uuid,
  party text,
  service text,
  rating smallint,
  review_text text,
  submitted_at timestamptz,
  may_show boolean
)
language sql
stable
security definer
set search_path = public
as $fn$
  select a.id, a.party, a.service, a.review_rating, a.review_text,
         a.review_submitted_at, a.review_may_show
    from public.appointments a
   where a.project_id = in_project_id
     and a.archived_at is null
     and a.review_submitted_at is not null
     and public.works_here(in_project_id)
   order by a.review_submitted_at desc;
$fn$;

revoke execute on function public.reviews_of(uuid) from public, anon;
grant execute on function public.reviews_of(uuid) to authenticated;

comment on function public.reviews_of(uuid) is
  'Every review left so far, newest first. See 20260911010000.';

-- ── 她后来才问客人「这句可不可以放上去」—— 跟 set_photo_may_show 同一个动作 ──

create or replace function public.set_review_may_show(
  in_id uuid,
  in_may_show boolean
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.appointments;
begin
  select * into row from public.appointments
   where id = in_id and public.works_here(project_id);
  if row.id is null then
    raise exception 'no such appointment in your business';
  end if;
  if row.review_submitted_at is null then
    raise exception 'no review to show yet';
  end if;

  update public.appointments
     set review_may_show = coalesce(in_may_show, false)
   where id = in_id
  returning * into row;

  return row;
end;
$fn$;

revoke execute on function public.set_review_may_show(uuid, boolean) from public, anon;
grant execute on function public.set_review_may_show(uuid, boolean) to authenticated;

comment on function public.set_review_may_show(uuid, boolean) is
  'Whether a review can appear in public -- defaults false at submission time, same policy as set_photo_may_show. See 20260911010000.';
