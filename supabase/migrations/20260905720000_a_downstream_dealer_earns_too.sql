-- 洞〇：抽成算得到下游经销商头上。
--
-- ── 洞是走 vibe-dealer 那一次撞到的（任务 175）────────────────────────────
--
--   FAIL  🔴 抽成算得到下游经销商头上
--         — that person is not a staff member in this project
--
-- `20260904130000` 那条守卫写死只收 `module_key = 'staff'`，而它的注解写着
-- 理由：*一个挂在客户身上的「谁做的」在画面上完全正常，而它会让月底那张表
-- 把一个客户算成员工*。
--
-- 🔴 **那句话对一家装修公司是对的，对一门经销生意是错的** ——
--    经销生意的抽成**本来就是给下游经销商的**，而经销商在名册上是客户。
--    他自己的 vibe-dealer 整门生意就是这个：master 抽 2%，dealer 抽 6%。
--
-- ── 这是「放宽」不是「加」，所以先问它本来在保护什么（重点 31）────────────
--
--   保护的是：**月底那张表不要把一个客户算成员工。**
--
-- 那件事**还是要保护，只是换一个地方**：`staff_earnings` 从今天起多回一栏
-- **`kind`**（`staff` / `customers` / `suppliers`），读的人分得出来。
-- 🔴 **拿掉一条守卫而不把它守的那件事接住，那不是放宽，那是拆掉。**
--
-- 剩下的守卫一个字都没松：**必须是这一家自己名册上的人，而且没有收起来**。
-- （顺手比原本还紧了一点：原本那一条没有看 `archived_at`。）
--
-- ⚠️ 三支函式的函式体是**用程式从 20260904130000 跟 20260905640000 抄出来的**，
--    只换了那一段守卫、多回一栏。整支重打漏掉守卫，这个仓库咬过三次
--    （20260831080000 · 20260905370000 · 20260905330000）。
--
-- ⚠️ 前两支签名没变，`create or replace` 就够；`staff_earnings` 多回一栏
--    ＝改回传型别，所以它自己带着 `drop`（重点 31 第二条）。

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
    /* 🔴 20260905720000 放宽：不再只收 module_key = 'staff'。
       一门经销生意的抽成就是给**下游经销商**的，而经销商在名册上是客户。
       守的还是同一件事 —— **必须是这一家自己名册上的人，而且没有收起来**。
       原本那条守卫在保护「月底那张表不要把客户算成员工」，
       而那件事现在由 `staff_earnings` 回传的 `kind` 那一栏答。 */
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
    /* 🔴 20260905720000 放宽：不再只收 module_key = 'staff'。
       一门经销生意的抽成就是给**下游经销商**的，而经销商在名册上是客户。
       守的还是同一件事 —— **必须是这一家自己名册上的人，而且没有收起来**。
       原本那条守卫在保护「月底那张表不要把客户算成员工」，
       而那件事现在由 `staff_earnings` 回传的 `kind` 那一栏答。 */
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
    done_by = case when in_clear_done_by then null else coalesce(in_done_by, done_by) end
  where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.update_ledger_words(uuid, text, text, text, text, uuid, boolean) from public, anon;
grant execute on function public.update_ledger_words(uuid, text, text, text, text, uuid, boolean) to authenticated;

drop function if exists public.staff_earnings(uuid, text);

create or replace function public.staff_earnings(
  in_project_id uuid,
  in_month text
)
returns table (
  party_id uuid,
  name text,
  earned_cents bigint,
  commission_cents bigint,
  /* 这个数字是照哪一份办法算的。null = 从来没有人记过世代
     （只可能是有人绕过 set_commission_tiers 直接写了那张表）。 */
  rate_from date,
  /* 他是自己人还是下游 —— 'staff' / 'customers' / 'suppliers'。
     20260905720000 加的：抽成放宽到下游之后，**读的人必须分得出来**，
     不然那条守卫本来在保护的事就真的没有人在保护了。 */
  kind text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  first_day date;
begin
  if not public.sees_money(in_project_id) then
    return;
  end if;

  /* 「2026-09」→ 那个月的第一天。马来西亚的月份，不是伺服器的。 */
  first_day := to_date(in_month || '-01', 'YYYY-MM-DD');

  return query
  with earned as (
    select e.done_by as who, sum(e.amount_cents)::bigint as total
    from public.ledger_entries e
    where e.project_id = in_project_id
      and e.done_by is not null
      and e.direction = 'in'
      /* 冲正过的、跟自己是冲正的，都不算 —— 一笔退回去的钱不算她赚的。
         同一条规矩在 lib/portal/allocations.ts 的 countsAsReceived。 */
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r where r.adjusts_id = e.id)
      and e.entry_on >= first_day
      and e.entry_on < (first_day + interval '1 month')
    group by e.done_by
  ),
  /* 🔴 这一段就是这一支 migration 的全部：用**那个月开始那天**在跑的
     那一份办法，不是用现在那一份。 */
  scheme as (
    select earned.who, s.effective_from, coalesce(s.tiers, '[]'::jsonb) as tiers
    from earned
    left join lateral (
      select * from public.commission_scheme_at(earned.who, first_day)
    ) s on true
  )
  select d.id,
         d.name,
         earned.total,
         (
           /* 分段算：每一档只吃它自己那一段。 */
           select coalesce(trunc(sum(
             greatest(
               least(earned.total, coalesce(nxt.from_cents, earned.total)) - t.from_cents,
               0
             ) * t.percent / 100
           )), 0)::bigint
           from jsonb_to_recordset(scheme.tiers) as t(from_cents bigint, percent numeric)
           left join lateral (
             select min(t2.from_cents) as from_cents
             from jsonb_to_recordset(scheme.tiers) as t2(from_cents bigint, percent numeric)
             where t2.from_cents > t.from_cents
           ) nxt on true
         ) as commission_cents,
         scheme.effective_from,
         d.module_key
  from earned
  join public.directory_entries d on d.id = earned.who
  join scheme on scheme.who = earned.who
  order by earned.total desc;
end;
$$;

revoke execute on function public.staff_earnings(uuid, text) from public, anon;
grant execute on function public.staff_earnings(uuid, text) to authenticated;

comment on function public.staff_earnings(uuid, text) is
  'Per staff member for one month: money they brought in, and the stepped commission on it AT THE RATE THAT WAS IN FORCE ON THAT MONTH''S FIRST DAY. Changing the rate today never moves a month that has already begun. Steps are applied BAND BY BAND, and the total is TRUNCATED to the cent to match lib/portal/commission.ts. See 20260905640000.';

-- ── 佣金办法也跟着放宽 ────────────────────────────────────────────────────
--
-- 那两支触发器写着 `commission belongs to a staff member`。同一条理由，
-- 而且同一个补法：分得出是谁由 `kind` 那一栏答。

create or replace function public.commission_tiers_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from public.directory_entries where id = new.party_id and archived_at is null;
  if owner_project is null then
    raise exception 'no such person';
  end if;
  new.project_id := owner_project;
  return new;
end;
$$;

create or replace function public.commission_schemes_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from public.directory_entries where id = new.party_id and archived_at is null;
  if owner_project is null then
    raise exception 'no such person';
  end if;
  new.project_id := owner_project;
  return new;
end;
$$;
