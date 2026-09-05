-- 洞三：他的经销商自己讲得出「我要货」。
--
-- ── 洞是走 vibe-dealer 那一次量出来的（任务 175）────────────────────────────
--
--   FAIL  🔴 经销商自己提交得了「我要货」
--         —— 没有任何一支给路人的函式收得了它
--
-- 外面那一边到今天只做得了三件事：**看那一页 · 留一句话 · 订一个时段**
-- （[任务 96] 8-31 数过，[任务 146] 加了第三件）。
-- 而里面十八个模块全部会写真资料 —— 这就是那句「里面十八个，外面三个」。
--
-- ── 读他自己真的表（重点 26）───────────────────────────────────────────────
--
-- `0042_dealer_submitted_requests` 的档头写得比我讲得好，三句原话：
--
--   *「Every row in transactions was, until now, typed by staff from something
--     a dealer said over WhatsApp. The dealer's own words never reached the
--     system, so a wrong figure was always the fault of whoever retyped it.」*
--
--   *「One permanent token per dealer, not one per request: a dealer tops up
--     several times a month and must not need a new link each time. The token
--     identifies a dealer, it does not authenticate a person — which is only
--     acceptable because the link cannot move money.」*
--
--   *「This adds a queue in front of the ledger, and nothing else. A submitted
--     request is a claim… it is not a transaction until an accountant opens it
--     and saves it through /entry — where every existing rule still applies,
--     because it is the same code path it was yesterday.」*
--
-- **三句全部照抄**，而第三句正好就是[重点 23](../docs/founder-points.md)：
-- 变成一张单要走**人按的那一支** `add_pipeline_record`。
--
-- 还抄了一样：**每个人最多五笔在等**，而且**用触发器挡不是只在函式里挡** ——
-- 他写的理由是 *「the form is a courtesy, the constraint is the rule」*。
--
-- ── ⚠️ 有一样故意没抄，而且要写下理由（重点 7h）──────────────────────────
--
-- 他的 0042 明写**不给 anon 任何东西**：公开那一页在伺服器上渲染、
-- 靠一支拿着 service role 的 Server Action 写，理由是
-- *「a SECURITY DEFINER function callable by anon… would widen the PostgREST
--   surface, which is exactly where both 0038 and 0041 found real holes」*。
--
-- **我们不跟，而且不是因为他讲错。** 我们外面那三件（询价 · 预约 · 签收）
-- 全部是「给 anon 的 security definer 函式」，而且是拿真的 anon 钥匙测过的。
-- 再开一条 service role 的路，就是**同一件事两条路** ——
-- 而这个仓库二十次「说了没做」的形状全部是那个。
-- **一致比较安全，而那条路本来就每一支自己验 token。**
--
-- ⚠️ 这一支是**加**（重点 31）：新表、新栏、新函式。
--    今天在跑的东西一个字都不会变，而且**没有开任何一个人的权限**。

-- ── 一个人一条门牌 ────────────────────────────────────────────────────────
--
-- 🔴 **不是那一行的 id。** 一个自己的 uuid 收得回来（设成 null，那条连结
-- 当场死掉）；一个 id 收不回来，而且它在别的地方也用。
-- 跟 `deliveries.public_ref`（20260905510000）· `appointments.public_ref`
-- 同一个做法。

alter table public.directory_entries
  add column if not exists portal_ref uuid;

comment on column public.directory_entries.portal_ref is
  'One permanent door number for this customer or supplier, so they can ask for something themselves. NULL means no link exists. Setting it to NULL kills the link immediately; writing a new uuid rotates it. Never the row id -- an id cannot be taken back. Taken from his own vibe-dealer 0042 (one token per dealer, not one per request). See 20260905680000.';

create unique index if not exists directory_entries_portal_ref_idx
  on public.directory_entries (portal_ref) where portal_ref is not null;

-- ── 一个队列，排在单据前面 ────────────────────────────────────────────────

create table if not exists public.party_requests (
  id uuid primary key default gen_random_uuid(),

  party_id uuid not null references public.directory_entries(id) on delete cascade,
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 🔴 **他自己讲的那句话**，原样。这一栏的全部价值就是它没有被谁重打过。 */
  what text not null,

  /* 两个都可以不填 —— 「下一批卡帮我留 200 张」讲得出数量讲不出钱，
     而「我转了 RM 5,000」反过来。逼他两个都填，他就不填了。 */
  qty numeric(14, 3),
  amount_cents bigint check (amount_cents is null or amount_cents >= 0),

  /* 送这一笔的人可能不是老板本人（他的伙计）。 */
  contact text not null default '',

  status text not null default 'open' check (status in ('open', 'done', 'dropped')),

  /* 变成哪一张单。单删掉了，这一笔还在 —— 他问过这件事本身是历史。 */
  record_id uuid references public.pipeline_records(id) on delete set null,
  handled_by uuid references auth.users(id) on delete set null,
  handled_at timestamptz,

  idempotency_key uuid,
  created_at timestamptz not null default now(),

  constraint party_requests_idem_unique unique (party_id, idempotency_key)
);

comment on table public.party_requests is
  'What a customer or supplier asked for, in their own words, through their own link. A CLAIM, not a document: it has no doc number, it moves no money and it touches no shelf until somebody presses the same add_pipeline_record button they press by hand. Shape and reasoning from his own vibe-dealer 0042. See 20260905680000.';

create index if not exists party_requests_open_idx
  on public.party_requests (project_id, created_at desc) where status = 'open';
create index if not exists party_requests_party_idx
  on public.party_requests (party_id, created_at desc);

-- ── 谁看得到 ──────────────────────────────────────────────────────────────
--
-- 🔴 **anon 一个字都读不到那张表。** 他自己那条连结读得到的是底下那支
-- 函式挑出来的几栏，不是这张表。
--
-- `works_here`（不是 `sees_money`）：这是一个**进来的订单收件匣**，
-- 而处理进来的订单的人不一定是老板。上面那个金额是**客人自己讲的数字**，
-- 客人本来就知道 —— 那不是我们的帐。
--
-- **没有 insert 的 policy**：员工不开请求，客人才开，而客人走的是那支函式。
-- 员工要记一笔就去按「加一单」，那是正门，本来就是。

alter table public.party_requests enable row level security;
revoke all on public.party_requests from anon;

drop policy if exists "party_requests_read" on public.party_requests;
create policy "party_requests_read" on public.party_requests
  for select using (public.works_here(project_id));

drop policy if exists "party_requests_update" on public.party_requests;
create policy "party_requests_update" on public.party_requests
  for update using (public.works_here(project_id)) with check (public.works_here(project_id));

create or replace function public.party_requests_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
  the_module text;
begin
  select project_id, module_key into owner_project, the_module
  from public.directory_entries where id = new.party_id;
  if owner_project is null then
    raise exception 'no such person';
  end if;
  /* 🔴 师傅不在这里。他有真的帐号，走的是里面那条路 —— 一个「外面的人」
     的队列里出现一个自己人，是把两条路混成一条。 */
  if the_module = 'staff' then
    raise exception 'a staff member is not an outsider -- they have a login';
  end if;
  new.project_id := owner_project;
  return new;
end;
$$;

drop trigger if exists party_requests_own_project_trg on public.party_requests;
create trigger party_requests_own_project_trg
  before insert on public.party_requests
  for each row execute function public.party_requests_own_project();

-- ── 一个人最多五笔在等 ────────────────────────────────────────────────────
--
-- ⚠️ 底下那支函式也会先讲一句人话再挡。**两个都要**，理由抄他的：
-- *the form is a courtesy, the constraint is the rule* ——
-- 一个只在函式里挡的上限，绕过那支函式就不存在了。

create or replace function public.party_requests_cap()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  waiting int;
begin
  if new.status is distinct from 'open' then
    return new;
  end if;
  select count(*) into waiting
  from public.party_requests
  where party_id = new.party_id and status = 'open';
  if waiting >= 5 then
    raise exception 'too_many_open: this person already has 5 requests waiting';
  end if;
  return new;
end;
$$;

drop trigger if exists party_requests_cap_trg on public.party_requests;
create trigger party_requests_cap_trg
  before insert on public.party_requests
  for each row execute function public.party_requests_cap();

-- ── 开一条连结给他 ────────────────────────────────────────────────────────

create or replace function public.open_party_portal(
  in_party_id uuid,
  /* 已经有一条了还叫它开 —— 预设是把原来那条还给他（他弄丢了、要再发一次），
     不是换一条。换一条是**杀掉旧的那条**，那要他自己讲。 */
  in_rotate boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  the_module text;
  the_project uuid;
  ref uuid;
begin
  select d.project_id, d.module_key, d.portal_ref
    into the_project, the_module, ref
  from public.directory_entries d where d.id = in_party_id;

  if the_project is null or not public.works_here(the_project) then
    raise exception 'no such person in your project';
  end if;
  if the_module = 'staff' then
    raise exception 'a staff member is not an outsider -- they have a login';
  end if;

  if ref is null or in_rotate then
    ref := gen_random_uuid();
    update public.directory_entries set portal_ref = ref where id = in_party_id;
  end if;
  return ref;
end;
$$;

revoke execute on function public.open_party_portal(uuid, boolean) from public, anon;
grant execute on function public.open_party_portal(uuid, boolean) to authenticated;

create or replace function public.close_party_portal(in_party_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  the_project uuid;
begin
  select d.project_id into the_project
  from public.directory_entries d where d.id = in_party_id;
  if the_project is null or not public.works_here(the_project) then
    raise exception 'no such person in your project';
  end if;
  /* 🔴 连结死掉，**他送过的那几笔一个都不删**。他问过这件事是历史。 */
  update public.directory_entries set portal_ref = null where id = in_party_id;
  return true;
end;
$$;

revoke execute on function public.close_party_portal(uuid) from public, anon;
grant execute on function public.close_party_portal(uuid) to authenticated;

-- ── 他打开那条连结看到什么 ────────────────────────────────────────────────
--
-- 🔴 **只有两样：这家公司叫什么 · 他自己送过的那几笔。**
--
-- ⚠️ **故意没有的**（写下来，不要下一轮当成漏做）：
--   · **他欠多少** —— `party_statement`（20260905140000）是 `sees_money` 的。
--     把一个人的整个户口挂在一条带着走的连结上，是**另一个决定**，
--     而且比这一件大：一条外流的连结从「多一笔假的请求」变成「他的帐」
--   · **他的单走到哪** —— [任务 155] 那条已经在做这件事，而它是**一张单
--     一个门牌、老板自己开的**。一条看得到全部单的连结，
--     不是同一件事的方便版，是不同一个爆炸半径
--   · **别人的任何东西** —— 没有别的客户、没有成本、没有一个 id

create or replace function public.party_portal(in_ref uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  d record;
  biz text;
begin
  if in_ref is null then
    return jsonb_build_object('found', false);
  end if;

  select de.id, de.name, de.project_id
    into d
  from public.directory_entries de
  where de.portal_ref = in_ref and de.archived_at is null;

  /* 🔴 收起来的人、关掉的连结、根本不存在的号码 —— **同一个答案**。
     告诉一个陌生人「这条连结存在过」，就是在告诉他别人的事。 */
  if d.id is null then
    return jsonb_build_object('found', false);
  end if;

  select coalesce(nullif(btrim(p.company_name), ''), 'this business')
    into biz
  from public.projects p where p.id = d.project_id;

  return jsonb_build_object(
    'found', true,
    'business', biz,
    'you', d.name,
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'what', r.what,
               'qty', r.qty,
               'amountCents', r.amount_cents,
               'status', r.status,
               'askedOn', r.created_at
             ) order by r.created_at desc)
      from public.party_requests r
      where r.party_id = d.id
    ), '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.party_portal(uuid) from public;
grant execute on function public.party_portal(uuid) to anon, authenticated;

-- ── 他送一笔进来 ──────────────────────────────────────────────────────────
--
-- 回的是一个**词**，不是一个例外 —— 跟 `submit_site_enquiry` ·
-- `submit_site_booking` 同一条：一个陌生人不该读到一句资料库的话。

create or replace function public.submit_party_request(
  in_ref uuid,
  in_what text,
  in_qty numeric default null,
  in_amount_cents bigint default null,
  in_contact text default '',
  in_idempotency_key uuid default null
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  the_party uuid;
  recent int;
  waiting int;
begin
  if coalesce(btrim(in_what), '') = '' then
    return 'incomplete';
  end if;
  /* 长度挡在这里，不是挡在浏览器 —— 这一支就是唯一那道门，
     而一道只挡在门外面的上限不是上限。 */
  if length(in_what) > 2000 or length(coalesce(in_contact, '')) > 120 then
    return 'too_long';
  end if;
  if in_amount_cents is not null and in_amount_cents < 0 then
    return 'incomplete';
  end if;

  select d.id into the_party
  from public.directory_entries d
  where d.portal_ref = in_ref and d.archived_at is null;

  if the_party is null then
    return 'not_found';
  end if;

  /* 按两下 = 一笔。手机上双击是常态，不是错。 */
  if in_idempotency_key is not null then
    perform 1 from public.party_requests
      where party_id = the_party and idempotency_key = in_idempotency_key;
    if found then
      return 'ok';
    end if;
  end if;

  select count(*) into recent
  from public.party_requests r
  where r.party_id = the_party and r.created_at > now() - interval '1 minute';
  if recent >= 5 then
    return 'too_many';
  end if;

  select count(*) into waiting
  from public.party_requests r
  where r.party_id = the_party and r.status = 'open';
  if waiting >= 5 then
    /* 讲人话在触发器讲资料库的话之前 —— 顺序错的守卫等於没有守卫
       （20260903050000）。 */
    return 'too_many_open';
  end if;

  insert into public.party_requests (
    party_id, project_id, what, qty, amount_cents, contact, idempotency_key
  ) values (
    the_party,
    '00000000-0000-0000-0000-000000000000'::uuid,
    left(btrim(in_what), 2000),
    in_qty,
    in_amount_cents,
    left(btrim(coalesce(in_contact, '')), 120),
    in_idempotency_key
  );
  return 'ok';

exception
  when unique_violation then
    /* 同一瞬间按两下，两笔一起进来 —— 那把钥匙挡住了，回同一个答案。 */
    return 'ok';
end;
$$;

revoke execute on function public.submit_party_request(uuid, text, numeric, bigint, text, uuid) from public;
grant execute on function public.submit_party_request(uuid, text, numeric, bigint, text, uuid) to anon, authenticated;

-- ── 老板那一边的收件匣 ────────────────────────────────────────────────────

create or replace function public.party_requests_of(
  in_project_id uuid,
  in_open_only boolean default true
)
returns table (
  id uuid,
  party_id uuid,
  party_name text,
  what text,
  qty numeric,
  amount_cents bigint,
  contact text,
  status text,
  record_id uuid,
  doc_no text,
  asked_on timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  return query
    select r.id, r.party_id, d.name, r.what, r.qty, r.amount_cents, r.contact,
           r.status, r.record_id, pr.doc_no, r.created_at
    from public.party_requests r
    join public.directory_entries d on d.id = r.party_id
    left join public.pipeline_records pr on pr.id = r.record_id
    where r.project_id = in_project_id
      and (not in_open_only or r.status = 'open')
    order by r.created_at desc;
end;
$$;

revoke execute on function public.party_requests_of(uuid, boolean) from public, anon;
grant execute on function public.party_requests_of(uuid, boolean) to authenticated;

-- ── 一按变一张单 ──────────────────────────────────────────────────────────
--
-- 🔴 **走 `add_pipeline_record`**，不是自己 insert 一行（重点 23）。
-- 单号 · 第一个阶段 · 连到那个人 · 防重复 · 分店守卫 —— 五样全部住在那里面，
-- 而一支「比较方便」的写入路径会静静地少掉其中几样。
--
-- ⚠️ 跟 [任务 89]（询价一按变单）是同一个形状，只是这一次那个人**已经在
--    名册上**了 —— 所以不用猜是谁，`party_id` 直接带过去。

create or replace function public.record_from_request(
  in_request_id uuid,
  in_module_key text
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  made public.pipeline_records;
begin
  select * into r from public.party_requests q where q.id = in_request_id;
  if r.id is null or not public.works_here(r.project_id) then
    raise exception 'no such request in your project';
  end if;

  /* 已经开过一张了 —— 把那一张还给他，不要开第二张。 */
  if r.record_id is not null then
    select * into made from public.pipeline_records where id = r.record_id;
    if made.id is not null then
      return made;
    end if;
  end if;

  made := public.add_pipeline_record(
    in_project_id := r.project_id,
    in_module_key := in_module_key,
    in_title := left(r.what, 200),
    in_party_id := r.party_id,
    in_amount_cents := r.amount_cents,
    /* 一笔请求本身就是防重复的那把钥匙：同一笔按两次，回同一张单。 */
    in_idempotency_key := r.id
  );

  update public.party_requests
     set status = 'done', record_id = made.id,
         handled_by = auth.uid(), handled_at = now()
   where id = in_request_id;

  return made;
end;
$$;

revoke execute on function public.record_from_request(uuid, text) from public, anon;
grant execute on function public.record_from_request(uuid, text) to authenticated;

create or replace function public.drop_party_request(in_request_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  the_project uuid;
begin
  select project_id into the_project from public.party_requests where id = in_request_id;
  if the_project is null or not public.works_here(the_project) then
    raise exception 'no such request in your project';
  end if;
  /* 🔴 **不删。** 一笔他问过而我们没有做的事，是他明年会提起的那一件。 */
  update public.party_requests
     set status = 'dropped', handled_by = auth.uid(), handled_at = now()
   where id = in_request_id;
  return true;
end;
$$;

revoke execute on function public.drop_party_request(uuid) from public, anon;
grant execute on function public.drop_party_request(uuid) to authenticated;
