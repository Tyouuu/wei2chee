-- 保养合约：一台冷气一年洗两次 —— 那份名单就是他的年金。
--
-- ── 为什么这一件排在附属功能的第一位 ──────────────────────────────────────
--
-- 他 2026-09-05 问「有些行业确实是非常需要的」附属功能。冷气 · 净水器 ·
-- 灭虫 · 电梯 —— 这几行的生意模型就是**同一个客户每隔 N 个月再来一次**，
-- 而今天那份名单记在一本簿子上。
--
-- 而它同时是[重点 29] 最好的那一种「不打字」：**到期日是算出来的，
-- 不是他去记的。** 最好的输入是不存在的输入。
--
-- ── 🔴 先读别人怎么做，然后挑更简单的那一版（[重点 7d-2]）────────────────
--
-- ERPNext 的保养是**四份单据、84 个栏位**（读的是 doctype 原文）：
--
--   Maintenance Schedule        24 栏  合约头
--   Maintenance Schedule Item   16 栏  每一项的 start/end/periodicity/no_of_visits
--   Maintenance Schedule Detail 12 栏  **按一个「产生排程」的按钮展开出来的每一个日期**
--   Maintenance Visit           32 栏  每一次上门再开一份单
--
-- 照抄下去，一个冷气老板要按一颗按钮把三年的日期先生出来，改一次频率
-- 还要重生一次。
--
-- 而他真正在问的是一句话：**「这个月有哪几家要去洗？」**
--
-- ── 所以：合约存起来，到期日算出来 ────────────────────────────────────────
--
--   service_contracts   一份合约：谁 · 做什么 · 多久一次 · 从哪天到哪天
--   service_visits      **只在真的发生一件事的时候才有一行**（做了／跳过）
--   due_visits()        算出来的：该来的那几次，扣掉已经有行的
--
-- 🔴 **不预生成**，三个理由：
--   1. 他把三个月改成六个月，不用重生 —— 而 ERPNext 那些已经生出来的行会过期
--   2. 一份三年的月度合约，不会先塞 36 行进他的资料库
--   3. 「这个月要去哪几家」永远是最新的，没有一个要人去维护的排程
--
-- 跟这个 schema 已经做过三次的判断同一条：**架上有几件**是流水加起来的、
-- **过期**是日历算的、**帐龄**是日期算的。一个存起来的数字会说谎，算出来的不会。
--
-- ── 🔴 合约上没有金额，而这是照套票那一条来的 ────────────────────────────
--
-- `works_here`：**师傅要知道今天去哪几家**，那是他一天的工作。
-- 而一份带着「一次收 RM 180」的合约，等於把价钱交给每一个师傅。
--
-- 所以钱不在这张表上，跟 `service_packages` 一模一样（20260904190000）。
-- 那他开单的时候价钱从哪来？—— `last_lines_for_party`（20260905200000）：
-- **上次开给这个客人的那几行，一按就有了。** 他一个字都不用打。
--
-- ⚠️ 代价写出来：「这个月保养会收多少」这一支答不了，
-- 要从**已经开出来的那几张单**加起来。那是既有的东西。

-- ── 合约 ──────────────────────────────────────────────────────────────────

create table if not exists public.service_contracts (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects(id) on delete cascade,

  /* 哪一个客人。 */
  party_id uuid not null references public.directory_entries(id) on delete cascade,

  /* 做什么。他自己的词：「洗冷气 · 三台」「灭虫 · 厨房跟仓库」。 */
  title text not null default '',

  /* 多久一次。**月**，不是天 —— 这一行讲的就是「三个月一次」「半年一次」，
     而按天算会让 3 月 31 号那种日子跑掉。 */
  every_months integer not null check (every_months between 1 and 24),

  starts_on date not null default public.today_myt(),

  /* 合约到哪天为止。可空 = 一直续下去，但那样就没有续约提醒可以给他 ——
     所以画面上该建议他写。 */
  ends_on date,

  /* 去哪里。装修那边做的多地址在这里第二次用上：
     一个客户三间店，各自一份保养合约。 */
  site_address_id uuid references public.directory_addresses(id) on delete set null,

  branch_id uuid references public.branches(id) on delete set null,

  note text not null default '',

  /* 收起来，不是删掉。一份去年结束的合约，是今年打电话续约的名单。 */
  archived_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  idempotency_key uuid,
  constraint service_contracts_idem unique (project_id, idempotency_key),
  constraint service_contracts_dates check (ends_on is null or ends_on >= starts_on)
);

comment on table public.service_contracts is
  'A recurring service arrangement: this customer, this work, every N months. Carries NO money -- the table is works_here so a technician can see the round he has to drive, and a price on it would hand him every customer rate. Due dates are COMPUTED, never generated into rows. See 20260905220000.';

create index if not exists service_contracts_project_idx
  on public.service_contracts (project_id, starts_on) where archived_at is null;
create index if not exists service_contracts_party_idx
  on public.service_contracts (party_id) where archived_at is null;

-- ── 真的发生过的那几次 ────────────────────────────────────────────────────
--
-- 没有行 = 还没做。所以一份刚签的三年合约，这张表是空的 —— 而那是对的。

create table if not exists public.service_visits (
  id uuid primary key default gen_random_uuid(),

  contract_id uuid not null references public.service_contracts(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 它是**哪一次** —— 算出来的那个日子，不是他去的那一天。
     两个分开，因为「该 6 月 1 号去，实际 6 月 8 号才去」两件事都是真的。 */
  due_on date not null,

  /* done  做了
     skip  客人说这次不用 —— 而**不是删掉那一次**：跳过是一个事实，
           而一个消失的日子读起来像系统忘了 */
  status text not null default 'done' check (status in ('done', 'skip')),

  done_on date,

  /* 变成的那张单。走的是人按的那一支 add_pipeline_record（[重点 23]）。 */
  record_id uuid references public.pipeline_records(id) on delete set null,

  staff_id uuid references public.directory_entries(id) on delete set null,

  note text not null default '',

  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  /* 同一次只准记一遍。**这是防重复的本体** —— 一个师傅在门口按两下，
     不该变成两次保养。 */
  constraint service_visits_once unique (contract_id, due_on)
);

comment on table public.service_visits is
  'One row per visit that actually happened (or was skipped). No row means not done yet -- so a freshly signed three-year contract has zero rows here, which is correct. due_on is the slot, done_on is the day he went; both are true and they differ. See 20260905220000.';

create index if not exists service_visits_contract_idx
  on public.service_visits (contract_id, due_on desc);
create index if not exists service_visits_project_idx
  on public.service_visits (project_id, due_on desc);

-- ── 挂对公司、挂对人 ──────────────────────────────────────────────────────

create or replace function public.service_contracts_own_project()
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
  /* 🔴 保养合约是签给**客人**的。挂在供应商身上的合约，在画面上完全正常，
     而它会让「这个月要去哪几家」里出现一个我们要去拜访的五金行。 */
  if the_module <> 'customers' then
    raise exception 'a service contract belongs to a customer';
  end if;
  if new.project_id is distinct from owner_project then
    new.project_id := owner_project;
  end if;
  if new.site_address_id is not null and not exists (
    select 1 from public.directory_addresses a
    where a.id = new.site_address_id and a.party_id = new.party_id
  ) then
    raise exception 'that address belongs to someone else';
  end if;
  if new.branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = new.branch_id and b.project_id = new.project_id
  ) then
    raise exception 'that branch belongs to another business';
  end if;
  return new;
end;
$$;

drop trigger if exists service_contracts_own_project_trg on public.service_contracts;
create trigger service_contracts_own_project_trg
  before insert or update on public.service_contracts
  for each row execute function public.service_contracts_own_project();

create or replace function public.service_visits_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from public.service_contracts where id = new.contract_id;
  if owner_project is null then
    raise exception 'no such contract';
  end if;
  if new.project_id is distinct from owner_project then
    new.project_id := owner_project;
  end if;
  if new.record_id is not null and not exists (
    select 1 from public.pipeline_records r
    where r.id = new.record_id and r.project_id = owner_project
  ) then
    raise exception 'that document belongs to another business';
  end if;
  if new.status = 'done' and new.done_on is null then
    new.done_on := public.today_myt();
  end if;
  return new;
end;
$$;

drop trigger if exists service_visits_own_project_trg on public.service_visits;
create trigger service_visits_own_project_trg
  before insert or update on public.service_visits
  for each row execute function public.service_visits_own_project();

-- ── 谁看得到 ──────────────────────────────────────────────────────────────
--
-- works_here：师傅要知道今天去哪几家。价钱不在这两张表上（见档头）。

alter table public.service_contracts enable row level security;
alter table public.service_visits enable row level security;

drop policy if exists "service_contracts_own" on public.service_contracts;
create policy "service_contracts_own" on public.service_contracts
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

drop policy if exists "service_visits_own" on public.service_visits;
create policy "service_visits_own" on public.service_visits
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

-- ── 开一份合约 ────────────────────────────────────────────────────────────

create or replace function public.add_service_contract(
  in_project_id uuid,
  in_party_id uuid,
  in_title text default '',
  in_every_months integer default 6,
  in_starts_on date default null,
  in_ends_on date default null,
  in_site_address_id uuid default null,
  in_branch_id uuid default null,
  in_note text default '',
  in_idempotency_key uuid default null
)
returns public.service_contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  made public.service_contracts;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;

  begin
    insert into public.service_contracts (
      project_id, party_id, title, every_months, starts_on, ends_on,
      site_address_id, branch_id, note, created_by, idempotency_key
    ) values (
      in_project_id, in_party_id, left(coalesce(in_title, ''), 200),
      in_every_months,
      coalesce(in_starts_on, public.today_myt()), in_ends_on,
      in_site_address_id, in_branch_id, left(coalesce(in_note, ''), 2000),
      auth.uid(), in_idempotency_key
    ) returning * into made;
  exception when unique_violation then
    /* 按两下是一份合约。把已经存在的那一份还给他，不是报错。 */
    select * into made from public.service_contracts
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
  end;

  return made;
end;
$$;

revoke execute on function public.add_service_contract(uuid, uuid, text, integer, date, date, uuid, uuid, text, uuid) from public, anon;
grant execute on function public.add_service_contract(uuid, uuid, text, integer, date, date, uuid, uuid, text, uuid) to authenticated;

-- ── 改一份合约 ────────────────────────────────────────────────────────────
--
-- ⚠️ 改频率或起始日**不会动到已经做过的那几次** —— due_visits 把
-- 算出来的日子跟已经有的行 union 起来，所以一次做过的保养永远不会消失。

create or replace function public.update_service_contract(
  in_contract_id uuid,
  in_title text default null,
  in_every_months integer default null,
  in_starts_on date default null,
  in_ends_on date default null,
  in_clear_ends_on boolean default false,
  in_site_address_id uuid default null,
  in_note text default null
)
returns public.service_contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  made public.service_contracts;
begin
  update public.service_contracts set
    title = coalesce(left(in_title, 200), title),
    every_months = coalesce(in_every_months, every_months),
    starts_on = coalesce(in_starts_on, starts_on),
    /* 一个日子填进去就永远拿不掉，是 20260903010000 修过的那个毛病。 */
    ends_on = case when in_clear_ends_on then null else coalesce(in_ends_on, ends_on) end,
    site_address_id = coalesce(in_site_address_id, site_address_id),
    note = coalesce(left(in_note, 2000), note)
  where id = in_contract_id and public.works_here(project_id)
  returning * into made;

  if made.id is null then
    raise exception 'no such contract in your business';
  end if;
  return made;
end;
$$;

revoke execute on function public.update_service_contract(uuid, text, integer, date, date, boolean, uuid, text) from public, anon;
grant execute on function public.update_service_contract(uuid, text, integer, date, date, boolean, uuid, text) to authenticated;

create or replace function public.set_contract_archived(
  in_contract_id uuid,
  in_archived boolean default true
)
returns public.service_contracts
language plpgsql
security definer
set search_path = public
as $$
declare
  made public.service_contracts;
begin
  update public.service_contracts
  set archived_at = case when in_archived then now() else null end
  where id = in_contract_id and public.works_here(project_id)
  returning * into made;
  if made.id is null then
    raise exception 'no such contract in your business';
  end if;
  return made;
end;
$$;

revoke execute on function public.set_contract_archived(uuid, boolean) from public, anon;
grant execute on function public.set_contract_archived(uuid, boolean) to authenticated;

-- ── 🔴 这个月有哪几家要去 ─────────────────────────────────────────────────
--
-- 整支功能就是为了这一句话。

create or replace function public.due_visits(
  in_project_id uuid,
  in_from date default null,
  in_until date default null
)
returns table (
  contract_id uuid,
  party_id uuid,
  party text,
  title text,
  due_on date,
  every_months integer,
  site_address_id uuid,
  branch_id uuid,
  status text,
  overdue boolean,
  record_id uuid,
  done_on date,
  staff_id uuid
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d_from date := coalesce(in_from, public.today_myt() - 60);
  d_until date := coalesce(in_until, public.today_myt() + 30);
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  /* 一个窗口开太宽，等於叫资料库替一份十年的月度合约算一百二十个日子，
     然后丢掉一百一十九个。而那也不是任何人读得完的一份清单。 */
  if d_until < d_from then
    raise exception 'the window ends before it starts';
  end if;
  if d_until - d_from > 400 then
    raise exception 'ask for at most about a year at a time';
  end if;

  return query
  with live as (
    select c.* from public.service_contracts c
    where c.project_id = in_project_id and c.archived_at is null
  ),
  /* 算出来的那几次。 */
  slots as (
    select c.id as cid, g::date as slot
    from live c
    cross join lateral generate_series(
      c.starts_on,
      least(coalesce(c.ends_on, d_until), d_until),
      (c.every_months || ' months')::interval
    ) g
    where g::date >= d_from
  ),
  /* 已经有行的那几次 —— **union 进来**，所以他改了频率之后，
     一次做过的保养也不会从画面上消失。 */
  logged as (
    select v.contract_id as cid, v.due_on as slot
    from public.service_visits v
    join live c on c.id = v.contract_id
    where v.due_on between d_from and d_until
  ),
  every_slot as (
    select cid, slot from slots
    union
    select cid, slot from logged
  )
  select
    c.id, c.party_id, coalesce(p.name, ''), c.title, s.slot, c.every_months,
    c.site_address_id, c.branch_id,
    coalesce(v.status, 'due'),
    (v.id is null and s.slot < public.today_myt()),
    v.record_id, v.done_on, v.staff_id
  from every_slot s
  join live c on c.id = s.cid
  left join public.directory_entries p on p.id = c.party_id
  left join public.service_visits v on v.contract_id = s.cid and v.due_on = s.slot
  /* 最该先看的排前面：漏掉的，然后照日子。 */
  order by (v.id is null and s.slot < public.today_myt()) desc, s.slot, coalesce(p.name, '');
end;
$$;

revoke execute on function public.due_visits(uuid, date, date) from public, anon;
grant execute on function public.due_visits(uuid, date, date) to authenticated;

comment on function public.due_visits(uuid, date, date) is
  'Which customers are due for their recurring service in this window. Dates are COMPUTED from the contract, never generated into rows -- change the frequency and this is right immediately. Rows already logged are UNIONed in so a completed visit never vanishes when the schedule moves. See 20260905220000.';

-- ── 做完了（顺手开一张单）─────────────────────────────────────────────────
--
-- 🔴 开单走的是**人按的那一支** add_pipeline_record（[重点 23]）——
-- 单号 · 阶段预设 · 防重复 · 连到客户，四样全部住在那里面。

create or replace function public.log_service_visit(
  in_contract_id uuid,
  in_due_on date,
  in_status text default 'done',
  in_done_on date default null,
  in_staff_id uuid default null,
  in_note text default '',
  in_make_job_in text default null,
  in_idempotency_key uuid default null
)
returns public.service_visits
language plpgsql
security definer
set search_path = public
as $$
declare
  con public.service_contracts;
  made public.service_visits;
  job public.pipeline_records;
  cust text;
begin
  select * into con from public.service_contracts where id = in_contract_id;
  if con.id is null or not public.works_here(con.project_id) then
    raise exception 'no such contract in your business';
  end if;
  if in_status not in ('done', 'skip') then
    raise exception 'a visit is either done or skipped';
  end if;

  /* 已经记过这一次了 —— 把它还给他，不要开第二张单。
     这是「在门口按两下」的答案。 */
  select * into made from public.service_visits
  where contract_id = in_contract_id and due_on = in_due_on;
  if made.id is not null then
    return made;
  end if;

  if in_status = 'done' and in_make_job_in is not null then
    if not public.is_pipeline_module(in_make_job_in) then
      raise exception 'that page does not hold documents';
    end if;
    select name into cust from public.directory_entries where id = con.party_id;
    job := public.add_pipeline_record(
      in_project_id => con.project_id,
      in_module_key => in_make_job_in,
      in_title => case when btrim(con.title) = '' then 'Service visit' else con.title end,
      in_party => coalesce(cust, ''),
      in_issued_on => coalesce(in_done_on, public.today_myt()),
      in_idempotency_key => coalesce(in_idempotency_key,
        md5(in_contract_id::text || in_due_on::text)::uuid),
      in_party_id => con.party_id,
      in_site_address_id => con.site_address_id,
      in_branch_id => con.branch_id
    );
  end if;

  insert into public.service_visits (
    contract_id, project_id, due_on, status, done_on, record_id, staff_id, note, recorded_by
  ) values (
    in_contract_id, con.project_id, in_due_on, in_status,
    case when in_status = 'done' then coalesce(in_done_on, public.today_myt()) else null end,
    job.id, in_staff_id, left(coalesce(in_note, ''), 2000), auth.uid()
  ) returning * into made;

  return made;
end;
$$;

revoke execute on function public.log_service_visit(uuid, date, text, date, uuid, text, text, uuid) from public, anon;
grant execute on function public.log_service_visit(uuid, date, text, date, uuid, text, text, uuid) to authenticated;

comment on function public.log_service_visit(uuid, date, text, date, uuid, text, text, uuid) is
  'Record one visit, optionally turning it into a real document through add_pipeline_record -- the same function his own button calls, so numbering, stage and party linking are identical. Pressing it twice returns the first row and never opens a second job. See 20260905220000.';

-- ── 记错了 ────────────────────────────────────────────────────────────────
--
-- ⚠️ 开出来的那张单**不删** —— 单号发出去了，而一张凭空消失的单
-- 在他的簿子上是一个洞。要作废那张单，去那一页收起来。

create or replace function public.undo_service_visit(
  in_contract_id uuid,
  in_due_on date
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  gone integer;
begin
  delete from public.service_visits
  where contract_id = in_contract_id
    and due_on = in_due_on
    and public.works_here(project_id);
  get diagnostics gone = row_count;
  return gone > 0;
end;
$$;

revoke execute on function public.undo_service_visit(uuid, date) from public, anon;
grant execute on function public.undo_service_visit(uuid, date) to authenticated;

-- ── 🔴 快到期的合约 —— 这才是年金 ────────────────────────────────────────
--
-- 一份合约到期而没有人打电话，就是一个客户静静地走掉。
-- 冷气这一行的钱在这里，不在单张的保养费上。

create or replace function public.contracts_ending(
  in_project_id uuid,
  in_within_days integer default 60
)
returns table (
  contract_id uuid,
  party_id uuid,
  party text,
  title text,
  ends_on date,
  days_left integer,
  visits_done integer
)
language sql
stable
security definer
set search_path = public
as $$
  select c.id, c.party_id, coalesce(p.name, ''), c.title, c.ends_on,
         (c.ends_on - public.today_myt())::integer,
         coalesce((
           select count(*)::integer from public.service_visits v
           where v.contract_id = c.id and v.status = 'done'
         ), 0)
  from public.service_contracts c
  left join public.directory_entries p on p.id = c.party_id
  where c.project_id = in_project_id
    and c.archived_at is null
    and c.ends_on is not null
    and public.works_here(in_project_id)
    /* 已经过期的也列出来 —— 一份上个月到期而没人管的合约，
       正是他最该打的那一通电话。 */
    and c.ends_on <= public.today_myt() + greatest(coalesce(in_within_days, 60), 0)
  order by c.ends_on;
$$;

revoke execute on function public.contracts_ending(uuid, integer) from public, anon;
grant execute on function public.contracts_ending(uuid, integer) to authenticated;

comment on function public.contracts_ending(uuid, integer) is
  'Contracts running out soon, expired ones first. This is where the money in aircon/pest-control actually is -- a contract that lapses with nobody calling is a customer walking away quietly. See 20260905220000.';
