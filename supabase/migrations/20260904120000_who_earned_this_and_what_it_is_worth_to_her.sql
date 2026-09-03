-- 阶梯佣金：头五千算一成，超过的算一成半。
--
-- ── 为什么美容跟零售需要它 ────────────────────────────────────────────────
--
-- [任务 67] 实查 Aoikumo：**「服务奖金 · 进阶佣金」**，而它自己讲有 20 多种
-- 算法。Tunai 的头条里也有「**阶梯佣金**」。
-- 一个沙龙老板每个月要算一次这件事，而今天他是在纸上算的。
--
-- ── 读的是谁的表 ──────────────────────────────────────────────────────────
--
-- ERPNext 的 `Sales Team` 子表：`sales_person` · `allocated_percentage`
-- （几个人分一张单）· `commission_rate`（**一个平的百分比**）· `incentives`。
--
--   ✅ **谁做的** ＋ **一个比例** —— 两样都抄
--   ❌ **几个人分一张单那个子表不抄**：一个沙龙的一次服务是一个人做的，
--      而「分成」是代理商跟批发那一边的事，抄进来等於把整个模型变两倍
--   ➕ **阶梯是加的，他们没有** —— 而那正好是这个市场的对手在卖的东西
--
-- ── 🔴 佣金算在「收到的钱」上，不是算在单子上 ────────────────────────────
--
-- 因为**钱在那里**。一个沙龙的一次服务，金额是记在 `payments` 那一笔上的
-- （预约那张表一分钱都没有，而那是[任务 100](#) 故意的）。
--
-- 一条规矩，而且讲出来：**谁的名字挂在那笔钱上，那笔钱就算谁的。**
-- 不给他选「算单子还是算收款」—— 两个都做，等於两个都要维护，
-- 而他还没有一个人在用这一件。

alter table public.ledger_entries
  add column if not exists done_by uuid
  references public.directory_entries(id) on delete set null;

comment on column public.ledger_entries.done_by is
  'Which staff member earned this money -- a row on his own 师傅 page. Commission is a percentage of THIS, because this is where the amount is (an appointment has no money on it, deliberately). See 20260904120000.';

create index if not exists ledger_entries_done_by_idx
  on public.ledger_entries (done_by, entry_on) where done_by is not null;

-- ── 阶梯 ──────────────────────────────────────────────────────────────────
--
-- 一张表，不是一栏 jsonb：阶梯是一份**要拿来算数**的清单，
-- 而这个 schema 已经学过两次（明细 · 分期），拿 jsonb 装要算数的清单
-- 就是把加总、排序、约束全部推给读它的人。

create table if not exists public.commission_tiers (
  id uuid primary key default gen_random_uuid(),

  /* 哪一个师傅。他就是名册上那一行（module_key = 'staff'）。 */
  party_id uuid not null references public.directory_entries(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 从多少开始算这一档。第一档是 0。 */
  from_cents bigint not null default 0 check (from_cents >= 0),

  /* 这一档抽几成。10 就是一成。 */
  percent numeric(5, 2) not null check (percent >= 0 and percent <= 100),

  created_at timestamptz not null default now(),

  /* 同一个起点两档，是一次打错，不是两档。 */
  constraint commission_tiers_unique unique (party_id, from_cents)
);

comment on table public.commission_tiers is
  'Stepped commission for one staff member: the first RM 5,000 at 10%, above that 15%. ERPNext has a flat rate; the steps are what this market''s competitors sell (Aoikumo, Tunai). See 20260904120000.';

create index if not exists commission_tiers_party_idx
  on public.commission_tiers (party_id, from_cents);

-- ── 谁看得到 ──────────────────────────────────────────────────────────────
--
-- 🔴 `sees_money`。一个师傅看不到自己抽几成 —— 而那听起来不近人情，
-- 直到你想到**他也看不到别人抽几成**。这一张表就是薪水，
-- 而薪水在这个 schema 里从来不是共用的。

alter table public.commission_tiers enable row level security;

drop policy if exists "commission_tiers_owner" on public.commission_tiers;
create policy "commission_tiers_owner" on public.commission_tiers
  for all using (public.sees_money(project_id)) with check (public.sees_money(project_id));

create or replace function public.commission_tiers_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
  the_module text;
begin
  select project_id, module_key into owner_project, the_module
  from public.directory_entries where id = new.party_id;
  if owner_project is null then
    raise exception 'no such person';
  end if;
  /* 客户没有佣金。一个挂在客户身上的抽成比例，在画面上完全正常，
     而它会让下个月那张表算出一个没有人拿得到的数字。 */
  if the_module <> 'staff' then
    raise exception 'commission belongs to a staff member';
  end if;
  new.project_id := owner_project;
  return new;
end;
$$;

drop trigger if exists commission_tiers_own_project_trg on public.commission_tiers;
create trigger commission_tiers_own_project_trg
  before insert or update on public.commission_tiers
  for each row execute function public.commission_tiers_own_project();

create or replace function public.set_commission_tiers(
  in_party_id uuid,
  in_tiers jsonb
)
returns setof public.commission_tiers
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  item jsonb;
  seen bigint[] := '{}';
  f bigint;
begin
  select exists (
    select 1 from public.directory_entries d
    where d.id = in_party_id and public.sees_money(d.project_id)
  ) into mine;
  if not mine then
    raise exception 'no such person in your project';
  end if;

  if jsonb_typeof(coalesce(in_tiers, 'null'::jsonb)) <> 'array' then
    raise exception 'tiers must be an array';
  end if;
  /* 六档是一份佣金办法；二十档是一张表格，而没有人算得清楚自己在第几档。 */
  if jsonb_array_length(in_tiers) > 6 then
    raise exception 'that is more steps than anybody can follow';
  end if;

  /* 在写之前先讲人话 —— 那条唯一约束吐的是他读不懂的一句
     （20260903050000 学到的：顺序错的守卫等於没有守卫）。 */
  for item in select * from jsonb_array_elements(in_tiers)
  loop
    f := coalesce(nullif(item->>'from_cents', '')::bigint, 0);
    if f = any (seen) then
      raise exception 'two steps cannot start at the same amount';
    end if;
    seen := seen || f;
  end loop;

  delete from public.commission_tiers where party_id = in_party_id;

  for item in select * from jsonb_array_elements(in_tiers)
  loop
    insert into public.commission_tiers (party_id, project_id, from_cents, percent)
    values (
      in_party_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      coalesce(nullif(item->>'from_cents', '')::bigint, 0),
      coalesce(nullif(item->>'percent', '')::numeric, 0)
    );
  end loop;

  return query
    select * from public.commission_tiers
     where party_id = in_party_id
     order by from_cents;
end;
$$;

revoke execute on function public.set_commission_tiers(uuid, jsonb) from public, anon;
grant execute on function public.set_commission_tiers(uuid, jsonb) to authenticated;

-- ── 这个月他做了多少，抽多少 ──────────────────────────────────────────────
--
-- 🔴 阶梯是**分段算的**，不是「过了五千就整笔算一成半」。
-- 八千块、0–5000 抽一成、5000 以上抽一成半：
--   5000 × 10% + 3000 × 15% = 500 + 450 = **950**
-- 而不是 8000 × 15% = 1200。
--
-- 那两个算法差 250 块，而**差的那 250 块每个月都会有人来吵** ——
-- 所以它写在这里，一个地方，带着测试（lib/portal/commission.ts 那一份
-- 是同一条规矩的另一边，两边用同一批断言验）。

create or replace function public.staff_earnings(
  in_project_id uuid,
  in_month text
)
returns table (
  party_id uuid,
  name text,
  earned_cents bigint,
  commission_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  first_day date;
begin
  if not public.sees_money(in_project_id) then
    return;
  end if;

  /* 「2026-09」→ 那个月的第一天。马来西亚的月份，不是伺服器的。 */
  first_day := to_date(in_month || '-01', 'YYYY-MM-DD');

  return query
  with earned as (
    select e.done_by as who, sum(e.amount_cents)::bigint as total
    from public.ledger_entries e
    where e.project_id = in_project_id
      and e.done_by is not null
      and e.direction = 'in'
      /* 冲正过的、跟自己是冲正的，都不算 —— 一笔退回去的钱不算她赚的。
         同一条规矩在 lib/portal/allocations.ts 的 countsAsReceived。 */
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r where r.adjusts_id = e.id)
      and e.entry_on >= first_day
      and e.entry_on < (first_day + interval '1 month')
    group by e.done_by
  )
  select d.id,
         d.name,
         earned.total,
         (
           /* 分段算：每一档只吃它自己那一段。 */
           select coalesce(sum(
             greatest(
               least(earned.total, coalesce(nxt.from_cents, earned.total)) - t.from_cents,
               0
             ) * t.percent / 100
           ), 0)::bigint
           from public.commission_tiers t
           left join lateral (
             select min(t2.from_cents) as from_cents
             from public.commission_tiers t2
             where t2.party_id = t.party_id and t2.from_cents > t.from_cents
           ) nxt on true
           where t.party_id = d.id
         ) as commission_cents
  from earned
  join public.directory_entries d on d.id = earned.who
  order by earned.total desc;
end;
$$;

revoke execute on function public.staff_earnings(uuid, text) from public, anon;
grant execute on function public.staff_earnings(uuid, text) to authenticated;

comment on function public.staff_earnings(uuid, text) is
  'Per staff member for one month: money they brought in, and the stepped commission on it. Steps are applied BAND BY BAND, not "whole amount at the top rate" -- those two differ by real money every month. See 20260904120000.';

/* ⚠️ 这一支**不会自己写一笔佣金出去**，而这一件要讲清楚：
   替他记一笔他没有讲过要付的钱，是在他的帐上凭空多一笔支出。
   它算给他看，他自己按那颗「记一笔」——而那一按走的是
   `add_ledger_entry`，跟他手打一笔佣金是同一条路（重点 23）。 */
