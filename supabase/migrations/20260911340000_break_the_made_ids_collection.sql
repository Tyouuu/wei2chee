-- 故意弄坏：拿掉「收进新开那一张的编号」那一句——看过它红。
-- 单独推、单独看红，见 20260911330000 档头。

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
      -- 🔴 故意拿掉：new_ids := new_ids || job.id;
    end if;
  end loop;

  select count(*) into n_skip
  from public.class_members m
  where m.group_id = in_group_id and m.left_on is not null;

  return query select n_made, n_again, n_skip, n_free, sum_cents, tag, new_ids;
end;
$$;
