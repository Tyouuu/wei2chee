-- 把 20260910140000 拿掉的那一句搬回去。
--
-- ⚠️ **原样从 20260910130000 抽出来**（[重点 31] 第 1 条）。
--
-- 弄坏那一版红出来的（`check:family`）：
--   FAIL  🔴 而三张都算在**妈妈**头上
--   FAIL  🔴 名单上只有一个欠款人

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
