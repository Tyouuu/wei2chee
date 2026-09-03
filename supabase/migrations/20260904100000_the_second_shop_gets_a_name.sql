-- 第二间店。
--
-- ── 这根柱子 2026-08-30 就立了，而它到今天还是空的 ──────────────────────
--
-- `pipeline_records.branch_id` · `ledger_entries.branch_id` ·
-- `directory_entries.branch_id` · `stock_moves.branch_id` —— 四张表都有，
-- 而**每一行都是 null**，因为没有任何东西可以填进去。
--
-- 那几栏的注解自己写着为什么先立：
--   「retrofitting means DECIDING which branch each old row was for,
--     and nobody can answer that afterwards.」
--
-- **这一支就是把它填得起来那一步** —— 而它的价值正是那句话：
-- 从今天写进去的每一行都带着真相，而昨天的那些永远补不回来。
--
-- ── 为什么是三个行业的刚需 ────────────────────────────────────────────────
--
-- [任务 67] 实查：**Tunai · Aoikumo · StoreHub 三家马来西亚的对手
-- 全部按分店收费** —— 那不是一个功能，那是他们的定价单位。
-- 而一个市场的对手按什么收费，就是那个市场的客户有什么。
--
-- ── 抄什么 ────────────────────────────────────────────────────────────────
--
-- ERPNext 的 `Branch` doctype 只有一栏（`branch`，就是名字）；
-- 仓库、成本中心、公司那些是**另外的 doctype**，靠 Link 挂上去。
-- 那个判断是对的，而且正好是我们要的：**一间店先只是一个名字。**
--
--   ✅ 名字 · 关得掉（不删）· 一个开局的预设
--   ❌ 不抄仓库/成本中心/公司那几层 —— 我们一个客户都还没有两间店

create table if not exists public.branches (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects(id) on delete cascade,

  /* 他自己的话：「Puchong 店」「总店」「二号车」。 */
  name text not null,

  /* 关掉的店留着，不删 —— 去年那一间店做过的每一单还挂在它身上，
     而删掉它等於让那些单指向一个没有名字的地方。
     跟 `archived_at` 同一条判断。 */
  active boolean not null default true,

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint branches_name_not_blank check (btrim(name) <> ''),
  /* 两间同名的店不是两间店，是一次打错。 */
  constraint branches_name_unique unique (project_id, name)
);

comment on table public.branches is
  'One outlet. A branch is a name and nothing else -- ERPNext''s Branch doctype has exactly one field too. The four branch_id columns have existed since 2026-08-30 and were null everywhere because nothing could fill them; this is that step. See 20260904100000.';

create index if not exists branches_project_idx
  on public.branches (project_id, sort_order) where active;

alter table public.branches enable row level security;

/* `works_here`：师傅要知道自己在哪一间店上工。 */
drop policy if exists "branches_members" on public.branches;
create policy "branches_members" on public.branches
  for select using (public.works_here(project_id));

/* 🔴 而**只有老板开得了店**。多一间店在这个市场是多一份月费
   （Tunai · Aoikumo · StoreHub 三家都按店收），所以那是老板的决定。 */
drop policy if exists "branches_owner_writes" on public.branches;
create policy "branches_owner_writes" on public.branches
  for all using (public.sees_money(project_id)) with check (public.sees_money(project_id));

create or replace function public.add_branch(
  in_project_id uuid,
  in_name text
)
returns public.branches
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.branches;
  next_order integer;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'only the owner opens a branch';
  end if;

  if coalesce(btrim(in_name), '') = '' then
    raise exception 'a branch needs a name';
  end if;

  /* 二十间店是一条连锁，而那是另一个产品。 */
  if (select count(*) from public.branches where project_id = in_project_id) >= 20 then
    raise exception 'that is more branches than this is built for';
  end if;

  select coalesce(max(sort_order), -1) + 1 into next_order
  from public.branches where project_id = in_project_id;

  insert into public.branches (project_id, name, sort_order)
  values (in_project_id, left(btrim(in_name), 80), next_order)
  returning * into row;

  return row;

exception
  /* 他打了两次同一个名字 —— 拿回原本那一间，不是报一个错。 */
  when unique_violation then
    select * into row from public.branches
    where project_id = in_project_id and name = left(btrim(in_name), 80);
    if found then
      return row;
    end if;
    raise;
end;
$$;

create or replace function public.set_branch_active(
  in_id uuid,
  in_active boolean
)
returns public.branches
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.branches;
begin
  update public.branches b
     set active = in_active, updated_at = now()
   where b.id = in_id and public.sees_money(b.project_id)
  returning * into row;
  if not found then
    raise exception 'no such branch in your project';
  end if;
  return row;
end;
$$;

revoke execute on function public.add_branch(uuid, text) from public, anon;
grant execute on function public.add_branch(uuid, text) to authenticated;
revoke execute on function public.set_branch_active(uuid, boolean) from public, anon;
grant execute on function public.set_branch_active(uuid, boolean) to authenticated;

-- ── 那四栏从今天起填得进去 ────────────────────────────────────────────────
--
-- ⚠️ **每一支写入函式都要收它**，而不是只收一支。
-- 只在报价单上填得了分店、收款填不了，就是他月底问「Puchong 收了多少」
-- 的时候答不出来 —— 而那正好是他开第二间店的唯一理由。
--
-- ⚠️ 而且**都是可选的**：一间店的生意占我们客户的绝大多数，
-- 而一个逼他每一单都挑分店的表单，会让他不用这个系统。

create or replace function public.branch_is_ours(in_project_id uuid, in_branch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select in_branch_id is null
      or exists (
        select 1 from public.branches b
        where b.id = in_branch_id and b.project_id = in_project_id
      );
$$;

revoke execute on function public.branch_is_ours(uuid, uuid) from public, anon;
grant execute on function public.branch_is_ours(uuid, uuid) to authenticated;

comment on function public.branch_is_ours(uuid, uuid) is
  'True when the branch belongs to that project, or when none was given. Every write that accepts a branch asks this -- another business''s outlet on your row looks completely normal on screen.';
