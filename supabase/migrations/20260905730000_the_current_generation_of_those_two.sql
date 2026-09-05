-- 补上 20260905720000 弄坏的：我抄的是**过期的那一代**。
--
-- 🔴 重点 31 第一条写着「不准整支重写，要在原来那一支上加」——
--    **而我做对了一半：我确实是用程式抄的，不是照记忆打的。我抄错了
--    「原来那一支」是哪一个档案。**
--
--   `add_ledger_entry`    我抄 20260904130000（16 个参数），
--                         而在跑的是 **20260905020000**（18 个，
--                         而且那道守卫早就搬进 `add_ledger_entry_core` 了）
--   `update_ledger_words` 我抄 20260904130000（7 个），
--                         而在跑的是 **20260904200000**（10 个）
--
-- 於是那两支各多了一个**旧签名的多载**，PostgREST 当场选不出来：
--
--     Could not choose the best candidate function between: public.add_ledger_entry…
--
-- 🔴 **而它的样子跟「功能整个坏了」一模一样** —— `walk:dealer` 那一次
--    十六笔钱变成 RM 0.00，读起来像收款坏了，其实是那支函式选不到。
--    这正是重点 31 第二条写的那句：**不 drop 旧的，那支函式整个选不到，
--    而画面上跟功能坏了一模一样。**
--
-- ── 教训，写下来 ──────────────────────────────────────────────────────────
--
-- 「在原来那一支上加」里的**「原来那一支」是最后一次定义它的那个档案**，
-- 不是我记得的那一个。找法只有一句：
--
--     grep -ln "create or replace function public.<名字>(" supabase/migrations/*.sql | tail -1
--
-- 🟢 **而这一次真正省事的是 20260905020000 那个拆法**：那道守卫住在
--    `add_ledger_entry_core` 里，一份逻辑两道门（重点 23）——
--    **所以放宽只要改一个地方**，两道门自己跟着。

drop function if exists public.add_ledger_entry(
  uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid, uuid, uuid
);
drop function if exists public.update_ledger_words(uuid, text, text, text, text, uuid, boolean);

create or replace function public.add_ledger_entry_core(
  /* 谁按的。人按的时候是他自己；闸道回呼的时候是 null ——
     而 null 在那一栏是**一句真话**：没有人打过这一笔。 */
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
  /* 谁做的。佣金算在这上面（20260904120000）。 */
  in_done_by uuid default null,
  /* 这笔钱是干什么的。他自己的词 —— 材料 · 工钱 · 车油 · 租金。
     ERPNext 的 Account 收成一栏（见档头）。 */
  in_category text default '',
  /* 这笔开销属於哪一单。**只有出去的钱**，见档头。 */
  in_job_id uuid default null
)
returns public.ledger_entries
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
  doc_taken bigint;
  to_apply bigint;
  job_belongs boolean;
begin
  /* 🔴 这里**故意没有权限检查**，而这一支也**没有 grant 给任何人**
     （见档案末尾的 revoke）。它只被两支 definer 函式呼叫，
     而那两支各自证明自己的权力：
       add_ledger_entry        他登入了，而且这一家是他的
       settle_payment_request  闸道说这一张付款要求付了
     一份写入逻辑，两道门 —— [重点 23] 讲的就是这件事。 */
  if in_project_id is null then
    raise exception 'no project';
  end if;

  if not public.is_ledger_module(in_module_key) then
    raise exception 'not a ledger module: %', in_module_key;
  end if;

  if not public.branch_is_ours(in_project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  /* 🔴 20260905720000 放宽（这一支补上）：不再只收 module_key = 'staff'。
     经销生意的抽成本来就是给**下游经销商**的，而经销商在名册上是客户。
     守的还是同一件事 —— **这一家自己名册上的人，而且没有收起来**；
     「不要把客户算成员工」由 `staff_earnings` 的 `kind` 那一栏接住。 */
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

  /* ── 🔴 一笔进来的钱不准挂在某一单上，而这不是小气 ─────────────────────
     进来的钱靠**分摊**回答「这一单收了多少」（ledger_allocations，一笔可以
     分给好几张单）。再让它写一个 job_id，同一个问题就有两个答案，
     而两个答案迟早会不一样 —— 这个仓库最常犯的那个错。
     所以讲出来该怎么做，不要静静地收下。 */
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

  /* Money in comes from a customer; money out goes to a supplier. Reading the
     direction rather than the module is what lets 开销 paid to a supplier and
     a refund paid to a customer both land on the right person. */
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
      /* And if that side has nobody by this name, the other one -- a business
         with only a customer list must still be able to file an expense
         against the person it typed. Tried second, never first: crossing sides
         is a fallback, not a default. */
      public.party_by_name(
        in_project_id, in_party,
        case when side = 'customers' then 'suppliers' else 'customers' end
      )
    );
  end if;

  insert into public.ledger_entries (
    project_id, module_key, doc_no, party, party_id, direction, amount_cents,
    /* 🔴 **0**，不是 in_amount_cents。见档头 —— 从 20260903030000 起
       `allocated_cents` 只有那支触发器写得了它，而下面那一笔真的分摊
       会让它变成对的数字。 */
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

  /* ── 🔴 写一笔真的分摊，不要自己设那个总数 ─────────────────────────────
     只分摊那张单**还欠的那一部分**：多出来的留着当订金，
     而那正是 set_payment_allocations 拒绝超收的时候叫他做的那件事。 */
  if dir = 'in' and in_against_id is not null and coalesce(in_amount_cents, 0) > 0 then
    select coalesce(r.amount_cents, 0) into doc_worth
    from public.pipeline_records r where r.id = in_against_id;

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
      /* 触发器把 allocated_cents 跟 against_id 写回去，所以这里再读一次。 */
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

create or replace function public.update_ledger_words(
  in_id uuid,
  in_note text default null,
  in_method text default null,
  in_reference text default null,
  in_receipt_url text default null,
  in_done_by uuid default null,
  in_clear_done_by boolean default false,
  in_category text default null,
  in_job_id uuid default null,
  in_clear_job_id boolean default false
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.ledger_entries;
begin
  select * into row from public.ledger_entries e
   where e.id = in_id
     and exists (
       select 1 from public.projects p
       where p.id = e.project_id and p.account_id = auth.uid()
     );
  if not found then
    raise exception 'no such entry in your project';
  end if;

  /* 🔴 挂错单跟挂错人一样，是一次打字错误，不是一笔要留痕迹的更正。
     而 null 的意思是「这一栏不要动」，所以清空要另一个参数讲 ——
     少了它，一个单挂上去就永远拿不下来（这个 schema 已经犯过四次）。 */
  if in_job_id is not null then
    if row.direction <> 'out' then
      raise exception 'money in is attached to a document by allocating it, not by naming a job';
    end if;
    perform 1 from public.pipeline_records
      where id = in_job_id and project_id = row.project_id;
    if not found then
      raise exception 'that job is not in this project';
    end if;
  end if;

  if in_done_by is not null then
    perform 1 from public.directory_entries
      where id = in_done_by and project_id = row.project_id and archived_at is null;
    if not found then
      raise exception 'that person is not in this project';
    end if;
  end if;

  /* ⚠️ THE AMOUNT, THE DIRECTION, THE PARTY AND THE DATE ARE NOT HERE, AND
     THAT IS THE FEATURE. Money is corrected by writing an opposite entry --
     reverse_ledger_entry -- so that the correction is visible. A figure that
     changed with no trace of the change cannot be told apart from a lie.

     「谁做的」在这里，因为它不是钱：它是一句关於谁的话，而挑错人是
     一次打字错误，不是一笔要留下痕迹的更正。 */
  update public.ledger_entries set
    note = coalesce(left(in_note, 2000), note),
    method = coalesce(left(btrim(in_method), 60), method),
    reference = coalesce(left(btrim(in_reference), 120), reference),
    receipt_url = coalesce(in_receipt_url, receipt_url),
    done_by = case when in_clear_done_by then null else coalesce(in_done_by, done_by) end,
    category = coalesce(left(btrim(in_category), 60), category),
    job_id = case when in_clear_job_id then null else coalesce(in_job_id, job_id) end
  where id = in_id
  returning * into row;

  return row;
end;
$$;

-- `_core` 一个人都不 grant —— 20260905020000 定的，这里再讲一次。
revoke all on function public.add_ledger_entry_core(
  uuid, uuid, text, text, bigint, text, uuid, date, text, text, text, text,
  jsonb, uuid, uuid, uuid, uuid, text, uuid
) from public, anon, authenticated, service_role;

revoke execute on function public.add_ledger_entry(
  uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid, uuid, uuid, text, uuid
) from public, anon;
grant execute on function public.add_ledger_entry(
  uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid, uuid, uuid, text, uuid
) to authenticated;

revoke execute on function public.update_ledger_words(
  uuid, text, text, text, text, uuid, boolean, text, uuid, boolean
) from public, anon;
grant execute on function public.update_ledger_words(
  uuid, text, text, text, text, uuid, boolean, text, uuid, boolean
) to authenticated;
