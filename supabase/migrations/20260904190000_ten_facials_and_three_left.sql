-- 套票：卖十次，用了七次，还剩三次。
--
-- ── 为什么这是沙龙那一单的第一件 ──────────────────────────────────────────
--
-- [任务 67] 实查两家本地对手，两家的头条里都有它：
--   Tunai      「**套票／次数追踪**」·「套票到期自动跟催」
--   Aoikumo    「**e-Wallet（预付余额）**」·「套票」
-- [任务 44] 写着签沙龙之前要问清楚的四件，**第一件就是套票**。
--
-- ⚠️ 而 [任务 61] 当时写「沙龙那一单缺的不是画面，是背后那张会算余额的表」——
-- 那句话只对一半。`PackagePicker` 确实在组件库里，但它是**官网上给客人挑**
-- 一张套票的卡片，跟「这位客人还剩几次」没有关系。两样东西都缺。
--
-- ── 读的是谁的表 ──────────────────────────────────────────────────────────
--
-- ERPNext Health 的 `Therapy Plan`（读的是它的 doctype 原文，不是首页）：
--   patient(REQ) · start_date(REQ) · therapy_plan_details(REQ, 子表)
--   total_sessions(唯读) · total_sessions_completed(唯读)
--   status(唯读: Not Started / In Progress / Completed / Cancelled)
--   practitioner(REQ) · naming_series · invoiced · source_doc · intent · interval
--
-- ✅ **抄三样**
--   1. 谁的 ＋ 总共几次
--   2. **用掉几次是唯读的** —— 算出来的，不是打进去的。跟「架上有几个」
--      同一条：一个存起来的次数，是任何东西都写得进去的数字
--   3. **状态是算出来的**（还没开始 / 用着 / 用完了）
--
-- ❌ **不抄四样**
--   · **子表**（一张套票包好几种服务、各自次数）—— 一间沙龙卖的是
--     「10 次洗剪吹」，一种。同一件事出现第二次才升级成形状（[任务 41]）
--   · **practitioner 必填** —— 一张套票不属於某一个师傅，客人换人做也照样算
--   · naming_series / invoiced / source_doc / intent / interval —— 医院的东西
--
-- ➕ **加一样他们没有的：到期日。**
--   Tunai 的头条就是「套票到期自动跟催」。一张永不过期的套票，是老板不敢卖的
--   东西 —— 那笔钱会挂在他帐上好几年。
--   ⚠️ **过期只讲，不挡**：跟报价单过期同一条（20260903010000）——
--   过期是日历的事实，通不通融是他的判断。一间沙龙常常通融。
--
-- ── 🔴 钱不在这张表上 ─────────────────────────────────────────────────────
--
-- 一个师傅**必须**看得到「这位还剩三次」，不然他没办法招呼客人。
-- 而这张表如果带着「这张套票卖 RM 1,500」，就等於把价钱交给了每一个师傅。
--
-- 所以：**这张表上没有金额那一栏。** 钱住在付款那一笔上（`entry_id`），
-- 而那张表是 `sees_money`。师傅看得到次数，看不到价钱 ——
-- 而那**不是多一条新规矩，是既有那条界线自己长出来的结果**。

create table if not exists public.service_packages (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects(id) on delete cascade,

  /* 谁的。⚠️ 一张套票**一定**属於某一个人 —— 「谁还剩几次」是它存在的
     全部理由，所以这一栏不给空。 */
  party_id uuid not null references public.directory_entries(id),

  /* 他自己给它取的名字：「10 次洗剪吹」「面部护理 6 送 1」。 */
  name text not null,

  /* 总共几次。**用掉几次不在这里** —— 那是 package_uses 数出来的。 */
  sessions_total integer not null check (sessions_total > 0 and sessions_total <= 999),

  /* 卖出去那一天，跟到期那一天。到期可以不写（有些套票不设期限）。 */
  sold_on date not null default public.today_myt(),
  expires_on date,

  /* 付款那一笔。⚠️ 可空：他可能先开套票、客人下週才付。
     金额永远不在这里 —— 见档头。 */
  entry_id uuid references public.ledger_entries(id) on delete set null,

  note text not null default '',

  /* 收起来，不是删掉。一张用完的套票是明年「他去年买过什么」的答案。 */
  archived_at timestamptz,

  branch_id uuid references public.branches(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  idempotency_key uuid,
  constraint service_packages_idem unique (project_id, idempotency_key)
);

comment on table public.service_packages is
  'A package of N sessions sold to one customer. Sessions used are COUNTED from package_uses, never stored -- same rule as stock on hand. Carries no price: the money lives on the ledger entry, which is owner-only, so a stylist can see 「three left」 without seeing what it cost. See 20260904190000.';

create index if not exists service_packages_party_idx
  on public.service_packages (party_id, sold_on desc) where archived_at is null;
create index if not exists service_packages_project_idx
  on public.service_packages (project_id, sold_on desc) where archived_at is null;

-- ── 用掉一次 ──────────────────────────────────────────────────────────────
--
-- 一次一行，跟库存的每一笔进出同一个形状。
-- 「还剩几次」= 总次数 − 这里有几行。**没有一栏存着余额**，所以没有一个
-- 数字可以被写歪。

create table if not exists public.package_uses (
  id uuid primary key default gen_random_uuid(),

  package_id uuid not null references public.service_packages(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  used_on date not null default public.today_myt(),

  /* 谁做的。⚠️ 跟 `ledger_entries.done_by` 同一个意思（20260904120000）——
     哪天要算「这个月她做了几次套票」，答案已经在这里。 */
  staff_id uuid references public.directory_entries(id) on delete set null,

  note text not null default '',

  recorded_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  idempotency_key uuid,
  constraint package_uses_idem unique (package_id, idempotency_key)
);

create index if not exists package_uses_package_idx
  on public.package_uses (package_id, used_on desc);

-- ── 还剩几次 ──────────────────────────────────────────────────────────────
--
-- ⚠️ `security_invoker` —— 2026-09-01 那个读穿权限的 view 就是漏了这一句
-- （`check:isolation` 现在有一条常驻守卫在数 public 里每一个 view）。

create or replace view public.package_balance
with (security_invoker = true) as
select
  p.id as package_id,
  p.project_id,
  p.party_id,
  p.name,
  p.sessions_total,
  coalesce(u.used, 0)::integer as sessions_used,
  (p.sessions_total - coalesce(u.used, 0))::integer as sessions_left,
  p.sold_on,
  p.expires_on,
  /* 过期是日历的事实，不是一个要有人去维护的旗子。 */
  (p.expires_on is not null and p.expires_on < public.today_myt()) as expired,
  p.archived_at
from public.service_packages p
left join lateral (
  select count(*)::integer as used from public.package_uses x where x.package_id = p.id
) u on true;

comment on view public.package_balance is
  'Sessions left is total minus the rows in package_uses -- computed at read time, so there is no stored figure to drift. `expired` is worked out from the date for the same reason. See 20260904190000.';

-- ── 谁看得到 ──────────────────────────────────────────────────────────────
--
-- `works_here`：一个师傅要跟客人讲「你还剩三次」。价钱不在这张表上，
-- 所以这不是把钱交出去。

alter table public.service_packages enable row level security;
alter table public.package_uses enable row level security;

drop policy if exists "service_packages_own" on public.service_packages;
create policy "service_packages_own" on public.service_packages
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

drop policy if exists "package_uses_own" on public.package_uses;
create policy "package_uses_own" on public.package_uses
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

-- ── 挂对公司 ──────────────────────────────────────────────────────────────

create or replace function public.service_packages_own_project()
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
  /* 🔴 套票是卖给**客人**的。挂在供应商或师傅身上的套票，在画面上完全正常，
     而它会让「他还剩几次」出现在一个永远不会来消费的人身上。 */
  if the_module <> 'customers' then
    raise exception 'a package belongs to a customer';
  end if;
  if new.project_id is distinct from owner_project then
    new.project_id := owner_project;
  end if;
  if new.expires_on is not null and new.expires_on < new.sold_on then
    raise exception 'it cannot expire before it was sold';
  end if;
  return new;
end;
$$;

drop trigger if exists service_packages_own_project_trg on public.service_packages;
create trigger service_packages_own_project_trg
  before insert or update on public.service_packages
  for each row execute function public.service_packages_own_project();

create or replace function public.package_uses_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from public.service_packages where id = new.package_id;
  if owner_project is null then
    raise exception 'no such package';
  end if;
  new.project_id := owner_project;

  if new.staff_id is not null then
    perform 1 from public.directory_entries
      where id = new.staff_id and project_id = owner_project and module_key = 'staff';
    if not found then
      raise exception 'that person is not a staff member in this project';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists package_uses_own_project_trg on public.package_uses;
create trigger package_uses_own_project_trg
  before insert or update on public.package_uses
  for each row execute function public.package_uses_own_project();

-- ── 卖一张 ────────────────────────────────────────────────────────────────

create or replace function public.add_service_package(
  in_party_id uuid,
  in_name text,
  in_sessions_total integer,
  in_sold_on date default null,
  in_expires_on date default null,
  in_entry_id uuid default null,
  in_note text default '',
  in_branch_id uuid default null,
  in_idempotency_key uuid default null
)
returns public.service_packages
language plpgsql
security definer
set search_path = public
as $$
declare
  their_project uuid;
  row public.service_packages;
begin
  select project_id into their_project
  from public.directory_entries where id = in_party_id;
  if their_project is null or not public.works_here(their_project) then
    raise exception 'no such person in your project';
  end if;

  if in_idempotency_key is not null then
    select * into row from public.service_packages
    where project_id = their_project and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  if btrim(coalesce(in_name, '')) = '' then
    raise exception 'give the package a name';
  end if;
  if coalesce(in_sessions_total, 0) <= 0 then
    raise exception 'how many sessions does it cover?';
  end if;
  if not public.branch_is_ours(their_project, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;
  if in_entry_id is not null then
    perform 1 from public.ledger_entries
      where id = in_entry_id and project_id = their_project;
    if not found then
      raise exception 'that payment is not in this project';
    end if;
  end if;

  insert into public.service_packages (
    project_id, party_id, name, sessions_total, sold_on, expires_on,
    entry_id, note, branch_id, created_by, idempotency_key
  ) values (
    their_project,
    in_party_id,
    left(btrim(in_name), 120),
    in_sessions_total,
    coalesce(in_sold_on, public.today_myt()),
    in_expires_on,
    in_entry_id,
    left(coalesce(in_note, ''), 2000),
    in_branch_id,
    auth.uid(),
    in_idempotency_key
  )
  returning * into row;

  return row;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row from public.service_packages
      where project_id = their_project and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise;
end;
$$;

revoke execute on function public.add_service_package(uuid, text, integer, date, date, uuid, text, uuid, uuid) from public, anon;
grant execute on function public.add_service_package(uuid, text, integer, date, date, uuid, text, uuid, uuid) to authenticated;

-- ── 用掉一次 ──────────────────────────────────────────────────────────────
--
-- 🔴 **剩几次在资料库里算**，不在浏览器里算。
-- 两个前台同时替同一个客人打卡，两边都读到「还剩 1 次」、两边都送出，
-- 那张卖十次的套票会被用掉十一次。20260904050000（盘点）学过同一条。

create or replace function public.use_package_session(
  in_package_id uuid,
  in_used_on date default null,
  in_staff_id uuid default null,
  in_note text default '',
  in_idempotency_key uuid default null
)
returns public.package_uses
language plpgsql
security definer
set search_path = public
as $$
declare
  pack public.service_packages;
  left_now integer;
  row public.package_uses;
begin
  /* `for update` 锁住那一张套票，所以同一瞬间的第二次要排队等它 ——
     而不是两个都读到同一个「还剩 1」。 */
  select * into pack from public.service_packages
   where id = in_package_id for update;
  if not found or not public.works_here(pack.project_id) then
    raise exception 'no such package in your project';
  end if;
  if pack.archived_at is not null then
    raise exception 'that package is put away';
  end if;

  if in_idempotency_key is not null then
    select * into row from public.package_uses
    where package_id = in_package_id and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  select pack.sessions_total - count(*)::integer into left_now
  from public.package_uses where package_id = in_package_id;

  if left_now <= 0 then
    raise exception 'that package is used up -- sell a new one';
  end if;

  /* ⚠️ **过期不挡**，跟报价单过期同一条（20260903010000）：
     过期是日历的事实，通不通融是老板的判断，而一间沙龙常常通融。
     画面上会讲「过期了」，然后让他自己决定。 */

  insert into public.package_uses (
    package_id, project_id, used_on, staff_id, note, recorded_by, idempotency_key
  ) values (
    in_package_id,
    pack.project_id,
    coalesce(in_used_on, public.today_myt()),
    in_staff_id,
    left(coalesce(in_note, ''), 500),
    auth.uid(),
    in_idempotency_key
  )
  returning * into row;

  return row;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row from public.package_uses
      where package_id = in_package_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise;
end;
$$;

revoke execute on function public.use_package_session(uuid, date, uuid, text, uuid) from public, anon;
grant execute on function public.use_package_session(uuid, date, uuid, text, uuid) to authenticated;

-- ── 打错了要退得回来 ──────────────────────────────────────────────────────
--
-- 一次打卡不是一笔钱，所以它不用开冲正 —— 删掉那一行就好。
-- （钱那一边永远不删，只开反向的一笔；那条规矩没有变。）

create or replace function public.undo_package_use(in_use_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  which uuid;
begin
  select project_id into which from public.package_uses where id = in_use_id;
  if which is null or not public.works_here(which) then
    raise exception 'no such entry in your project';
  end if;
  delete from public.package_uses where id = in_use_id;
  return true;
end;
$$;

revoke execute on function public.undo_package_use(uuid) from public, anon;
grant execute on function public.undo_package_use(uuid) to authenticated;

-- ── 收起来 ────────────────────────────────────────────────────────────────

create or replace function public.set_package_archived(
  in_id uuid,
  in_archived boolean default true
)
returns public.service_packages
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.service_packages;
begin
  select * into row from public.service_packages where id = in_id;
  if not found or not public.works_here(row.project_id) then
    raise exception 'no such package in your project';
  end if;
  update public.service_packages
     set archived_at = case when in_archived then now() else null end
   where id = in_id
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.set_package_archived(uuid, boolean) from public, anon;
grant execute on function public.set_package_archived(uuid, boolean) to authenticated;

/* ⚠️ 这一支**还不是什么**，自己讲清楚：
   · 没有「一张套票能做哪几种服务」—— 一张套票就是 N 次，做什么由他招呼
   · 没有跟预约接起来 —— 客人来了要有人按一下「用掉一次」，
     而不是订了位就自动扣。**订位不是来过**，那是 no-show 的来源
   · 没有自动跟催快到期的 —— 那要一条发得出去的讯息，而号码还是占位符 */
