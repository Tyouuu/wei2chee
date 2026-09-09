-- 一个班一个价钱，而**一个学生可以有他自己的价钱** —— 兄弟姐妹折扣。
--
-- ── 为什么（[任务 324](../docs/founder-tasks.md#324) 自己留下的那一行）──────
--
-- `bill_class`（20260909170000）一次开十张，十张同一个数字。而一间怡保的
-- 补习中心，**第二个孩子九折**几乎是默认的；一个老师的孩子不收钱也是常有的。
-- 今天她要做的是：把那两个学生从那一按里漏掉，然后一个一个手开 ——
-- 也就是「一次开完」那件事对她**不成立**。
--
-- ── 🔴 加一栏，不是加一张表 ───────────────────────────────────────────────
--
-- 最想当然的做法是做一张「收费办法」表（ERPNext 的 `Fee Structure` 19 栏 ·
-- `Fee Category`）。**不做**（[重点 7d-2](../docs/founder-points.md)：
-- 要找更简单的那一个做法）—— 那是给有学年 · 学期 · 课程 · 学籍的学校用的，
-- 而这里真正的问题只有一句：**这个学生这个月交多少。**
-- 那是**这个学生在这个班的那一行上的一个数字**。
--
--   `class_members.fee_cents`   null = 跟班上那个价钱走
--                               一个数字 = 他自己的价钱
--                               0 = 这个月不收他的钱
--
-- 🔴 **null 跟 0 是两句话，不可以混。** 一个没有讲过的价钱（跟班走），
-- 跟一个讲过「这个不收钱」的价钱，在一张开出去的单上差一整笔钱。
--
-- ── 🔴 改价钱不会改已经开出去的单 ─────────────────────────────────────────
--
-- 她把某个学生改成九折之后再按一次，那一张**已经开出去的单不会变** ——
-- `add_pipeline_record` 的幂等把第一张还回来。**那是对的**：
-- 单已经给了家长，系统偷偷改掉它上面的数字比不改更糟。
-- 要改就是改那一张单（`update_pipeline_record`），而那是她按的另一颗按钮。
--
-- ── 谁改得了 ──────────────────────────────────────────────────────────────
--
-- `set_class_fee` 是 **`sees_money`** —— 跟 `set_commission_tiers`
-- （20260905640000）同一条：**定价是老板的事**。
-- ⚠️ 而 `bill_class` 照旧 `works_here`，故意的：它底下走的
-- `add_pipeline_record` 就是 `works_here`，而一个函式挡得比它底下那一支还严，
-- 就是在替资料库发明一条它没有的规矩（20260909200000 立过这一条）。

alter table public.class_members
  add column if not exists fee_cents bigint;

do $do$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'class_members_fee_not_negative'
  ) then
    alter table public.class_members
      add constraint class_members_fee_not_negative
      check (fee_cents is null or fee_cents >= 0);
  end if;
end
$do$;

comment on column public.class_members.fee_cents is
  'What this one student pays for this class. NULL means the class price given at billing time; 0 means bill nothing this round. NULL and 0 are different sentences. See 20260909270000.';

-- ── 改一个学生的价钱 ──────────────────────────────────────────────────────

create or replace function public.set_class_fee(
  in_group_id uuid,
  in_party_id uuid,
  /* 不给（null）＝ 把他放回班上那个价钱。**清掉跟设成 0 是两件事**，
     所以清掉走这个预设，设成 0 要他真的传一个 0。 */
  in_amount_cents bigint default null
)
returns public.class_members
language plpgsql
security definer
set search_path = public
as $$
declare
  grp public.class_groups;
  row public.class_members;
begin
  select * into grp from public.class_groups where id = in_group_id;
  if grp.id is null or not public.works_here(grp.project_id) then
    raise exception 'no such class in your business';
  end if;
  if not public.sees_money(grp.project_id) then
    raise exception 'what a student pays is for the owner';
  end if;
  if in_amount_cents is not null and in_amount_cents < 0 then
    raise exception 'a fee cannot be less than nothing';
  end if;

  update public.class_members
     set fee_cents = in_amount_cents
   where group_id = in_group_id and party_id = in_party_id
  returning * into row;
  if row.id is null then
    raise exception 'that student is not in this class';
  end if;
  return row;
end;
$$;

revoke execute on function public.set_class_fee(uuid, uuid, bigint) from public, anon;
grant execute on function public.set_class_fee(uuid, uuid, bigint) to authenticated;

comment on function public.set_class_fee(uuid, uuid, bigint) is
  'One student''s own price in one class. Passing nothing clears it back to the class price -- clearing and setting zero are different acts. sees_money, like set_commission_tiers: pricing is the owner''s. See 20260909270000.';

-- ── 谁在班价上，谁不在 ────────────────────────────────────────────────────

create or replace function public.class_fees_of(in_group_id uuid)
returns table (
  party_id uuid,
  student text,
  fee_cents bigint,
  on_class_price boolean
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  grp public.class_groups;
begin
  select * into grp from public.class_groups where id = in_group_id;
  if grp.id is null or not public.works_here(grp.project_id) then
    raise exception 'no such class in your business';
  end if;
  /* 🔴 跟 `class_fees_due`（20260909200000）同一条，理由也一样：
     它讲的是钱，而一个老师不该读得到谁交多少。 */
  if not public.sees_money(grp.project_id) then
    raise exception 'what the students pay is for the owner';
  end if;

  return query
  select d.id, d.name, m.fee_cents, m.fee_cents is null
    from public.class_members m
    join public.directory_entries d on d.id = m.party_id
   where m.group_id = in_group_id and m.left_on is null
   order by m.fee_cents nulls last, d.name;
end;
$$;

revoke execute on function public.class_fees_of(uuid) from public, anon;
grant execute on function public.class_fees_of(uuid) to authenticated;

comment on function public.class_fees_of(uuid) is
  'Who in this class is on the class price and who is on their own. Owner only. See 20260909270000.';

-- ── 一次开十张，而其中两张是别的数字 ──────────────────────────────────────
--
-- ⚠️ **先 drop** —— 回传多了一栏（`free`），而多一个栏位对呼叫端相容、
-- 对资料库不相容（[重点 31] 第 2 条：加了不 drop，那支函式整个选不到，
-- 而画面上跟「功能坏了」一模一样）。

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
    select m.party_id, d.name, m.fee_cents
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
      in_party => coalesce(who.name, ''),
      in_amount_cents => owe,
      in_issued_on => on_day,
      in_due_on => in_due_on,
      in_idempotency_key =>
        md5(in_group_id::text || tag || who.party_id::text)::uuid,
      in_party_id => who.party_id
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

comment on function public.bill_class(uuid, text, bigint, text, date, date, text) is
  'Opens one bill per student in a class for one period, at the class price or, where one is set, that student''s own (20260909270000). Idempotent on (class, period, student), so a second press changes nothing and says so. A student on zero gets no bill and is counted under free.';
