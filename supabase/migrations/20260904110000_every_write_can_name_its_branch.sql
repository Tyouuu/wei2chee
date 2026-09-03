-- 每一支写入函式收得下「哪一间店」。
--
-- 20260904100000 建了 `branches`，而那四栏 `branch_id` 还是没有人填得进去。
-- 一支建好了、线没接的迁移，是这个仓库最常犯的那个错 —— 而这一次
-- 它特别贵：**分店这根柱子补不回来**（那几栏的注解 8-30 就写着这句）。
--
-- ⚠️ **两支都收，不是只收一支。** 只在报价单上填得了分店、收款填不了，
-- 就是他月底问「Puchong 收了多少」的时候答不出来 ——
-- 而那正好是他开第二间店的唯一理由。
--
-- ⚠️ 而且**都是可选的**：一间店的生意占绝大多数，
-- 一个逼他每一单都挑分店的表单，会让他不用这个系统。
--
-- ── 🔴 顺手修一个昨天我自己造的、比分店严重的错 ──────────────────────────
--
-- `add_ledger_entry` 收到 `in_against_id` 的时候写的是：
--
--     allocated := coalesce(in_amount_cents, 0);
--
-- —— **直接把 `allocated_cents` 设满，而不写任何一笔 `ledger_allocations`。**
--
-- 20260903030000 那一支的档头白纸黑字写着「`allocated_cents` 从今天起是一个
-- **只有一个写它的人**的快取」，而这一支绕过了那个人。结果是两个真相：
--
--   · 那笔钱说自己全部分摊完了 → 订金是 0
--   · 而那张单问「我收到多少」→ 一笔都没有 → **他还欠全额**
--   · 20260904060000 的「他欠我多少」也照样算他欠 —— 因为它数的是分摊
--
-- 一笔真的付过的钱，在客户页上不算数。**那是钱那一层的错，不是分店的。**
--
-- 修法：**写一笔真的分摊**，让触发器去设 `allocated_cents`。
-- 而且**只分摊那张单还欠的那一部分** —— 多出来的留着当订金，
-- 那正是 set_payment_allocations 拒绝超收时叫他做的那件事。

drop function if exists public.add_pipeline_record(
  uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid, uuid
);
drop function if exists public.update_pipeline_record(
  uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean, boolean, uuid, boolean
);
drop function if exists public.add_ledger_entry(
  uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid
);

create or replace function public.add_pipeline_record(
  in_project_id uuid,
  in_module_key text,
  in_title text default '',
  in_party text default '',
  in_amount_cents bigint default null,
  in_stage text default null,
  in_issued_on date default null,
  in_due_on date default null,
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null,
  in_party_id uuid default null,
  in_site_address_id uuid default null,
  in_branch_id uuid default null
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  row public.pipeline_records;
  first_stage text;
  the_party uuid;
  is_en boolean;
  site_owner uuid;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;

  if not public.is_pipeline_module(in_module_key) then
    raise exception 'not a pipeline module: %', in_module_key;
  end if;

  /* 别人家的分店挂不上来。跟工地那一条同一类：一个指错地方的连结，
     画面上完全正常，而月底那张分店报表是错的。 */
  if not public.branch_is_ours(in_project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  if in_idempotency_key is not null then
    select * into row from public.pipeline_records
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id
        and project_id = in_project_id
        and module_key = public.directory_side(in_module_key);
    if not found then
      raise exception 'that party is not on this side of the book';
    end if;
    the_party := in_party_id;
  else
    the_party := public.party_by_name(
      in_project_id, in_party, public.directory_side(in_module_key)
    );
  end if;

  if in_site_address_id is not null then
    select a.party_id into site_owner
    from public.directory_addresses a
    where a.id = in_site_address_id and a.project_id = in_project_id;
    if site_owner is null then
      raise exception 'no such address in your project';
    end if;
    if the_party is null then
      raise exception 'pick the customer before the site';
    end if;
    if site_owner <> the_party then
      raise exception 'that address belongs to somebody else';
    end if;
  end if;

  if in_stage is null or btrim(in_stage) = '' then
    if in_module_key = 'purchases' then
      select p.system_language = 'en' into is_en
        from public.projects p where p.id = in_project_id;
      first_stage := case when is_en then 'Ordered' else '开了单' end;
    else
      select case when p.system_language = 'en'
                  then coalesce(ar.after_workflow_en, ar.after_workflow)
                  else ar.after_workflow
             end ->> 0
        into first_stage
        from public.projects p
        join public.accounts a on a.id = p.account_id
        join public.analysis_results ar on ar.lead_id = a.lead_id
       where p.id = in_project_id;
    end if;
  end if;

  insert into public.pipeline_records (
    project_id, module_key, doc_no, title, party, party_id, amount_cents, stage,
    issued_on, due_on, extra, idempotency_key, site_address_id, branch_id
  ) values (
    in_project_id,
    in_module_key,
    public.next_doc_no(in_project_id, in_module_key),
    left(coalesce(in_title, ''), 200),
    left(coalesce(in_party, ''), 200),
    the_party,
    in_amount_cents,
    left(coalesce(nullif(btrim(coalesce(in_stage, '')), ''), coalesce(first_stage, '')), 60),
    coalesce(in_issued_on, public.today_myt()),
    in_due_on,
    coalesce(in_extra, '{}'::jsonb),
    in_idempotency_key,
    in_site_address_id,
    in_branch_id
  )
  returning * into row;

  return row;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row from public.pipeline_records
      where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise;
end;
$$;

create or replace function public.update_pipeline_record(
  in_id uuid,
  in_title text default null,
  in_party text default null,
  in_amount_cents bigint default null,
  in_stage text default null,
  in_issued_on date default null,
  in_due_on date default null,
  in_extra jsonb default null,
  in_party_id uuid default null,
  in_clear_party boolean default false,
  in_clear_due_on boolean default false,
  in_site_address_id uuid default null,
  in_clear_site boolean default false,
  in_branch_id uuid default null,
  in_clear_branch boolean default false
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.pipeline_records;
  the_party uuid;
  site_owner uuid;
begin
  select * into row from public.pipeline_records r
   where r.id = in_id
     and public.works_here(r.project_id);
  if not found then
    raise exception 'no such record in your project';
  end if;

  if not public.branch_is_ours(row.project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id
        and project_id = row.project_id
        and module_key = public.directory_side(row.module_key);
    if not found then
      raise exception 'that party is not on this side of the book';
    end if;
    the_party := in_party_id;
  elsif in_clear_party then
    the_party := null;
  elsif in_party is not null and btrim(in_party) is distinct from btrim(row.party) then
    the_party := public.party_by_name(
      row.project_id, in_party, public.directory_side(row.module_key)
    );
  else
    the_party := row.party_id;
  end if;

  if in_site_address_id is not null then
    select a.party_id into site_owner
    from public.directory_addresses a
    where a.id = in_site_address_id and a.project_id = row.project_id;
    if site_owner is null then
      raise exception 'no such address in your project';
    end if;
    if the_party is null then
      raise exception 'pick the customer before the site';
    end if;
    if site_owner <> the_party then
      raise exception 'that address belongs to somebody else';
    end if;
  end if;

  update public.pipeline_records set
    title = coalesce(left(btrim(in_title), 200), title),
    party = coalesce(left(btrim(in_party), 200), party),
    party_id = the_party,
    amount_cents = coalesce(in_amount_cents, amount_cents),
    stage = coalesce(left(btrim(in_stage), 60), stage),
    issued_on = coalesce(in_issued_on, issued_on),
    due_on = case when in_clear_due_on then null else coalesce(in_due_on, due_on) end,
    site_address_id = case
                        when in_clear_site then null
                        else coalesce(in_site_address_id, site_address_id)
                      end,
    /* 同一个形状，第四次：他把分店拿掉就要真的拿掉，
       而 null 的意思是「这一栏不要动」。 */
    branch_id = case
                  when in_clear_branch then null
                  else coalesce(in_branch_id, branch_id)
                end,
    extra = coalesce(in_extra, extra)
  where id = in_id
  returning * into row;

  return row;
end;
$$;

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
  in_branch_id uuid default null
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
    note, recorded_by, extra, idempotency_key, branch_id
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
    in_branch_id
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

revoke execute on function public.add_pipeline_record(
  uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid, uuid, uuid
) from public, anon;
grant execute on function public.add_pipeline_record(
  uuid, text, text, text, bigint, text, date, date, jsonb, uuid, uuid, uuid, uuid
) to authenticated;

revoke execute on function public.update_pipeline_record(
  uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean, boolean, uuid, boolean, uuid, boolean
) from public, anon;
grant execute on function public.update_pipeline_record(
  uuid, text, text, bigint, text, date, date, jsonb, uuid, boolean, boolean, uuid, boolean, uuid, boolean
) to authenticated;

revoke execute on function public.add_ledger_entry(
  uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid, uuid
) from public, anon;
grant execute on function public.add_ledger_entry(
  uuid, text, text, bigint, text, uuid, date, text, text, text, text, jsonb, uuid, uuid, uuid
) to authenticated;

/* ⚠️ `move_stock` **故意还没有收分店**，而这一件要讲清楚不要留给人发现：
   库存分店不是多一个参数，它会改变 `stock_on_hand` 的意思 ——
   「架上有几个」变成「哪一间店的架上有几个」，而那张 view、盘点、
   收货、补货线全部要跟着变。那是它自己的一格，不是这一格的一部分。 */
