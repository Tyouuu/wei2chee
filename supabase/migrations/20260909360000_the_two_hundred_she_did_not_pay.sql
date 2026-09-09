-- 储值卡 —— 「充 1000 送 200」，而**那 200 永远不进他的营业额**。
--
-- ── 我本来说要等他回答，想通之后不用等 ───────────────────────────────────
--
-- 我跟他讲：`你们送不送？固定 · 百分比 · 分档？问回来才动手`。
-- **那句话把两件事绑在一起了，而它们本来是分开的**：
--
--   送多少   → 一条规矩（固定 · 百分比 · 分档）—— **他问回来才知道**
--   送了一笔 → 一件事实（这个客人、这一天、多少钱）—— **三种规矩长得一模一样**
--
-- 所以照 [重点 「先写 general」](../docs/founder-points.md) 那一条：
-- **事实先记得下，算法等他填。** 今天金额是他打进去的；他讲了规矩之后，
-- 那个数字改成算出来的，而这张表一个字都不用动。
--
-- ── 🔴 为什么那 200 不可以走帐 ────────────────────────────────────────────
--
-- 最省事的做法是把 1,200 整个当一笔收款记进去。**那是这套系统最不可以出的错**：
-- 他的营业额会多出 **200 块从来没有进过户口的钱**，而月底他拿银行对帐单一比，
-- 对不上的正是那一笔。[重点 26](../docs/founder-points.md)：钱那一层一个错都不准有。
--
-- 所以两边分开，各记各的：
--
--   她付的 1,000  → `add_ledger_entry`（**人按那颗按钮同一支**，[重点 23]）
--                   真的钱、真的进帐、`party_deposit` 自己就算得到
--   送的 200      → 这张表。**不是钱，是一张欠她的服务券**
--
-- ── 🔴 而「用掉的时候先扣哪一边」我不发明 ─────────────────────────────────
--
-- 先扣送的、先扣付的、按比例摊 —— 三种都有人做，而三种都是**他的生意决定**。
-- 所以 `credit_of` **两个数字都给**（她付的还剩多少 · 送的还剩多少），
-- 柜台自己看着办；系统不替他挑。
-- 这跟 20260909320000 那条门槛是同一条纪律：**不知道的数字不要编**。
--
-- ⚠️ 而**用掉送的那一笔照样不进帐** —— 钱在充值那一天就收过了。
-- 再记一次就是同一笔钱算两次，跟上面那个错是同一家。

create table if not exists public.stored_value_moves (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* restrict：卡里还有余额的客人删不掉。 */
  party_id uuid not null references public.directory_entries(id) on delete restrict,

  /* 'in' = 送给她的；'out' = 她用掉的。**两边都不是钱**。 */
  direction text not null check (direction in ('in', 'out')),

  /* 正数，方向在上面那一栏 —— 跟 `ledger_entries` 同一个做法。 */
  amount_cents bigint not null check (amount_cents > 0),

  /* 他自己的话：「充一千送两百」「生日礼」「做坏了赔她」。 */
  reason text not null default '',

  /* 🔴 送的那一笔是**跟着哪一次充值**来的。null = 单独送的（生日 · 赔偿）。
     它指的是那一笔**真的钱**，所以对得回帐上那一行。 */
  entry_id uuid references public.ledger_entries(id) on delete set null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  idempotency_key uuid,

  constraint stored_value_moves_one_per_key unique (project_id, idempotency_key)
);

create index if not exists stored_value_moves_by_party
  on public.stored_value_moves (project_id, party_id, created_at desc);

alter table public.stored_value_moves enable row level security;

drop policy if exists "stored_value_moves_members" on public.stored_value_moves;
create policy "stored_value_moves_members" on public.stored_value_moves
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

comment on table public.stored_value_moves is
  'Credit given to a customer that she did not pay for -- the 200 in "top up 1,000 get 1,200" -- and the same credit being used up. Never money: the cash side is a ledger entry, and putting the gift there would inflate his takings by an amount that never reached his bank. See 20260909360000.';

-- ── 送她一笔 ──────────────────────────────────────────────────────────────

create or replace function public.grant_credit(
  in_project_id uuid,
  in_party_id uuid,
  in_amount_cents bigint,
  in_reason text default '',
  /* 跟着哪一笔充值来的。单独送的（生日 · 赔偿）不给。 */
  in_entry_id uuid default null,
  in_idempotency_key uuid default null
)
returns public.stored_value_moves
language plpgsql
security definer
set search_path = public
as $$
declare
  made public.stored_value_moves;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;
  /* 🔴 **送钱是老板的事**（跟 `set_booking_rules` · `set_class_fee` 同一条）。
     ⚠️ 他把规矩讲出来那天，这里要放宽给柜台 —— 照规矩送跟自己决定送，
     是两件事，而今天只有后者存在。 */
  if not public.sees_money(in_project_id) then
    raise exception 'giving credit away is for the owner';
  end if;
  if coalesce(in_amount_cents, 0) <= 0 then
    raise exception 'say how much to give';
  end if;
  perform 1 from public.directory_entries
   where id = in_party_id and project_id = in_project_id;
  if not found then
    raise exception 'that person is not in your directory';
  end if;

  if in_idempotency_key is not null then
    select * into made from public.stored_value_moves
     where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then return made; end if;
  end if;

  insert into public.stored_value_moves
    (project_id, party_id, direction, amount_cents, reason, entry_id,
     created_by, idempotency_key)
  values (in_project_id, in_party_id, 'in', in_amount_cents,
          left(btrim(coalesce(in_reason, '')), 200), in_entry_id,
          auth.uid(), in_idempotency_key)
  returning * into made;
  return made;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into made from public.stored_value_moves
       where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then return made; end if;
    end if;
    raise;
end;
$$;

revoke execute on function public.grant_credit(uuid, uuid, bigint, text, uuid, uuid)
  from public, anon;
grant execute on function public.grant_credit(uuid, uuid, bigint, text, uuid, uuid)
  to authenticated;

-- ── 她用掉送的那一部分 ────────────────────────────────────────────────────

create or replace function public.use_credit(
  in_project_id uuid,
  in_party_id uuid,
  in_amount_cents bigint,
  in_reason text default '',
  in_idempotency_key uuid default null
)
returns public.stored_value_moves
language plpgsql
security definer
set search_path = public
as $$
declare
  made public.stored_value_moves;
  left_over bigint;
begin
  /* 🔴 `works_here` —— **用掉是柜台按的**，跟 `set_appointment_deposit` 同一条。
     送出去是老板的决定；用掉只是把已经答应过的东西交出去。 */
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;
  if coalesce(in_amount_cents, 0) <= 0 then
    raise exception 'say how much was used';
  end if;

  if in_idempotency_key is not null then
    select * into made from public.stored_value_moves
     where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then return made; end if;
  end if;

  /* 🔴 送的那一份用完就是用完 —— 不准变成负的。
     一张可以透支的礼券，就是一张他没有答应过的礼券。 */
  select coalesce(sum(case when direction = 'in' then amount_cents
                           else -amount_cents end), 0)
    into left_over
    from public.stored_value_moves
   where project_id = in_project_id and party_id = in_party_id;
  if left_over < in_amount_cents then
    raise exception 'she only has % sen of gift credit left', left_over;
  end if;

  insert into public.stored_value_moves
    (project_id, party_id, direction, amount_cents, reason,
     created_by, idempotency_key)
  values (in_project_id, in_party_id, 'out', in_amount_cents,
          left(btrim(coalesce(in_reason, '')), 200), auth.uid(), in_idempotency_key)
  returning * into made;
  return made;

exception
  when unique_violation then
    if in_idempotency_key is not null then
      select * into made from public.stored_value_moves
       where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then return made; end if;
    end if;
    raise;
end;
$$;

revoke execute on function public.use_credit(uuid, uuid, bigint, text, uuid)
  from public, anon;
grant execute on function public.use_credit(uuid, uuid, bigint, text, uuid)
  to authenticated;

-- ── 她卡里还剩多少 ────────────────────────────────────────────────────────

create or replace function public.credit_of(
  in_project_id uuid,
  in_party_id uuid
)
returns table (
  /* 她自己付过、还没用掉的（`party_deposit`，一份不是两份）。 */
  paid_cents bigint,
  /* 送的，还没用掉的。 */
  gift_cents bigint,
  /* 柜台念给她听的那一个数字。 */
  total_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  paid bigint;
  gift bigint;
begin
  /* 🔴 `works_here` —— 20260909350000 他点头放开的那一条：
     一个客人自己的余额是柜台每天要讲出口的一句话。 */
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;

  /* 🔴 **呼叫既有那一支，不在这里再算一次** —— 两个地方算同一个数字，
     漂的那一天柜台讲的跟单据页上写的不一样（[任务 216] 的陷阱）。 */
  paid := public.party_deposit(in_project_id, in_party_id);

  select coalesce(sum(case when direction = 'in' then amount_cents
                           else -amount_cents end), 0)
    into gift
    from public.stored_value_moves
   where project_id = in_project_id and party_id = in_party_id;

  return query select paid, gift, paid + gift;
end;
$$;

revoke execute on function public.credit_of(uuid, uuid) from public, anon;
grant execute on function public.credit_of(uuid, uuid) to authenticated;

comment on function public.credit_of(uuid, uuid) is
  'What a customer has left, in two numbers: what she paid for and what she was given. Two, not one, because which side to draw down first is the shop''s decision and not ours to invent. See 20260909360000.';
