-- 她签下的那一张纸。
--
-- ── 这是 medi spa 那一层的最后一件 ──────────────────────────────────────
--
-- [任务 309] 跟外面比过之后排的三件：
--   ① 疗程记录  ✅ 20260909040000
--   ② 前后照片  ✅ 20260909100000
--   ③ **同意书** ← 这一件
--
-- Aoikumo（马来西亚，我们真正的对手）高阶那一档列着
-- `Electronic Forms & Documents（indemnity & consultation form）`，
-- 而我们今天一格都没有。
--
-- ── 🔴 几乎白捡：门牌那一套 20260905230000 已经解过一次 ──────────────────
--
-- 一条不用登入的连结 · 陌生人打得开 · 按下去 · 留一个时间章 · 收得回来
-- —— **那一套就是同意书的机制**，换的只是那一份内容。
-- 所以这一支不发明第二套分享机制，形状原样搬：
--
--   · 门牌是**另一个 uuid**，不是那一行的 id —— 一个自己的 uuid
--     设得了 null，那条连结当场死掉；一个 id 设不了
--   · 门牌不存在跟那一家关掉了 —— **回一样的东西**（什么都不回）。
--     告诉一个陌生人「这份表单存在但你不能看」，就是在讲别人生意的事
--   · 陌生人那两支**回一个词，不抛例外** —— 一句资料库的错误讯息
--     对站在别人表单前面的人没有意义，对我们还多泄漏一点东西
--
-- ── 🔴 一份范本，而它的内容是她自己写的 ─────────────────────────────────
--
-- 读了外面怎么做（2026-09-09，Mangomint 自己那篇文章的原文）：
--   `Because a Botox consent includes different risk disclosures than a
--    laser treatment, create separate forms`
--
-- 所以是**好几份**（肉毒一份 · 激光一份 · 洗面一份），不是一段写死的字。
-- 而那几份的**内容我们一个字都不给** —— 一份同意书上写的是
-- 风险 · 替代方案 · 禁忌，那是**医疗上的宣称**，而我们不是一间诊所。
-- （[任务 309] 判「处方不做」是同一条。）
--
-- ── 🔴 签下去那一刻，要存一份文字的快照 ─────────────────────────────────
--
-- **这是这一整张表唯一存在的理由。**
--
-- 她今年三月改了那份同意书的措辞 —— 而去年十月那个客人签的是**当时那一份**。
-- 范本变了，签过的那一份**一个字都不可以跟着变**。
-- 跟 `party` / `party_id` 同一条：当时写下的那几个字，之后永远不改。
--
-- ⚠️ 代价：同一段文字会存很多次（一个客人一次）。
-- 而**一份会跟着范本变的证据不是证据** —— 那正是她被问「她签的时候
-- 你那张纸上写的是什么」时唯一答得出来的东西。
--
-- ── 🔴 三件故意不做，每一件带它的代价 ───────────────────────────────────
--
--   · **病史勾选格 · 问诊题目** —— 搜出来那几家都有
--     （`medical history checkboxes` · `contraindication screening`）。
--     不做：它要一套题目引擎，而她第一份表单就要先设计一堆题目
--     —— 一个第一次用之前要先填完的东西（[重点 7d-2]，
--     而 20260902030000 拒绝整套上班时间引擎是同一条）。
--     **要问的话写进那段文字里。**
--
--   · **见证人那一栏** —— 那是诊所的做法。一间 medi spa 的美疗师
--     本身就是那个见证人，而系统里已经记着这份表单是谁发出去的。
--
--   · 🔴 **不自动翻照片那个开关** —— 搜出来那几家把
--     `photo release authorization` 列成**另一份**表单，而我们
--     20260909100000 已经有 `may_show`（预设 false，要她一个动作才翻）。
--     一份签了的照片授权是**一句话**；`may_show` 是**她逐张点的**。
--     签一次就替她把全部照片翻成可以公开，正好是那一栏存在要挡的事故。
--
-- ── 🔴 没有「我要改一点」 ────────────────────────────────────────────────
--
-- 报价单那一边有那一颗，因为议价是常态。**一份同意书不是拿来议的**：
-- 她要嘛签，要嘛不签 —— 而「不签」不是一个要记下来的答案，
-- 那是一件没有发生的事。**不发明第二种状态。**
--
-- ── 🔴 没有有效期 ───────────────────────────────────────────────────────
--
-- 实务上一份同意书常常一年要重签一次 —— 而那是一个**天数**，
-- 而这个仓库立过规矩：**不发明天数**（[任务 220]）。
-- 「上一次签是几时」这一支答得出来，**要不要重签是她的判断**。
--
-- ── 谁看得到 ────────────────────────────────────────────────────────────
--
-- `works_here`，不是 `sees_money` —— 美疗师开工前要问的就是那一句
-- 「她签了没有」。而这两张表上**一个金额都没有**（跟套票 · 疗程记录同一条）。

-- ── 一份范本 ────────────────────────────────────────────────────────────
create table if not exists public.consent_forms (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 她自己取的名字（肉毒同意书 · 激光同意书），跟 stage / category 同一条。 */
  name text not null,

  /* 🔴 她自己写的那一段。我们一个字都不给 —— 见档头。 */
  body text not null,

  /* 关得掉，不删得掉：签过的那几份指着它。 */
  archived_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint consent_forms_name_not_blank check (btrim(name) <> ''),
  constraint consent_forms_body_not_blank check (btrim(body) <> '')
);

comment on table public.consent_forms is
  'The consent forms this business asks people to sign. The wording is theirs -- we never supply the text of a medical claim. See 20260909130000.';

/* 同一家不准两份同名 —— 一份发出去之前她要选得出是哪一份。
   关掉的那几份不算（她可以重开一份同名的新版本）。 */
create unique index if not exists consent_forms_name_idx
  on public.consent_forms (project_id, lower(btrim(name)))
  where archived_at is null;

alter table public.consent_forms enable row level security;

drop policy if exists "consent_forms_members" on public.consent_forms;
create policy "consent_forms_members" on public.consent_forms
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

-- ── 一次签署 ────────────────────────────────────────────────────────────
create table if not exists public.consent_signatures (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 必填 —— 一份不知道是谁签的同意书没有用。
     restrict：一个签过同意书的人删不掉。 */
  party_id uuid not null references public.directory_entries(id) on delete restrict,

  /* 从哪一份范本发出去的。set null：范本以后真的被删了，
     签过的那一份还在 —— 因为下面那两栏是快照。 */
  form_id uuid references public.consent_forms(id) on delete set null,

  /* 🔴 快照。发出去那一刻抄下来的名字跟内容，之后永远不改。 */
  form_name text not null,
  form_body text not null,

  /* 门牌。null = 这条连结收回来了。 */
  share_ref uuid,
  sent_at timestamptz not null default now(),

  /* 她按下去之后的三样。signed_at 是 null 就是还没签。 */
  signed_at timestamptz,
  signed_name text,
  signed_note text,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint consent_signatures_body_not_blank check (btrim(form_body) <> '')
);

comment on table public.consent_signatures is
  'One person, one consent form, one signature. form_name/form_body are a SNAPSHOT taken when it was sent -- a piece of evidence that changes when the template changes is not evidence. See 20260909130000.';
comment on column public.consent_signatures.share_ref is
  'The door number for the public page. A separate uuid, never the row id -- so it can be set to null and the link actually dies. Same as pipeline_records.share_ref (20260905230000).';

create unique index if not exists consent_signatures_share_ref_idx
  on public.consent_signatures (share_ref)
  where share_ref is not null;

create index if not exists consent_signatures_party_idx
  on public.consent_signatures (party_id, sent_at desc);

create index if not exists consent_signatures_project_idx
  on public.consent_signatures (project_id, sent_at desc);

alter table public.consent_signatures enable row level security;

drop policy if exists "consent_signatures_members" on public.consent_signatures;
create policy "consent_signatures_members" on public.consent_signatures
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

-- 那张表的 project_id 要跟它上一层一样 —— 20260906/20260909 那一族同一个形状。
create or replace function public.consent_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  owner uuid;
begin
  /* 公司都不在了、或者这一栏根本没有动，就放行 —— cascade 那一刻没有
     登入身分，而 20260906260000 跟 20260906390000 为同一件事付过两次学费。 */
  if tg_op = 'UPDATE' and new.project_id is not distinct from old.project_id then
    return new;
  end if;

  select p.project_id into owner
    from public.directory_entries p where p.id = new.party_id;

  if owner is null then
    return new;
  end if;

  new.project_id := owner;
  return new;
end;
$fn$;

drop trigger if exists consent_signatures_own_project_trg on public.consent_signatures;
create trigger consent_signatures_own_project_trg
  before insert or update on public.consent_signatures
  for each row execute function public.consent_own_project();

-- ── 写一份范本 ──────────────────────────────────────────────────────────
create or replace function public.add_consent_form(
  in_project_id uuid,
  in_name text,
  in_body text
)
returns public.consent_forms
language plpgsql
security definer
set search_path = public
as $fn$
declare
  made public.consent_forms;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;
  if btrim(coalesce(in_name, '')) = '' then
    raise exception 'give the form a name';
  end if;
  if btrim(coalesce(in_body, '')) = '' then
    raise exception 'write what she is agreeing to';
  end if;

  insert into public.consent_forms (project_id, name, body, created_by)
  values (
    in_project_id,
    left(btrim(in_name), 120),
    left(btrim(in_body), 20000),
    auth.uid()
  )
  returning * into made;

  return made;
exception
  when unique_violation then
    raise exception 'you already have a form called that';
end;
$fn$;

revoke execute on function public.add_consent_form(uuid, text, text) from public, anon;
grant execute on function public.add_consent_form(uuid, text, text) to authenticated;

-- ── 改一份范本 ──────────────────────────────────────────────────────────
--
-- ⚠️ 改这里**不动任何一份已经发出去的**。那是快照，见档头。
create or replace function public.update_consent_form(
  in_id uuid,
  in_name text default null,
  in_body text default null,
  in_archived boolean default null
)
returns public.consent_forms
language plpgsql
security definer
set search_path = public
as $fn$
declare
  made public.consent_forms;
begin
  select * into made from public.consent_forms where id = in_id;
  if made.id is null or not public.works_here(made.project_id) then
    raise exception 'no such form';
  end if;

  if in_name is not null and btrim(in_name) = '' then
    raise exception 'give the form a name';
  end if;
  if in_body is not null and btrim(in_body) = '' then
    raise exception 'write what she is agreeing to';
  end if;

  update public.consent_forms
  set name = case when in_name is null then name
                  else left(btrim(in_name), 120) end,
      body = case when in_body is null then body
                  else left(btrim(in_body), 20000) end,
      archived_at = case when in_archived is null then archived_at
                         when in_archived then coalesce(archived_at, now())
                         else null end,
      updated_at = now()
  where id = in_id
  returning * into made;

  return made;
exception
  when unique_violation then
    raise exception 'you already have a form called that';
end;
$fn$;

revoke execute on function public.update_consent_form(uuid, text, text, boolean) from public, anon;
grant execute on function public.update_consent_form(uuid, text, text, boolean) to authenticated;

-- ── 她有哪几份范本 ──────────────────────────────────────────────────────
create or replace function public.consent_forms_of(in_project_id uuid)
returns table (
  id uuid,
  name text,
  body text,
  archived boolean,
  signed_count bigint,
  waiting_count bigint
)
language sql
stable
security definer
set search_path = public
as $$
  select
    f.id,
    f.name,
    f.body,
    f.archived_at is not null,
    (select count(*) from public.consent_signatures s
      where s.form_id = f.id and s.signed_at is not null),
    (select count(*) from public.consent_signatures s
      where s.form_id = f.id and s.signed_at is null)
  from public.consent_forms f
  where f.project_id = in_project_id
    and public.works_here(f.project_id)
  order by f.archived_at nulls first, lower(f.name);
$$;

revoke execute on function public.consent_forms_of(uuid) from public, anon;
grant execute on function public.consent_forms_of(uuid) to authenticated;

-- ── 发一份给她 ──────────────────────────────────────────────────────────
--
-- 🔴 一发出去就有门牌 —— 那条连结**就是**要发给她的东西。
-- 而快照在这一刻抄下来，不是在她签的那一刻：她读到的跟她签的
-- 必须是同一份，中间她老板改了范本也一样。
create or replace function public.request_consent(
  in_party_id uuid,
  in_form_id uuid
)
returns public.consent_signatures
language plpgsql
security definer
set search_path = public
as $fn$
declare
  proj uuid;
  form public.consent_forms;
  made public.consent_signatures;
begin
  select p.project_id into proj
    from public.directory_entries p
   where p.id = in_party_id and public.works_here(p.project_id);
  if proj is null then
    raise exception 'that person is not in your directory';
  end if;

  select * into form from public.consent_forms f where f.id = in_form_id;
  if form.id is null or form.project_id <> proj then
    raise exception 'no such form';
  end if;
  if form.archived_at is not null then
    raise exception 'that form is put away -- take it back out before sending it';
  end if;

  insert into public.consent_signatures
    (project_id, party_id, form_id, form_name, form_body, share_ref, created_by)
  values (proj, in_party_id, form.id, form.name, form.body, gen_random_uuid(), auth.uid())
  returning * into made;

  return made;
end;
$fn$;

revoke execute on function public.request_consent(uuid, uuid) from public, anon;
grant execute on function public.request_consent(uuid, uuid) to authenticated;

comment on function public.request_consent(uuid, uuid) is
  'Send one consent form to one person. Takes a SNAPSHOT of the wording now, not when she signs -- what she reads and what she signs must be the same sheet. See 20260909130000.';

-- ── 收回那条连结 ────────────────────────────────────────────────────────
--
-- ⚠️ **签过的那一份收不回来。** 那不是一个设定，那是发生过的事 ——
-- 而她本来就该回得去看自己签了什么。
create or replace function public.revoke_consent_request(in_id uuid)
returns public.consent_signatures
language plpgsql
security definer
set search_path = public
as $fn$
declare
  made public.consent_signatures;
begin
  select * into made from public.consent_signatures where id = in_id;
  if made.id is null or not public.works_here(made.project_id) then
    raise exception 'no such consent';
  end if;
  if made.signed_at is not null then
    raise exception 'she already signed that one -- it stays';
  end if;

  update public.consent_signatures
  set share_ref = null, updated_at = now()
  where id = in_id
  returning * into made;

  return made;
end;
$fn$;

revoke execute on function public.revoke_consent_request(uuid) from public, anon;
grant execute on function public.revoke_consent_request(uuid) to authenticated;

-- ── 她签过什么，还有什么在等 ────────────────────────────────────────────
create or replace function public.consents_of(in_party_id uuid)
returns table (
  id uuid,
  form_id uuid,
  form_name text,
  form_body text,
  share_ref uuid,
  sent_at timestamptz,
  signed_at timestamptz,
  signed_name text,
  signed_note text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    s.id, s.form_id, s.form_name, s.form_body, s.share_ref,
    s.sent_at, s.signed_at, s.signed_name, s.signed_note
  from public.consent_signatures s
  join public.directory_entries p on p.id = s.party_id
  where s.party_id = in_party_id
    and public.works_here(p.project_id)
  order by s.sent_at desc;
$$;

revoke execute on function public.consents_of(uuid) from public, anon;
grant execute on function public.consents_of(uuid) to authenticated;

comment on function public.consents_of(uuid) is
  'What this person has signed and what is still waiting. signed_at null = sent, not signed. No expiry: whether it is time to sign again is her judgement, not a number we invented (任务 220).';

-- ── 她打开那一页 ────────────────────────────────────────────────────────
--
-- 🔴 看得到：这家公司的名字跟它自己那套样子 · **她自己的名字** ·
--            那份表单的名字跟内容 · 她签了没有
-- 🔴 看不到：她的疗程记录 · 她欠多少 · 她别的同意书 · 任何 id
--            —— **一条连结开一份表单**
create or replace function public.public_consent_form(in_ref uuid)
returns table (
  business_name text,
  style text,
  palette text,
  system_language text,
  person_name text,
  form_name text,
  form_body text,
  can_sign boolean,
  signed_at timestamptz,
  signed_name text,
  signed_note text
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  sig public.consent_signatures;
  proj public.projects;
  person public.directory_entries;
begin
  if in_ref is null then
    return;
  end if;

  select * into sig from public.consent_signatures s where s.share_ref = in_ref;
  if sig.id is null then
    return;
  end if;

  select * into proj from public.projects p where p.id = sig.project_id;
  if proj.id is null then
    return;
  end if;

  select * into person from public.directory_entries d where d.id = sig.party_id;

  return query
  select
    coalesce(proj.business_name, ''),
    proj.style,
    proj.palette,
    proj.system_language,
    coalesce(person.name, ''),
    sig.form_name,
    sig.form_body,
    sig.signed_at is null,
    sig.signed_at,
    sig.signed_name,
    sig.signed_note;
end;
$fn$;

revoke execute on function public.public_consent_form(uuid) from public;
grant execute on function public.public_consent_form(uuid) to anon, authenticated;

comment on function public.public_consent_form(uuid) is
  'One consent form as the person holding the link sees it. Carries the business own name and style so the page wears HER brand. Never another form, never an id, never anything else about this person. See 20260909130000.';

-- ── 她按下去 ────────────────────────────────────────────────────────────
--
-- ⚠️ 回一个**词**不是抛例外，跟 answer_shared_record / submit_site_booking
-- 一样：呼叫者是一个站在别人表单前面的人。
create or replace function public.sign_consent(
  in_ref uuid,
  in_name text,
  in_note text default ''
)
returns text
language plpgsql
security definer
set search_path = public
as $fn$
declare
  sig public.consent_signatures;
begin
  if coalesce(btrim(in_name), '') = '' then
    return 'incomplete';
  end if;
  if length(in_name) > 120 or length(coalesce(in_note, '')) > 1000 then
    return 'too_long';
  end if;
  if in_ref is null then
    return 'not_found';
  end if;

  select * into sig from public.consent_signatures s where s.share_ref = in_ref;
  if sig.id is null then
    return 'not_found';
  end if;

  /* 🔴 签过了就不给再动。一次签名是一个承诺，不是一个设定。 */
  if sig.signed_at is not null then
    return 'signed';
  end if;

  update public.consent_signatures
  set signed_at = now(),
      signed_name = left(btrim(in_name), 120),
      signed_note = left(btrim(coalesce(in_note, '')), 1000),
      updated_at = now()
  where id = sig.id;

  return 'ok';
end;
$fn$;

revoke execute on function public.sign_consent(uuid, text, text) from public;
grant execute on function public.sign_consent(uuid, text, text) to anon, authenticated;

comment on function public.sign_consent(uuid, text, text) is
  'She signs. Returns a word, never an exception -- the caller is a stranger standing on someone elses form. Signing twice is refused: a signature is a commitment, not a setting. See 20260909130000.';
