-- 那笔钱是谁赚的 —— 收进那两支写入函式。
--
-- 20260904120000 建了 `ledger_entries.done_by` 跟阶梯，然后**没有任何地方
-- 写得进那一栏** —— 那正是这个仓库最常犯的错（东西建好了，线没接），
-- 而这一支就是那条线。
--
-- ⚠️ **加一个参数就是一支新函式**，而新函式的 EXECUTE 预设给 PUBLIC。
-- 所以旧签名要 drop 掉（不 drop 就是两支同名的，呼叫的时候会含糊），
-- 然后重新 revoke / grant。这一条这个 schema 已经栽过一次。
--
-- ⚠️ 底下那一支的函式体是**从 20260904110000 逐字抄的**，只加了
-- 「谁做的」那三处。凭印象重写过一次的代价写在 20260903060000 的档头：
-- 三个地方跟线上的不一样，而 tsc 干净、db push 成功。

drop function if exists public.add_ledger_entry(
  uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid, uuid
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
  in_done_by uuid default null
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
    note, recorded_by, extra, idempotency_key, branch_id, done_by
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
    in_done_by
  )
  returning * into row;

  /* ── 🔴 写一笔真的分摊，不要自己设那个总数 ─────────────────────────────
     只分摊那张单**还欠的那一部分**：多出来的留着当订金，
     而那正是 set_payment_allocations 拒绝超收的时候叫他做的那件事。 */
  if in_against_id is not null and coalesce(in_amount_cents, 0) > 0 then
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
  uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid, uuid, uuid
) from public, anon;
grant execute on function public.add_ledger_entry(
  uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid, uuid, uuid
) to authenticated;

-- ── 认错人是要改得回来的 ──────────────────────────────────────────────────
--
-- 金额、方向、日子、对方都不给改（那要开一张冲正），而「谁做的」不是钱，
-- 是一句**关於谁**的话 —— 而他一定会有一次挑错人。
--
-- 🔴 `null` 的意思是「这一栏不要动」，所以清空要另外一个参数讲。
-- 少了它，一个名字挂上去就永远拿不下来 —— 这个 schema 已经犯过三次
-- （due_on · site_address_id · branch_id）。

drop function if exists public.update_ledger_words(uuid, text, text, text, text);

create or replace function public.update_ledger_words(
  in_id uuid,
  in_note text default null,
  in_method text default null,
  in_reference text default null,
  in_receipt_url text default null,
  in_done_by uuid default null,
  in_clear_done_by boolean default false
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
    done_by = case when in_clear_done_by then null else coalesce(in_done_by, done_by) end
  where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.update_ledger_words(uuid, text, text, text, text, uuid, boolean) from public, anon;
grant execute on function public.update_ledger_words(uuid, text, text, text, text, uuid, boolean) to authenticated;
