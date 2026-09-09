-- 把 20260909180000 弄坏的那一段搬回去。
--
-- ⚠️ **原样从 20260909170000 抽出来**，不是照记忆重打 ——
-- [重点 31] 第 1 条：整支重写咬过三次，每一次都是漏掉一段守卫，
-- 而画面上看不出来。
--
-- 弄坏那一版红出来的（`check:class-fees`）：
--   FAIL  开了四张 — {made:1, again:3}
--   FAIL  一共 RM 720 — 18000
--   FAIL  资料库里真的有四张 — 1
-- 也就是四个学生里三个的学费单从来没有存在过。

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
