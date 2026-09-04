-- 这笔钱是干什么的、属於哪一单 —— 「这个月赚多少」的地基。
--
-- ── 先读别人真的表，不是读首页（重点 26）─────────────────────────────────
--
-- ERPNext 的 `Account` doctype（2026-09-04 逐栏读的）：必填 account_name ·
-- company · **parent_account**（所以它是一棵树），另外 40 个 account_type、
-- tax_rate、freeze_account、balance_must_be、lft/rgt。
-- `GL Entry`：account · **debit / credit** · voucher_type + voucher_no ·
-- **project** · cost_center · fiscal_year · finance_book · 四组币别栏位。
--
-- 拿两样：
--
--   (1) `root_type` 只有五个值，而 Income / Expense 那两个就是整张损益表。
--       我们已经有它了，它叫 `direction`。而他们的 `report_type` 是**唯读的、
--       从 root_type 算出来的** -- 跟这个 schema 到处在用的那条规矩一样。
--
--   (2) `GL Entry` 同时有 `against_voucher`（这笔钱结清了哪一张单）**跟**
--       `project`（这笔钱属於哪一件工程）。**两个意思，两栏。**
--       这一条是这次最要紧的发现，理由写在下面。
--
-- 不拿的，逐条带理由：
--
--   * **借贷双分录。** 它在有应计、折旧、存货计价、多帐套的时候才划得来。
--     它的代价是**每一笔都要平**，也就是他没办法在不指定对方科目的情况下
--     记一笔收款 -- 而那正是老板放弃会计软件的那一刻。
--     🔴 **所以要老实讲我们做不出什么**：没有资产负债表、没有试算表、
--     没有应计。我们出的是一张**收付实现制的损益表**，而那正好是他的会计
--     拿着银行流水在做的那一张。
--   * **科目树**（parent_account 必填 · lft/rgt）。树是给 200 个科目的，他有八个。
--   * 40 个 account_type、fiscal_year、finance_book、cost_center、四组币别。
--
-- ── 🔴 为什么不重用 `against_id`，而要多一栏 ──────────────────────────────
--
-- `against_id` 是**触发器写的**：20260903030000 那支 sync 在分摊变动的时候
-- 会把它设成「唯一那一笔分摊指的那张单」，不只一笔的时候设回 null。
-- 也就是它回答的是「这笔钱结清了哪一张单」。
--
-- 一笔水泥开销挂在某一单上，讲的是**另一件事**：这是那一单的成本。
-- 塞进同一栏会出两个毛病，而且两个都不会报错：
--   * 那支触发器有一天会把他填的那一单**清成 null**
--   * `add_ledger_entry` 底下那段会替它写一笔**分摊** --
--     也就是**报一笔 RM 3,000 的水泥，会让那张单看起来收到了 RM 3,000**
--
-- 第二件今天就在代码里（那段 `if in_against_id is not null` 没有看方向），
-- 只是还没有人挂得上去，所以还没有烧到人。这一支同时把它关掉。
--
-- **ERPNext 自己就是两栏**（against_voucher vs project），所以这不是我们的
-- 发明，是他们二十年前就分开的那两件事。
--
-- ── 一栏是他的词，不是我们的科目表 ────────────────────────────────────────
--
-- `category` 是自由文字，跟 `stage`、`method`、`status` 同一条规矩：
-- **客户自己的词就是产品**。给它一张固定清单，等於逼全马来西亚的生意
-- 走同一份科目表。
--
-- ⚠️ 而且**不给建议清单**：任务 117 立过那一条 -- 没有量过的行业就不建议，
-- 猜一份科目表比留白更糟。画面上那个下拉读的是**他自己打过的词**，
-- 所以第一次是空的，而那是诚实的。

alter table public.ledger_entries
  add column if not exists category text not null default '';

alter table public.ledger_entries
  add column if not exists job_id uuid references public.pipeline_records(id) on delete set null;

comment on column public.ledger_entries.category is
  '这笔钱是干什么的，他自己的词。ERPNext 的 Account 收成一栏 -- 没有科目树，没有借贷。';
comment on column public.ledger_entries.job_id is
  '这笔开销属於哪一单（成本）。⚠️ 跟 against_id 不是同一件事：against_id 是触发器写的「结清了哪一张单」。ERPNext 也是两栏（against_voucher vs project）。';

/* 损益表按类别分组，跟「他自己打过哪些词」那个下拉，读的都是这个。 */
create index if not exists ledger_entries_category_idx
  on public.ledger_entries (project_id, category)
  where category <> '';

/* 一单的成本。 */
create index if not exists ledger_entries_job_idx
  on public.ledger_entries (job_id)
  where job_id is not null;

-- ── 两支写入函式 ─────────────────────────────────────────────────────────
--
-- ⚠️ **加一个参数就是一支新函式**，而新函式的 EXECUTE 预设给 PUBLIC。
-- 旧签名要 drop 掉再重新 revoke / grant。这个 schema 已经栽过一次。
--
-- ⚠️ 底下两支的函式体是**用脚本从 20260904130000 逐字抄出来再打补丁的**，
-- 不是凭印象重写的。凭印象重写过一次的代价写在 20260903060000 的档头。

drop function if exists public.add_ledger_entry(
  uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid, uuid, uuid
);

create or replace function public.add_ledger_entry(
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
  mine boolean;
  row public.ledger_entries;
  dir text;
  the_party uuid;
  side text;
  doc_worth bigint;
  doc_taken bigint;
  to_apply bigint;
  job_belongs boolean;
begin
  select exists (
    select 1 from public.projects
    where id = in_project_id and account_id = auth.uid()
  ) into mine;
  if not mine then
    raise exception 'not your project';
  end if;

  if not public.is_ledger_module(in_module_key) then
    raise exception 'not a ledger module: %', in_module_key;
  end if;

  if not public.branch_is_ours(in_project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  /* 🔴 只能是这一家自己的**师傅**。一个挂在客户身上的「谁做的」在画面上
     完全正常，而它会让月底那张表把一个客户算成员工。 */
  if in_done_by is not null then
    perform 1 from public.directory_entries
      where id = in_done_by and project_id = in_project_id and module_key = 'staff';
    if not found then
      raise exception 'that person is not a staff member in this project';
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
    auth.uid(),
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
revoke execute on function public.add_ledger_entry(
  uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid, uuid, uuid, text, uuid
) from public, anon;
grant execute on function public.add_ledger_entry(
  uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid, uuid, uuid, text, uuid
) to authenticated;

drop function if exists public.update_ledger_words(uuid, text, text, text, text, uuid, boolean);
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
      where id = in_done_by and project_id = row.project_id and module_key = 'staff';
    if not found then
      raise exception 'that person is not a staff member in this project';
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
revoke execute on function public.update_ledger_words(
  uuid, text, text, text, text, uuid, boolean, text, uuid, boolean
) from public, anon;
grant execute on function public.update_ledger_words(
  uuid, text, text, text, text, uuid, boolean, text, uuid, boolean
) to authenticated;
