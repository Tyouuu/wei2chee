-- 一个班十个学生，一次开十张学费单。
--
-- ── 他今天要按几次 ────────────────────────────────────────────────────────
--
-- [任务 239] 走完一间补习中心之后写着「**学费不在这里** —— 那在收款那一边；
-- 一个班收多少钱还没有连起来」。而实际上是这样：
-- 一间十个学生的补习中心，每个月开十张单 = **十次**，而十次里
-- 每一次他打的字一模一样（同一个金额、同一个到期日、同一个抬头）。
-- [重点 29](docs/founder-points.md)：**那不是十个输入，那是一次抄写。**
--
-- ── 读别人真的表（[重点 26]）───────────────────────────────────────────────
--
-- `frappe/education` 三份 doctype 的原文：
--
--   Fees           46 栏 · 必填 8（student · company · posting_date · due_date ·
--                  **program_enrollment** · **fee_structure** · components ·
--                  receivable_account）
--   Fee Structure  19 栏 · 必填 4（program · academic_year · components ·
--                  receivable_account）
--   🔴 Fee Schedule 35 栏 · 必填 5（fee_structure · due_date · academic_year ·
--                  **student_groups** · posting_date）
--
-- **Fee Schedule 就是这一件** —— 拿一份费率表加一份学生名单，一次开出全部。
--
-- ── 抄一样，不抄五样（[重点 7d-2]：读完之后挑最简单那一版）────────────────
--
-- | 抄 | 不抄，为什么 |
-- |---|---|
-- | **一个班一次开一整批**（Fee Schedule 的核心） | **学年 · 学期 · 课程 · 学籍 · 费率表** —— 五样，而**五样都是他开第一张单之前要先填完的表**。一间怡保的补习中心一样都没有 |
-- | **一个到期日**（他们必填，对的：学费有期限） | `receivable_account` · `cost_center` · `currency` —— 会计那一层 |
-- | | `components` 子表（学费 · 教材费 · 冷气费分行）—— 那是 `record_lines`，已经有了 |
-- | | `send_email` —— 卡讯息管道（[任务 11]） |
--
-- 🔴 **而金额是他在开的那一刻讲的，不建费率表。** 一张费率表要他先想
-- 「哪一个课程 · 哪一个学年 · 哪一类学生」——而下一次「照上次那一张」
-- （[任务 150] 那三支）本来就会把上一次的金额递给他。
--
-- ── 🔴 一个班一个月只准开一次，而这一条 ERPNext 没有 ──────────────────────
--
-- 他们靠 Fee Schedule 自己的 status 挡。而一间补习中心**每个月开一次**，
-- 而他在手机上按两下就是**每个学生两张单** —— 而那会让「谁还没交」全部错，
-- 那正是这一整支要答的那一句。
--
-- 所以钥匙是 `md5(班 || 那个月 || 学生)` —— 抄 `log_service_visit`
-- （20260905220000）那一支的形状，**而且走的是 `add_pipeline_record` 自己的
-- 幂等，不另开一张「开过了没有」的表**（[重点 23]）。
--
-- 🔴 **而它顺手答对一件我没有特地写的**：一个**九月十号插班**的学生 ——
-- 再按一次，前十个人拿回同一张单（钥匙一样），**而他拿到一张新的**。
-- 那是幂等钥匙买到的，不是一段逻辑。
--
-- ── 三个判断 ──────────────────────────────────────────────────────────────
--
-- 1. **走了的学生不开单**（`left_on is not null`）—— 而他照旧留在名册上
--    （[任务 223]：「走了不删，他上过我们的课是真的」）
-- 2. **一个学生都没有 → 回 0，不抛** —— 一个空的班不是一个错
-- 3. 🔴 **`works_here`，跟 `add_pipeline_record` 一致** —— 一张学费单的总额
--    师傅本来就看得到（[任务 117]）。**一个页面挡得比它底下那几支函式还严，
--    就是在替资料库发明一条它没有的规矩。**

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
    select m.party_id, d.name
    from public.class_members m
    join public.directory_entries d on d.id = m.party_id
    where m.group_id = in_group_id
      and m.left_on is null
      and d.archived_at is null
    order by d.name
  loop
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
      in_amount_cents => in_amount_cents,
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
      sum_cents := sum_cents + in_amount_cents;
    end if;
  end loop;

  /* 走了的那几个 —— 印出来，不要静静少掉几张。 */
  select count(*) into n_skip
  from public.class_members m
  where m.group_id = in_group_id and m.left_on is not null;

  return query select n_made, n_again, n_skip, sum_cents, tag;
end;
$$;

revoke execute on function public.bill_class(uuid, text, bigint, text, date, date, text)
  from public, anon;
grant execute on function public.bill_class(uuid, text, bigint, text, date, date, text)
  to authenticated;

comment on function public.bill_class(uuid, text, bigint, text, date, date, text) is
  'Open one document per student in a class, in a single press. Goes through add_pipeline_record -- the same function his own button calls -- so numbering, stage, party linking and duplicate protection are identical. The idempotency key is (class, period, student), so pressing it twice bills nobody twice while a student who joined mid-month still gets his. See 20260909170000.';

-- ── 谁还没交 ──────────────────────────────────────────────────────────────
--
-- 🔴 **这一支不重算「他欠多少」** —— `party_debts`（20260904060000）已经在答
-- 那一句，而在这里再算一次就是同一个问题两个答案（这个仓库栽过至少八次）。
-- 它只做一件 `party_debts` 做不到的事：**按班分组**。

create or replace function public.class_fees_due(
  in_group_id uuid,
  in_period text default null
)
returns table (
  party_id uuid,
  student text,
  record_id uuid,
  doc_no text,
  amount_cents bigint,
  paid_cents bigint,
  owed_cents bigint,
  due_on date
)
language plpgsql
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

  return query
  select
    d.id,
    d.name,
    r.id,
    r.doc_no,
    coalesce(r.amount_cents, 0)::bigint,
    coalesce(paid.cents, 0)::bigint,
    (coalesce(r.amount_cents, 0) - coalesce(paid.cents, 0))::bigint,
    r.due_on
  from public.class_members m
  join public.directory_entries d on d.id = m.party_id
  join public.pipeline_records r
    on r.project_id = grp.project_id
   and r.party_id = m.party_id
   and r.archived_at is null
   and r.idempotency_key = md5(
         in_group_id::text
         || coalesce(nullif(btrim(in_period), ''), to_char(public.today_myt(), 'YYYY-MM'))
         || m.party_id::text
       )::uuid
  left join lateral (
    /* 收到多少 —— 走**分摊**那张表，跟「谁欠我钱」同一个来源。
       ⚠️ 冲正过的那一笔不算（`adjusts_id` 那一条），
       所以这里跟 party_debts 给的是同一个答案。 */
    select sum(a.amount_cents) as cents
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where a.record_id = r.id
      and e.adjusts_id is null
      and not exists (
        select 1 from public.ledger_entries rev where rev.adjusts_id = e.id
      )
  ) paid on true
  where m.left_on is null
  order by (coalesce(r.amount_cents, 0) - coalesce(paid.cents, 0)) desc, d.name;
end;
$$;

revoke execute on function public.class_fees_due(uuid, text) from public, anon;
grant execute on function public.class_fees_due(uuid, text) to authenticated;

comment on function public.class_fees_due(uuid, text) is
  'One row per student in a class for one billing period: what was billed, what came in, what is still owed. Reads the same allocation table party_debts reads, so the two never disagree. See 20260909170000.';

-- ── 它还不是什么 ──────────────────────────────────────────────────────────
--
-- · **画面上没有那颗按钮** —— 两支通了，而他今天点不到
-- · **一个班一个金额** —— 一个学生半价（兄弟姐妹折扣）今天要单独开一张
-- · **不做费率表** —— 上面写了为什么
-- · **不发出去** —— 卡讯息管道（[任务 11]）
