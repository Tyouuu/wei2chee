-- 客人放飞机 · 订金 —— **规矩先做好，数字等他问回来再填**。
--
-- ── 他 2026-09-09 讲的那一句 ──────────────────────────────────────────────
--
--     `先写general 我问了资料就可以直接写进去了 不然怎么叫模版`
--
-- 我原本讲「上门要先问他们怎么做，我不该照想像做」。**那句话对了一半**：
-- 不该发明的是**数字**（放几次算多、订金收多少），不是**那件事本身**。
-- 一个连「谁没来过」都数不出来的系统，他问回来也没有地方填。
--
-- ── 🔴 分清楚哪一样是他的，哪一样是我们的 ────────────────────────────────
--
-- | 我们做（模版） | 他填（问回来才知道） |
-- |---|---|
-- | 数得出每个客人没来过几次 | —— |
-- | 一单挂得住一个订金 | 订金收多少 |
-- | 「要不要收」这条规矩跑得起来 | **放几次之后才要收** |
--
-- 🔴 **他没填，系统就不讲。** `no_show_deposit_after` 是 null 的时候，
-- `deposit_advice.advise` **永远是 false** —— 不是拿一个我发明的次数顶着。
-- [重点 33](../docs/founder-points.md)：不知道的东西不要编。一个写死的「三次」
-- 对一间高档沙龙是宽的，对一间街边店是苛的，而**两边都会觉得这系统不懂他**。
--
-- ── 🔴 分母要一起给 ───────────────────────────────────────────────────────
--
-- 「她放过两次飞机」单独讲是一句会害人的话：一个**来过四十次**错过两次的老客，
-- 跟一个**来过两次**错过两次的人，不是同一件事，而柜台照着前者收订金
-- 就是在赶走她最好的客人。所以 `no_shows_of` 一定连**来过几次**一起给。
--
-- ── 🔴 钱那一半，看不到的人拿 null，不是 0 ────────────────────────────────
--
-- `party_deposit`（她手上还有多少）是 `sees_money`，而它对一个美发师
-- **回 0，不是报错**。照抄下去，柜台看到的是「她一分钱都没付」——
-- 而那正是 `debts.ts` 档头写过的那个坑（对着师傅讲「没有人欠你钱」）。
-- 所以这里**看不到钱的人那两栏是 null**，画面那一边分得出来。
--
-- ⚠️ **不做百分比订金**（「收三成」）：订金是在她还没决定做哪几样的时候收的，
-- 那一刻没有一个可靠的总额可以乘。等真的有一间店这样收再说
-- （[任务 41](../docs/founder-tasks.md#41)：一次＝个案，两次＝形状）。
--
-- ⚠️ **不自动扣、不自动罚**。这一支一分钱都不会动 —— 它只讲一句话，
-- 收不收是他按的。一个自动扣客人订金的系统，是他上门第一天最怕的东西
-- （[重点 32](../docs/founder-points.md)：坐到他椅子上再讲一次）。

-- ── 一单要收多少订金 ──────────────────────────────────────────────────────

alter table public.appointments
  add column if not exists deposit_cents bigint;

do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'appointments_deposit_not_negative'
  ) then
    alter table public.appointments
      add constraint appointments_deposit_not_negative
      check (deposit_cents is null or deposit_cents >= 0);
  end if;
end
$do$;

comment on column public.appointments.deposit_cents is
  'What was asked for on this booking before it is held. NULL means no deposit was asked -- which is not the same as one asked and unpaid. Whether it arrived is answered by the ledger, not by a second number here. See 20260909320000.';

create or replace function public.set_appointment_deposit(
  in_id uuid,
  /* 不给（null）＝ 这一单不用订金。**跟 0 是两件事**：0 是「讲好了不收」。 */
  in_amount_cents bigint default null
)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.appointments;
begin
  if in_amount_cents is not null and in_amount_cents < 0 then
    raise exception 'a deposit cannot be less than nothing';
  end if;

  /* 🔴 `works_here`，不是 `sees_money` —— **叫客人先付订金的是柜台**，
     而柜台在一间沙龙里就是那个美发师自己。挡得比这更严，
     等於做出一条这门生意没有的规矩（20260909200000 立过这一条）。 */
  update public.appointments a
     set deposit_cents = in_amount_cents, updated_at = now()
   where a.id = in_id
     and public.works_here(a.project_id)
  returning * into row;
  if row.id is null then
    raise exception 'no such booking in your business';
  end if;
  return row;
end;
$$;

revoke execute on function public.set_appointment_deposit(uuid, bigint) from public, anon;
grant execute on function public.set_appointment_deposit(uuid, bigint) to authenticated;

-- ── 这门生意自己那两个数字 ────────────────────────────────────────────────

create table if not exists public.booking_rules (
  project_id uuid primary key references public.projects(id) on delete cascade,

  /* 🔴 放几次飞机之后才要订金。**null = 他还没讲**，而那时候系统一句话都不讲。
     不是 3，不是任何一个我挑的数字 —— 见档头。 */
  no_show_deposit_after integer,

  /* 订金收多少。null = 他还没讲。 */
  default_deposit_cents bigint,

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null,

  constraint booking_rules_after_sane
    check (no_show_deposit_after is null or no_show_deposit_after between 1 and 20),
  constraint booking_rules_deposit_sane
    check (default_deposit_cents is null or default_deposit_cents >= 0)
);

alter table public.booking_rules enable row level security;

drop policy if exists "booking_rules_members" on public.booking_rules;
create policy "booking_rules_members" on public.booking_rules
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

comment on table public.booking_rules is
  'The two numbers a shop gives us after we ask: how many no-shows before a deposit is asked for, and how much. Both NULL until they say, and while they are NULL the system advises nothing rather than inventing a threshold. See 20260909320000.';

create or replace function public.set_booking_rules(
  in_project_id uuid,
  in_no_show_deposit_after integer default null,
  in_default_deposit_cents bigint default null
)
returns public.booking_rules
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.booking_rules;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;
  /* 🔴 **定规矩是老板的事**（跟 `set_commission_tiers` · `set_class_fee` 同一条），
     而**照规矩收**是柜台的事（`set_appointment_deposit` 是 `works_here`）。 */
  if not public.sees_money(in_project_id) then
    raise exception 'the deposit rule is for the owner';
  end if;

  insert into public.booking_rules
    (project_id, no_show_deposit_after, default_deposit_cents, updated_by)
  values (in_project_id, in_no_show_deposit_after, in_default_deposit_cents, auth.uid())
  on conflict (project_id) do update
    set no_show_deposit_after = excluded.no_show_deposit_after,
        default_deposit_cents = excluded.default_deposit_cents,
        updated_at = now(),
        updated_by = auth.uid()
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.set_booking_rules(uuid, integer, bigint) from public, anon;
grant execute on function public.set_booking_rules(uuid, integer, bigint) to authenticated;

-- ── 谁没来过，来过几次 ────────────────────────────────────────────────────

create or replace function public.no_shows_of(
  in_project_id uuid,
  in_limit integer default 50
)
returns table (
  party_id uuid,
  party text,
  missed integer,
  came integer,
  last_missed_on date
)
language sql
stable
security definer
set search_path = public
as $$
  /* 🔴 `works_here` —— 柜台要知道明天来的那一个靠不靠得住，
     而这一支从头到尾一个金额都没有。 */
  select
    d.id,
    d.name,
    count(*) filter (where a.status = 'no_show')::integer,
    count(*) filter (where a.status = 'done')::integer,
    max(a.starts_at at time zone 'Asia/Kuala_Lumpur')
      filter (where a.status = 'no_show')::date
  from public.appointments a
  join public.directory_entries d on d.id = a.party_id
  where a.project_id = in_project_id
    and a.kind = 'booking'
    and a.archived_at is null
    and public.works_here(in_project_id)
  group by d.id, d.name
  having count(*) filter (where a.status = 'no_show') > 0
  order by count(*) filter (where a.status = 'no_show') desc, d.name
  limit greatest(1, least(coalesce(in_limit, 50), 500));
$$;

revoke execute on function public.no_shows_of(uuid, integer) from public, anon;
grant execute on function public.no_shows_of(uuid, integer) to authenticated;

comment on function public.no_shows_of(uuid, integer) is
  'Who has not turned up, how often, AND how often they did -- the denominator ships with the numerator, because forty visits with two misses and two visits with two misses are not the same customer. See 20260909320000.';

-- ── 这一个客人，要不要先收订金 ────────────────────────────────────────────

create or replace function public.deposit_advice(
  in_project_id uuid,
  in_party_id uuid
)
returns table (
  missed integer,
  came integer,
  last_missed_on date,
  /* 他自己设的那个次数。null = 他还没讲，而那时候 `advise` 一定是 false。 */
  rule_after integer,
  advise boolean,
  /* 🔴 这两栏对看不到钱的人是 **null，不是 0** —— 见档头。 */
  suggest_cents bigint,
  on_hand_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rules public.booking_rules;
  n_missed integer := 0;
  n_came integer := 0;
  last_on date;
  money boolean;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;
  money := public.sees_money(in_project_id);

  select * into rules from public.booking_rules where project_id = in_project_id;

  select
    count(*) filter (where a.status = 'no_show')::integer,
    count(*) filter (where a.status = 'done')::integer,
    max(a.starts_at at time zone 'Asia/Kuala_Lumpur')
      filter (where a.status = 'no_show')::date
  into n_missed, n_came, last_on
  from public.appointments a
  where a.project_id = in_project_id
    and a.party_id = in_party_id
    and a.kind = 'booking'
    and a.archived_at is null;

  return query select
    coalesce(n_missed, 0),
    coalesce(n_came, 0),
    last_on,
    rules.no_show_deposit_after,
    /* 🔴 他没讲那个次数 → **不讲话**。见档头：不知道的东西不要编。 */
    (rules.no_show_deposit_after is not null
      and coalesce(n_missed, 0) >= rules.no_show_deposit_after),
    case when money then rules.default_deposit_cents end,
    case when money then public.party_deposit(in_project_id, in_party_id) end;
end;
$$;

revoke execute on function public.deposit_advice(uuid, uuid) from public, anon;
grant execute on function public.deposit_advice(uuid, uuid) to authenticated;

comment on function public.deposit_advice(uuid, uuid) is
  'Answers the one sentence a counter says out loud: is this customer reliable, and should we ask for a deposit. Advises nothing until the shop has given its own threshold. Money columns are NULL, never 0, for someone who cannot see money. See 20260909320000.';
