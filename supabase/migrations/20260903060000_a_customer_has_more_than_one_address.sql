-- 帐单一个地方，工地另一个，而且可能有两三个工地。
--
-- ── 为什么这一格排在刚需的第一个 ──────────────────────────────────────────
--
-- `directory_entries.address` 是**一格自由文字**。一个装修承包商的客户有
-- 一个收帐单的地址跟两三个工地 —— 他今天只能把它们全部打进那一格，
-- 或者打进备注。而师傅要去的是其中一个，帐单要寄的是另一个。
--
-- 而且它挡着两件已经写下来的事：
--   · [任务 81] 「表单还不敢收地址/注册号/税号 —— 页面上没有地方显示它们，
--     而收一个看不回来的输入就是吞掉他打的字」
--   · e-Invoice 要 Buyer 是**结构**，不是一行字（任务 70 从 LHDN 自己的
--     SDK 读到的）
--
-- ── 读的是谁的表 ──────────────────────────────────────────────────────────
--
-- Frappe 的 `Address` doctype 原文（GitHub API）。16 栏，必填四栏：
-- `address_type` · `address_line1` · `city` · `country`。
-- 另外两个 flag：`is_primary_address`（帐单）· `is_shipping_address`（送货），
-- 加一张 `links` 子表让一个地址可以挂在很多个对象上。
--
-- **抄三样：一个标签 · 一个 flag · 一份清单。**
--
-- ❌ **不抄那张七栏的邮政表格**（line1 · line2 · city · county · state ·
--    country · pincode）。`directory_entries.address` 的档头已经写过为什么：
--    「a contractor's customer has a site, a supplier has a shop, and neither
--    is a postal form」。而且他们把 `city` 设成必填 —— 一个工地写的是
--    「Lot 42, Jalan Kebun」，它没有 city。
--    ⚠️ e-Invoice 落地的时候，**只有帐单那一个地址**可能要补结构化的栏位；
--    那时候补在那一行上，不是现在替每一个工地盖一张邮政表格。
-- ❌ **不抄 `country`** —— 一个国家。
-- ❌ **不抄 `links`（一个地址挂很多对象）** —— 那是给一栋楼里的关系企业用的，
--    而这个市场的客户是一个人跟他的两个工地。
-- ❌ **不抄 `address_type` 那个固定选单**（Billing / Shipping / Office /
--    Personal / Plant / Postal / Shop / Subsidiary / Warehouse / Manufacturing）。
--    跟 `stage` 跟 `status` 同一条：**他自己的词就是产品**。
--    「工地」「档口」「仓库」「家」—— 一个选单挡不住马来西亚八个行业。
-- ❌ **不抄两个 flag，只留一个**：`is_billing`。他们的 shipping 在这里是
--    「哪一个工地」，而那是**每一张单自己的决定**，不是这个客户的一个属性 ——
--    见下面 `site_address_id`。

create table if not exists public.directory_addresses (
  id uuid primary key default gen_random_uuid(),

  /* 这个地址是谁的。cascade：人没了，他的地址没有意义。 */
  party_id uuid not null references public.directory_entries(id) on delete cascade,

  /* 反正规化，让 RLS 不用每一次读都 join。靠下面那支触发器保持真。 */
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 他自己的词：「工地」「帐单地址」「档口」「仓库」。
     可以空 —— 只有一个地址的时候他不用替它取名字。 */
  label text not null default '',

  /* 一行。见档头。 */
  line text not null,

  /* 会被拿去筛的那一部分。`directory_entries.region` 已经是同一个东西，
     而 vibe-dealer 替它建了索引，正是因为它是被筛的那一栏。 */
  region text not null default '',

  /* 帐单寄这里。一个客户最多一个 —— 下面那个部分索引挡着。
     ⚠️ 可以一个都没有：他只有一个工地地址、帐单跟着人走，那是常态。 */
  is_billing boolean not null default false,

  note text not null default '',

  sort_order integer not null default 0,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint directory_addresses_line_not_blank check (btrim(line) <> '')
);

comment on table public.directory_addresses is
  'One party''s addresses -- a billing address and one or more sites. One free-text line each, not a postal form; see the header of 20260903060000.';
comment on column public.directory_addresses.label is
  'The owner''s own word (工地 · 档口 · 仓库). Never a fixed list: the vocabulary is the product, same rule as stage and status.';
comment on column public.directory_addresses.is_billing is
  'Where the paper goes. At most one per party, enforced by a partial unique index; zero is normal.';

create index if not exists directory_addresses_party_idx
  on public.directory_addresses (party_id, sort_order);

/* 一个客户最多一个帐单地址。两个帐单地址不是一个设定，是一个打错的字。 */
create unique index if not exists directory_addresses_one_billing_idx
  on public.directory_addresses (party_id) where is_billing;

-- ── 谁看得到 ──────────────────────────────────────────────────────────────
--
-- `works_here()`，**不是** sees_money。
-- 师傅最需要的就是这一张 —— 他要知道明天去哪一个工地。

alter table public.directory_addresses enable row level security;

drop policy if exists "directory_addresses_members" on public.directory_addresses;
create policy "directory_addresses_members" on public.directory_addresses
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

create or replace function public.directory_addresses_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from public.directory_entries where id = new.party_id;
  if owner_project is null then
    raise exception 'no such party';
  end if;
  new.project_id := owner_project;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists directory_addresses_own_project_trg on public.directory_addresses;
create trigger directory_addresses_own_project_trg
  before insert or update on public.directory_addresses
  for each row execute function public.directory_addresses_own_project();

-- ── 🔴 一张单是给哪一个工地的 ─────────────────────────────────────────────
--
-- 没有这一栏，多地址就只是一份**读得到、用不上**的清单：他看得到客户有三个
-- 工地，而那张报价单还是讲不出自己是哪一个的。而这个仓库最常犯的错，
-- 就是「建好了、线没接」。
--
-- Frappe 把它做成 `shipping_address` 挂在单据上，而不是挂在客户上 ——
-- 对的，因为**哪一个工地是每一张单自己的决定**，不是这个客户的一个属性。
-- 所以他们那个 `is_shipping_address` flag 我们不抄，抄的是这一栏。
--
-- `on delete set null`：地址被删掉，那张单还在，只是不再指着一个不存在的地方。
-- 而「有单指着的地址不给整批换掉」挡在上面那支函式里 —— 两层各管各的。

alter table public.pipeline_records
  add column if not exists site_address_id uuid
  references public.directory_addresses(id) on delete set null;

comment on column public.pipeline_records.site_address_id is
  'Which of the party''s addresses this job is at. Null is normal -- most documents are for the one address the party has. See 20260903060000.';

create index if not exists pipeline_records_site_idx
  on public.pipeline_records (site_address_id) where site_address_id is not null;

-- ── 写它 ──────────────────────────────────────────────────────────────────
--
-- 整批换，跟 set_record_lines / set_record_terms / set_payment_allocations
-- 同一个形状。
--
-- ⚠️ 而这一次整批换是**安全**的，理由要讲出来：地址被 `site_address_id`
-- 指着，而那是 `on delete set null` —— 一张单指着的地址如果被换掉，
-- 那张单会静静地忘记它的工地。所以下面挡住：**有单指着的地址，改不掉。**
-- （跟 20260903040000 锁住收过钱的分期表是同一条，同一天第二次。）

create or replace function public.set_directory_addresses(
  in_party_id uuid,
  in_rows jsonb
)
returns setof public.directory_addresses
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  item jsonb;
  i integer := 0;
  billing_count integer := 0;
  used text;
begin
  select exists (
    select 1 from public.directory_entries d
    where d.id = in_party_id and public.works_here(d.project_id)
  ) into mine;
  if not mine then
    raise exception 'no such party in your project';
  end if;

  if jsonb_typeof(coalesce(in_rows, 'null'::jsonb)) <> 'array' then
    raise exception 'addresses must be an array';
  end if;
  /* 二十个地址是一份物流路线，而那是另一件东西。 */
  if jsonb_array_length(in_rows) > 20 then
    raise exception 'that is more addresses than one party has';
  end if;

  /* 两个帐单地址不是一个设定，是一个打错的字。在写之前讲 ——
     那条唯一索引会挡，而它吐的是他读不懂的一句
     （20260903050000 学到的：顺序错的守卫等於没有守卫）。 */
  select count(*) into billing_count
  from jsonb_array_elements(in_rows) as x
  where coalesce((x->>'is_billing')::boolean, false);
  if billing_count > 1 then
    raise exception 'only one address can be the billing address';
  end if;

  /* 🔴 有单指着的地址，改不掉。整批换会给每一行新的 id，
     而 `site_address_id` 是 on delete set null —— 那张单会静静地
     忘记它的工地，而静静地忘记比报一个错糟得多。 */
  select a.label || coalesce(nullif(' ' || a.line, ' '), '') into used
  from public.directory_addresses a
  where a.party_id = in_party_id
    and exists (
      select 1 from public.pipeline_records r where r.site_address_id = a.id
    )
  limit 1;
  if used is not null then
    raise exception
      'a job already points at "%"; take it off that job before changing the list',
      btrim(used);
  end if;

  delete from public.directory_addresses where party_id = in_party_id;

  for item in select * from jsonb_array_elements(in_rows)
  loop
    if coalesce(btrim(item->>'line'), '') = '' then
      raise exception 'every address needs a line';
    end if;

    insert into public.directory_addresses (
      party_id, project_id, label, line, region, is_billing, note, sort_order
    ) values (
      in_party_id,
      /* 被触发器盖掉；这里只是为了满足 not null。 */
      '00000000-0000-0000-0000-000000000000'::uuid,
      left(btrim(coalesce(item->>'label', '')), 60),
      left(btrim(item->>'line'), 400),
      left(btrim(coalesce(item->>'region', '')), 120),
      coalesce((item->>'is_billing')::boolean, false),
      left(coalesce(item->>'note', ''), 300),
      i
    );
    i := i + 1;
  end loop;

  return query
    select * from public.directory_addresses
     where party_id = in_party_id
     order by sort_order;
end;
$$;

revoke execute on function public.set_directory_addresses(uuid, jsonb) from public, anon;
grant execute on function public.set_directory_addresses(uuid, jsonb) to authenticated;
