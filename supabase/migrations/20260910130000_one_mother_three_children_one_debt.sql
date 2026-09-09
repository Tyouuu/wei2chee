-- 一个家长，三个孩子，一笔钱 —— **加一栏，不是加一张「家庭」表**。
--
-- ── 为什么（2026-09-10 深度研究，[任务 341](../docs/founder-tasks.md#341)）────
--
-- Jackrabbit **整个资料模型是「家庭」**：`Family Fixed Fees`、报名费可以
-- `Per Family… with optional family maximum`、上课时数可以按 `By family` 算。
-- 而马来西亚的补习中心就是靠兄弟姐妹撑的 —— 折扣本身就是留客的招。
--
-- 今天我们是**三个客户 · 三张单 · 三条连结**，妈妈付一笔钱要手工拆成三份，
-- 而帐龄上一个欠 RM 480 的家庭长成**三个不相干的欠款人**。
--
-- ── 🔴 而我们只加一栏 ────────────────────────────────────────────────────
--
-- [重点 34](../docs/founder-points.md)：**手写簿上有没有这一格。**
-- 有 —— 收据上写妈妈的名字，底下列三个孩子。那是**一个指向**，不是一张新表。
--
--     directory_entries.billed_to_id  →  这个学生的单，算在谁头上
--
-- 空 = 算他自己（一个成年学生自己付钱，那是真的）。
--
-- **不做的**：
--   · **不做一张 `families` 表** —— 那要「谁是户长」「谁属於哪一户」两层，
--     而它答的问题跟一个指向一模一样
--   · **不把三张单併成一张** —— 一个学生一张单，是因为
--     **兄弟姐妹折扣是一个学生一个价**（20260909270000），
--     併成一张之后那个价没有地方站。而妈妈手上那一笔钱照样付得了三张：
--     分摊那一支（`set_payment_allocations`）从一开始就是一笔对多张
--   · **不自动算折扣** —— 「第二个孩子九折」的「第二个」怎么数（按入学先后？
--     按年龄？）是他的规矩。这一栏让系统**知道他们是一家人**，
--     等他讲了规矩，算出来那一步才有地方站
--
-- ── 谁改得了 ──────────────────────────────────────────────────────────────
--
-- `works_here` —— **收学生的时候顺手填的那一格**，柜台每天在做。
-- ⚠️ 它会改「谁欠钱」，所以看起来像钱那一层；而它记的是
-- **一个家庭关系**，不是一个金额。填错了改回来就好，没有任何一笔钱会动。

alter table public.directory_entries
  add column if not exists billed_to_id uuid
    references public.directory_entries(id) on delete set null;

create index if not exists directory_billed_to
  on public.directory_entries (billed_to_id)
  where billed_to_id is not null;

comment on column public.directory_entries.billed_to_id is
  'Who gets this person''s bills. NULL means they get their own. One pointer instead of a family table: it answers the same question, and the sibling fee still lives per student where the discount can stand. See 20260910130000.';

-- ── 这个学生的单算在谁头上 ────────────────────────────────────────────────

create or replace function public.set_bill_payer(
  in_party_id uuid,
  /* 不给 = 算他自己。 */
  in_payer_id uuid default null
)
returns public.directory_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  who public.directory_entries;
  payer public.directory_entries;
begin
  select * into who from public.directory_entries where id = in_party_id;
  if who.id is null or not public.works_here(who.project_id) then
    raise exception 'that person is not in your directory';
  end if;

  if in_payer_id is not null then
    if in_payer_id = in_party_id then
      raise exception 'somebody cannot be billed to themselves';
    end if;
    select * into payer from public.directory_entries where id = in_payer_id;
    if payer.id is null or payer.project_id <> who.project_id then
      raise exception 'that payer is not in your directory';
    end if;
    /* 🔴 只准一层。妈妈的单算给爸爸、爸爸的算给妈妈 —— 那是一个圈，
       而一个圈上的帐永远算不完。**一层够了**：纸上也只有一层。 */
    if payer.billed_to_id is not null then
      raise exception 'that payer is already billed to somebody else';
    end if;
    /* 反过来那一边也要挡：他已经在替别人付钱，就不可以再挂到第三个人身上。 */
    perform 1 from public.directory_entries
     where billed_to_id = in_party_id and project_id = who.project_id;
    if found then
      raise exception 'somebody is already billed to this person';
    end if;
  end if;

  update public.directory_entries
     set billed_to_id = in_payer_id
   where id = in_party_id
  returning * into who;
  return who;
end;
$$;

revoke execute on function public.set_bill_payer(uuid, uuid) from public, anon;
grant execute on function public.set_bill_payer(uuid, uuid) to authenticated;

-- ── 一家人 ────────────────────────────────────────────────────────────────

create or replace function public.family_of(in_party_id uuid)
returns table (
  party_id uuid,
  name text,
  /* 这一位是付钱的那一个吗。 */
  is_payer boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  who public.directory_entries;
  head uuid;
begin
  select * into who from public.directory_entries where id = in_party_id;
  if who.id is null or not public.works_here(who.project_id) then
    raise exception 'that person is not in your directory';
  end if;

  /* 户长 = 他自己指向的那一位，或者他自己。 */
  head := coalesce(who.billed_to_id, who.id);

  return query
  select d.id, d.name, d.id = head
    from public.directory_entries d
   where d.project_id = who.project_id
     and (d.id = head or d.billed_to_id = head)
   order by (d.id = head) desc, d.name;
end;
$$;

revoke execute on function public.family_of(uuid) from public, anon;
grant execute on function public.family_of(uuid) to authenticated;

comment on function public.family_of(uuid) is
  'The payer and everyone billed to them, from either end -- ask about a child or about the mother and get the same list. See 20260910130000.';

-- ── 开单那一支跟着改（原样切下来，两处替换）──────────────────────────────

drop function if exists public.bill_class(uuid, text, bigint, text, date, date, text);

create or replace function public.bill_class(
  in_group_id uuid,
  in_module_key text,
  in_amount_cents bigint,
  in_title text default '',
  in_issued_on date default null,
  in_due_on date default null,
  /* 那把钥匙的月份。预设是开单那一天的月 ——
     他补开八月的时候自己传 '2026-08'。 */
  in_period text default null
)
returns table (
  made integer,
  again integer,
  skipped integer,
  /* 🔴 这个月不用交的那几个（他自己的价钱是 0）。**数出来，不要静静少掉几张** ——
     一间十个学生的补习中心开出八张单，第九第十去了哪里要讲得出来。 */
  free integer,
  total_cents bigint,
  period text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  grp public.class_groups;
  who record;
  job public.pipeline_records;
  on_day date;
  tag text;
  n_made integer := 0;
  n_again integer := 0;
  n_skip integer := 0;
  n_free integer := 0;
  owe bigint;
  sum_cents bigint := 0;
  seen_before boolean;
begin
  select * into grp from public.class_groups where id = in_group_id;
  if grp.id is null or not public.works_here(grp.project_id) then
    raise exception 'no such class in your business';
  end if;
  if grp.archived_at is not null then
    raise exception 'that class is put away — take it back out first';
  end if;
  if not public.is_pipeline_module(in_module_key) then
    raise exception 'that page does not hold documents';
  end if;
  if in_amount_cents is null or in_amount_cents <= 0 then
    raise exception 'say how much each student pays';
  end if;

  on_day := coalesce(in_issued_on, public.today_myt());
  tag := coalesce(nullif(btrim(in_period), ''), to_char(on_day, 'YYYY-MM'));

  for who in
    select m.party_id, d.name, m.fee_cents, d.billed_to_id
    from public.class_members m
    join public.directory_entries d on d.id = m.party_id
    where m.group_id = in_group_id
      and m.left_on is null
      and d.archived_at is null
    order by d.name
  loop
    /* 🔴 这个学生自己的价钱（20260909270000）。
       null = 跟班上那个价钱走 —— **不是 0**，两句话不一样：
       一个没有讲过的价钱，跟一个讲过「这个不收钱」的价钱，
       在一张开出去的单上差一整笔钱。 */
    owe := coalesce(who.fee_cents, in_amount_cents);
    if owe = 0 then
      n_free := n_free + 1;
      continue;
    end if;

    /* 已经开过了没有 —— 问那张表，不猜。
       ⚠️ 这一句是**报数**用的：`add_pipeline_record` 自己会把第一张还回来，
       所以少了它照样不会开第二张，只是他分不出「开了十张」跟
       「其中八张是上次开的」。而那正好是他按第二下要读的那一句。 */
    select exists (
      select 1 from public.pipeline_records
      where project_id = grp.project_id
        and idempotency_key = md5(in_group_id::text || tag || who.party_id::text)::uuid
    ) into seen_before;

    job := public.add_pipeline_record(
      in_project_id => grp.project_id,
      in_module_key => in_module_key,
      in_title => case
        when btrim(in_title) <> '' then in_title
        else grp.name || ' · ' || tag
      end,
      /* 🔴 单上写的还是**孩子**的名字 —— 妈妈拿到手上要看得出这是哪一个。
         （`party` 是当天写下的那几个字，`party_id` 是连到谁，
         两者本来就分开：20260831080000。） */
      in_party => coalesce(who.name, ''),
      in_amount_cents => owe,
      in_issued_on => on_day,
      in_due_on => in_due_on,
      in_idempotency_key =>
        md5(in_group_id::text || tag || who.party_id::text)::uuid,
      /* 🔴 20260910130000：算在**付钱那一位**头上。没有指定就是他自己。
         少了这一句，一个欠 RM 480 的家庭在帐龄上是三个不相干的欠款人，
         而那一笔钱要手工拆成三份。 */
      in_party_id => coalesce(who.billed_to_id, who.party_id)
    );

    if seen_before then
      n_again := n_again + 1;
    else
      n_made := n_made + 1;
      sum_cents := sum_cents + owe;
    end if;
  end loop;

  /* 走了的那几个 —— 印出来，不要静静少掉几张。 */
  select count(*) into n_skip
  from public.class_members m
  where m.group_id = in_group_id and m.left_on is not null;

  return query select n_made, n_again, n_skip, n_free, sum_cents, tag;
end;
$$;

revoke execute on function public.bill_class(uuid, text, bigint, text, date, date, text)
  from public, anon;
grant execute on function public.bill_class(uuid, text, bigint, text, date, date, text)
  to authenticated;
