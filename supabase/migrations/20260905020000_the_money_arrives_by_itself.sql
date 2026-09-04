-- 客人给了钱，系统自己多一行 —— 不用打字。
--
-- ── 他要的那一句话 ────────────────────────────────────────────────────────
--
--   `我只是要客户用卡给了钱 那个system能自动进去 不需要key in什么`（2026-09-05）
--
-- 那件事分三段，而**两段本来就在了**：
--
--   ① 客人怎么把钱给你（刷卡 / 网银）      🔴 没有 —— 要一个收款户口，卡在公司注册
--   ② 钱到了，谁来通知系统                 🔴 没有 —— **这一支就是它**
--   ③ 自动写一行、自动对上是哪一张单        ✅ 20260903030000 就做好了
--
-- ── 🔴 一份写入逻辑，两道门 ──────────────────────────────────────────────
--
-- `add_ledger_entry` 的第一句是 `account_id = auth.uid()` —— 而一个从闸道
-- 打进来的回呼**没有 auth.uid()**。最省事的做法是替它另写一支会 insert 的
-- 函式，而那正是[重点 23]白纸黑字禁止的那件事：
--
--   「不准为 AI 另写一支比较方便的写入函式」——
--   而一个闸道跟一个 AI 在这一点上没有分别。
--
-- 这个仓库十九次「说了没做」，每一次的形状都是**同一件事有两条路，
-- 只修了一条**。钱这一层再开第二条，代价是他月底对不上帐而没有人知道为什么。
--
-- 所以：
--
--   add_ledger_entry_core   一份逻辑，**没有权限检查，也没有 grant 给任何人**
--   add_ledger_entry        门一：他登入了，而且这一家是他的
--   settle_payment_request  门二：闸道说这一张付款要求付了
--
-- ⚠️ 而 core 的 body 是**用程式从原本那一支抄出来的，不是重打的**。
-- 20260831080000 就是重打的时候把 `unique_violation` 那一段漏掉了，
-- 而那一段正是「按两下只进一笔」。
--
-- ── 🔴 `recorded_by` 是 null，而那是一句真话 ─────────────────────────────
--
-- 人按的时候记他；闸道回呼的时候**记 null** —— 没有人打过这一笔。
-- 填一个老板的 id 进去会让 20260904030000 那本「谁改的」帐说谎，
-- 而那本帐存在的唯一理由就是回答那个问题。

create or replace function public.add_ledger_entry_core(
  /* 谁按的。人按的时候是他自己；闸道回呼的时候是 null ——
     而 null 在那一栏是**一句真话**：没有人打过这一笔。 */
  in_actor uuid,
  in_project_id uuid,
  in_module_key text,
  in_direction text default null,
  in_amount_cents bigint default 0,
  in_party text default '',
  in_against_id uuid default null,
  in_entry_on date default null,
  in_method text default '',
  in_reference text default '',
  in_receipt_url text default null,
  in_note text default '',
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null,
  in_party_id uuid default null,
  in_branch_id uuid default null,
  /* 谁做的。佣金算在这上面（20260904120000）。 */
  in_done_by uuid default null,
  /* 这笔钱是干什么的。他自己的词 —— 材料 · 工钱 · 车油 · 租金。
     ERPNext 的 Account 收成一栏（见档头）。 */
  in_category text default '',
  /* 这笔开销属於哪一单。**只有出去的钱**，见档头。 */
  in_job_id uuid default null
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.ledger_entries;
  dir text;
  the_party uuid;
  side text;
  doc_worth bigint;
  doc_taken bigint;
  to_apply bigint;
  job_belongs boolean;
begin
  /* 🔴 这里**故意没有权限检查**，而这一支也**没有 grant 给任何人**
     （见档案末尾的 revoke）。它只被两支 definer 函式呼叫，
     而那两支各自证明自己的权力：
       add_ledger_entry        他登入了，而且这一家是他的
       settle_payment_request  闸道说这一张付款要求付了
     一份写入逻辑，两道门 —— [重点 23] 讲的就是这件事。 */
  if in_project_id is null then
    raise exception 'no project';
  end if;

  if not public.is_ledger_module(in_module_key) then
    raise exception 'not a ledger module: %', in_module_key;
  end if;

  if not public.branch_is_ours(in_project_id, in_branch_id) then
    raise exception 'that branch is not in this project';
  end if;

  /* 🔴 只能是这一家自己的**师傅**。一个挂在客户身上的「谁做的」在画面上
     完全正常，而它会让月底那张表把一个客户算成员工。 */
  if in_done_by is not null then
    perform 1 from public.directory_entries
      where id = in_done_by and project_id = in_project_id and module_key = 'staff';
    if not found then
      raise exception 'that person is not a staff member in this project';
    end if;
  end if;

  if in_idempotency_key is not null then
    select * into row from public.ledger_entries
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  if coalesce(in_amount_cents, 0) < 0 then
    raise exception 'amount cannot be negative -- use direction instead';
  end if;

  dir := lower(btrim(coalesce(in_direction, '')));
  if dir not in ('in', 'out') then
    dir := case in_module_key when 'payments' then 'in' else 'out' end;
  end if;

  if in_against_id is not null then
    perform 1 from public.pipeline_records
      where id = in_against_id and project_id = in_project_id;
    if not found then
      raise exception 'that document is not in this project';
    end if;
  end if;

  /* ── 🔴 一笔进来的钱不准挂在某一单上，而这不是小气 ─────────────────────
     进来的钱靠**分摊**回答「这一单收了多少」（ledger_allocations，一笔可以
     分给好几张单）。再让它写一个 job_id，同一个问题就有两个答案，
     而两个答案迟早会不一样 —— 这个仓库最常犯的那个错。
     所以讲出来该怎么做，不要静静地收下。 */
  if in_job_id is not null then
    if dir <> 'out' then
      raise exception 'money in is attached to a document by allocating it, not by naming a job';
    end if;
    select true into job_belongs from public.pipeline_records
      where id = in_job_id and project_id = in_project_id;
    if not found then
      raise exception 'that job is not in this project';
    end if;
  end if;

  /* Money in comes from a customer; money out goes to a supplier. Reading the
     direction rather than the module is what lets 开销 paid to a supplier and
     a refund paid to a customer both land on the right person. */
  side := case when dir = 'in' then 'customers' else 'suppliers' end;

  if in_party_id is not null then
    perform 1 from public.directory_entries
      where id = in_party_id and project_id = in_project_id;
    if not found then
      raise exception 'that party is not in this project';
    end if;
    the_party := in_party_id;
  else
    if in_against_id is not null then
      select party_id into the_party from public.pipeline_records where id = in_against_id;
    end if;
    the_party := coalesce(
      the_party,
      public.party_by_name(in_project_id, in_party, side),
      /* And if that side has nobody by this name, the other one -- a business
         with only a customer list must still be able to file an expense
         against the person it typed. Tried second, never first: crossing sides
         is a fallback, not a default. */
      public.party_by_name(
        in_project_id, in_party,
        case when side = 'customers' then 'suppliers' else 'customers' end
      )
    );
  end if;

  insert into public.ledger_entries (
    project_id, module_key, doc_no, party, party_id, direction, amount_cents,
    /* 🔴 **0**，不是 in_amount_cents。见档头 —— 从 20260903030000 起
       `allocated_cents` 只有那支触发器写得了它，而下面那一笔真的分摊
       会让它变成对的数字。 */
    allocated_cents, against_id, entry_on, method, reference, receipt_url,
    note, recorded_by, extra, idempotency_key, branch_id, done_by, category, job_id
  ) values (
    in_project_id,
    in_module_key,
    public.next_doc_no(in_project_id, in_module_key),
    left(coalesce(in_party, ''), 200),
    the_party,
    dir,
    coalesce(in_amount_cents, 0),
    0,
    in_against_id,
    coalesce(in_entry_on, public.today_myt()),
    left(coalesce(in_method, ''), 60),
    left(coalesce(in_reference, ''), 120),
    in_receipt_url,
    left(coalesce(in_note, ''), 2000),
    in_actor,
    coalesce(in_extra, '{}'::jsonb),
    in_idempotency_key,
    in_branch_id,
    in_done_by,
    left(btrim(coalesce(in_category, '')), 60),
    in_job_id
  )
  returning * into row;

  /* ── 🔴 写一笔真的分摊，不要自己设那个总数 ─────────────────────────────
     只分摊那张单**还欠的那一部分**：多出来的留着当订金，
     而那正是 set_payment_allocations 拒绝超收的时候叫他做的那件事。 */
  if dir = 'in' and in_against_id is not null and coalesce(in_amount_cents, 0) > 0 then
    select coalesce(r.amount_cents, 0) into doc_worth
    from public.pipeline_records r where r.id = in_against_id;

    select coalesce(sum(a.amount_cents), 0) into doc_taken
    from public.ledger_allocations a
    join public.ledger_entries e on e.id = a.entry_id
    where a.record_id = in_against_id
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id);

    to_apply := least(coalesce(in_amount_cents, 0), greatest(doc_worth - doc_taken, 0));
    if to_apply > 0 then
      insert into public.ledger_allocations (entry_id, record_id, project_id, amount_cents)
      values (row.id, in_against_id, in_project_id, to_apply);
      /* 触发器把 allocated_cents 跟 against_id 写回去，所以这里再读一次。 */
      select * into row from public.ledger_entries where id = row.id;
    end if;
  end if;

  return row;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into row from public.ledger_entries
      where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise;
end;
$$;


-- ── 门一：他自己按的 ──────────────────────────────────────────────────────
--
-- 签名一个字都没变，所以不用 drop（20260904010000 那条守卫问的是
-- 「签名变了才必须 drop」）。变的只有 body：检查还在，写入搬去 core。
create or replace function public.add_ledger_entry(

  in_project_id uuid,
  in_module_key text,
  in_direction text default null,
  in_amount_cents bigint default 0,
  in_party text default '',
  in_against_id uuid default null,
  in_entry_on date default null,
  in_method text default '',
  in_reference text default '',
  in_receipt_url text default null,
  in_note text default '',
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null,
  in_party_id uuid default null,
  in_branch_id uuid default null,
  /* 谁做的。佣金算在这上面（20260904120000）。 */
  in_done_by uuid default null,
  /* 这笔钱是干什么的。他自己的词 —— 材料 · 工钱 · 车油 · 租金。
     ERPNext 的 Account 收成一栏（见档头）。 */
  in_category text default '',
  /* 这笔开销属於哪一单。**只有出去的钱**，见档头。 */
  in_job_id uuid default null
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.projects
    where id = in_project_id and account_id = auth.uid()
  ) then
    raise exception 'not your project';
  end if;

  return public.add_ledger_entry_core(
    in_actor => auth.uid(),
    in_project_id => in_project_id,
    in_module_key => in_module_key,
    in_direction => in_direction,
    in_amount_cents => in_amount_cents,
    in_party => in_party,
    in_against_id => in_against_id,
    in_entry_on => in_entry_on,
    in_method => in_method,
    in_reference => in_reference,
    in_receipt_url => in_receipt_url,
    in_note => in_note,
    in_extra => in_extra,
    in_idempotency_key => in_idempotency_key,
    in_party_id => in_party_id,
    in_branch_id => in_branch_id,
    in_done_by => in_done_by,
    in_category => in_category,
    in_job_id => in_job_id
  );
end;
$$;

-- ── 一张「请这个人付这笔钱」 ──────────────────────────────────────────────
--
-- 它不是一笔钱，它是**一个还没发生的收款**。分开的理由很实际：
-- 他开出去十张付款连结，客人付了三张 —— 那七张不可以出现在他的帐上，
-- 而那三张要变成真的行。一张表答得了「谁还没付」，一本帐答不了。
create table if not exists public.payment_requests (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects(id) on delete cascade,

  /* 哪一张单。**可以是 null** —— 一间咖啡店在柜台收一笔钱，
     那笔钱不指向任何一张单，而它照样是一笔真的收入。 */
  record_id uuid references public.pipeline_records(id) on delete set null,

  /* 要他付多少。**这不是最后收到多少** —— 见 `paid_cents`。 */
  amount_cents bigint not null check (amount_cents > 0),

  /* 从哪个闸道进来的。对帐的时候他会问的第一句就是这个。
     ⚠️ 没有写死成一张清单：今天一家都还没开户（[任务 70](#70) 查过
     CHIP · Billplz · toyyibPay 的费率，而开户卡在公司注册），
     而一个写死的清单会在他选定的那一天变成一次迁移。 */
  provider text not null check (btrim(provider) <> ''),

  /* 闸道自己给的编号。回呼靠这个认得是哪一张。 */
  provider_ref text not null check (btrim(provider_ref) <> ''),

  status text not null default 'open'
    check (status in ('open', 'paid', 'failed', 'cancelled')),

  /* 付了之后变成哪一行钱。null = 还没付。
     ⚠️ `on delete set null`：他把那一行收款删掉（或者冲正），
     这张付款要求还在 —— **「有人付过」是历史，不是那一行的附属品**。 */
  entry_id uuid references public.ledger_entries(id) on delete set null,

  /* 闸道讲的付款人。**存原样，不去猜他是名册上的谁** ——
     猜错就是把钱记到另一个客户头上，而那是月底才会发现的错。
     认人那一段走 add_ledger_entry_core 里既有的那一支（party_by_name）。 */
  payer text not null default '',

  /* 🔴 **真的收到多少**，不是我们要求多少。
     部分付款、闸道扣手续费、客人自己改金额 —— 三种都会让两个数字不一样，
     而写进帐的必须是真的到帐的那一个。 */
  paid_cents bigint check (paid_cents is null or paid_cents >= 0),
  paid_at timestamptz,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

/* 🔴 这一条索引就是「客人的钱不会被记两次」的全部。
   每一家闸道都会重送回呼（网路抖一下、我们回慢了、他们自己重试），
   而没有这一条的话，一笔 RM 3,000 会变成两笔。 */
create unique index if not exists payment_requests_provider_ref_once
  on public.payment_requests (provider, provider_ref);

create index if not exists payment_requests_open_first
  on public.payment_requests (project_id, status, created_at desc);

alter table public.payment_requests enable row level security;

/* 钱那一层。师傅看不到 —— 一张付款要求上面写着金额跟客户，
   跟收款那一页是同一件事。 */
create policy "payment requests are read by whoever sees the money"
  on public.payment_requests for select to authenticated
  using (public.sees_money(project_id));

comment on table public.payment_requests is
  'One "please pay this" that has not become money yet. The unique index on (provider, provider_ref) is what stops a retried gateway callback from banking the same payment twice. See 20260905020000.';

-- ── 他开一张 ──────────────────────────────────────────────────────────────
create or replace function public.open_payment_request(
  in_project_id uuid,
  in_amount_cents bigint,
  in_provider text,
  in_provider_ref text,
  in_record_id uuid default null,
  in_payer text default ''
)
returns public.payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.payment_requests;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'not your project';
  end if;

  if coalesce(in_amount_cents, 0) <= 0 then
    raise exception 'a payment request needs an amount';
  end if;

  /* 那张单要是这一家的。一张指向别人家单据的付款要求，
     在画面上完全正常，而它会把别人的钱记进这一家的帐。 */
  if in_record_id is not null then
    perform 1 from public.pipeline_records
      where id = in_record_id and project_id = in_project_id;
    if not found then
      raise exception 'that document is not in this project';
    end if;
  end if;

  insert into public.payment_requests (
    project_id, record_id, amount_cents, provider, provider_ref, payer, created_by
  ) values (
    in_project_id, in_record_id, in_amount_cents,
    btrim(in_provider), btrim(in_provider_ref),
    left(coalesce(in_payer, ''), 200), auth.uid()
  )
  returning * into row;

  return row;

exception
  /* 同一个闸道编号开两次 = 同一张。把已经在的那一张还给他，
     不要开第二张 —— 两张指向同一笔钱，回呼来的时候只会结掉一张。 */
  when unique_violation then
    select * into row from public.payment_requests
      where provider = btrim(in_provider) and provider_ref = btrim(in_provider_ref);
    if found and row.project_id = in_project_id then
      return row;
    end if;
    raise;
end;
$$;

-- ── 门二：闸道说付了 ──────────────────────────────────────────────────────
--
-- 🔴 **它自己不写任何 insert 到 ledger_entries** —— 它呼叫 core，
-- 跟他手按那一颗按钮走的是同一份逻辑（单号 · 认人 · 分摊 · 防重复）。
--
-- ⚠️ 只 grant 给 service_role。这一支没有 auth.uid() 可以问，
-- 所以它唯一的权力来源是「那一张付款要求存在，而且还没结」。
-- 让浏览器打得到它，就等於任何人都可以宣称自己付过钱。
create or replace function public.settle_payment_request(
  in_provider text,
  in_provider_ref text,
  in_paid_cents bigint,
  in_method text default '',
  in_payer text default ''
)
returns public.payment_requests
language plpgsql
security definer
set search_path = public
as $$
declare
  req public.payment_requests;
  entry public.ledger_entries;
begin
  select * into req from public.payment_requests
    where provider = btrim(in_provider) and provider_ref = btrim(in_provider_ref)
    for update;

  if not found then
    raise exception 'no such payment request';
  end if;

  /* 🔴 重送的回呼走这一条出去。每一家闸道都会重送，而**不是错误** ——
     所以回那一张已经结好的，不要抛。抛出去的话闸道会再送一次，
     然后再一次，而我们每一次都在告诉它我们坏了。 */
  if req.status = 'paid' then
    return req;
  end if;

  if coalesce(in_paid_cents, 0) <= 0 then
    update public.payment_requests
      set status = 'failed', paid_at = now()
      where id = req.id
      returning * into req;
    return req;
  end if;

  entry := public.add_ledger_entry_core(
    /* 🔴 null —— 没有人打过这一笔。见档头。 */
    in_actor => null,
    in_project_id => req.project_id,
    in_module_key => 'payments',
    in_direction => 'in',
    /* **真的到帐的那个数字**，不是我们要求的那个。 */
    in_amount_cents => in_paid_cents,
    in_party => left(coalesce(nullif(btrim(in_payer), ''), req.payer), 200),
    in_against_id => req.record_id,
    in_method => left(coalesce(nullif(btrim(in_method), ''), req.provider), 60),
    in_reference => left(req.provider_ref, 120),
    /* 同一张付款要求只会变成同一行钱 —— 就算上面每一道检查都错了，
       core 里那一段 idempotency 会把第二次的还给我们。 */
    in_idempotency_key => req.id
  );

  update public.payment_requests
    set status = 'paid',
        entry_id = entry.id,
        paid_cents = in_paid_cents,
        paid_at = now(),
        payer = left(coalesce(nullif(btrim(in_payer), ''), payer), 200)
    where id = req.id
    returning * into req;

  return req;
end;
$$;

-- ── 谁能打哪一支 ──────────────────────────────────────────────────────────
--
-- 🔴 core **一个人都不给**。它是 security definer 而且没有权限检查，
-- 所以任何一个拿得到它的角色，都可以往任何一家的帐上写钱。
-- 上面那两支 definer 函式以 owner 的身分跑，所以它们照样呼叫得到。
revoke all on function public.add_ledger_entry_core(
  uuid, uuid, text, text, bigint, text, uuid, date, text, text, text, text,
  jsonb, uuid, uuid, uuid, uuid, text, uuid
) from public, anon, authenticated, service_role;

revoke execute on function public.open_payment_request(uuid, bigint, text, text, uuid, text)
  from public, anon;
grant execute on function public.open_payment_request(uuid, bigint, text, text, uuid, text)
  to authenticated;

/* 🔴 只有伺服器那一端。浏览器打得到它 = 任何人都可以宣称自己付过钱。 */
revoke execute on function public.settle_payment_request(text, text, bigint, text, text)
  from public, anon, authenticated;
grant execute on function public.settle_payment_request(text, text, bigint, text, text)
  to service_role;

comment on function public.settle_payment_request(text, text, bigint, text, text) is
  'The gateway says this request was paid. Writes the money through add_ledger_entry_core -- the same body a person''s button uses -- and is safe to call twice, because every gateway retries. service_role only. See 20260905020000.';
