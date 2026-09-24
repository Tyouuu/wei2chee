-- 员工可以记「客人付给我们的钱」—— 任务 411，他拍板：`肯定要放宽给员工`。
--
-- ── 为什么 ────────────────────────────────────────────────────────────
--
-- `add_ledger_entry` 只认 `projects.account_id = auth.uid()`：只有帐号老板本人
-- 的登入记得了一笔钱。而收银台是**柜台**按的 —— 一间沙龙的美发师收完钱、按
-- 「结帐」，拿到的是一句资料库的 `not your project`。2026-09-24 用真的员工
-- 登入打出来的（scripts/shoot-register-cart-real.mjs 最后一段），不是读代码猜的。
--
-- ── 改了什么：一处 ────────────────────────────────────────────────────
--
-- 这支外壳里**唯一**的闸门，从「是不是老板本人」换成 `works_here`（老板或
-- 在职员工，跟 use_credit · set_appointment_deposit · credit_of 同一条）。
-- 原样取自 pg_proc 里活的那一版（20260924010000 那支探针读的），不是照迁移
-- 历史手抄 —— 同一个名字在 20260904200000 跟 20260905720000 签名不一样，
-- 之后 20260911880000 起又被拆过一次，[重点 31]：不整支重写，在活的那一支上改。
-- `add_ledger_entry_core` 一个字没动 —— 它本来就没有闸门，别的函式（收会员月费 ·
-- 收货付款 …）带着自己的闸门直接呼叫它。
--
-- ── 🔴 放宽的只有「客人付给我们的钱」 ──────────────────────────────────
--
--   · 员工 = 收下一笔已经答应过的钱（跟 use_credit 同一个形状）
--   · 付出去的钱（开销 · 付供应商 · 佣金）仍然只有老板 —— 那是决定，不是收下
--
-- 方向是**核心那支自己算出来的**（外壳收到的 `in_direction` 可以是 null，核心
-- 照模组补），所以这里不另外抄一份规矩，而是**等核心回来看它写了什么**，
-- 不合规就 raise —— 同一个交易里，那一笔跟着回滚，什么都不留。
-- 在外壳里抄一份「怎么算方向」是两份会漂的东西：漂到一边是员工被误挡（安全），
-- 漂到另一边是员工写得进付出去的钱（不安全）。等核心回来看，不会漂。
--
-- ⚠️ 冲正（撤销一笔钱）照旧只有老板：`reverse_ledger_entry` 挡 `sees_money`，
-- 一个员工按错了要请老板撤。那是另一个决定，这一支没有碰。
--
-- 🔴 这是一次放宽（[重点 31]：加 > 放宽 > 收紧）。守卫：
-- `npm run check:ledger-staff`，而且它**看过红**两头：改之前对着旧闸门跑，
-- 「员工记得下客人付的钱」那四条红；20260924040000 故意放宽放过头，
-- 陌生人 · 离职员工 · 付出去的钱那十三条红。20260924050000 放回来，全绿。

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
  in_done_by uuid default null,
  in_category text default '',
  in_job_id uuid default null
)
returns public.ledger_entries
language plpgsql
security definer
set search_path = public
as $$
declare
  made public.ledger_entries;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;

  made := public.add_ledger_entry_core(
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

  if not public.sees_money(in_project_id)
     and not (made.direction = 'in' and made.module_key = 'payments') then
    raise exception 'staff can record what a customer paid; anything else is for the owner';
  end if;

  return made;
end;
$$;
