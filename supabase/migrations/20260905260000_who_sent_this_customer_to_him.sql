-- 这一单是谁介绍的，答应了给他多少，给了没有。
--
-- ── 为什么这一件值得做 ──────────────────────────────────────────────────
--
-- **装修在这个市场是百分之百靠口碑的** —— 而那笔介绍费今天记在他脑袋里：
-- 谁介绍的 · 答应了多少 · 给了没有，三样都没有纪录，**最后常常变成一场架**。
-- 沙龙 · 车厂 · 冷气一模一样。
--
-- 而它是[留客四根柱](../docs/founder-points.md)最硬的那一根：
-- **不续，他就断了一条真的客源。**
--
-- ⚠️ 但我顶过一句，写下来免得以后误读它：**它不是签单用的，是留客用的。**
-- 一个刚签下来的新客户，第一个月里这个功能什么都不会发生 —— 他还没有介绍人。
-- 它在第二年发力，所以排在[公开连结](20260905230000)后面。
--
-- ── 🔴 「给了没有」不存一个旗子，是算出来的 ──────────────────────────────
--
-- 最省事的是加一栏 `referral_paid boolean`。**不要** —— 那是任何人都写得进去
-- 的一个字，而它讲的是钱。
--
-- 真相本来就在帐上：**方向是出、收款人是他、而且挂在这一单上**
-- （`ledger_entries.party_id` ＋ `job_id`，两栏都已经在了）。
-- 所以「给了多少」是加出来的，而它跟他自己的帐永远不会打架。
--
-- 跟这套 schema 已经判过四次的同一条：架上有几件是流水加起来的 ·
-- 过期是日历算的 · 帐龄是日期算的 · 保养的到期日是排程算的。
-- **存起来的数字会说谎，算出来的不会。**
--
-- ── 🔴 比例算在「收到的钱」上，不是算在单子上 ──────────────────────────
--
-- 跟佣金（20260904120000）同一条，而这里的理由更硬：
-- **客人根本没付钱，他不会想付介绍费。** 一个照单子面额算的介绍费，
-- 会在一张收不回来的单上凭空长出一笔他要给的钱。
--
-- ⚠️ 而「一单给 RM 300」那种**写死的金额**不吃这一条 ——
-- 那是他答应的一个数字，不是一个比例，本来就没有基数。
--
-- ── 三件故意不做 ────────────────────────────────────────────────────────
--
--   ❌ **不自动记一笔开销。** 算出来是 RM 300，画面就写 RM 300 ——
--      替他记一笔他还没有讲过要给的钱，是在他的帐上凭空多一笔支出，
--      而他要到对帐才发现（[任务 128](../docs/founder-tasks.md) 同一条）
--   ❌ **不做多层。** 中国那一套做到四层（介绍人的介绍人也抽）——
--      一个五个人的装修公司不需要，而多一层就要一整套追溯
--   ❌ **不限定介绍人一定是客户。** 供应商介绍、师傅介绍都是真的会发生的事。
--      名册上的任何一个人都可以，**谁给谁钱是他的生意，不是我们要管的事**

alter table public.pipeline_records
  /* 谁介绍的。**名册上的一个人**，不是一行字 ——
     「阿明」这三个字答不了「他一共替我介绍了几单」。 */
  add column if not exists referrer_id uuid,

  /* 答应了多少。比例**或者**金额，只准一个 —— 跟 record_terms 同一条：
     两个都存会打架，而一个过期的金额在画面上看不出来。 */
  add column if not exists referral_portion numeric(5, 2),
  add column if not exists referral_amount_cents bigint;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pipeline_records_referrer_fkey'
  ) then
    alter table public.pipeline_records
      add constraint pipeline_records_referrer_fkey
      foreign key (referrer_id) references public.directory_entries(id)
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'pipeline_records_referral_one_measure'
  ) then
    alter table public.pipeline_records
      add constraint pipeline_records_referral_one_measure
      check (referral_portion is null or referral_amount_cents is null);
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'pipeline_records_referral_sane'
  ) then
    alter table public.pipeline_records
      add constraint pipeline_records_referral_sane
      check (
        (referral_portion is null or (referral_portion > 0 and referral_portion <= 100))
        and (referral_amount_cents is null or referral_amount_cents > 0)
      );
  end if;
end $$;

create index if not exists pipeline_records_referrer_idx
  on public.pipeline_records (project_id, referrer_id)
  where referrer_id is not null;

comment on column public.pipeline_records.referrer_id is
  'Who sent this customer. A row in the directory, never a line of text -- 「阿明」 cannot answer 「how many has he sent me」. See 20260905260000.';
comment on column public.pipeline_records.referral_portion is
  'Percent of the money actually RECEIVED on this job, not of the document. If the customer never pays, he was never going to pay a referral fee either.';

-- ── 写下来是谁介绍的 ──────────────────────────────────────────────────────
--
-- 🔴 `sees_money`，不是 `works_here` —— 一笔答应给出去的钱是钱。
-- 一个师傅不该从这里学到老板给了谁多少介绍费。
create or replace function public.set_record_referral(
  in_record_id uuid,
  in_referrer_id uuid default null,
  in_portion numeric default null,
  in_amount_cents bigint default null
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.pipeline_records;
  who public.directory_entries;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null then
    raise exception 'no such document';
  end if;
  if not public.sees_money(rec.project_id) then
    raise exception 'only the owner can set a referral fee';
  end if;

  /* 清掉。三栏一起走 —— 留一个没有人的比例，是一笔没有收款人的钱。 */
  if in_referrer_id is null then
    update public.pipeline_records
    set referrer_id = null, referral_portion = null,
        referral_amount_cents = null, updated_at = now()
    where id = in_record_id
    returning * into rec;
    return rec;
  end if;

  select * into who from public.directory_entries where id = in_referrer_id;
  if who.id is null or who.project_id <> rec.project_id then
    raise exception 'that person is not in this business''s directory';
  end if;

  /* 🔴 自己介绍自己不算。这不是一个假想的输入错误 ——
     那一格挑的是同一份名册，而这一单的客户就排在最上面。 */
  if rec.party_id is not null and who.id = rec.party_id then
    raise exception 'the customer cannot be his own referrer';
  end if;

  if in_portion is not null and in_amount_cents is not null then
    raise exception 'a referral fee is a percentage or a figure, not both';
  end if;
  if in_portion is null and in_amount_cents is null then
    raise exception 'say how much was promised';
  end if;

  update public.pipeline_records
  set referrer_id = who.id,
      referral_portion = in_portion,
      referral_amount_cents = in_amount_cents,
      updated_at = now()
  where id = in_record_id
  returning * into rec;

  return rec;
end;
$$;

revoke execute on function public.set_record_referral(uuid, uuid, numeric, bigint)
  from public, anon;
grant execute on function public.set_record_referral(uuid, uuid, numeric, bigint)
  to authenticated;

comment on function public.set_record_referral(uuid, uuid, numeric, bigint) is
  'Who sent this job in and what was promised. Owner only -- a promised payout is money. Writes nothing to the ledger: paying it is his act, and 「paid」 is summed back from the expenses he actually recorded. See 20260905260000.';

-- ── 谁替他带过生意，他还欠人家多少 ────────────────────────────────────────
--
-- 一行一个介绍人，不是一行一张单 —— 他真正要做的动作是**打给阿明**，
-- 而不是逐张单对帐。
create or replace function public.referrals_owing(in_project_id uuid)
returns table (
  referrer_id uuid,
  name text,
  whatsapp text,
  jobs integer,
  received_cents bigint,
  promised_cents bigint,
  paid_cents bigint,
  owing_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sees_money(in_project_id) then
    return;
  end if;

  return query
  with jobs as (
    select r.id, r.referrer_id, r.referral_portion, r.referral_amount_cents,
           /* 这一单真的收到多少。冲正过的、跟自己是冲正的都不算 ——
              同一条规矩在 lib/portal/allocations.ts 的 countsAsReceived。 */
           coalesce((
             select sum(a.amount_cents)
             from public.ledger_allocations a
             join public.ledger_entries e on e.id = a.entry_id
             where a.record_id = r.id
               and e.direction = 'in'
               and e.adjusts_id is null
               and not exists (
                 select 1 from public.ledger_entries x where x.adjusts_id = e.id
               )
           ), 0)::bigint as got
    from public.pipeline_records r
    where r.project_id = in_project_id
      and r.referrer_id is not null
      and r.archived_at is null
  ),
  owed as (
    select j.referrer_id,
           count(*)::integer as jobs,
           sum(j.got)::bigint as received,
           /* 写死的金额照写；比例算在**收到的钱**上。 */
           sum(coalesce(
             j.referral_amount_cents,
             floor(j.got * j.referral_portion / 100)
           ))::bigint as promised
    from jobs j
    group by j.referrer_id
  ),
  handed as (
    /* 🔴 「给了多少」是加出来的：方向是出 · 收款人是他 ·
       而且挂在这几单其中一单上。 */
    select e.party_id as who, sum(e.amount_cents)::bigint as total
    from public.ledger_entries e
    where e.project_id = in_project_id
      and e.direction = 'out'
      and e.party_id is not null
      and e.job_id in (select j.id from jobs j)
      and e.adjusts_id is null
      and not exists (
        select 1 from public.ledger_entries x where x.adjusts_id = e.id
      )
    group by e.party_id
  )
  select d.id, d.name, d.whatsapp,
         o.jobs, o.received, o.promised,
         coalesce(h.total, 0)::bigint,
         greatest(o.promised - coalesce(h.total, 0), 0)::bigint
  from owed o
  join public.directory_entries d on d.id = o.referrer_id
  left join handed h on h.who = o.referrer_id
  /* 欠最多的排前面 —— 那一行就是他今天要处理的那一件。 */
  order by greatest(o.promised - coalesce(h.total, 0), 0) desc, d.name;
end;
$$;

revoke execute on function public.referrals_owing(uuid) from public, anon;
grant execute on function public.referrals_owing(uuid) to authenticated;

comment on function public.referrals_owing(uuid) is
  'One row per referrer: how many he sent, how much came in, what was promised, what has been handed over, what is still owed. 「Paid」 is summed from real expenses, never a flag. See 20260905260000.';

-- ── 他一共替我带过几单 ────────────────────────────────────────────────────
--
-- 这一支是**看一个人**的时候要的那几行 —— 打给阿明之前，
-- 他要看得出是哪几单。
create or replace function public.referred_jobs(
  in_project_id uuid,
  in_referrer_id uuid
)
returns table (
  record_id uuid,
  doc_no text,
  title text,
  party text,
  amount_cents bigint,
  received_cents bigint,
  promised_cents bigint,
  issued_on date
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sees_money(in_project_id) then
    return;
  end if;

  return query
  select r.id, r.doc_no, r.title, r.party, r.amount_cents,
         got.total,
         coalesce(r.referral_amount_cents,
                  floor(got.total * r.referral_portion / 100))::bigint,
         r.issued_on
  from public.pipeline_records r
  cross join lateral (
    select coalesce(sum(a.amount_cents), 0)::bigint as total
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where a.record_id = r.id
      and e.direction = 'in'
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries x where x.adjusts_id = e.id)
  ) got
  where r.project_id = in_project_id
    and r.referrer_id = in_referrer_id
    and r.archived_at is null
  order by r.issued_on desc nulls last, r.doc_no desc;
end;
$$;

revoke execute on function public.referred_jobs(uuid, uuid) from public, anon;
grant execute on function public.referred_jobs(uuid, uuid) to authenticated;

comment on function public.referred_jobs(uuid, uuid) is
  'The jobs one person sent in. What he does before calling 阿明 is look at which ones. See 20260905260000.';

-- ── 🔴 还欠的，写下来 ────────────────────────────────────────────────────
--
--   · **画面上没有那一格** —— 「这一单是谁介绍的」那个挑选器是画面那一层
--   · **不会自动提醒他去给** —— 卡在同一条通知管道（[任务 59]）
--   · **一单一个介绍人** —— 两个人一起介绍的情况，他自己分。
--     两个人一张单要一张子表，而那是[重点 7d-2] 讲的那种「没有人开口就先建」
