-- bill_class 回开出来那几张的编号了——[任务 347] 登记过的那一格。
--
-- ── 为什么（[任务 347]：`bill_class` 回开出来那几张的编号）───────────────
--
-- 一按开全班学费单（20260910160000），今天只回得出「开了几张、总共多少」——
-- 一句摘要，不是那几张单的编号。所以按错了想撤销，或者事后想核对
-- 「这一轮到底是哪十张」，答不出来。
--
-- ── 只加一栏，回圈本身一个字不动（[重点 31] 第 1 条）───────────────────
--
-- `made_ids uuid[]`，只收**这一轮真的新开的**那几张——已经开过的
-- （`again`）不放进去，因为撤销要撤的是这一轮的动作，不是历史。
-- `returns table` 的形状变了，照[重点 31] 第 2 条先 drop 旧的签名再重建。

drop function if exists public.bill_class(uuid, text, bigint, text, date, date, text, boolean);

create or replace function public.bill_class(
  in_group_id uuid,
  in_module_key text,
  in_amount_cents bigint,
  in_title text default '',
  in_issued_on date default null,
  in_due_on date default null,
  in_period text default null,
  in_use_own_fee boolean default true
)
returns table (
  made integer,
  again integer,
  skipped integer,
  free integer,
  total_cents bigint,
  period text,
  -- 🔴 新加的一栏：这一轮真的新开的那几张单的编号。
  made_ids uuid[]
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
  new_ids uuid[] := '{}';
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
    owe := case when coalesce(in_use_own_fee, true)
                then coalesce(who.fee_cents, in_amount_cents)
                else in_amount_cents end;
    if owe = 0 then
      n_free := n_free + 1;
      continue;
    end if;

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
      in_party_id => coalesce(who.billed_to_id, who.party_id)
    );

    if seen_before then
      n_again := n_again + 1;
    else
      n_made := n_made + 1;
      sum_cents := sum_cents + owe;
      new_ids := new_ids || job.id;
    end if;
  end loop;

  select count(*) into n_skip
  from public.class_members m
  where m.group_id = in_group_id and m.left_on is not null;

  return query select n_made, n_again, n_skip, n_free, sum_cents, tag, new_ids;
end;
$$;

revoke execute on function public.bill_class(uuid, text, bigint, text, date, date, text, boolean)
  from public, anon;
grant execute on function public.bill_class(uuid, text, bigint, text, date, date, text, boolean)
  to authenticated;

comment on function public.bill_class(uuid, text, bigint, text, date, date, text, boolean) is
  'Opens one bill per student for one round. made_ids only holds this rounds genuinely new documents (not the ones found already existing) -- that is the set an undo action would target. See 20260910160000, made_ids added 20260911330000.';
