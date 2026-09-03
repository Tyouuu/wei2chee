-- 分期付款表 —— 订金 30% · 动工 40% · 完工 30%。
--
-- ── 为什么这一件排在十五格的第二格 ────────────────────────────────────
--
-- 装修**每一张单都有**。一个承包商不会讲「这个工程 RM 48,500」就收工，
-- 他讲的是「订金三成，动工再四成，完工付清」—— 而我们的报价单到今天
-- 只存得下一个总数。那不是少一个功能，那是那张纸上最要紧的一段话没地方放。
--
-- ── 读的是谁的表 ────────────────────────────────────────────────────────
--
-- ERPNext 的 `Payment Schedule` doctype 原文（GitHub API 读的，不是首页）：
-- 必填只有 `due_date` 跟 `payment_amount`；20 栏里真正决定它像不像真的
-- 那一栏是 **`invoice_portion: Percent`** —— 分期讲的是**比例**，不是三个
-- 凭空写死的数字。
--
-- 抄五栏，不抄二十栏：
--   ✅ 讲什么（description）· 比例或金额 · 什么时候 · 顺序
--   ❌ `mode_of_payment` `discount_date` `discount_type` `base_*`（多币别）
--      `credit_days` `credit_months` `discount_validity_*` —— 十四栏
--   ❌ **`paid_amount` 跟 `outstanding` 故意不建**，理由在下面
--
-- ── 🔴 这一支还不是什么，自己讲出来 ───────────────────────────────────
--
-- 这张表说的是「他应该什么时候收到多少」。**它不知道钱有没有进来。**
--
-- ERPNext 在这张表上存 `paid_amount` 跟 `outstanding`，而那两栏只有在
-- 「一笔收款可以指定分摊到哪一期」存在之后才有意义 —— 那是十五格里的
-- 下一格，还没做。
--
-- 现在建那两栏，等於建两个永远是 0 的数字挂在他的单上；而一个永远是 0 的
-- 「已收」比没有那一栏更糟，因为它看起来像一个事实。
-- （跟 20260901070000 决定「总数是流水加起来的」是同一条判断。）
--
-- ⚠️ 而下一格落地的时候要记得回来做一件事：**一笔钱分摊到某一期之后，
-- 那一期就不可以再被整批换掉**（下面 set_record_terms 是整批换的）。
-- 那正是 20260903 之前 record_lines 踩过的坑（任务 93：整批换让每一行
-- 拿到新 id，收货的锚点就断了）。**同一个坑，先写下来。**
--
-- ── 比例还是金额，只能有一个 ────────────────────────────────────────────
--
-- 两个都存会打架：他写 30%，然后逐项明细多一行，总数变了 —— 一个存起来的
-- 金额当场过期，而画面上没有任何东西会讲。
--
-- 所以一期**只能是比例、或者只能是金额**，check 挡着。
-- 比例的那几期，金额在读的时候算（lib/portal/payment-terms.ts），
-- **最后一期吃掉余数** —— 33.33% 三期加起来不等於总数，而客人手上那张纸
-- 一定要加得起来。

create table if not exists public.record_terms (
  id uuid primary key default gen_random_uuid(),

  /* 这一期属於哪一张单。cascade：单没了，它自己没有意义。 */
  record_id uuid not null references public.pipeline_records(id) on delete cascade,

  /* 反正规化，让 RLS 不用每一次读都 join —— 这张 schema 里每一张表都这样，
     而且靠下面那支触发器保持真，不是靠祈祷。 */
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 他自己的话：「订金」「动工」「完工」「交钥匙」。永远不是一个固定选单 ——
     跟 `stage` 同一个决定，每一行生意讲法不一样。 */
  description text not null,

  /* 比例。30 就是三成。numeric 不是 float：33.33 要加得回去。
     null 代表这一期是写死的金额。 */
  portion numeric(5, 2),

  /* 写死的金额，sen。「订金 RM 5,000，余额完工付」是真的会写的单。
     null 代表这一期是比例。 */
  amount_cents bigint,

  /* 什么时候。可以空 —— 「完工付」没有日期，那是一个事件不是一天，
     而替他填一个猜的日子比留白更糟（同 20260903010000 的理由）。 */
  due_on date,

  /* 他写的顺序。分期表读错顺序就是另一份合约。 */
  sort_order integer not null default 0,

  note text not null default '',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  /* 🔴 只能有一个。两个都给，或者两个都不给，都是一期讲不清楚自己是多少钱。 */
  constraint record_terms_one_measure check (
    (portion is not null and amount_cents is null)
    or (portion is null and amount_cents is not null)
  ),
  /* 0% 的一期不是一期；超过 100% 的比例是打错字。 */
  constraint record_terms_portion_range check (
    portion is null or (portion > 0 and portion <= 100)
  ),
  /* 负数的一期是冲正，而冲正是记帐那一边的事。 */
  constraint record_terms_amount_positive check (
    amount_cents is null or amount_cents > 0
  )
);

comment on table public.record_terms is
  'The payment schedule of one pipeline document -- 订金 30% · 动工 40% · 完工 30%. '
  'Deliberately without paid_amount/outstanding: nothing can allocate money to an '
  'instalment yet, and a 「已收」 column that is always 0 reads as a fact. See the header of 20260903020000.';
comment on column public.record_terms.portion is
  'Percent. Exactly one of portion / amount_cents is set -- storing both goes stale the moment a line is added.';
comment on column public.record_terms.due_on is
  'Optional on purpose: 「完工付」 is an event, not a day, and a guessed date is worse than a blank.';

create index if not exists record_terms_doc_idx
  on public.record_terms (record_id, sort_order);

-- ── 谁看得到 ──────────────────────────────────────────────────────────────
--
-- `works_here()`，跟 record_lines 一样,**不是** `sees_money()`。
--
-- 那不是随手选的：`sees_money` 挡的是**收款 · 开销 · 佣金**那本帐 —— 真的
-- 现金进出。分期付款表是**报价单上的一段话**，而报价单的总额师傅本来就看得到
-- （pipeline_records 用的就是 works_here）。把这一张挡起来，会变成一个师傅
-- 看得到 RM 48,500 却看不到「订金三成」—— 那不是保护，那是不一致。

alter table public.record_terms enable row level security;

create policy "record_terms_members" on public.record_terms
  for all using (public.works_here(project_id)) with check (public.works_here(project_id));

-- ── 这一期的 project 就是它那张单的 project ───────────────────────────────
--
-- 反正规化的栏位只有在有东西让它保持真的时候才安全。没有这一支，一个客户端
-- 可以插一期、写自己的 project id、却指着别人的单 —— 上面那条 policy 会放行，
-- 而那一期会出现在陌生人的报价单上。

create or replace function public.record_terms_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from public.pipeline_records where id = new.record_id;
  if owner_project is null then
    raise exception 'no such document';
  end if;
  new.project_id := owner_project;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists record_terms_own_project_trg on public.record_terms;
create trigger record_terms_own_project_trg
  before insert or update on public.record_terms
  for each row execute function public.record_terms_own_project();

-- ⚠️ 故意没有第二支触发器。record_lines 有一支把总数写回单上,因为逐项明细
-- **就是**那张单的钱。分期表不是 —— 它把同一笔钱切开,总数一分都没有变。
-- 一支「把分期加起来写回 amount_cents」的触发器,会让一张写了 30/40/30 的单
-- 在存档的那一刻总数变成 100% 的自己,而如果他只写了订金那一期,总数会变成三成。

-- ── 写它 ──────────────────────────────────────────────────────────────────
--
-- 一次换掉整份,跟 set_record_lines 同一个形状,而且是同一个理由:分期表是
-- 一整份合约条款,半套改完的分期表是一份没有人同意过的付款办法。

create or replace function public.set_record_terms(
  in_record_id uuid,
  in_terms jsonb
)
returns setof public.record_terms
language plpgsql
security definer
set search_path = public
as $$
declare
  mine boolean;
  item jsonb;
  i integer := 0;
  pct numeric;
  amt bigint;
begin
  select exists (
    select 1 from public.pipeline_records r
    where r.id = in_record_id and public.works_here(r.project_id)
  ) into mine;
  if not mine then
    raise exception 'no such document in your project';
  end if;

  if jsonb_typeof(coalesce(in_terms, 'null'::jsonb)) <> 'array' then
    raise exception 'terms must be an array';
  end if;

  /* 十二期是一份付款办法;六十期是一份还款表,而那是另一件东西。 */
  if jsonb_array_length(in_terms) > 12 then
    raise exception 'too many instalments on one document';
  end if;

  delete from public.record_terms where record_id = in_record_id;

  for item in select * from jsonb_array_elements(in_terms)
  loop
    if coalesce(btrim(item->>'description'), '') = '' then
      raise exception 'every instalment needs a description';
    end if;

    pct := nullif(item->>'portion', '')::numeric;
    amt := nullif(item->>'amount_cents', '')::bigint;

    /* 讲清楚哪里错,不要让约束吐一句他读不懂的话。这两句他读得懂,
       而 「violates check constraint record_terms_one_measure」 他读不懂。 */
    if pct is not null and amt is not null then
      raise exception 'an instalment is either a percentage or an amount, not both';
    end if;
    if pct is null and amt is null then
      raise exception 'an instalment needs a percentage or an amount';
    end if;

    insert into public.record_terms (
      record_id, project_id, description, portion, amount_cents, due_on, sort_order, note
    ) values (
      in_record_id,
      /* 被触发器盖掉;这里只是为了满足 not null。 */
      '00000000-0000-0000-0000-000000000000'::uuid,
      left(btrim(item->>'description'), 120),
      pct,
      amt,
      nullif(item->>'due_on', '')::date,
      i,
      left(coalesce(item->>'note', ''), 300)
    );
    i := i + 1;
  end loop;

  return query
    select * from public.record_terms
     where record_id = in_record_id
     order by sort_order;
end;
$$;

-- 谁可以打它:登入的人,而且函式自己用 works_here() 挡住不是这一家的人。
revoke execute on function public.set_record_terms(uuid, jsonb) from public, anon;
grant execute on function public.set_record_terms(uuid, jsonb) to authenticated;
