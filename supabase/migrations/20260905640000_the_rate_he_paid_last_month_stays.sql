-- 上个月讲好的那个率，不会因为今天改了而变。
--
-- ── 洞是走 vibe-dealer 那一次量出来的（任务 175）────────────────────────────
--
--   上个月本来 RM 760 · 把率从 2% 改成 3% 之后变 RM 1,140
--
-- 一个已经付掉的月份，数字自己动了 RM 380，而画面上没有任何东西会讲。
-- 根因是 `commission_tiers` 只有一份、没有日子：`staff_earnings` 不管问哪个
-- 月，读的都是**现在**那一份。
--
-- ── 读别人真的表（重点 26）─────────────────────────────────────────────────
--
-- **他自己的 `0006_dealer_rate_history`** —— 一张只加不改的记录表
-- （old_rate / new_rate / changed_by / created_at），档头写的正是同一句：
--   *「dealers 只看得到现在的值 —— 没有记录它以前是多少、什么时候改的」*
--
-- **ERPNext 的佣金率没有日子，一个都没有。** 逐栏读过：
--   `Sales Person.commission_rate`  Percent，一栏
--   `Sales Partner.commission_rate` Float，一栏
-- 改下去一样会动历史。他们躲开这件事的方法是**冻在单上**：
--   `Sales Team.commission_rate` 是**唯读**的，开单的时候抄一份进那一行。
-- 他自己的 vibe-dealer 也是这个做法（`commission_rm` 是 generated column）。
--
-- 🔴 **而「冻在单上」对我们不成立，理由很硬**：我们的佣金是**分段算一整个
--    月的总数**的 —— 5000 抽一成、超过的抽一成半。那个「超过」依赖整月合计，
--    **冻不到任何一笔单上**。ERPNext 抄得成是因为他们那一栏是**平的**。
--
-- ✅ **所以走另一条，而那条 ERPNext 自己在同一个仓库的另一个地方就有**：
--    `Item Price.valid_from / valid_upto` —— **一份价钱带一个生效日**。
--    佣金办法照它做。
--
-- ── 规矩只有一句 ──────────────────────────────────────────────────────────
--
--   **每一份佣金办法带一个生效日。算某个月的时候，用那个月「开始那天」
--     在跑的那一份。**
--
-- 推论，全部是好的：
--   · 今天改率 → **这个月跟以前每一个月都不会动**，新的率从下个月开始
--   · 他要改的正好是这个月（打错了）→ 生效日自己写 `2026-09-01`。
--     **那时候动的是他讲的，不是我们偷偷做的** —— 这一条才是整件事的重点
--   · 那个月开始之前一份都还没有 → **用最早那一份**。
--     一个刚建的师傅，第一次写办法就是「我们本来就是这样算的」
--
-- ── 为什么另开一张表，而不是给 `commission_tiers` 加一栏日子 ────────────────
--
-- 🔴 因为画面上那一段是 `.from("commission_tiers")` **直接读表**的
--    （师傅那一页）。加一栏日子，那一段会把每一个世代混在一起画出来 ——
--    **一个我在别人地盘上造出来的画面 bug**（重点 22e）。
--
-- 分开之后：`commission_tiers` 一个字都没变（现在在跑的那一份，画面照读），
-- 历史在旁边。**这也正好是他 0006 的形状** —— 表不动，记录表在旁边。
--
-- ⚠️ 这一支是**加**（重点 31）：今天在跑的东西一个字都不会变。
--    底下那段回填给每一个已经有办法的师傅补一份**日期在最早**的世代，
--    所以**今天算出来的每一个数字，跟昨天一模一样**。

-- ── 一份佣金办法，跟它从哪天开始 ──────────────────────────────────────────

create table if not exists public.commission_schemes (
  id uuid primary key default gen_random_uuid(),

  party_id uuid not null references public.directory_entries(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 从哪天开始算这一份。算某个月用的是「那个月第一天」在跑的那一份。 */
  effective_from date not null default public.today_myt(),

  /* 那一份的全部档：[{"from_cents": 0, "percent": 10}, …]，按起点排好。
     🔴 这里存 jsonb 是对的，而 `commission_tiers` 存成真的行也是对的 ——
     两张表回答的是两个问题：那一张要**算数**（所以是行），
     这一张是**那一天他讲了什么**（所以是一句原话，不再被谁改）。 */
  tiers jsonb not null default '[]'::jsonb,

  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.commission_schemes is
  'One commission scheme and the date it starts. staff_earnings(month) uses the scheme in force on that month''s FIRST day, so changing the rate today never moves a month that has already begun -- unless he writes a past date himself, which is his sentence, not ours. Append-only. Shape taken from his own vibe-dealer 0006 and from ERPNext Item Price.valid_from; ERPNext''s own commission_rate has no dating at all. See 20260905640000.';

comment on column public.commission_schemes.effective_from is
  'The day this scheme starts. A month uses the latest scheme with effective_from <= that month''s first day; if none is that old, the earliest one.';

create index if not exists commission_schemes_party_idx
  on public.commission_schemes (party_id, effective_from desc, created_at desc);

-- ── 谁看得到，谁写得进去 ──────────────────────────────────────────────────
--
-- 🔴 **只有 select 的 policy，一条 insert / update / delete 都没有** ——
-- 跟 `record_changes`（20260904090000）同一个形状：只有底下那两支
-- security definer 写得进去。**一本改得了的帐，答不了它存在的那个问题。**

alter table public.commission_schemes enable row level security;

drop policy if exists "commission_schemes_read" on public.commission_schemes;
create policy "commission_schemes_read" on public.commission_schemes
  for select using (public.sees_money(project_id));

create or replace function public.commission_schemes_own_project()
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
  if the_module <> 'staff' then
    raise exception 'commission belongs to a staff member';
  end if;
  new.project_id := owner_project;
  return new;
end;
$$;

drop trigger if exists commission_schemes_own_project_trg on public.commission_schemes;
create trigger commission_schemes_own_project_trg
  before insert on public.commission_schemes
  for each row execute function public.commission_schemes_own_project();

-- ── 回填：今天算出来的每一个数字，跟昨天一模一样 ──────────────────────────
--
-- 每一个已经有办法的师傅补一份世代，日期放在**任何一个月份之前**。
-- 所以每一个月都找得到它，而且找到的就是他今天在用的那一份。
--
-- ⚠️ `changed_by` 是 null —— 这不是某一个人做的动作，是一次回填。
--    他自己的 0010 在同一个位置也是这样写的，而且写下了理由。

insert into public.commission_schemes (party_id, project_id, effective_from, tiers, changed_by)
select t.party_id,
       t.project_id,
       date '2000-01-01',
       jsonb_agg(jsonb_build_object('from_cents', t.from_cents, 'percent', t.percent)
                 order by t.from_cents),
       null
from public.commission_tiers t
group by t.party_id, t.project_id
on conflict do nothing;

-- ── 那一天在跑的是哪一份 ──────────────────────────────────────────────────
--
-- 🔴 **一个人都不 grant。** 它没有自己的权限检查，只给底下那两支
-- security definer 用 —— 跟 `add_ledger_entry_core`（20260905020000）
-- 同一个做法。grant 出去就是一条绕过 sees_money 的路。

create or replace function public.commission_scheme_at(
  in_party_id uuid,
  in_on date
)
returns table (effective_from date, tiers jsonb)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  /* ① 那一天在跑的那一份。同一天存过两次，最后存的那一次赢。 */
  return query
    select s.effective_from, s.tiers
    from public.commission_schemes s
    where s.party_id = in_party_id
      and s.effective_from <= in_on
    order by s.effective_from desc, s.created_at desc
    limit 1;
  if found then return; end if;

  /* ② 那一天之前一份都没有 → 最早那一份。
        「我们本来就是这样算的」。 */
  return query
    select s.effective_from, s.tiers
    from public.commission_schemes s
    where s.party_id = in_party_id
    order by s.effective_from asc, s.created_at asc
    limit 1;
  if found then return; end if;

  /* ③ 一份世代都没有 —— 有人绕过 set_commission_tiers 直接写了那张表
        （policy 是 for all，所以写得了）。退回现在那一份，
        **也就是今天的行为**，而不是回一个凭空的零。 */
  return query
    select null::date,
           coalesce(
             jsonb_agg(jsonb_build_object('from_cents', t.from_cents, 'percent', t.percent)
                       order by t.from_cents),
             '[]'::jsonb)
    from public.commission_tiers t
    where t.party_id = in_party_id
    having count(*) > 0;
end;
$$;

revoke execute on function public.commission_scheme_at(uuid, date) from public, anon, authenticated;

-- ── 他改过几次，每一次从哪天开始 ──────────────────────────────────────────

create or replace function public.commission_schemes_of(in_party_id uuid)
returns table (
  id uuid,
  effective_from date,
  tiers jsonb,
  changed_at timestamptz,
  in_force_now boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  mine boolean;
  current_id uuid;
begin
  select exists (
    select 1 from public.directory_entries d
    where d.id = in_party_id and public.sees_money(d.project_id)
  ) into mine;
  if not mine then
    return;
  end if;

  select s.id into current_id
  from public.commission_schemes s
  where s.party_id = in_party_id and s.effective_from <= public.today_myt()
  order by s.effective_from desc, s.created_at desc
  limit 1;

  return query
    select s.id, s.effective_from, s.tiers, s.created_at, (s.id = current_id)
    from public.commission_schemes s
    where s.party_id = in_party_id
    order by s.effective_from desc, s.created_at desc;
end;
$$;

revoke execute on function public.commission_schemes_of(uuid) from public, anon;
grant execute on function public.commission_schemes_of(uuid) to authenticated;

-- ── 写一份办法 ────────────────────────────────────────────────────────────
--
-- ⚠️ **加一个有预设的参数就是一支新函式**（重点 31 第二条）：
--    不 drop 旧的，那支函式**整个选不到**，而画面上跟「功能坏了」一模一样。
--
-- ⚠️ 底下的函式体是**从 20260904120000 逐字延伸的**，只在结尾加了
--    「顺手记一份世代」那一段。整支重写漏掉守卫，这个仓库咬过三次。

drop function if exists public.set_commission_tiers(uuid, jsonb);

create or replace function public.set_commission_tiers(
  in_party_id uuid,
  in_tiers jsonb,
  /* 从哪天开始。不给就是今天 —— 也就是**下个月**才生效（见档头那一句）。
     他要改的正好是这个月，就自己写这个月一号。 */
  in_effective_from date default null
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
  starts date;
  the_project uuid;
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

  /* ── 顺手记一份世代 ────────────────────────────────────────────────────
     🔴 **一份空的办法照样记一份。** 「从九月起不抽了」是真的会发生的一件
     事，而它跟「没有这一份」在画面上长得一样、算出来却不一样：
     没有这一份 → 往前找，找到旧的那一份，**照旧抽**。 */
  starts := coalesce(in_effective_from, public.today_myt());
  select d.project_id into the_project from public.directory_entries d where d.id = in_party_id;

  insert into public.commission_schemes (party_id, project_id, effective_from, tiers, changed_by)
  values (
    in_party_id,
    the_project,
    starts,
    coalesce(
      (select jsonb_agg(jsonb_build_object(
                'from_cents', coalesce(nullif(x->>'from_cents', '')::bigint, 0),
                'percent', coalesce(nullif(x->>'percent', '')::numeric, 0))
              order by coalesce(nullif(x->>'from_cents', '')::bigint, 0))
       from jsonb_array_elements(in_tiers) x),
      '[]'::jsonb),
    auth.uid()
  );

  return query
    select * from public.commission_tiers
     where party_id = in_party_id
     order by from_cents;
end;
$$;

revoke execute on function public.set_commission_tiers(uuid, jsonb, date) from public, anon;
grant execute on function public.set_commission_tiers(uuid, jsonb, date) to authenticated;

-- ── 这个月他做了多少，抽多少 —— 而抽的是**那个月**的率 ────────────────────
--
-- ⚠️ 回传多一栏 `rate_from`，所以要先 drop（改回传型别跟改签名一样，
--    `create or replace` 会直接拒绝）。
--
-- 🔴 **顺手修一个真的错，而且要讲出来**：原本那一支收尾是 `(...)::bigint`，
--    而 numeric 转 bigint 在 Postgres 是**四舍五入**。
--    `lib/portal/commission.ts` 那一份用的是 `Math.trunc`，而且它档头写着
--    理由：*一笔算出来比讲好的多一分的佣金，是我们替他多付的钱，而他不知道*。
--    **两边在有零头的时候差一分**（333 分抽 10.5% → 那边 34、这边 35）。
--    照那条规矩，截掉才是对的，所以这一支改成 `trunc()`。

drop function if exists public.staff_earnings(uuid, text);

create or replace function public.staff_earnings(
  in_project_id uuid,
  in_month text
)
returns table (
  party_id uuid,
  name text,
  earned_cents bigint,
  commission_cents bigint,
  /* 这个数字是照哪一份办法算的。null = 从来没有人记过世代
     （只可能是有人绕过 set_commission_tiers 直接写了那张表）。 */
  rate_from date
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
  ),
  /* 🔴 这一段就是这一支 migration 的全部：用**那个月开始那天**在跑的
     那一份办法，不是用现在那一份。 */
  scheme as (
    select earned.who, s.effective_from, coalesce(s.tiers, '[]'::jsonb) as tiers
    from earned
    left join lateral (
      select * from public.commission_scheme_at(earned.who, first_day)
    ) s on true
  )
  select d.id,
         d.name,
         earned.total,
         (
           /* 分段算：每一档只吃它自己那一段。 */
           select coalesce(trunc(sum(
             greatest(
               least(earned.total, coalesce(nxt.from_cents, earned.total)) - t.from_cents,
               0
             ) * t.percent / 100
           )), 0)::bigint
           from jsonb_to_recordset(scheme.tiers) as t(from_cents bigint, percent numeric)
           left join lateral (
             select min(t2.from_cents) as from_cents
             from jsonb_to_recordset(scheme.tiers) as t2(from_cents bigint, percent numeric)
             where t2.from_cents > t.from_cents
           ) nxt on true
         ) as commission_cents,
         scheme.effective_from
  from earned
  join public.directory_entries d on d.id = earned.who
  join scheme on scheme.who = earned.who
  order by earned.total desc;
end;
$$;

revoke execute on function public.staff_earnings(uuid, text) from public, anon;
grant execute on function public.staff_earnings(uuid, text) to authenticated;

comment on function public.staff_earnings(uuid, text) is
  'Per staff member for one month: money they brought in, and the stepped commission on it AT THE RATE THAT WAS IN FORCE ON THAT MONTH''S FIRST DAY. Changing the rate today never moves a month that has already begun. Steps are applied BAND BY BAND, and the total is TRUNCATED to the cent to match lib/portal/commission.ts. See 20260905640000.';
