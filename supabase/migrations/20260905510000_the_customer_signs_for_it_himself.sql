-- 客人自己在他那条连结上按「收到了」
--
-- ## 为什么不做电子签名板
--
-- 外勤那一群（ServiceM8 · Jobber · Housecall）做的是**手指画在萤幕上**。
-- 那一条歪线在争执的时候证明不了任何事 —— 没有人比得了两条线是不是同一个人画的。
--
-- **有时间戳、而且是他自己在他自己的手机上、从他自己那条连结按下去的那一下，
-- 比一条线强得多**：那条连结是我们发给他的，我们没有替他按。
--
-- 而那条连结 20260905230000 已经在了（客人按「同意」用的就是它）——
-- **这一支是同一个机制多一个动作**，不是第二套东西。
--
-- ## 🔴 门牌又是另一个号码
--
-- 一趟自己的 id 不给出去（[任务 155] 立的那条：一个 id 都不出去）。
-- 跟 pipeline_records.share_ref · appointments.public_ref 同一个做法 ——
-- 而它同时买到「收回得了」：一个 id 收不回来，一个门牌可以。

alter table public.deliveries add column if not exists public_ref uuid default gen_random_uuid();
update public.deliveries set public_ref = gen_random_uuid() where public_ref is null;
alter table public.deliveries alter column public_ref set not null;

create unique index if not exists deliveries_public_ref_idx
  on public.deliveries (public_ref);

comment on column public.deliveries.public_ref is
  'The door number a customer signs through. Never the row id -- an id cannot be taken back and shows up elsewhere.';

-- ── 那一页多一段 ──────────────────────────────────────────────────────────
--
-- 🔴 回传的栏位变了 = **回传型别变了**，所以旧的那一支一定要先 drop。

drop function if exists public.public_shared_record(uuid);

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
  terms jsonb,
  deliveries jsonb
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  rec public.pipeline_records;
  proj public.projects;
begin
  if in_ref is null then
    return;
  end if;

  select * into rec from public.pipeline_records r where r.share_ref = in_ref;

  /* 门牌不存在、单被收起来了、那一家关掉了 —— **回一样的东西**。 */
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
    ), '[]'::jsonb),
    /* ── 🔴 送到他家的那几趟 ─────────────────────────────────────────
       给的：门牌 · 日期 · 送了什么 · 签了没有 · 签的名字。
       **不给**：`driver`（那是他的师傅，跟价钱同一条界线，[任务 155]）·
       `received_by`（那是老板自己打的说法，让客人读到它等於在替他背书）·
       `note`（内部的）· 一趟自己的 id。

       批号跟效期**给** —— 那两样本来就印在他手上那个箱子上，
       而一间药行收货第一件事就是核对它。 */
    coalesce((
      select jsonb_agg(jsonb_build_object(
        'ref', d.public_ref,
        'run_on', d.run_on,
        'signed_at', d.signed_at,
        'signed_name', d.signed_name,
        'lines', coalesce((
          select jsonb_agg(jsonb_build_object(
                   'description', l.description,
                   'qty', x.qty,
                   'unit', l.unit,
                   'batch_code', b.code,
                   'expiry_on', b.expiry_on
                 ) order by l.sort_order)
          from (
            select m.line_id, m.batch_id, sum(m.qty) as qty
            from public.stock_moves m
            where m.delivery_id = d.id
            group by m.line_id, m.batch_id
          ) x
          join public.record_lines l on l.id = x.line_id
          left join public.stock_batches b on b.id = x.batch_id
        ), '[]'::jsonb)
      ) order by d.run_on desc, d.created_at desc)
      from public.deliveries d
      where d.record_id = rec.id and d.archived_at is null
    ), '[]'::jsonb);
end;
$fn$;

revoke execute on function public.public_shared_record(uuid) from public;
grant execute on function public.public_shared_record(uuid) to anon, authenticated;

comment on function public.public_shared_record(uuid) is
  'What a stranger sees on his own link: the document, its lines, its instalments, and now the delivery runs. Never the internal line note, never the driver, never received_by, never an id. See 20260905230000 and 20260905510000.';

-- ── 他按下去 ──────────────────────────────────────────────────────────────

create or replace function public.sign_delivery(
  in_ref uuid,
  in_delivery_ref uuid,
  in_name text,
  in_note text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  rec public.pipeline_records;
  run public.deliveries;
begin
  if coalesce(btrim(in_name), '') = '' then
    return 'incomplete';
  end if;
  if length(in_name) > 120 or length(coalesce(in_note, '')) > 1000 then
    return 'too_long';
  end if;
  if in_ref is null or in_delivery_ref is null then
    return 'not_found';
  end if;

  /* 🔴 两个门牌都要对得上，而且那一趟一定要是**这一张单**的。
     只认一趟自己的门牌，等於任何拿到任何一条连结的人都签得了别人的货。 */
  select * into rec from public.pipeline_records r where r.share_ref = in_ref;
  if rec.id is null or rec.archived_at is not null then
    return 'not_found';
  end if;

  select * into run from public.deliveries d
   where d.public_ref = in_delivery_ref and d.record_id = rec.id and d.archived_at is null;
  if run.id is null then
    return 'not_found';
  end if;

  /* 签过了就不给再动 —— 那是一句他已经讲出去的话。
     跟 answer = 'accepted' 换不掉同一条。 */
  if run.signed_at is not null then
    return 'signed';
  end if;

  update public.deliveries
     set signed_at = now(),
         signed_name = left(btrim(in_name), 120),
         signed_note = left(btrim(coalesce(in_note, '')), 1000),
         updated_at = now()
   where id = run.id;

  return 'ok';
end;
$fn$;

revoke execute on function public.sign_delivery(uuid, uuid, text, text) from public;
grant execute on function public.sign_delivery(uuid, uuid, text, text) to anon, authenticated;

comment on function public.sign_delivery(uuid, uuid, text, text) is
  'A stranger signs for one run on his own link. Returns a word, never an exception. Both door numbers must match AND the run must belong to that document. Does NOT move the stage: signing is a fact, moving his pipeline is his judgement. See 20260905510000.';

-- ── 🔴 它故意不做的两件 ───────────────────────────────────────────────────
--
--   · **签了，`stage` 一动都不动** —— 跟按「同意」同一条（20260905230000）：
--     签收是日历上的事实，搬他那一格是他的判断
--   · **签了不会通知他** —— 卡在同一条管道（[任务 59]）
