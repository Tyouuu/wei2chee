-- 改回来：20260911890000 弄坏的那一行撤销掉，恢复 20260911880000 的版本。
--
-- ⚠️ 压力探针跑了 25 轮，弄坏之后（拿掉锁）也是 0 次真的双重分摊——
-- 跟 count_stock / use_credit 那两次不一样，这一次**没有真的看过它红**。
-- 查出来的原因：`next_doc_no` 自己那一行 `update doc_counters ...`
-- 早就会锁住 (project_id, 'payments', 年份) 那一列，而它在这一支函式里
-- 排在分摊那一段**前面**——两笔付同一张单的钱，`in_module_key` 一定
-- 都是 `payments`，所以第二笔在碰到分摊那一段之前，就已经在
-- `next_doc_no` 那一步被同一把（不相干的）锁挡住，等第一笔整支
-- 交易做完才轮到它，於是它读到的 `doc_taken` 已经是第一笔写完之后
-- 的数字——问题被一个没人设计过的意外挡住了。
--
-- 这一支锁还是留着，理由不是「有一个洞」，是「不该靠一个意外挡着」：
-- `next_doc_no` 哪天换一种做法（例如批号不再逐笔锁），这一段就会
-- 失去它从来不知道自己在依赖的那道防线。加一把明写的锁，比继续
-- 靠别的函式的副作用安全。
create or replace function public.add_ledger_entry_core(
  in_actor uuid,
  in_project_id uuid,
  in_module_key text,
  in_direction text default null,
  in_amount_cents bigint default 0,
  in_party text default '',
  in_against_id uuid default null,
  in_entry_on date default null,
  in_method text default '',
  in_reference text default '',
  in_receipt_url text default null,
  in_note text default '',
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null,
  in_party_id uuid default null,
  in_branch_id uuid default null,
  in_done_by uuid default null,
  in_category text default '',
  in_job_id uuid default null
)
returns ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.ledger_entries;
  dir text;
  the_party uuid;
  side text;
  doc_worth bigint;
  doc_module text;
  doc_taken bigint;
  to_apply bigint;
  job_belongs boolean;
begin
  if in_project_id is null then
    raise exception 'no project';
  end if;

  if not public.is_ledger_module(in_module_key) then
    raise exception 'not a ledger module: %', in_module_key;
  end if;

  if not public.branch_is_ours(in_project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  if in_done_by is not null then
    perform 1 from public.directory_entries
      where id = in_done_by and project_id = in_project_id and archived_at is null;
    if not found then
      raise exception 'that person is not in this project';
    end if;
  end if;

  if in_idempotency_key is not null then
    select * into row from public.ledger_entries
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  if coalesce(in_amount_cents, 0) < 0 then
    raise exception 'amount cannot be negative -- use direction instead';
  end if;

  dir := lower(btrim(coalesce(in_direction, '')));
  if dir not in ('in', 'out') then
    dir := case in_module_key when 'payments' then 'in' else 'out' end;
  end if;

  if in_against_id is not null then
    perform 1 from public.pipeline_records
      where id = in_against_id and project_id = in_project_id;
    if not found then
      raise exception 'that document is not in this project';
    end if;
  end if;

  if in_job_id is not null then
    if dir <> 'out' then
      raise exception 'money in is attached to a document by allocating it, not by naming a job';
    end if;
    select true into job_belongs from public.pipeline_records
      where id = in_job_id and project_id = in_project_id;
    if not found then
      raise exception 'that job is not in this project';
    end if;
  end if;

  side := case when dir = 'in' then 'customers' else 'suppliers' end;

  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id and project_id = in_project_id;
    if not found then
      raise exception 'that party is not in this project';
    end if;
    the_party := in_party_id;
  else
    if in_against_id is not null then
      select party_id into the_party from public.pipeline_records where id = in_against_id;
    end if;
    the_party := coalesce(
      the_party,
      public.party_by_name(in_project_id, in_party, side),
      public.party_by_name(
        in_project_id, in_party,
        case when side = 'customers' then 'suppliers' else 'customers' end
      )
    );
  end if;

  insert into public.ledger_entries (
    project_id, module_key, doc_no, party, party_id, direction, amount_cents,
    allocated_cents, against_id, entry_on, method, reference, receipt_url,
    note, recorded_by, extra, idempotency_key, branch_id, done_by, category, job_id
  ) values (
    in_project_id,
    in_module_key,
    public.next_doc_no(in_project_id, in_module_key),
    left(coalesce(in_party, ''), 200),
    the_party,
    dir,
    coalesce(in_amount_cents, 0),
    0,
    in_against_id,
    coalesce(in_entry_on, public.today_myt()),
    left(coalesce(in_method, ''), 60),
    left(coalesce(in_reference, ''), 120),
    in_receipt_url,
    left(coalesce(in_note, ''), 2000),
    in_actor,
    coalesce(in_extra, '{}'::jsonb),
    in_idempotency_key,
    in_branch_id,
    in_done_by,
    left(btrim(coalesce(in_category, '')), 60),
    in_job_id
  )
  returning * into row;

  if in_against_id is not null and coalesce(in_amount_cents, 0) > 0 then
    select coalesce(r.amount_cents, 0), r.module_key into doc_worth, doc_module
    from public.pipeline_records r where r.id = in_against_id
    for update;

    if (dir = 'in' and doc_module = 'purchases')
       or (dir = 'out' and doc_module <> 'purchases') then
      doc_worth := 0;
    end if;

    select coalesce(sum(a.amount_cents), 0) into doc_taken
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where a.record_id = in_against_id
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id);

    to_apply := least(coalesce(in_amount_cents, 0), greatest(doc_worth - doc_taken, 0));
    if to_apply > 0 then
      insert into public.ledger_allocations (entry_id, record_id, project_id, amount_cents)
      values (row.id, in_against_id, in_project_id, to_apply);
      select * into row from public.ledger_entries where id = row.id;
    end if;
  end if;

  return row;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row from public.ledger_entries
      where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise;
end;
$$;
