-- 客人自己打得开那一张单，而且按得了「同意」。
--
-- ── 两件事底下是同一样东西 ──────────────────────────────────────────────
--
-- 他 2026-09-05 问的三件里，有两件我判成同一件：
--
--   ① 报价单让客人线上按「同意」
--   ③ 客人自己看得到这一单做到哪
--
-- 两件要的都是**一张不用登入、陌生人打得开的单页**。做一次，两件一起有。
-- 而且它同时把「一张纸印不出来」解掉一大半：这个市场 19 家有 15 家第一屏
-- 就给 WhatsApp（[任务 26] 实测）—— **一条贴得进 WhatsApp 的连结，
-- 比一份要下载的 PDF 更贴合他们本来的做法。**
--
-- ── 🔴 门牌是另一个 uuid，不是那一行的 id ────────────────────────────────
--
-- 最省事的做法是把 record 的 id 当网址。**不行，两个理由：**
--
--   · 那个 id 在别的地方也用（AI 的操作、投影、稽核）—— 一个流出去过的 id
--     以后每一次出现都要重新想「这个人是不是看得到」
--   · **收不回来。** 一个自己的 uuid 可以设成 null，那条连结当场死掉；
--     一个 id 设不了 null
--
-- 跟 `appointments.public_ref`（20260902030000）同一个做法。
--
-- ── 🔴 陌生人看得到什么，看不到什么 ──────────────────────────────────────
--
-- 看得到：这家公司的名字跟他自己选的那套样子 · 单号 · 抬头 · 日期 ·
--         有效期 · 逐项 · 分期表 · 总额 · 走到哪一步 · 工地地址（他自己的）
--
-- 🔴 **看不到**：
--   · `record_lines.note` 跟 `.extra` —— 那两栏没有人规定过是给谁看的，
--     而一句「这个我们进价 12」写在那里完全合理
--   · `record_terms.note` —— 同上
--   · 任何 id（project · record · party · branch）
--   · 这个客人的**其他单**、他欠多少、他的额度 —— 一条连结只开一张单
--   · 成本。那本来就不在这几张表上（开销挂在 `ledger_entries.job_id`），
--     而这一支连碰都不碰它
--
-- ── 🔴 哪几种单分享得了 ──────────────────────────────────────────────────
--
--   ✅ quotations · orders · projects   客人本来就是这张单的另一方
--   ❌ tasks       内部的。「打给供应商问货几时到」不是给客人读的
--   ❌ purchases   那是供应商那一边。它的另一方不是客人，
--                  而「同意」在那一边是另一件事 —— 不为一个没有人开口的
--                  情况先建（[重点 7d-2]）
--
-- 而**答得了**的只有 quotations 跟 orders：一张已经在做的工程没有「同意」
-- 这个动作，那一页是给他看进度的。
--
-- ── 🔴 过期了不准按同意 ──────────────────────────────────────────────────
--
-- [任务 115] 立过：**过期只讲，不挡** —— 但那一条讲的是**老板自己**。
-- 这里按下去的是一个陌生人，而他按的是一个**承诺**。
--
-- **一个有效期存在的全部意义，就是过了那天它不再能被接受。**
-- 挡下来才是照那张纸上印的字做事。而出路一句话就讲得完：
-- 那个日子他一秒钟就改得了。
--
-- ── 「我要改一点」不是多做的 ────────────────────────────────────────────
--
-- Jobber 的客人那一页有这一颗，而它在这个市场更要紧：客人本来就会
-- WhatsApp 他讲「可不可以便宜一点」—— 那句话讲完就散了。
-- 按在这里，**它变成写在那张单上的一句话**，而那正是以后不会吵起来的原因。
--
-- 规矩一条：**「我要改一点」可以被换掉，「同意」不可以。**
-- 答应是一个承诺，问一句不是。

-- ── 那一行多五栏 ──────────────────────────────────────────────────────────
alter table public.pipeline_records
  /* 门牌。null = 这张单没有对外的连结。 */
  add column if not exists share_ref uuid,
  add column if not exists shared_at timestamptz,

  /* 他答了什么、什么时候、他说自己是谁、他补了一句什么。
     ⚠️ `answered_name` 是**他自己打的字**，不认人也不建档 ——
     [任务 89] 量过：靠名字认人会把钱记到另一个人头上。 */
  add column if not exists answered_at timestamptz,
  add column if not exists answer text,
  add column if not exists answered_name text,
  add column if not exists answer_note text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'pipeline_records_answer_word'
  ) then
    alter table public.pipeline_records
      add constraint pipeline_records_answer_word
      check (answer is null or answer in ('accepted', 'changes'));
  end if;
end $$;

/* 一个门牌只开一张单。partial，因为绝大多数单永远不会被分享。 */
create unique index if not exists pipeline_records_share_ref_idx
  on public.pipeline_records (share_ref)
  where share_ref is not null;

comment on column public.pipeline_records.share_ref is
  'The door number for the public page. A separate uuid, never the row id -- so it can be set to null and the link actually dies. See 20260905230000.';
comment on column public.pipeline_records.answer is
  'accepted | changes. Written by a stranger through answer_shared_record. 「changes」 can be replaced, 「accepted」 cannot -- agreeing is a commitment, asking is not.';

-- ── 哪几种单分享得了 ──────────────────────────────────────────────────────
create or replace function public.is_shareable_module(k text)
returns boolean
language sql
immutable
as $$
  select k in ('quotations', 'orders', 'projects');
$$;

comment on function public.is_shareable_module(text) is
  'The documents the customer is the other party to. Tasks are internal; purchases belong to the supplier side. See 20260905230000.';

create or replace function public.is_answerable_module(k text)
returns boolean
language sql
immutable
as $$
  select k in ('quotations', 'orders');
$$;

comment on function public.is_answerable_module(text) is
  'You do not 「accept」 a job already in progress -- that page is there to show progress. See 20260905230000.';

-- ── 开一条连结 ────────────────────────────────────────────────────────────
create or replace function public.share_record(in_record_id uuid)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  row_now public.pipeline_records;
begin
  select * into row_now from public.pipeline_records where id = in_record_id;
  if row_now.id is null then
    raise exception 'no such document';
  end if;
  if not public.works_here(row_now.project_id) then
    raise exception 'not your document';
  end if;
  if not public.is_shareable_module(row_now.module_key) then
    raise exception 'that kind of document is not for the customer to open';
  end if;
  if row_now.archived_at is not null then
    raise exception 'that document is put away -- take it back out before sharing it';
  end if;

  /* 已经开过了就把同一条还给他。**再按一次不会换掉网址** ——
     换掉等於让他昨天发出去的那条连结静静地死掉。 */
  if row_now.share_ref is not null then
    return row_now;
  end if;

  update public.pipeline_records
  set share_ref = gen_random_uuid(),
      shared_at = now(),
      updated_at = now()
  where id = in_record_id
  returning * into row_now;

  return row_now;
end;
$$;

revoke execute on function public.share_record(uuid) from public, anon;
grant execute on function public.share_record(uuid) to authenticated;

comment on function public.share_record(uuid) is
  'Open a public link for one document. Idempotent: pressing it twice returns the same link, because a new one would silently kill the link he sent yesterday. See 20260905230000.';

-- ── 收回那条连结 ──────────────────────────────────────────────────────────
--
-- ⚠️ **收回是真的收回**：门牌设成 null，那条网址当场是 404，
-- 而且再开一条是**新的**网址。一个还开着的旧网址不叫收回。
--
-- 他答过的那几栏**留着** —— 那是发生过的事，不是一个设定。
create or replace function public.unshare_record(in_record_id uuid)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  row_now public.pipeline_records;
begin
  select * into row_now from public.pipeline_records where id = in_record_id;
  if row_now.id is null then
    raise exception 'no such document';
  end if;
  if not public.works_here(row_now.project_id) then
    raise exception 'not your document';
  end if;

  update public.pipeline_records
  set share_ref = null, shared_at = null, updated_at = now()
  where id = in_record_id
  returning * into row_now;

  return row_now;
end;
$$;

revoke execute on function public.unshare_record(uuid) from public, anon;
grant execute on function public.unshare_record(uuid) to authenticated;

comment on function public.unshare_record(uuid) is
  'Kill the public link. The answer the customer already gave stays -- that is something that happened, not a setting. See 20260905230000.';

-- ── 陌生人打开那一张单 ────────────────────────────────────────────────────
--
-- 一支回一行，不是三支 —— 那一页开一次就要全部，
-- 而三个来回在一支 4G 的手机上是三次等待。
create or replace function public.public_shared_record(in_ref uuid)
returns table (
  business_name text,
  style text,
  palette text,
  system_language text,
  module_key text,
  doc_no text,
  title text,
  party text,
  stage text,
  amount_cents bigint,
  issued_on date,
  due_on date,
  is_expired boolean,
  can_answer boolean,
  answer text,
  answered_at timestamptz,
  answered_name text,
  answer_note text,
  site_address text,
  lines jsonb,
  terms jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rec public.pipeline_records;
  proj public.projects;
begin
  if in_ref is null then
    return;
  end if;

  select * into rec from public.pipeline_records r where r.share_ref = in_ref;

  /* 门牌不存在、单被收起来了、那一家关掉了 —— **回一样的东西**。
     跟 submit_site_enquiry 同一句：告诉一个陌生人「这张单存在但你不能看」，
     就是在讲别人生意的事。 */
  if rec.id is null or rec.archived_at is not null then
    return;
  end if;

  select * into proj from public.projects p where p.id = rec.project_id;
  if proj.id is null then
    return;
  end if;

  return query
  select
    coalesce(proj.business_name, ''),
    proj.style,
    proj.palette,
    proj.system_language,
    rec.module_key,
    rec.doc_no,
    rec.title,
    rec.party,
    rec.stage,
    rec.amount_cents,
    rec.issued_on,
    rec.due_on,
    /* 过期是**算出来的**，不是存起来的（[任务 115]）——
       一个存起来的旗子，在排程没跑的那一天就在说谎。 */
    (rec.module_key = 'quotations'
      and rec.due_on is not null
      and rec.due_on < public.today_myt()),
    (public.is_answerable_module(rec.module_key)
      and rec.answer is distinct from 'accepted'
      and not (rec.module_key = 'quotations'
               and rec.due_on is not null
               and rec.due_on < public.today_myt())),
    rec.answer,
    rec.answered_at,
    rec.answered_name,
    rec.answer_note,
    coalesce((
      select btrim(concat_ws(', ',
        nullif(btrim(a.label), ''), nullif(btrim(a.line), ''),
        nullif(btrim(a.region), '')))
      from public.directory_addresses a
      where a.id = rec.site_address_id
    ), ''),
    /* 🔴 逐项：只给客人本来就该在那张纸上读到的那几栏。
       `note` 跟 `extra` **不给** —— 没有人规定过那两栏是写给谁的，
       而一句「这个我们进价 12」写在那里完全合理。 */
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', l.description,
        'qty', l.qty,
        'unit', l.unit,
        'unit_price_cents', l.unit_price_cents,
        'amount_cents', l.amount_cents
      ) order by l.sort_order)
      from public.record_lines l where l.record_id = rec.id
    ), '[]'::jsonb),
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', t.description,
        'portion', t.portion,
        'amount_cents', t.amount_cents,
        'due_on', t.due_on
      ) order by t.sort_order)
      from public.record_terms t where t.record_id = rec.id
    ), '[]'::jsonb);
end;
$$;

revoke execute on function public.public_shared_record(uuid) from public;
grant execute on function public.public_shared_record(uuid) to anon, authenticated;

comment on function public.public_shared_record(uuid) is
  'One shared document, as a stranger holding the link sees it. Carries the business''s own name, style and palette so the page wears HIS brand, not ours. Never a line note, never an id, never another document. See 20260905230000.';

-- ── 客人按下去 ────────────────────────────────────────────────────────────
--
-- ⚠️ 回一个**字**不是抛例外，跟 submit_site_enquiry / submit_site_booking
-- 一样：呼叫者是一个站在别人单据上的人，一句资料库的错误讯息对他没有意义，
-- 对我们还多泄漏一点东西。
create or replace function public.answer_shared_record(
  in_ref uuid,
  in_answer text,
  in_name text,
  in_note text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  rec public.pipeline_records;
begin
  if in_answer is null or in_answer not in ('accepted', 'changes') then
    return 'bad_answer';
  end if;
  if coalesce(btrim(in_name), '') = '' then
    return 'incomplete';
  end if;
  if length(in_name) > 120 or length(coalesce(in_note, '')) > 1000 then
    return 'too_long';
  end if;
  if in_ref is null then
    return 'not_found';
  end if;

  select * into rec from public.pipeline_records r where r.share_ref = in_ref;
  if rec.id is null or rec.archived_at is not null then
    return 'not_found';
  end if;
  if not public.is_answerable_module(rec.module_key) then
    return 'not_found';
  end if;

  /* 🔴 已经同意过了就不给再动。
     「我要改一点」可以换掉 —— 他改好了，客人回来按同意，那是常态。 */
  if rec.answer = 'accepted' then
    return 'answered';
  end if;

  /* 🔴 过期了不准按同意。
     一个有效期存在的全部意义，就是过了那天它不再能被接受。
     ⚠️ 「我要改一点」照旧准 —— 那不是一个承诺，
     而一个想问一句的客人不该因为过了三天就没有地方讲。 */
  if in_answer = 'accepted'
     and rec.module_key = 'quotations'
     and rec.due_on is not null
     and rec.due_on < public.today_myt() then
    return 'expired';
  end if;

  update public.pipeline_records
  set answer = in_answer,
      answered_at = now(),
      answered_name = left(btrim(in_name), 120),
      answer_note = left(btrim(coalesce(in_note, '')), 1000),
      updated_at = now()
  where id = rec.id;

  return 'ok';
end;
$$;

revoke execute on function public.answer_shared_record(uuid, text, text, text) from public;
grant execute on function public.answer_shared_record(uuid, text, text, text) to anon, authenticated;

comment on function public.answer_shared_record(uuid, text, text, text) is
  'A stranger accepts a quotation, or asks for a change. Returns a word, never an exception. Does NOT move the stage: accepting is a fact, moving his pipeline is his judgement -- the same line 20260903010000 drew for expiry. See 20260905230000.';

-- ── 🔴 它故意不做的一件，写下来不要等他发现 ──────────────────────────────
--
-- **按了同意，`stage` 一动都不动。**
--
-- 听起来该动 —— 客人都同意了，那张单当然该从「等回覆」走到「已确认」。
-- 而 `stage` 是**他自己流程里的那一格**，是他的判断；同意是**日历上的事实**。
-- 一个把他的单偷偷搬过去的系统，是替他做了一个他没有做的决定 ——
-- 而那正是 20260903010000 对「过期」画的同一条线。
--
-- 画面上写「客人 9 月 5 日同意了」，然后让他自己按。
--
-- ── 还欠的（一样写下来）──────────────────────────────────────────────────
--
--   · **付订金那半截** —— 分期表已经算得出「订金 RM 14,550」，
--     `open_payment_request` / `settle_payment_request`（20260905020000）
--     也已经在跑。差的是一个收款户口，而那不是这里的事
--   · **那一页不存在** —— 这一支是底下那一层。画面是另一边
--   · **答了不会通知他** —— 卡在同一条通知管道（[任务 59]）
