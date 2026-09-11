-- 沙龙「其余」清单第一件真正动手的：每日结帐对数。
--
-- 老板纠正的那一句：不是「问回来才能做」，是「先把格子做出来，
-- 格子先是空的」——查过之后这一格其实一个字都不用等他：
-- 「哪几种收款方式」不用预先定义，`ledger_entries.method` 本来就是
-- 自由文字，柜台数哪一种就问哪一种；「误差多少算正常」不是这一支
-- 要回答的问题——跟 count_stock 同一条纪律：**这一支只讲差多少，
-- 不评断差多少算正常**，那是老板自己看那个数字的判断。
--
-- 照抄 count_stock 的形状：算出系统这一天这个收款方式应该有多少
-- （收进来的减去付出去的，冲正过的不算——跟 staff_earnings 同一条），
-- 跟柜台数出来的一比，**只讲差多少，什么都不动**——不像盘点那支
-- 会真的写一笔调整；现金对不上是要柜台或者老板自己去查原因，
-- 系统没有资格替他「调整」出一个数字让帐面变平。
create table if not exists public.till_counts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  branch_id uuid references public.branches(id) on delete set null,
  counted_on date not null,
  method text not null,
  expected_cents bigint not null,
  counted_cents bigint not null,
  note text not null default '',
  created_by uuid,
  created_at timestamptz not null default now()
);

comment on table public.till_counts is
  'Append-only record of a till count -- what the system expected in a payment method that day (from ledger_entries) versus what was physically counted. Never adjusts anything; a mismatch is a fact for a human to investigate, the same posture as count_stock. See 20260911930000.';

create index if not exists till_counts_project_idx
  on public.till_counts (project_id, counted_on desc, method);

alter table public.till_counts enable row level security;

create policy "till counts are read by money-seers" on public.till_counts
  for select using (public.sees_money(project_id));

-- 🔴 没有 insert/update/delete 的 policy——跟 record_changes 同一个形状，
-- 只有底下这支 security definer 函式写得进去。

create or replace function public.count_till(
  in_project_id uuid,
  in_on date,
  in_method text,
  in_counted_cents bigint,
  in_branch_id uuid default null,
  in_note text default ''
)
returns till_counts
language plpgsql
security definer
set search_path = public
as $$
declare
  expected bigint;
  row public.till_counts;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;
  if not public.branch_is_ours(in_project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;
  if coalesce(btrim(in_method), '') = '' then
    raise exception 'say which payment method you counted';
  end if;
  if in_counted_cents is null or in_counted_cents < 0 then
    raise exception 'a count cannot be negative';
  end if;

  /* 收进来的减去付出去的，冲正过的不算——跟 staff_earnings 同一条:
     一笔退回去的钱不算真的收到过。 */
  select coalesce(sum(
           case when e.direction = 'in' then e.amount_cents else -e.amount_cents end
         ), 0)
    into expected
  from public.ledger_entries e
  where e.project_id = in_project_id
    and e.entry_on = in_on
    and lower(btrim(e.method)) = lower(btrim(in_method))
    and (in_branch_id is null or e.branch_id is not distinct from in_branch_id)
    and e.adjusts_id is null
    and not exists (select 1 from public.ledger_entries r where r.adjusts_id = e.id);

  insert into public.till_counts (
    project_id, branch_id, counted_on, method,
    expected_cents, counted_cents, note, created_by
  ) values (
    in_project_id, in_branch_id, in_on, btrim(in_method),
    expected, in_counted_cents, left(btrim(coalesce(in_note, '')), 500), auth.uid()
  )
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.count_till(uuid, date, text, bigint, uuid, text) from public;
grant execute on function public.count_till(uuid, date, text, bigint, uuid, text) to authenticated;

comment on function public.count_till(uuid, date, text, bigint, uuid, text) is
  'Records one till count: what ledger_entries says a payment method should hold that day versus what was physically counted. Does not touch any money -- a mismatch is reported, not corrected. works_here (whoever closes the till counts it), same posture as count_stock.';

/* 🔴 历史清单，给老板看有没有常常对不上——`sees_money`，
   这是管理层在看模式，不是柜台每天要做的动作。 */
create or replace function public.till_counts_of(
  in_project_id uuid,
  in_from date default null,
  in_until date default null
)
returns setof till_counts
language sql
stable
security definer
set search_path = public
as $$
  select *
  from public.till_counts t
  where t.project_id = in_project_id
    and public.sees_money(in_project_id)
    and (in_from is null or t.counted_on >= in_from)
    and (in_until is null or t.counted_on <= in_until)
  order by t.counted_on desc, t.created_at desc;
$$;

revoke execute on function public.till_counts_of(uuid, date, date) from public;
grant execute on function public.till_counts_of(uuid, date, date) to authenticated;
