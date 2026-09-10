-- 集点——沙龙其余那一组下一件，跟一张贴在墙上的盖章卡同一张纸。
--
-- ── 为什么（[任务 341] 沙龙其余那一组）───────────────────────────────────
--
-- 一张实体的集点卡：来一次盖一个章，盖满换一次免费。今天这个系统数得出
-- 「她来过几次」（`party_visits`，20260907010000），却没有地方放「集满
-- 几个章换一次」这条规矩，也没有地方记「她刚刚换过一次，重新算」。
--
-- ── 规矩先立好，数字等他问回来——跟 `booking_rules` 同一条纪律 ───────────
--
-- 集满几个换一次是他的生意决定，不是我们猜的。`loyalty_rules.stamps_needed`
-- 从 null 开始，没填之前系统一句话都不讲（跟订金门槛那次一模一样，
-- 见 20260909320000 档头：一个我们发明的数字对高档店太松，对街边店太严）。
--
-- ── 换过一次，卡要能重新开始——一张真的卡换了会收走，不是继续盖章 ──────
--
-- `directory_entries.loyalty_redeemed_at`：她上一次换奖那一刻。集点数
-- 只算这个时间点**之后**的来访，不是全部生涯的次数——不然换过一次奖之后
-- 数字还是会一直往上涨，永远达标，永远说她可以再换一次。
--
-- ── 「一次来访」跟 party_visits 完全同一个定义，独立算一次窗口内的 ────────
--
-- 不去改 `party_visits`（[重点 31] 第 1 条：不准整支重写），
-- 也不去扩充它的签名多塞一个「从哪天算起」的参数——它今天服务的是
-- 「他多久没来」那类问题，形状不一样。这里照抄它 `hits` 那段 CTE 的
-- 同一个「一次来访」定义（pipeline_records 有 `issued_on` 的 · 没取消
-- 没缺席且已经发生的预约），只是多一个下限时间。

create table if not exists public.loyalty_rules (
  project_id uuid primary key references public.projects(id) on delete cascade,

  /* 集满几次换一次。null = 他还没讲，那时候这一支一句话都不说。 */
  stamps_needed integer check (stamps_needed is null or stamps_needed between 1 and 50),

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.loyalty_rules enable row level security;

drop policy if exists "loyalty_rules_owner_only" on public.loyalty_rules;
create policy "loyalty_rules_owner_only" on public.loyalty_rules
  for all to authenticated
  using (public.sees_money(project_id))
  with check (public.sees_money(project_id));

comment on table public.loyalty_rules is
  'How many visits earn a reward -- the owners own decision, starts unset. See 20260911270000.';

alter table public.directory_entries
  add column if not exists loyalty_redeemed_at timestamptz;

comment on column public.directory_entries.loyalty_redeemed_at is
  'When she last claimed a loyalty reward. Stamps only count visits after this moment -- a redeemed card starts over, it does not keep climbing. See 20260911270000.';

-- ── 老板定规矩 ────────────────────────────────────────────────────────────

create or replace function public.set_loyalty_rule(
  in_project_id uuid,
  in_stamps_needed integer
)
returns public.loyalty_rules
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.loyalty_rules;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'the loyalty rule is for the owner';
  end if;

  insert into public.loyalty_rules (project_id, stamps_needed, updated_by)
  values (in_project_id, in_stamps_needed, auth.uid())
  on conflict (project_id) do update
    set stamps_needed = excluded.stamps_needed,
        updated_at = now(),
        updated_by = auth.uid()
  returning * into row;

  return row;
end;
$fn$;

revoke execute on function public.set_loyalty_rule(uuid, integer) from public, anon;
grant execute on function public.set_loyalty_rule(uuid, integer) to authenticated;

-- ── 柜台换奖 ──────────────────────────────────────────────────────────────

create or replace function public.mark_loyalty_redeemed(in_party_id uuid)
returns public.directory_entries
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.directory_entries;
begin
  select * into row from public.directory_entries
   where id = in_party_id and public.works_here(project_id);
  if row.id is null then
    raise exception 'no such customer in your business';
  end if;

  update public.directory_entries
     set loyalty_redeemed_at = now()
   where id = in_party_id
  returning * into row;

  return row;
end;
$fn$;

revoke execute on function public.mark_loyalty_redeemed(uuid) from public, anon;
grant execute on function public.mark_loyalty_redeemed(uuid) to authenticated;

comment on function public.mark_loyalty_redeemed(uuid) is
  'She just claimed her reward -- the count starts over from this moment. See 20260911270000.';

-- ── 她现在几个章 ──────────────────────────────────────────────────────────

create or replace function public.loyalty_status_of(
  in_project_id uuid,
  in_party_id uuid default null
)
returns table (
  party_id uuid,
  name text,
  stamps integer,
  stamps_needed integer,
  earned boolean
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  needed integer;
begin
  if not public.works_here(in_project_id) then
    return;
  end if;

  select r.stamps_needed into needed
    from public.loyalty_rules r where r.project_id = in_project_id;

  return query
  with entries as (
    select d.id, d.name, d.loyalty_redeemed_at
      from public.directory_entries d
     where d.project_id = in_project_id
       and d.archived_at is null
       and (in_party_id is null or d.id = in_party_id)
  ),
  /* 同一个「一次来访」定义，照抄 party_visits 那段 hits CTE。 */
  hits as (
    select r.party_id
      from public.pipeline_records r
      join entries e on e.id = r.party_id
     where r.project_id = in_project_id
       and r.party_id is not null
       and r.issued_on is not null
       and (e.loyalty_redeemed_at is null or r.issued_on::timestamptz >= e.loyalty_redeemed_at)
    union all
    select a.party_id
      from public.appointments a
      join entries e on e.id = a.party_id
     where a.project_id = in_project_id
       and a.party_id is not null
       and coalesce(a.status, '') not in ('cancelled', 'no_show')
       and a.starts_at < now()
       and (e.loyalty_redeemed_at is null or a.starts_at >= e.loyalty_redeemed_at)
  ),
  counted as (
    select e.id, e.name, coalesce(count(h.party_id), 0)::integer as stamps
      from entries e
      left join hits h on h.party_id = e.id
     group by e.id, e.name
  )
  select c.id, c.name, c.stamps, needed,
         needed is not null and c.stamps >= needed
    from counted c
   order by c.stamps desc;
end;
$fn$;

revoke execute on function public.loyalty_status_of(uuid, uuid) from public, anon;
grant execute on function public.loyalty_status_of(uuid, uuid) to authenticated;

comment on function public.loyalty_status_of(uuid, uuid) is
  'How many stamps she has since her last redemption (or ever, if never redeemed), and whether that meets the owners rule. earned is always false until stamps_needed is set. See 20260911270000.';
