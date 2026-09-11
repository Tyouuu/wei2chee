-- 故意弄坏：拿掉那一行 for update，看压力探针真的量出同一张单被
-- 双重分摊。单独推、单独跑，看过它红，再改回去。
--
-- 老板问「你看看要怎么去处理」——顺着 count_stock / use_credit 那两次
-- 的教训，系统性扫过全部 security definer 函式，找「先读一个会变的
-- 聚合数、检查够不够、才写」这个形状还出现在哪。这一支是查到的
-- 第三个、也是唯一确认属於这一类的：两笔钱同时付同一张单，
-- 都会读到同一个「这张单已经收了多少」，都通过「还没超过单子本身」
-- 的检查，都写一笔分摊——单据身上的 `allocated_cents` 变成收了
-- 两倍的钱，而客户实际只付了一次。
--
-- 锁的是那张单本身（`pipeline_records`），不是分摊表——
-- `ledger_allocations` 只加不改，锁现有的行锁不住等一下要插进来的
-- 新那一行，跟 count_stock 那次一模一样的坑。一张单只有一行，
-- 锁它就是真的排队：先到的那一笔把「读还欠多少、决定分摊多少、
-- 写那一行」整段做完才放手。
--
-- 只加 `for update`，其余一个字不动——[重点 31] 第 1 条。
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
    /* 🔴 锁这一张单，见档头——中间那一段（读还欠多少、算分摊多少、
       写那一行）整段要在同一位打电话的人手上做完，第二位才准进来。 */
    select coalesce(r.amount_cents, 0), r.module_key into doc_worth, doc_module
    from public.pipeline_records r where r.id = in_against_id
    ;

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
