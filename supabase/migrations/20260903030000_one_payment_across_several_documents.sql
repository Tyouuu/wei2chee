-- 一笔钱分摊多张单 —— 十五格的第三格。
--
-- ── 为什么是这一格 ────────────────────────────────────────────────────────
--
-- 客户转一笔 RM 20,000 过来，付的是三张单：QT-1 的尾款、QT-2 的订金、
-- 上个月那张还差的一点。今天我们只存得下 `against_id` 一个指标 ——
-- 一笔钱只能指着一张单，所以他只能把那一笔拆成三笔假的收款去记。
--
-- 而上一格（20260903020000 分期付款表）的档头自己写着：
--   「ERPNext 在这张表上存 paid_amount 跟 outstanding，而那两栏只有在
--    『一笔收款可以指定分摊到哪一期』存在之后才有意义 —— 那是下一格。」
-- 这一支就是那一格。做完它，分期表才答得出「订金收了没有」。
--
-- ── 读的是谁的表 ──────────────────────────────────────────────────────────
--
-- ERPNext 的 `Payment Entry Reference` doctype 原文（GitHub API，不是首页）。
-- 20 栏，而**只有两栏是人真的会填的**：
--
--   reference_doctype + reference_name   必填 —— 哪一张单
--   allocated_amount                     唯一一个不是 read_only 的金额
--   payment_term                         哪一期（Link 到 Payment Term）
--   ── 以下全部 read_only，是算出来的回音 ──
--   total_amount · outstanding_amount · payment_term_outstanding
--   exchange_rate · exchange_gain_loss · account · account_type
--   payment_type · payment_request · payment_request_outstanding
--   reconcile_effect_on · advance_voucher_type · advance_voucher_no · bill_no
--
-- **抄三栏，不抄二十栏**：哪一张单 · 多少钱 · 哪一期。
--
-- ⚠️ 而那几个 read_only 的正好是我上一格**故意不建**的两栏
-- （`paid_amount` / `outstanding`）。ERPNext 把算出来的数字存成快照挂在子表上；
-- 我们算。理由跟「库存总数是流水加起来的」「工程完成度是算出来的」
-- 「过期是读的时候算的」是同一条：**一个存起来的数字，在没有人重算它的那一刻
-- 就开始说谎，而画面上没有任何东西会讲。**
--
-- ── 🔴 那 allocated_cents 呢？它本来就是一个存起来的数字 ───────────────────
--
-- 是。而且它从 20260831020000 建出来那天到今天，**没有任何一支程式写过它**
-- （grep 全仓库：只有 add / reverse 在传，而传的一直是 0 或者一份拷贝）。
--
-- 从今天起它是一个**快取，而且只有一个写它的人**：下面那支触发器，
-- 从 ledger_allocations 加总。它不再是一个可以自己漂的数字，
-- 而 `ledger_entries_allocation_fits`（allocated_cents <= amount_cents）
-- 那条 check 从此变成真的守卫 —— 分摊超过那笔钱本身，资料库自己会挡。
--
-- 保留它、不改成一个 view，是因为那条**订金的索引**是 partial index：
--   `where allocated_cents < amount_cents`
-- 「这个客户还有多少订金没用完」是这张表最常被问的一句，而那一句要走索引。
--
-- ── 🔴 顺手修一个还没有人踩到的 bug ───────────────────────────────────────
--
-- `reverse_ledger_entry` 一直在**把原本那笔的 allocated_cents 抄进冲正那一笔**。
-- 今天那个值永远是 0，所以看不出来。allocations 一落地它就现形：
-- 冲正那一笔会宣称自己已分摊 RM 10,000，**而它一条分摊记录都没有** ——
-- 一个跟它的明细对不起来的总数，正是这一整支在消灭的东西。
-- 冲正那一笔的正确值是 **0**。
--
-- ── 冲正之后，那张单算不算收过钱 ──────────────────────────────────────────
--
-- 不算。钱退回去了。所以「这张单收到多少」要跳过两种 entry：
--   · 自己是冲正的（adjusts_id is not null）
--   · 已经被冲正的（有另一笔 adjusts_id 指着它）
-- 这一条同时算在这里（写的时候挡超收）跟 TypeScript 那一层
-- （lib/portal/allocations.ts，读的时候算「还欠多少」，有测试）。

create table if not exists public.ledger_allocations (
  id uuid primary key default gen_random_uuid(),

  /* 哪一笔钱。cascade：钱没了，它怎么分的也没有意义。 */
  entry_id uuid not null references public.ledger_entries(id) on delete cascade,

  /* 分到哪一张单。cascade：单没了，这一笔钱就回到「还没分摊」——
     也就是回去当订金，那正是它该有的下场。
     ⚠️ 跟 ledger_entries.against_id 的 `on delete set null` 不一样，而两个都对：
     那一条保的是**那笔钱不可以跟着单一起消失**；这一张表本来就不是钱，
     它是钱跟单之间的一句话。 */
  record_id uuid not null references public.pipeline_records(id) on delete cascade,

  /* 哪一期。可以空 —— 大部分的钱就是「付这张单」，没有指定哪一期。
     ⚠️ `on delete set null` 而不是 restrict，理由在 set_record_terms 那一段。 */
  term_id uuid references public.record_terms(id) on delete set null,

  /* 反正规化，让 RLS 不用每一次读都 join。靠下面那支触发器保持真。 */
  project_id uuid not null references public.projects(id) on delete cascade,

  /* Sen，一定是正的。方向是那笔钱自己的 direction，不是这里的正负号。 */
  amount_cents bigint not null check (amount_cents > 0),

  note text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.ledger_allocations is
  'One payment applied to one document (optionally to one instalment of it). The unallocated remainder of a payment is the deposit. See the header of 20260903030000.';
comment on column public.ledger_allocations.term_id is
  'Which instalment of the document this covers. Null is normal -- most money is just "against that quotation".';

-- 「这张单收到多少」—— 单据页每一次打开都问这一句。
create index if not exists ledger_allocations_record_idx
  on public.ledger_allocations (record_id);
-- 「这笔钱分到哪几张」—— 收款那一页的编辑器问这一句。
create index if not exists ledger_allocations_entry_idx
  on public.ledger_allocations (entry_id);
create index if not exists ledger_allocations_term_idx
  on public.ledger_allocations (term_id) where term_id is not null;

-- ── 谁看得到 ──────────────────────────────────────────────────────────────
--
-- `sees_money()`，跟 ledger_entries 一样。
--
-- ⚠️ 这一条跟上一格**故意相反**，而两边都对：分期付款表用的是 works_here，
-- 因为那是报价单上的一段话，而报价单的总额师傅本来就看得到。
-- 这一张表不是 —— 它讲的是**真的有多少钱进来了**，而那本帐是老板一个人的。
--
-- 🔴 所以画面上要跟着分边：一个师傅打开那张报价单，
-- 「已收 / 还欠」那一段**整段不画**，不是画一个 RM 0。
-- 「读不到」跟「是零」在客户端长得一模一样，而这个仓库被这个形状骗过四次。

alter table public.ledger_allocations enable row level security;

drop policy if exists "ledger_allocations_owner_only" on public.ledger_allocations;
create policy "ledger_allocations_owner_only" on public.ledger_allocations
  for all using (public.sees_money(project_id)) with check (public.sees_money(project_id));

-- ── 它的 project 就是那笔钱的 project，而且那张单要是同一家 ────────────────

create or replace function public.ledger_allocations_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  entry_project uuid;
  entry_reversal uuid;
  record_project uuid;
  term_record uuid;
begin
  select project_id, adjusts_id into entry_project, entry_reversal
  from public.ledger_entries where id = new.entry_id;
  if entry_project is null then
    raise exception 'no such payment';
  end if;

  /* 冲正那一笔不用再分摊 —— 它是撤销，不是收入。 */
  if entry_reversal is not null then
    raise exception 'that entry is a reversal; a reversal is not allocated';
  end if;

  select project_id into record_project
  from public.pipeline_records where id = new.record_id;
  if record_project is null then
    raise exception 'no such document';
  end if;
  if record_project <> entry_project then
    raise exception 'that payment and that document belong to different businesses';
  end if;

  /* 🔴 别的单上的一期，不可以拿来分摊这一张。
     跟 20260901060000「两个同名的客户不准猜」是同一类：
     一个指错了地方的连结，画面上看起来完全正常。 */
  if new.term_id is not null then
    select record_id into term_record
    from public.record_terms where id = new.term_id;
    if term_record is null or term_record <> new.record_id then
      raise exception 'that instalment is not on that document';
    end if;
  end if;

  new.project_id := entry_project;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists ledger_allocations_own_project_trg on public.ledger_allocations;
create trigger ledger_allocations_own_project_trg
  before insert or update on public.ledger_allocations
  for each row execute function public.ledger_allocations_own_project();

-- ── 加总写回那笔钱 ────────────────────────────────────────────────────────
--
-- `allocated_cents` 从今天起只有这一支在写。
--
-- `against_id` 也一起维护，而且规则讲得出口：**只分给一张单的时候它就是那张单，
-- 分给两张以上的时候它是 null** —— 因为那时候「这笔钱是给哪一张的」这个问题
-- 本来就没有一个答案，而随便挑一张填进去，正是两个真相开始打架的方式。

create or replace function public.ledger_allocations_sync_one(in_entry_id uuid)
returns void language plpgsql
security definer
set search_path = public
as $$
declare
  total bigint;
  only_one uuid;
  how_many integer;
begin
  select coalesce(sum(a.amount_cents), 0), count(*)
    into total, how_many
  from public.ledger_allocations a where a.entry_id = in_entry_id;

  if how_many = 1 then
    select a.record_id into only_one
    from public.ledger_allocations a where a.entry_id = in_entry_id;
  else
    only_one := null;
  end if;

  update public.ledger_entries e
     set allocated_cents = total,
         against_id = only_one,
         updated_at = now()
   where e.id = in_entry_id;
end;
$$;

create or replace function public.ledger_allocations_sync()
returns trigger language plpgsql
security definer
set search_path = public
as $$
begin
  /* 一笔分摊被搬到另一笔钱底下的时候，两边都要重算。 */
  if tg_op <> 'INSERT' and old.entry_id is not null then
    perform public.ledger_allocations_sync_one(old.entry_id);
  end if;
  if tg_op <> 'DELETE' and new.entry_id is not null then
    perform public.ledger_allocations_sync_one(new.entry_id);
  end if;
  return null;
end;
$$;

drop trigger if exists ledger_allocations_sync_trg on public.ledger_allocations;
create trigger ledger_allocations_sync_trg
  after insert or update or delete on public.ledger_allocations
  for each row execute function public.ledger_allocations_sync();

-- ── 写它 ──────────────────────────────────────────────────────────────────
--
-- 一次换掉整笔钱的分摊，跟 set_record_lines / set_record_terms 同一个形状：
-- 「这 RM 20,000 是这样分的」是一句完整的话，半套改完的分摊表是一份对不起来的帐。

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

  /* ── 分摊不可以超过那笔钱本身 ──────────────────────────────────────────
     `ledger_entries_allocation_fits` 那条 check 已经会挡，但它吐的是
     「violates check constraint」，而他读不懂那一句。这里先讲人话。
     两道都留着：一道给人看，一道是最后一层。 */
  select coalesce(sum(a.amount_cents), 0) into spent
  from public.ledger_allocations a where a.entry_id = in_entry_id;
  if spent > entry.amount_cents then
    raise exception 'that is more than the payment: % sen received, % sen allocated',
      entry.amount_cents, spent;
  end if;

  /* ── 一张单收到的，不可以超过那张单本身 ────────────────────────────────
     多收的那一部分不是错，是**订金** —— 留着不分摊就好，
     而那正是这张表存在的理由。所以这一句要把做法讲出来。

     冲正过的、跟自己是冲正的，都不算收到 —— 见档头。 */
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
revoke execute on function public.ledger_allocations_sync_one(uuid) from public, anon;
