-- 两道守卫都在，而先讲话的是错的那一道。
--
-- 20260903030000 的 `set_payment_allocations` 把「分摊不可以超过那笔钱本身」
-- 那一句放在**插完之后**，理由听起来很好：插完再加总最准。
--
-- 用真的客户身分打一次（check:records），它回的是：
--
--     new row for relation "ledger_entries" violates check constraint
--     "ledger_entries_allocation_fits"
--
-- 因为每插一行，同步触发器就把总数写回 ledger_entries 一次 ——
-- **资料库那道最后的防线在第二行就先讲话，而给人看的那一句永远轮不到。**
--
-- 那一支自己的注解白纸黑字写着「一道给人看，一道是最后一层」。
-- 两道都在，顺序是反的。而顺序错的守卫，在测试里跟没有守卫长得一模一样 ——
-- 两边都是「挡下来了」，差别只有那个装修承包商读到的是哪一句话。
--
-- 🔴 而这一条只有**真的打一次**才看得到：SQL 读起来完全正确，
-- 单元测试碰不到触发器，`supabase db push` 也过了（重点 26）。
--
-- 修法：先从他送进来的那份清单加总，再动手写。
-- 资料库那条 check 照旧留着 —— 它本来就该是最后一层，不是第一层。

create or replace function public.set_payment_allocations(
  in_entry_id uuid,
  in_rows jsonb
)
returns setof public.ledger_allocations
language plpgsql
security definer
set search_path = public
as $$
declare
  entry public.ledger_entries;
  item jsonb;
  amt bigint;
  rec uuid;
  trm uuid;
  seen text[] := '{}';
  pair text;
  spent bigint;
  doc record;
  worth bigint;
begin
  select * into entry
  from public.ledger_entries e
  where e.id = in_entry_id and public.sees_money(e.project_id);
  if not found then
    raise exception 'no such payment in your project';
  end if;

  if entry.adjusts_id is not null then
    raise exception 'that entry is a reversal; a reversal is not allocated';
  end if;

  if jsonb_typeof(coalesce(in_rows, 'null'::jsonb)) <> 'array' then
    raise exception 'allocations must be an array';
  end if;
  /* 一笔钱付二十张单是一份对帐表，而那是 reconcile 那个零件的事。 */
  if jsonb_array_length(in_rows) > 20 then
    raise exception 'one payment cannot be split across more than 20 documents';
  end if;

  /* 🔴 在写之前。见档头 —— 这是这一支存在的唯一理由。 */
  select coalesce(sum((nullif(x->>'amount_cents', ''))::bigint), 0) into spent
  from jsonb_array_elements(in_rows) as x;
  if spent > entry.amount_cents then
    raise exception 'that is more than the payment: % sen received, % sen allocated',
      entry.amount_cents, spent;
  end if;

  delete from public.ledger_allocations where entry_id = in_entry_id;

  for item in select * from jsonb_array_elements(in_rows)
  loop
    rec := nullif(item->>'record_id', '')::uuid;
    trm := nullif(item->>'term_id', '')::uuid;
    amt := nullif(item->>'amount_cents', '')::bigint;

    if rec is null then
      raise exception 'every allocation needs a document';
    end if;
    if amt is null or amt <= 0 then
      raise exception 'every allocation needs an amount';
    end if;

    /* 同一张单的同一期出现两次，是他打了两行而不是两笔钱。
       讲清楚，不要让它默默变成加倍。 */
    pair := rec::text || ':' || coalesce(trm::text, '-');
    if pair = any (seen) then
      raise exception 'the same document is listed twice; put it on one line';
    end if;
    seen := seen || pair;

    insert into public.ledger_allocations (
      entry_id, record_id, term_id, project_id, amount_cents, note
    ) values (
      in_entry_id, rec, trm,
      /* 被触发器盖掉；这里只是为了满足 not null。 */
      '00000000-0000-0000-0000-000000000000'::uuid,
      amt,
      left(coalesce(item->>'note', ''), 300)
    );
  end loop;

  /* ── 一张单收到的，不可以超过那张单本身 ────────────────────────────────
     多收的那一部分不是错，是**订金** —— 留着不分摊就好，
     而那正是这张表存在的理由。所以这一句要把做法讲出来。

     这一句可以留在写之后，因为没有任何 check 会抢在它前面讲话。

     冲正过的、跟自己是冲正的，都不算收到 —— 见 20260903030000 的档头。 */
  for doc in
    select a.record_id as rid, sum(a.amount_cents) as taken
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where a.record_id in (
      select record_id from public.ledger_allocations where entry_id = in_entry_id
    )
      and e.adjusts_id is null
      and not exists (
        select 1 from public.ledger_entries r where r.adjusts_id = e.id
      )
    group by a.record_id
  loop
    select coalesce(r.amount_cents, 0) into worth
    from public.pipeline_records r where r.id = doc.rid;
    if doc.taken > worth then
      raise exception 'that is more than the document is worth; leave the rest unallocated and it stays a deposit';
    end if;
  end loop;

  return query
    select * from public.ledger_allocations
     where entry_id = in_entry_id
     order by created_at;
end;
$$;

revoke execute on function public.set_payment_allocations(uuid, jsonb) from public, anon;
grant execute on function public.set_payment_allocations(uuid, jsonb) to authenticated;
