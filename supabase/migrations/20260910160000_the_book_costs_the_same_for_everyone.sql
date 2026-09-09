-- 教材费那一轮，大家一样价 —— `bill_class` 多一个开关。
--
-- ── 量出来的，不是想出来的（2026-09-10）──────────────────────────────────
--
-- `class_members.fee_cents`（20260909270000）叫「这个学生自己的价钱」，
-- 而它今天**套在每一轮上**。月费那一轮那是对的；
-- 而教材费 · 报名费那几轮**不是** ——
--
--   一个学费九折的学生（RM 162），按下「教材费 RM 80」那一下，
--   开出来的是 **RM 162**。而那是一个**没有人讲过的价钱**。
--
-- 🔴 **这一条是写尺子的时候撞到的**：我在 `check:class-fees` 加第 ⑫ 段，
-- 想证明「教材费用同一按就做得到」，第一次跑的读数就把它掀出来了。
--
-- ── 🔴 而做法是给她一个开关，不是替她猜 ──────────────────────────────────
--
-- 想当然的修法是「`in_period` 看起来像月份的时候才用学生自己的价」——
-- **那是发明一条她没有讲过的规矩**（[重点 34](../docs/founder-points.md)）。
--
-- 所以是一个开关，而且**预设保持今天的行为**：
--
--     in_use_own_fee = true   月费 —— 兄弟姐妹折扣照算（预设）
--     in_use_own_fee = false  教材费 · 报名费 —— 大家一样价
--
-- ⚠️ 那个「不收钱」的学生（`fee_cents = 0`）在 false 那一轮**照样会被开单** ——
-- 故意的：一个学费全免的孩子照样要买课本，而**那是她的决定，不是我们的**。
-- 她真的不想收，把那一轮的金额讲成 0 就好。
--
-- ⚠️ **先 drop** —— 签名多了一个参数（[重点 31] 第 2 条：加了不 drop，
-- 那支函式整个选不到，而画面上跟「功能坏了」一模一样）。

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
  in_period text default null,
  /* 🔴 这一轮要不要用「这个学生自己的价钱」。
     **预设是要** —— 今天每一个呼叫端一个字都不用改，而月费本来就该用。
     开给教材费 · 报名费那一轮的时候传 false：那几笔大家一样价。 */
  in_use_own_fee boolean default true
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
    /* 🔴 20260910160000：只有这一轮**跟着学生走**的时候才用他自己的价。
       ⚠️ 少了这个开关，一个学费九折（RM 162）的学生，
       **教材费也会被开成 RM 162** —— 而那是一个没有人讲过的价钱。
       量出来的：`check:class-fees` 第 ⑫ 段第一次跑就撞到。 */
    owe := case when coalesce(in_use_own_fee, true)
                then coalesce(who.fee_cents, in_amount_cents)
                else in_amount_cents end;
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

revoke execute on function public.bill_class(uuid, text, bigint, text, date, date, text, boolean)
  from public, anon;
grant execute on function public.bill_class(uuid, text, bigint, text, date, date, text, boolean)
  to authenticated;

comment on function public.bill_class(uuid, text, bigint, text, date, date, text, boolean) is
  'Opens one bill per student for one round. The round is any word he likes, so 2026-09 is a month and 2026-teaching-materials is a one-off, both idempotent. in_use_own_fee is TRUE by default so monthly fees keep the sibling discount; pass FALSE for a one-off where everybody pays the same, because a student on a discounted monthly rate must not be billed that rate for a book. See 20260910160000.';
