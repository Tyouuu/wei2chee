-- 洞二：他签过字的那个月，不会再自己变。
--
-- ⚠️ **这是四个洞里唯一一个「收紧」，所以它单独一支、排最后**（重点 31）。
--    收紧最危险的地方不是它会挡错人，是**它会挡到每一条写入路径，
--    而画面上只看得到「存不了」**。
--
-- ── 洞是走 vibe-dealer 那一次量出来的（任务 175）────────────────────────────
--
--   FAIL  🔴 一个已经对完帐的月份，补不进单
--         — 进去了 · 那个月的总数 RM 38,000.00 → RM 38,999.00，
--           而它还写着「已对帐 是」
--
-- ── 读他自己真的表（重点 26）───────────────────────────────────────────────
--
-- `0031_period_lock` 的档头，两句原话：
--
--   *「Post a forgotten June sale in August and June's verified total moves
--     while company_statements.reconciled stays true. The books now disagree
--     with the carrier's statement and nothing says so; you find out when the
--     carrier queries it, or at audit.」*
--
--   *「Deliberately no per-transaction override flag. The accounting-software
--     convention is to reopen the period, make the correction, and close it
--     again — one auditable act instead of a flag on every row.」*
--
-- **ERPNext 也是一样，而且更小**：`Company.accounts_frozen_till_date`
-- 一个日期 ＋ `role_allowed_for_frozen_entries` 一个可以绕过的角色，
-- `gl_validator.py` 里就一句 `if getdate(posting_date) <= getdate(frozen_till)`。
--
-- ⚠️ **ERPNext 那个「角色绕过」我们抄不了，而且不是因为懒**：
--    这个 schema 里**写得了钱的只有老板一个人**，所以「一个可以绕过的角色」
--    就是「每一个写得了的人」—— 那道锁等於不存在。
--    → 走他那一条：**锁跟着对帐走，重开那个月就是绕过的方法。**
--    而重开本来就有（`set_reconciliation_settled(id, false)`，20260902020000），
--    所以这一支**没有加任何新的绕过路径**。
--
-- ── 五条规矩，一条一条都有代价在后面 ──────────────────────────────────────
--
-- ① 🔴 **只锁已经过完的月份。**
--    一个还在进行的月份不可能「已经对完帐」；而更要紧的是 ——
--    **外面进来的钱没有别的地方去**。客人从付款连结付进来那一笔
--    （`settle_payment_request`，20260905020000）日子不是任何人挑的，
--    挡下去就是**钱收到了而记不进去**，那比一个会动的总数糟得多。
--    这一条把那一整类消灭掉，而且**不用给闸道开一条例外**
--    ——一开例外就是同一件事两条路（重点 23）。
--
-- ② **只锁他签过的那一边。** 他签的是 Celcom 的「进来多少」，
--    那就锁「进」；签的是供应商的「出去多少」，锁「出」；`net` 两边都锁。
--    整个月一起锁，会挡掉那张对帐单从来没有覆盖过的事。
--
-- ③ **动不到那个总数的更新，照样过。** 补一张收据、改一句注解、
--    改「谁做的」、改类别 —— 那是他在一个关掉的月份里照样要做的事。
--    会动的只有三样：**金额 · 方向 · 日子**。
--
-- ④ **进不去就是进不去，不管那一笔长什么样。** 抄他的理由：
--    一笔停在关掉的月份里的记录，以后也永远补不完，
--    与其让它进来变成一个死结，不如当场讲清楚。
--
-- ⑤ **把一行搬出锁住的月份也要挡** —— 那一样会动那个月的总数，
--    所以**旧日子也要看**，不是只看新日子。
--
-- ⚠️ **删除那一支故意放宽一个地方**：整家公司被删掉的时候（cascade）不挡。
--    [任务 129] 就是这个 —— 六条 `on delete restrict` 让一个 auth 使用者
--    删不掉，而我在清理的时候连他的示范帐号一起炸了。
--    公司都不在了，没有人要读那本帐。

-- ── 那个月的哪一边被签过 ──────────────────────────────────────────────────
--
-- 🔴 **一个人都不 grant。** 触发器要用它，而触发器跑在**每一条写入路径**上
-- ——包括闸道那一条（service_role，`auth.uid()` 是 null）。
-- 一支带 `works_here` 的版本在那条路上会回 false，**於是闸道那条路没有锁**。
-- 跟 `add_ledger_entry_core` · `commission_scheme_at` 同一个做法。

create or replace function public.period_lock_hit(
  in_project_id uuid,
  in_on date,
  in_direction text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.reconciliations r
    where r.project_id = in_project_id
      and r.settled_at is not null
      and r.archived_at is null
      and r.period = date_trunc('month', in_on)::date
      /* ① 只锁已经过完的月份。 */
      and r.period < date_trunc('month', public.today_myt())::date
      /* ② 只锁他签过的那一边。 */
      and (r.direction = 'net' or r.direction = in_direction)
  );
$$;

revoke execute on function public.period_lock_hit(uuid, date, text)
  from public, anon, authenticated, service_role;

-- ── 画面上要问得到，才不会等他按下去才讲 ──────────────────────────────────

create or replace function public.is_period_locked(
  in_project_id uuid,
  in_on date,
  in_direction text default 'in'
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.works_here(in_project_id)
     and public.period_lock_hit(in_project_id, in_on, in_direction);
$$;

revoke execute on function public.is_period_locked(uuid, date, text) from public, anon;
grant execute on function public.is_period_locked(uuid, date, text) to authenticated;

comment on function public.is_period_locked(uuid, date, text) is
  'Whether that month, on that side, is already signed off -- so the screen can say so before he types rather than after he presses save. Only months that have ENDED can be locked. See 20260905740000.';

create index if not exists reconciliations_settled_period_idx
  on public.reconciliations (project_id, period, direction)
  where settled_at is not null and archived_at is null;

-- ── 挡在资料库那一层，不是只挡在那几支函式里 ──────────────────────────────
--
-- 抄他 0031 的最后一句：*enforced at the DB layer, not just in the Server
-- Actions*。一道只挡在函式里的锁，绕过那支函式就不存在了 ——
-- 而 `ledger_entries` 的 policy 是 `for all`，老板拿浏览器直接写得进去。

create or replace function public.enforce_period_lock()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  still_there boolean;
begin
  if tg_op = 'DELETE' then
    /* ⚠️ 公司都不在了就不要挡 —— 任务 129 那一次，六条守卫让一个 auth
       使用者删不掉，而清理的时候连示范帐号一起炸了。 */
    select exists (select 1 from public.projects p where p.id = old.project_id)
      into still_there;
    if not still_there then
      return old;
    end if;
    if public.period_lock_hit(old.project_id, old.entry_on, old.direction) then
      raise exception 'period_locked: % is already reconciled -- reopen that month, change it, then close it again',
        to_char(old.entry_on, 'YYYY-MM');
    end if;
    return old;
  end if;

  /* ③ 动不到那个总数的更新，直接放过 —— 这一段就是「关掉的月份里照样
     做得了事」的全部。 */
  if tg_op = 'UPDATE'
     and new.entry_on is not distinct from old.entry_on
     and new.amount_cents is not distinct from old.amount_cents
     and new.direction is not distinct from old.direction then
    return new;
  end if;

  /* ④ 新的那个位置。 */
  if public.period_lock_hit(new.project_id, new.entry_on, new.direction) then
    raise exception 'period_locked: % is already reconciled -- reopen that month, change it, then close it again',
      to_char(new.entry_on, 'YYYY-MM');
  end if;

  /* ⑤ 旧的那个位置 —— 搬出去一样会动那个月。 */
  if tg_op = 'UPDATE'
     and public.period_lock_hit(old.project_id, old.entry_on, old.direction) then
    raise exception 'period_locked: % is already reconciled -- reopen that month, change it, then close it again',
      to_char(old.entry_on, 'YYYY-MM');
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_period_lock_trg on public.ledger_entries;
create trigger enforce_period_lock_trg
  before insert or update or delete on public.ledger_entries
  for each row execute function public.enforce_period_lock();

comment on function public.enforce_period_lock() is
  'A month he has signed off stops moving. Only ended months, only the side the reconciliation covered, and only writes that can actually move that total -- attaching a receipt or fixing a note still works inside a closed month. No per-row override on purpose: reopen the month, correct it, close it again, which is one auditable act. Taken from his own vibe-dealer 0031. See 20260905740000.';
