-- 下一步自己长出来 —— 三个器官的第一个：**触发**。
--
-- 交接那一份（任务 204 / 206）数过：六条链断掉 21 节，**18 节落在
-- 通知 · 触发 · 收钱三样上**，而触发是唯一一个**纯资料库、不等公司**的。
--
-- 🔴 而我要改掉那一份报告里自己写的做法，理由写在这里：
--
--   报告写的是「**往「一张单一个下一步」那张表自动长东西**」。
--   照那样做会出两个毛病，而两个都是这个仓库栽过的形状：
--
--   1. **他打勾了，明天又长回来。** 一条自动长出来的行，他按「做完了」
--      之后那张表就有一行 done_at，而规则明天照样成立 —— 除非再加一张
--      「已经长过了」的表去记，那就是第三张表。
--   2. **存起来的会说谎。** 报价单昨天快到期、今天客人付了订金 ——
--      那一行还写着「快到期，去追」。而这个 schema 判过十次同一件事：
--      架上几件 · 过期 · 帐龄 · 保养到期 · 车子里程 · 批号剩几件 ·
--      退了几成 —— **全部是算出来的，因为存起来的会过期。**
--
-- → **他自己写的那一条是承诺，存起来；系统看出来的是事实，算出来。**
--    两种东西，一个问题（「今天要跟什么」），所以它们是两支函式、
--    一张画面 —— 而不是一张表里两种行。
--
-- ⚠️ 而算出来的东西有一个新毛病，所以要一张小表挡住它：
--    「补货线破了」会一直讲到他补货为止，而他可能就是不想补。
--    **一把天天叫狼的尺没有人看** —— 这个仓库自己的话。
--    所以有 `nudge_snoozes`：他讲「我知道了，七天别再提」。

create table if not exists public.nudge_snoozes (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 哪一种信号。**不做外键、不做列举** —— 它对应的是下面那支函式里的
     `kind`，而那份清单会长。一个跟不上的列举会挡住加新规则的人。 */
  kind text not null check (btrim(kind) <> '' and length(kind) <= 40),

  /* 那个东西自己的 id：一张单 · 一份合约 · 一张套票 · 一件货。
     **不做外键**，同一个理由：它指得到四张不同的表。 */
  subject_id uuid not null,

  /* 到这一天为止不要再提。**存日子不存天数** ——
     存天数的话「还剩几天」每天都要有人去减。 */
  until date not null,

  by_who uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint nudge_snoozes_one_per_thing unique (project_id, kind, subject_id)
);

alter table public.nudge_snoozes enable row level security;

create or replace function public.nudge_snoozes_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.works_here(new.project_id) then
    raise exception 'that project is not yours';
  end if;
  return new;
end;
$$;

drop trigger if exists nudge_snoozes_guard on public.nudge_snoozes;
create trigger nudge_snoozes_guard
  before insert or update on public.nudge_snoozes
  for each row execute function public.nudge_snoozes_own_project();

drop policy if exists nudge_snoozes_read on public.nudge_snoozes;
create policy nudge_snoozes_read on public.nudge_snoozes
  for select using (public.works_here(project_id));

create index if not exists nudge_snoozes_live_idx
  on public.nudge_snoozes (project_id, kind, subject_id);


/* 「我知道了，先别提」。预设七天 —— 一个礼拜之后同一件事还在，
   那就真的该讲了。 */
create or replace function public.snooze_nudge(
  in_project_id uuid,
  in_kind text,
  in_subject_id uuid,
  in_days integer default 7
)
returns public.nudge_snoozes
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.nudge_snoozes;
begin
  if not public.works_here(in_project_id) then
    raise exception 'that project is not yours';
  end if;
  if coalesce(in_days, 0) < 1 or in_days > 365 then
    raise exception 'snooze it for between 1 and 365 days';
  end if;

  insert into public.nudge_snoozes (project_id, kind, subject_id, until, by_who)
  values (
    in_project_id, left(btrim(in_kind), 40), in_subject_id,
    public.today_myt() + in_days, auth.uid()
  )
  on conflict (project_id, kind, subject_id) do update
    set until = excluded.until, by_who = excluded.by_who, created_at = now()
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.snooze_nudge(uuid, text, uuid, integer) from public, anon;
grant execute on function public.snooze_nudge(uuid, text, uuid, integer) to authenticated;


/* 🔴 五个信号，一支函式，**一行都不存**。
   跟 `follow_ups_due`（他自己写的那几条）并排读，不混在一起。

   哪一种给谁看:
     · 保养到期 · 套票剩一次 · 补货线破了  → **师傅也看得到**，那是他的工作
     · 报价快到期 · 同意了没付订金          → **只有老板**，那是他的销售跟他的钱
   金额那一栏一律按身分挡（回 null 不是 0 ——「不给看」跟「零」是两句话）。 */
create or replace function public.nudges_due(
  in_project_id uuid,
  /* 看到哪一天为止。不给就是今天 ＋ 三天 —— 「快到期」本来就要提前讲。 */
  in_until date default null
)
returns table (
  kind text,
  subject_id uuid,
  record_id uuid,
  party text,
  title text,
  due_on date,
  days_late integer,
  amount_cents bigint,
  qty_left numeric,
  qty_floor numeric
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  cutoff date;
  money boolean;
  today date;
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  today := public.today_myt();
  cutoff := coalesce(in_until, today + 3);
  money := public.sees_money(in_project_id);

  return query
  with hushed as (
    select s.kind, s.subject_id
    from public.nudge_snoozes s
    where s.project_id = in_project_id and s.until >= today
  ),
  taken as (
    /* 这张单收到多少 —— 跟 `party_debts` 同一条：冲正过的不算。 */
    select a.record_id, sum(a.amount_cents) as got
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where e.project_id = in_project_id
      and e.direction = 'in'
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
    group by a.record_id
  ),

  /* ① 报价快到期，而且还没变成钱。
     「已确认」是他自己的词，测不了 —— **收到钱没有**是事实，测得了。 */
  quote_expiring as (
    select 'quote_expiring'::text as kind, r.id as subject_id, r.id as record_id,
           coalesce(r.party, '') as party, coalesce(r.title, '') as title,
           r.due_on, coalesce(r.amount_cents, 0)::bigint as amount_cents,
           null::numeric as qty_left, null::numeric as qty_floor
    from public.pipeline_records r
    left join taken t on t.record_id = r.id
    where money
      and r.project_id = in_project_id
      and r.module_key = 'quotations'
      and r.archived_at is null
      and r.due_on is not null
      and r.due_on <= cutoff
      and coalesce(t.got, 0) = 0
  ),

  /* ② 客人按了「同意」，而一分订金都还没进来。
     🔴 这一条是六条链里最贵的那一节 —— 他不知道客人答应了。 */
  agreed_unpaid as (
    select 'agreed_unpaid'::text, r.id, r.id,
           coalesce(r.party, ''), coalesce(r.title, ''),
           r.answered_at::date,
           coalesce(r.amount_cents, 0)::bigint,
           null::numeric, null::numeric
    from public.pipeline_records r
    left join taken t on t.record_id = r.id
    where money
      and r.project_id = in_project_id
      and r.archived_at is null
      and r.answered_at is not null
      and r.answer = 'accepted'
      and coalesce(t.got, 0) = 0
  ),

  /* ③ 保养该去了。**重用 `due_visits`**，不自己再算一次 ——
     同一个问题两个答案，这个仓库栽过至少八次。 */
  contract_due as (
    select 'contract_due'::text, v.contract_id, v.record_id,
           coalesce(v.party, ''), coalesce(v.title, ''),
           v.due_on, null::bigint, null::numeric, null::numeric
    from public.due_visits(in_project_id, null, cutoff) v
    where v.done_on is null
  ),

  /* ④ 套票剩最后一次 —— 那是他打电话叫客人续的那一刻。
     剩 0 次的不讲：那不是「快用完」，那是「用完了」。 */
  package_last as (
    select 'package_last'::text, b.package_id, null::uuid,
           coalesce(d.name, ''), coalesce(b.name, ''),
           b.expires_on, null::bigint,
           b.sessions_left::numeric, null::numeric
    from public.package_balance b
    join public.directory_entries d on d.id = b.party_id
    where b.project_id = in_project_id
      and b.archived_at is null
      and not b.expired
      and b.sessions_left = 1
  ),

  /* ⑤ 补货线破了。`reorder_at` 从建表那天就在，
     而在今天之前**没有任何地方读过它**（第 N 次「能力有、线没接」）。 */
  below_reorder as (
    select 'below_reorder'::text, i.id, null::uuid,
           '', coalesce(i.name, ''),
           null::date, null::bigint,
           coalesce(h.on_hand, 0)::numeric, i.reorder_at::numeric
    from public.catalog_items i
    left join public.stock_on_hand h on h.item_id = i.id
    where i.project_id = in_project_id
      and i.archived_at is null
      and i.reorder_at is not null
      and coalesce(h.on_hand, 0) < i.reorder_at
  ),

  all_of as (
    select * from quote_expiring
    union all select * from agreed_unpaid
    union all select * from contract_due
    union all select * from package_last
    union all select * from below_reorder
  )
  select a.kind, a.subject_id, a.record_id, a.party, a.title, a.due_on,
         /* 逾期是算出来的。没有日子的（补货线 · 套票）没有逾期这回事。 */
         case when a.due_on is not null
              then greatest((today - a.due_on), 0)::integer end,
         case when money then a.amount_cents end,
         a.qty_left, a.qty_floor
  from all_of a
  where not exists (
    select 1 from hushed s where s.kind = a.kind and s.subject_id = a.subject_id
  )
  /* 逾期的排最前面 —— 他打开那一秒要看的不是「有五件事」，
     是「有一件上个礼拜就该做而你没做」。 */
  order by a.due_on nulls last, a.kind;
end;
$fn$;

revoke execute on function public.nudges_due(uuid, date) from public, anon;
grant execute on function public.nudges_due(uuid, date) to authenticated;
