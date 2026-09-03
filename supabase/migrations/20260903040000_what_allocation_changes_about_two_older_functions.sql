-- 分摊落地之后，两支旧函式的行为必须跟着改。两个都是「不改就会说谎」。
--
-- ── ① reverse_ledger_entry 一直在抄一个它没有的数字 ────────────────────────
--
-- 它从 20260831020000 起就写着 `original.allocated_cents`。今天那个值永远
-- 是 0，所以三个 migration 抄了三次都没有人看出来。
--
-- allocations 一落地它就现形：冲正 RM 10,000 那一笔会宣称自己已分摊
-- RM 10,000，**而 ledger_allocations 里它一条都没有**。那正好是这一整批在
-- 消灭的东西 —— 一个跟明细对不起来的总数。
--
-- 冲正那一笔的正确值是 **0**，而 `against_id` 也是 **null**：
-- 从 20260903030000 起，`against_id` 只有一个意思 ——
-- 「这笔钱整笔分摊给这一张单」。一笔冲正没有分摊给任何一张。
--
-- 🔴 那「这张单被退过钱」怎么看得到？走 `adjusts_id`：
-- 单据页读的是分摊，而分摊连着的那一笔如果被冲正了，
-- 它就不算收到（lib/portal/allocations.ts 那一层，有测试）。
-- **一张退过款的单，不可以看起来像收过钱。**
--
-- ⚠️ 顺手把它的守卫换成 `sees_money()`。它一直写着 `account_id = auth.uid()`，
-- 而 20260901010000 的整个主张就是「这个 schema 里只有一个判断权限的地方」。
-- 今天这两句选到的是同一批人，所以行为没有变；差别在**下一次**多一个角色的时候
-- 只要改一支函式，而不是去翻哪几支还写着旧的那一句。

create or replace function public.reverse_ledger_entry(
  in_entry_id uuid,
  in_note text default ''
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  original public.ledger_entries;
  row public.ledger_entries;
  already uuid;
begin
  select * into original
  from public.ledger_entries e
  where e.id = in_entry_id and public.sees_money(e.project_id);
  if not found then
    raise exception 'no such entry in your project';
  end if;

  if original.adjusts_id is not null then
    raise exception 'that entry is itself a reversal';
  end if;

  select id into already
  from public.ledger_entries where adjusts_id = in_entry_id;
  if already is not null then
    raise exception 'that entry has already been reversed';
  end if;

  insert into public.ledger_entries (
    project_id, module_key, doc_no, party, party_id, direction, amount_cents,
    allocated_cents, against_id, adjusts_id, entry_on, method, reference,
    note, recorded_by, extra
  ) values (
    original.project_id,
    original.module_key,
    public.next_doc_no(original.project_id, original.module_key),
    original.party,
    original.party_id,
    case original.direction when 'in' then 'out' else 'in' end,
    original.amount_cents,
    /* 🔴 0 和 null，不是原本那一笔的拷贝。见档头。 */
    0,
    null,
    original.id,
    public.today_myt(),
    original.method,
    original.reference,
    left(coalesce(nullif(btrim(in_note), ''), '冲正 ' || original.doc_no), 2000),
    auth.uid(),
    original.extra
  )
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.reverse_ledger_entry(uuid, text) from public, anon;
grant execute on function public.reverse_ledger_entry(uuid, text) to authenticated;

-- ── ② set_record_terms 是整批换的，而分摊会指着某一期 ──────────────────────
--
-- 20260903020000 的档头自己写下了这一条，**在它发生之前**：
--   「⚠️ 而下一格落地的时候要记得回来做一件事：一笔钱分摊到某一期之后，
--     那一期就不可以再被整批换掉。那正是 record_lines 踩过的坑
--     （任务 93：整批换让每一行拿到新 id，收货的锚点就断了）。」
--
-- 现在回来做它。整批换 = 全删再全插，所以每一期都会拿到新的 id，
-- 而 `ledger_allocations.term_id` 是 `on delete set null` ——
-- **那些钱不会消失，但它们会静静地忘记自己付的是哪一期。**
-- 静静地忘记，比报一个错糟得多。
--
-- 做法照任务 93（收过货的单，行就锁了）：**收过钱的分期表，锁住。**
-- 而且要讲人话，把出路一起讲出来 —— 一个只说「不行」的错误讯息，
-- 会教他去找别的方法把它弄坏。
--
-- ⚠️ 剩下的一个洞，写出来不掩饰：有人在 Supabase Studio 手删一期，
-- 那笔分摊还是会静静地忘记它。这里挡的是**产品里那条路**，
-- 因为那是人真的会走的那一条（任务 43 那次的教训是同一句：
-- 「那只是两条写入路径之一，另一条是在 Studio 手改」）。

create or replace function public.set_record_terms(
  in_record_id uuid,
  in_terms jsonb
)
returns setof public.record_terms
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  item jsonb;
  i integer := 0;
  pct numeric;
  amt bigint;
  paid_stage text;
begin
  select exists (
    select 1 from public.pipeline_records r
    where r.id = in_record_id and public.works_here(r.project_id)
  ) into mine;
  if not mine then
    raise exception 'no such document in your project';
  end if;

  /* 🔴 收过钱的那一期，锁住。见档头。
     ⚠️ 这一句故意**不**经过 sees_money：一个师傅改不了一份已经收过订金的
     分期表，就算他看不到那笔钱是多少。挡的是改，不是看。 */
  select t.description into paid_stage
  from public.record_terms t
  where t.record_id = in_record_id
    and exists (
      select 1 from public.ledger_allocations a where a.term_id = t.id
    )
  limit 1;
  if paid_stage is not null then
    raise exception
      'money has already been taken against "%"; remove that allocation from the payment first',
      paid_stage;
  end if;

  if jsonb_typeof(coalesce(in_terms, 'null'::jsonb)) <> 'array' then
    raise exception 'terms must be an array';
  end if;

  /* 十二期是一份付款办法；六十期是一份还款表，而那是另一件东西。 */
  if jsonb_array_length(in_terms) > 12 then
    raise exception 'too many instalments on one document';
  end if;

  delete from public.record_terms where record_id = in_record_id;

  for item in select * from jsonb_array_elements(in_terms)
  loop
    if coalesce(btrim(item->>'description'), '') = '' then
      raise exception 'every instalment needs a description';
    end if;

    pct := nullif(item->>'portion', '')::numeric;
    amt := nullif(item->>'amount_cents', '')::bigint;

    if pct is not null and amt is not null then
      raise exception 'an instalment is either a percentage or an amount, not both';
    end if;
    if pct is null and amt is null then
      raise exception 'an instalment needs a percentage or an amount';
    end if;

    insert into public.record_terms (
      record_id, project_id, description, portion, amount_cents, due_on, sort_order, note
    ) values (
      in_record_id,
      '00000000-0000-0000-0000-000000000000'::uuid,
      left(btrim(item->>'description'), 120),
      pct,
      amt,
      nullif(item->>'due_on', '')::date,
      i,
      left(coalesce(item->>'note', ''), 300)
    );
    i := i + 1;
  end loop;

  return query
    select * from public.record_terms
     where record_id = in_record_id
     order by sort_order;
end;
$$;

revoke execute on function public.set_record_terms(uuid, jsonb) from public, anon;
grant execute on function public.set_record_terms(uuid, jsonb) to authenticated;
