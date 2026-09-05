-- 过期了，他还是讲得出「我要改一点」。
--
-- ── 洞是接画面的时候撞到的 ────────────────────────────────────────────────
--
-- `answer_shared_record`（20260905230000）白纸黑字写着：
--
--   「🔴 过期了不准按同意…⚠️ 「我要改一点」照旧准 —— 那不是一个承诺，
--     而一个想问一句的客人不该因为过了三天就没有地方讲。」
--
-- 而**读**那一边（`public_shared_record`）的 `can_answer` 把过期也算进去，
-- 所以一张过期的报价单回 `can_answer = false` ——
-- 🔴 **画面照读的那一个，於是整个答覆表单被收起来**：
-- 客人连问一句的地方都没有，而资料库那一边是准的。
-- **读跟写讲的不是同一件事**，而这个仓库二十次「说了没做」全部是这个形状。
--
-- ── 这是「放宽」，所以先问它本来在保护什么（重点 31）──────────────────────
--
-- **什么都没有。** 写那一边自己有一条一模一样的守卫（`in_answer = 'accepted'`
-- 才看过期），而且它更准。这里那一条只是把它抄错了范围。
-- 过期照旧回在 `is_expired` 上，画面拿它去把「同意」那一颗变灰。
--
-- ⚠️ 整支从 **20260905510000**（最后一次定义它的那个档案）原样搬过来、
--    只改那一段。第一版抄了 250000，而那一版少一栏 `deliveries` ——
--    `db push` 当场拒绝：`cannot change return type of existing function`。
--    「原来那一支」是**最后一次定义它的那个档案**，不是我记得的那一个
--    （任务 183 记过同一课，这是第二次）。

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
    /* 🔴 2026-09-05 改：**过期不再关掉整个答覆**。
       写那一边（`answer_shared_record`）自己就写着
       「我要改一点照旧准 —— 那不是一个承诺，而一个想问一句的客人
       不该因为过了三天就没有地方讲」，而这里回 false，
       画面就把整个表单收起来了。**读跟写讲的不是同一件事，
       而画面照读的那一个。**
       过期照旧回在 `is_expired` 上，画面拿它去把「同意」那一颗变灰。 */
    (public.is_answerable_module(rec.module_key)
      and rec.answer is distinct from 'accepted'),
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
