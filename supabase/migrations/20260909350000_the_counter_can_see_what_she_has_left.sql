-- 柜台看得到「她手上还剩多少」—— 而看不到「谁欠我钱」那张总表。
--
-- ── 他 2026-09-09 点的头 ─────────────────────────────────────────────────
--
-- 我问：`柜台今天看不到客人卡里还剩多少（美发师读到的是 0）。Fresha 是给
-- 柜台看的。要不要放开？` 他答 `可以`。
--
-- ── 🔴 这是「放宽」，所以要先讲清楚原来那条守卫在保护什么 ─────────────────
--
-- [重点 31](../docs/founder-points.md) 那张表：**放宽不会挡到任何人**，
-- 但要问一句「本来那条守卫在保护什么」。
--
-- `party_deposit` 写的时候挡的是 `sees_money`，跟 `add_ledger_entry` ·
-- `party_debts` 同一批 —— 那一批保护的是**这门生意的钱**：营业额、欠款总表、
-- 谁抽多少。一个美发师读得到那几样，等於老板的帐摊在柜台上。
--
-- 而这一支答的不是那件事。它答的是**这一个客人自己付过、还没用掉的钱** ——
-- 而那是柜台每天要讲出口的一句话：「陈太太，你卡里还有 RM 300」。
-- 客人自己都知道这个数字，**她就是付钱的那个人**。
--
-- 🔴 所以放开的是**一个客人的余额**，不是**一门生意的钱**。
-- 那两件事本来就不该共用一条守卫，而它们共用了四天。
--
-- ⚠️ 逐个呼叫端看过（2026-09-09）：单据详情那一页 · `check:statement` ·
-- `shoot:record-doors` · `walk:salon` · `deposit_advice` ——
-- **五个全部是问某一个客人**，没有一个在加总这门生意的钱。
--
-- ⚠️ 而 `party_debts`（谁欠我钱那张总表）**照旧 `sees_money`**，
-- 而这一支放开之后它是唯一的对照组：柜台看得到一个人的余额，
-- 看不到全店的欠款。少了那个对照，「放开了」跟「本来就没挡」分不出来。

create or replace function public.party_deposit(
  p_project_id uuid,
  p_party_id uuid
)
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(sum(e.amount_cents - e.allocated_cents), 0)::bigint
  from public.ledger_entries e
  where e.project_id = p_project_id
    and e.party_id = p_party_id
    and e.direction = 'in'
    and e.adjusts_id is null
    and not exists (select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id)
    /* 🔴 20260909350000：`sees_money` → `works_here`。见档头。
       一个客人自己付过而还没用掉的钱，是柜台每天要讲出口的一句话。 */
    and public.works_here(p_project_id);
$$;

comment on function public.party_deposit(uuid, uuid) is
  'One customer''s own money paid in and not yet used up. works_here, not sees_money: the counter says this number out loud every day, and the customer already knows it -- she is the one who paid. The business''s own money (party_debts, takings, commission) stays behind sees_money. See 20260909350000.';

-- ── 而建议那一支的两栏也跟着开 ────────────────────────────────────────────
--
-- `deposit_advice` 本来把这两栏对看不到钱的人做成 null（20260909320000），
-- 理由是「`party_deposit` 对美发师回 0，照抄下去柜台看到的是她一分钱都没付」。
-- **那个理由今天不成立了** —— 她读得到真的数字。
--
-- ⚠️ 而一条过期的守卫，跟一个没有守卫，是同一个缺陷的两张脸
-- （[任务 110](../docs/founder-tasks.md#110)）：留着那个 null，就是柜台
-- 明明读得到而系统告诉她「你看不到」。

create or replace function public.deposit_advice(
  in_project_id uuid,
  in_party_id uuid
)
returns table (
  missed integer,
  came integer,
  last_missed_on date,
  rule_after integer,
  advise boolean,
  suggest_cents bigint,
  on_hand_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rules public.booking_rules;
  n_missed integer := 0;
  n_came integer := 0;
  last_on date;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;

  select * into rules from public.booking_rules where project_id = in_project_id;

  select
    count(*) filter (where a.status = 'no_show')::integer,
    count(*) filter (where a.status = 'done')::integer,
    max(a.starts_at at time zone 'Asia/Kuala_Lumpur')
      filter (where a.status = 'no_show')::date
  into n_missed, n_came, last_on
  from public.appointments a
  where a.project_id = in_project_id
    and a.party_id = in_party_id
    and a.kind = 'booking'
    and a.archived_at is null;

  return query select
    coalesce(n_missed, 0),
    coalesce(n_came, 0),
    last_on,
    rules.no_show_deposit_after,
    /* 🔴 他没讲那个次数 → 不讲话。这一条一个字都没有动过。 */
    (rules.no_show_deposit_after is not null
      and coalesce(n_missed, 0) >= rules.no_show_deposit_after),
    /* 🔴 20260909350000：两栏都给柜台看。见档头。 */
    rules.default_deposit_cents,
    public.party_deposit(in_project_id, in_party_id);
end;
$$;

comment on function public.deposit_advice(uuid, uuid) is
  'Answers the one sentence a counter says out loud: is this customer reliable, and should we ask for a deposit. Advises nothing until the shop has given its own threshold. Both money columns are readable by the counter since 20260909350000 -- they are about this one customer, not about the business.';
