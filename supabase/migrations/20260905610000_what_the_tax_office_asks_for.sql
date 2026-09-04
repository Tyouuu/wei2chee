-- 电子发票 · SST —— **做到能送出去的前一步为止，然后老实讲那一步为什么还不能做**
--
-- ## 先讲范围，因为这一件最容易做出一个假的「已接上」
--
-- 真的送去税局要三样我们今天一样都没有：
-- **一家注册好的公司** · **LHDN 发的凭证** · **一把数位签章**。
-- 他的公司还在办（[任务 136](#136)）。
--
-- 🔴 **所以这一支不接送出去那一段，而且不假装接了。**
-- 一段猜出来的对接代码，会一路看起来像已经好了，
-- 直到真的接上那一天才发现全错 —— 20260905020000 的档头写过同一句
-- （收款闸道那个「接缝」故意留空，没有假装知道 CHIP 的栏位叫什么）。
--
-- 做的是**送出去之前的全部**，而那一半才是他每天真的会碰到的：
--
--   · 他自己那一边的身分（TIN · SSM · MSIC · SST 号码）—— **今天完全没有**
--   · 一张单上的税（SST）—— **今天完全没有**
--   · **这张单开得出电子发票吗？还差什么** —— 用他看得懂的话讲
--   · 那份**结构化的单据**，栏位照 LHDN 自己的 SDK（[任务 70](#70) 读的原文）
--   · 他要报的那张 SST 表的数字
--
-- ## ⚠️ 而急迫性要讲准，不要吓他
--
-- [任务 136](#136) 查到：**2026-01-01 起免除门槛从 RM50 万升到 RM100 万，
-- 而且第五阶段取消了**（首相 2025-12-07 宣布）。
-- **他大部分的客户（装修 · 沙龙 · 车厂）现在是免除的。**
--
-- 所以这一件的理由**不是**「法律逼他」，是 [重点 18](../docs/founder-points.md)：
-- **少了它这一套完不完整** —— 一家批发商会超过一百万，
-- 而一个客户看到「什么都有就是没有电子发票」，会觉得这套还没做完。
--
-- ## SST 的门槛也一样，一起写下来
--
-- **一年营业额超过 RM 500,000 才要登记**，过线之后 30 天内去关税局。
-- 服务税现在是 **8%**（2025-07 起，之前是 6%）。
-- 🔴 **所以税率是一个「那一天的事实」，不是一个设定** ——
-- 存在**那一张单**上，不是只存在他的档案里；不然去年那几张单
-- 会在他改税率的那一秒全部变成另一个数字。

-- ── 他自己那一边 ──────────────────────────────────────────────────────────

create table if not exists public.tax_profile (
  project_id uuid primary key references public.projects(id) on delete cascade,

  /* LHDN 的纳税人编号。电子发票上 Supplier 的第一格。 */
  tin text not null default '',
  /* SSM 注册号。个人商号跟私人有限公司都有。 */
  reg_no text not null default '',
  /* 行业代号（五位数）。LHDN 要它，而他要去 SSM 那边查自己的。 */
  msic_code text not null default '',
  msic_name text not null default '',

  address_line text not null default '',
  postcode text not null default '',
  city text not null default '',
  state text not null default '',
  phone text not null default '',
  email text not null default '',

  /* ── SST ────────────────────────────────────────────────────────────
     `sst_no` 空的就是**还没登记**，而那是绝大多数小生意的状态 ——
     所以预设不是「税率 0」，是**根本不算税**。两件事不一样：
     一张写着「SST RM 0.00」的单，是在讲一件他没有资格讲的话。 */
  sst_no text not null default '',
  sst_from date,
  /* 服务税现在 8%。存在这里的是**预设**，真正算数的是单据上那一栏。 */
  sst_rate numeric(5, 2) not null default 8.00 check (sst_rate >= 0 and sst_rate <= 100),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.tax_profile enable row level security;

drop policy if exists "tax_profile_money" on public.tax_profile;
create policy "tax_profile_money" on public.tax_profile
  for all using (public.sees_money(project_id)) with check (public.sees_money(project_id));

comment on table public.tax_profile is
  'Who the business is to LHDN and the customs office. Empty sst_no means not registered, and that means no tax line at all -- an invoice printing 「SST RM 0.00」 says something the business has no standing to say. See 20260905610000.';
comment on column public.tax_profile.sst_rate is
  'The DEFAULT rate. What counts is the rate stored on each document, so changing this never rewrites last year''s invoices.';

create or replace function public.set_tax_profile(
  in_project_id uuid,
  in_tin text default null,
  in_reg_no text default null,
  in_msic_code text default null,
  in_msic_name text default null,
  in_address_line text default null,
  in_postcode text default null,
  in_city text default null,
  in_state text default null,
  in_phone text default null,
  in_email text default null,
  in_sst_no text default null,
  in_sst_from date default null,
  in_sst_rate numeric default null
)
returns public.tax_profile
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.tax_profile;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your project';
  end if;

  insert into public.tax_profile (project_id) values (in_project_id)
  on conflict (project_id) do nothing;

  update public.tax_profile set
    tin          = coalesce(left(btrim(in_tin), 30), tin),
    reg_no       = coalesce(left(btrim(in_reg_no), 30), reg_no),
    msic_code    = coalesce(left(btrim(in_msic_code), 10), msic_code),
    msic_name    = coalesce(left(btrim(in_msic_name), 200), msic_name),
    address_line = coalesce(left(btrim(in_address_line), 200), address_line),
    postcode     = coalesce(left(btrim(in_postcode), 10), postcode),
    city         = coalesce(left(btrim(in_city), 60), city),
    state        = coalesce(left(btrim(in_state), 60), state),
    phone        = coalesce(left(btrim(in_phone), 30), phone),
    email        = coalesce(left(btrim(in_email), 120), email),
    sst_no       = coalesce(left(btrim(in_sst_no), 30), sst_no),
    sst_from     = coalesce(in_sst_from, sst_from),
    sst_rate     = coalesce(in_sst_rate, sst_rate),
    updated_at   = now()
  where project_id = in_project_id
  returning * into row;

  return row;
end;
$fn$;

revoke execute on function public.set_tax_profile(uuid, text, text, text, text, text, text, text, text, text, text, text, date, numeric)
  from public, anon;
grant execute on function public.set_tax_profile(uuid, text, text, text, text, text, text, text, text, text, text, text, date, numeric)
  to authenticated;

-- ── 一张单上的税 ──────────────────────────────────────────────────────────
--
-- 🔴 **存税率，不存税额。**
-- 税额 = 金额 × 税率，而金额会因为多加一行明细而变 ——
-- 一个存起来的税额，在那一刻当场过期，而画面上没有任何东西会讲。
-- 跟 `record_terms.portion`（存比例不存金额）同一条判断。

alter table public.pipeline_records
  add column if not exists tax_rate numeric(5, 2)
    check (tax_rate is null or (tax_rate >= 0 and tax_rate <= 100));

comment on column public.pipeline_records.tax_rate is
  'The SST rate agreed on this document. Null means no tax line at all (he is not registered, or this one is exempt) -- which is different from 0.00, and the difference is printed. The amount is computed from it so an added line cannot leave a stale tax figure behind.';

create or replace function public.set_record_tax(
  in_record_id uuid,
  in_rate numeric default null,
  in_clear boolean default false
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $fn$
declare
  rec public.pipeline_records;
  prof public.tax_profile;
  use_rate numeric;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null or not public.sees_money(rec.project_id) then
    raise exception 'no such document in your project';
  end if;

  if in_clear then
    update public.pipeline_records set tax_rate = null, updated_at = now()
     where id = in_record_id returning * into rec;
    return rec;
  end if;

  select * into prof from public.tax_profile where project_id = rec.project_id;

  /* 没讲税率就用他档案上那个 —— 但**只有在他真的登记过**的时候。
     没登记而套一个 8%，是替他开一张他没有资格开的税单。 */
  use_rate := in_rate;
  if use_rate is null then
    if coalesce(btrim(prof.sst_no), '') = '' then
      raise exception 'you are not registered for SST, so say the rate explicitly if this one really carries tax';
    end if;
    use_rate := prof.sst_rate;
  end if;

  if use_rate < 0 or use_rate > 100 then
    raise exception 'that is not a rate';
  end if;

  update public.pipeline_records set tax_rate = use_rate, updated_at = now()
   where id = in_record_id returning * into rec;
  return rec;
end;
$fn$;

revoke execute on function public.set_record_tax(uuid, numeric, boolean) from public, anon;
grant execute on function public.set_record_tax(uuid, numeric, boolean) to authenticated;

comment on function public.set_record_tax(uuid, numeric, boolean) is
  'Sets the rate on one document. Refuses to fall back to the profile default when he is not registered, because applying 8% for a business with no SST number is issuing a tax invoice it has no standing to issue. See 20260905610000.';

-- ── 这张单开得出电子发票吗，还差什么 ──────────────────────────────────────
--
-- **用他看得懂的话讲**（[重点 22b](../docs/founder-points.md)）——
-- 一份写着 `Supplier.TIN is required` 的清单，对一个装修老板等於没写。

create or replace function public.einvoice_readiness(in_record_id uuid)
returns table (
  what text,
  missing text
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  rec public.pipeline_records;
  prof public.tax_profile;
  party public.directory_entries;
  is_en boolean;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null or not public.sees_money(rec.project_id) then
    raise exception 'no such document in your project';
  end if;

  select p.system_language = 'en' into is_en
    from public.projects p where p.id = rec.project_id;
  select * into prof from public.tax_profile where project_id = rec.project_id;
  if rec.party_id is not null then
    select * into party from public.directory_entries where id = rec.party_id;
  end if;

  if coalesce(btrim(prof.tin), '') = '' then
    what := case when is_en then 'Your tax number (TIN)' else '你的纳税人编号（TIN）' end;
    missing := case when is_en then 'Not filled in yet' else '还没填' end;
    return next;
  end if;
  if coalesce(btrim(prof.reg_no), '') = '' then
    what := case when is_en then 'Your SSM number' else '你的 SSM 注册号' end;
    missing := case when is_en then 'Not filled in yet' else '还没填' end;
    return next;
  end if;
  if coalesce(btrim(prof.msic_code), '') = '' then
    what := case when is_en then 'Your trade code (MSIC)' else '你的行业代号（MSIC）' end;
    missing := case when is_en then 'Look it up on your SSM certificate' else '在 SSM 的证书上查得到' end;
    return next;
  end if;
  if coalesce(btrim(prof.address_line), '') = '' or coalesce(btrim(prof.city), '') = '' then
    what := case when is_en then 'Your business address' else '你的营业地址' end;
    missing := case when is_en then 'Street and town are both needed' else '街道跟城市两样都要' end;
    return next;
  end if;

  /* 🔴 客人那一边：**一个陌生人（walk-in）不用 TIN**，
     LHDN 有一个通用编号给他们。所以「没有 TIN」只在**公司客户**身上算缺。 */
  if rec.party_id is null then
    what := case when is_en then 'Which customer this is' else '这张单是哪一个客户的' end;
    missing := case when is_en then 'Pick him from your list, not just a name'
                    else '要从名单里挑，不能只是打一个名字' end;
    return next;
  elsif party.kind = 'company' and coalesce(btrim(party.tax_id), '') = '' then
    what := case when is_en then 'The customer''s tax number' else '客户的纳税人编号' end;
    missing := case when is_en then 'A company buyer needs one' else '公司客户要有' end;
    return next;
  end if;

  if not exists (select 1 from public.record_lines l where l.record_id = rec.id) then
    what := case when is_en then 'What you are charging for' else '这张单卖的是什么' end;
    missing := case when is_en then 'At least one line' else '至少要有一行明细' end;
    return next;
  end if;

  if coalesce(rec.amount_cents, 0) <= 0 then
    what := case when is_en then 'The amount' else '金额' end;
    missing := case when is_en then 'It is still zero' else '还是零' end;
    return next;
  end if;

  return;
end;
$fn$;

revoke execute on function public.einvoice_readiness(uuid) from public, anon;
grant execute on function public.einvoice_readiness(uuid) to authenticated;

comment on function public.einvoice_readiness(uuid) is
  'What is still missing before this document could go to LHDN, said in the owner''s own language. A walk-in buyer deliberately does not need a TIN -- LHDN publishes a general number for them -- so only a company buyer is flagged. See 20260905610000.';

-- ── 那份结构化的单据 ──────────────────────────────────────────────────────
--
-- 栏位照 LHDN 自己的 SDK（[任务 70](#70) 读的原文）：
-- 编号（**上限 50 字**，20260830050000 已经守着）· Supplier · Buyer（都是**结构**）·
-- 型别代号 · 日期＋时间（UTC）· 币别 · 明细。
--
-- ⚠️ **它不送出去，也不签章。** 它产出的是那份要送的东西 ——
-- 而接上那一天，缺的只有一层壳。

create or replace function public.einvoice_payload(in_record_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  rec public.pipeline_records;
  prof public.tax_profile;
  proj public.projects;
  party public.directory_entries;
  addr public.directory_addresses;
  net bigint;
  tax bigint;
begin
  select * into rec from public.pipeline_records where id = in_record_id;
  if rec.id is null or not public.sees_money(rec.project_id) then
    raise exception 'no such document in your project';
  end if;

  select * into proj from public.projects where id = rec.project_id;
  select * into prof from public.tax_profile where project_id = rec.project_id;
  if rec.party_id is not null then
    select * into party from public.directory_entries where id = rec.party_id;
    select * into addr from public.directory_addresses
     where party_id = rec.party_id order by created_at limit 1;
  end if;

  net := coalesce(rec.amount_cents, 0);
  /* 税额是**算出来的**。存起来的那一刻它就会跟明细打架。 */
  tax := case when rec.tax_rate is null then 0
              else round(net * rec.tax_rate / 100.0)::bigint end;

  return jsonb_build_object(
    /* 一张报价单不是这四种任何一种 —— 型别只有真的单据才有。 */
    'typeCode', case rec.module_key
                  when 'orders' then '01'      -- Invoice
                  when 'projects' then '01'
                  else null end,
    'eInvoiceNumber', left(coalesce(rec.doc_no, ''), 50),
    'issuedOn', rec.issued_on,
    /* LHDN 要日期**加时间，而且是 UTC**。我们只有日期（20260830040000
       就写着这一条），所以补的是那一天的开始，而且这一句要看得见 ——
       一个编出来的时间会一路看起来是对的。 */
    'issuedAtUtc', (rec.issued_on::timestamp at time zone 'Asia/Kuala_Lumpur'),
    'currency', 'MYR',
    'supplier', jsonb_build_object(
      'name', coalesce(proj.business_name, ''),
      'tin', prof.tin, 'registrationNumber', prof.reg_no,
      'sstNumber', nullif(prof.sst_no, ''),
      'msicCode', prof.msic_code, 'msicName', prof.msic_name,
      'address', jsonb_build_object(
        'line', prof.address_line, 'postcode', prof.postcode,
        'city', prof.city, 'state', prof.state, 'country', 'MYS'),
      'phone', prof.phone, 'email', prof.email
    ),
    'buyer', case when party.id is null then null else jsonb_build_object(
      'name', party.name,
      'kind', party.kind,
      'tin', nullif(party.tax_id, ''),
      'registrationNumber', nullif(party.reg_no, ''),
      'address', case when addr.id is null then null else jsonb_build_object(
        'line', addr.line, 'city', addr.region, 'country', 'MYS') end,
      'phone', nullif(party.phone, ''),
      'email', nullif(party.email, '')
    ) end,
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'description', l.description,
        'quantity', l.qty,
        'unit', nullif(l.unit, ''),
        'unitPriceCents', l.unit_price_cents,
        'amountCents', l.amount_cents
      ) order by l.sort_order)
      from public.record_lines l where l.record_id = rec.id
    ), '[]'::jsonb),
    'totals', jsonb_build_object(
      'netCents', net,
      'taxRate', rec.tax_rate,
      'taxCents', tax,
      'grossCents', net + tax
    ),
    /* 🔴 老实讲还差什么 —— 一份少了签章却看起来完整的东西，
       正是这一支最该避免的。 */
    'notReadyBecause', jsonb_build_object(
      'digitalSignature', 'not implemented -- needs a company, an LHDN certificate and a key',
      'submission', 'not implemented -- see the header of 20260905610000',
      'issuedAtIsMidnight', rec.issued_on is not null
    )
  );
end;
$fn$;

revoke execute on function public.einvoice_payload(uuid) from public, anon;
grant execute on function public.einvoice_payload(uuid) to authenticated;

comment on function public.einvoice_payload(uuid) is
  'The structured document LHDN asks for, built from what is already recorded. It does NOT sign and does NOT submit, and it says so inside the payload rather than looking finished. See 20260905610000.';

-- ── 他要报的那张表 ────────────────────────────────────────────────────────
--
-- ⚠️ **只算他真的收到的钱**，跟试算表同一条（收付实现制）——
-- 服务税在马来西亚本来就是收到才缴。

create or replace function public.sst_return(
  in_project_id uuid,
  in_from date,
  in_to date
)
returns table (
  registered boolean,
  sst_no text,
  taxable_cents bigint,
  tax_cents bigint,
  documents integer
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  prof public.tax_profile;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your project';
  end if;
  select * into prof from public.tax_profile where project_id = in_project_id;

  return query
  with taxed as (
    select r.id, r.amount_cents, r.tax_rate,
           coalesce((
             select sum(a.amount_cents) from public.ledger_allocations a
             join public.ledger_entries e on e.id = a.entry_id
             where a.record_id = r.id and e.direction = 'in'
               and e.entry_on between in_from and in_to
               and e.adjusts_id is null
               and not exists (select 1 from public.ledger_entries x where x.adjusts_id = e.id)
           ), 0) as got
    from public.pipeline_records r
    where r.project_id = in_project_id
      and r.tax_rate is not null
      and r.archived_at is null
  )
  select coalesce(btrim(prof.sst_no), '') <> '',
         prof.sst_no,
         coalesce(sum(t.got), 0)::bigint,
         coalesce(sum(round(t.got * t.tax_rate / 100.0)), 0)::bigint,
         count(*) filter (where t.got > 0)::integer
  from taxed t;
end;
$fn$;

revoke execute on function public.sst_return(uuid, date, date) from public, anon;
grant execute on function public.sst_return(uuid, date, date) to authenticated;

comment on function public.sst_return(uuid, date, date) is
  'The figures for one SST period, on money actually received -- service tax in Malaysia is payable on receipt. Reports registered = false rather than a zero return, because a business with no SST number does not file one. See 20260905610000.';

-- ── 🔴 它还不是什么（自己讲，不要等他发现）────────────────────────────────
--
--   · **不送去 LHDN，不签章** —— 要公司 · 凭证 · 一把钥匙。见档头
--   · **不验 TIN** —— 那要打 LHDN 的 API，同一件事挡着
--   · **一张单一个税率** —— 一张同时有货（10%）跟服务（8%）的单，
--     今天表达不了。那要每一行一个税率 ＋ 一份货品分类，
--     而分类是他要去查的东西，不是我们猜得出来的
--   · **不管进项税** —— 服务税没有进项扣抵（那是 GST 的东西，2018 就废了）
--   · **画面上没有那一页**
