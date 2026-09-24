-- 收工记录——沙龙 End of Day Cash 那一页的「Lock Drawer」终于真的存下来
-- （[任务 415] 第 2 项，他 2026-09-24 拍板 `1 2 4 都要去做吧`）。
--
-- 之前那一页的点钞、备用金、收工清单、交班备注、锁定，全部只活在那一台电脑的
-- 记忆里，重新整理就没了——一个「明早的领班要读到昨晚的交班备注」的功能，
-- 却连隔夜都活不过。
--
-- ── 读了别人真的表，不是读首页（[重点 27] 第 1 步）─────────────────────
--   ERPNext `POS Closing Entry`：period_start/end · user · 一张子表
--     （每种付款方式：opening / expected / closing / difference）· status
--     （Draft / Submitted / Cancelled）—— 交了就冻结，要改是取消再重开
--   Odoo `pos.session`：start_at / stop_at · closing_notes · closing_balance ·
--     closing_difference · state（opening → opened → closing → closed）
--   Square `CashDrawerShift`：opened / ended / closed 三个时刻 ·
--     expected_cash_money（系统算的）· closed_cash_money（点出来的）
--   三家一模一样的骨架：**冻结那一刻「系统说该有多少」跟「人点出来多少」两个数字，
--   差额从这两个数字算出来，不另外存；一旦收了，改动要留痕不能覆盖。**
--
-- ── 抄什么、不抄什么 ─────────────────────────────────────────────────
--   抄：expected vs counted 各自存，差额是算出来的（generated column，不会飘）·
--       收了就冻结 · 改要留痕（不是覆盖，跟 ledger 的冲正同一条纪律）·
--       谁收的、几时收的
--   不抄：ERPNext 的 pos_opening_entry（开班那一头——沙龙不开班点钞，
--       只有收工点钞）· 每种付款方式各自点钞（一间沙龙的抽屉里只有现金）·
--       税金子表 · 草稿状态（[重点 34]：手写簿上没有「草稿」，点完签名就是收了）
--
-- ── 存的是「他当时看到的画面」 ────────────────────────────────────────
--   expected / gross / outflows / settlements 是收工那一刻页面上的数字，
--   **不是**在这里重新从帐算一遍：页面上「Expected Cash」是把付款方式里带
--   「cash」字样的加起来（方式是自由文字），那是一个尽力而为的读法。
--   在这里再抄一份同样的规则，两边会各自飘。冻结的意义正是「他拿哪个数字去对的」。
--   点钞的合计（counted）则**一定**在这里从面额算——数字跟面额永远对得上。
--
-- ── 🔴 这一张表只有老板碰 ─────────────────────────────────────────────
--   收工那一页本来就是 `sees_money`（员工整页看不到）。读跟写都是。

create table if not exists public.day_closings (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  closing_date date not null,

  -- { "100": 1, "20": 3 } —— 只存点过的面额（大于 0 的）
  counts jsonb not null default '{}'::jsonb,
  counted_cents bigint not null default 0,
  float_cents bigint not null default 0,

  -- 收的那一刻页面上的数字（见上面「存的是他当时看到的画面」）
  expected_cash_cents bigint not null default 0,
  gross_cents bigint not null default 0,
  outflows_cents bigint not null default 0,
  settlements jsonb not null default '[]'::jsonb,
  checklist jsonb not null default '[]'::jsonb,
  note text not null default '',

  -- 从上面两个数字算出来的，不另外存一份会飘的
  variance_cents bigint generated always as (counted_cents - expected_cash_cents) stored,
  net_deposit_cents bigint generated always as (greatest(0, counted_cents - float_cents)) stored,

  locked_at timestamptz not null default now(),
  locked_by uuid,
  locked_by_name text not null default '',

  -- 收错了要「重开」——不是删掉，是留着并标记（跟 ledger 的冲正同一条纪律）
  voided_at timestamptz,
  voided_by uuid,
  void_reason text not null default '',

  idempotency_key uuid,

  constraint day_closings_counts_is_object check (jsonb_typeof(counts) = 'object'),
  constraint day_closings_settlements_is_array check (jsonb_typeof(settlements) = 'array'),
  constraint day_closings_checklist_is_array check (jsonb_typeof(checklist) = 'array'),
  constraint day_closings_non_negative check (
    counted_cents >= 0 and float_cents >= 0 and expected_cash_cents >= 0
    and gross_cents >= 0 and outflows_cents >= 0
  )
);

comment on table public.day_closings is
  'One row per time a day was closed. At most one LIVE (not voided) row per project per day; a wrong count is reopened (voided_at set, the row kept), never deleted or overwritten. expected/gross are the figures on screen at lock time, counted is derived from the denominations in the RPC. See 20260925010000.';

-- 一家一天只有一份「现行」的收工——两个分页同时按也只有一个进得去。
create unique index if not exists day_closings_one_live_per_day
  on public.day_closings (project_id, closing_date)
  where voided_at is null;

create unique index if not exists day_closings_idem_idx
  on public.day_closings (project_id, idempotency_key)
  where idempotency_key is not null;

create index if not exists day_closings_recent_idx
  on public.day_closings (project_id, closing_date desc, locked_at desc);

alter table public.day_closings enable row level security;

create policy "day closings are read by money-seers" on public.day_closings
  for select using (public.sees_money(project_id));

-- 🔴 没有 insert/update/delete 的 policy——只有底下这两支写得进去。

create or replace function public.lock_day_closing(
  in_project_id uuid,
  in_closing_date date,
  in_counts jsonb,
  in_float_cents bigint,
  in_expected_cash_cents bigint,
  in_gross_cents bigint,
  in_outflows_cents bigint,
  in_settlements jsonb,
  in_checklist jsonb,
  in_note text,
  in_idempotency_key uuid default null
)
returns public.day_closings
language plpgsql
security definer
set search_path = public
as $$
declare
  norm jsonb := '{}'::jsonb;
  counted bigint := 0;
  k text;
  v text;
  existing public.day_closings;
  row public.day_closings;
  who text;
  sett jsonb := coalesce(in_settlements, '[]'::jsonb);
  chk jsonb := coalesce(in_checklist, '[]'::jsonb);
  cnt jsonb := coalesce(in_counts, '{}'::jsonb);
begin
  if not public.sees_money(in_project_id) then
    raise exception 'closing the day is for the owner';
  end if;
  if in_closing_date is null or in_closing_date > public.today_myt() then
    raise exception 'you can only close today or an earlier day';
  end if;

  -- 按了两下：同一把钥匙回原来那一份，不多开一份
  if in_idempotency_key is not null then
    select * into existing from public.day_closings
     where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return existing;
    end if;
  end if;

  if jsonb_typeof(cnt) <> 'object' then
    raise exception 'the count must be a list of notes and how many of each';
  end if;
  for k, v in select key, value from jsonb_each_text(cnt) loop
    if k not in ('100', '50', '20', '10', '5', '1') then
      raise exception 'RM % is not a note this count knows about', k;
    end if;
    if v !~ '^[0-9]{1,6}$' then
      raise exception 'a count must be a whole number of notes';
    end if;
    if v::bigint > 0 then
      norm := norm || jsonb_build_object(k, v::bigint);
      counted := counted + k::bigint * v::bigint * 100;
    end if;
  end loop;

  if in_float_cents is null or in_float_cents < 0 then
    raise exception 'the float cannot be negative';
  end if;
  if coalesce(in_expected_cash_cents, -1) < 0
     or coalesce(in_gross_cents, -1) < 0
     or coalesce(in_outflows_cents, -1) < 0 then
    raise exception 'a total cannot be negative';
  end if;
  if jsonb_typeof(sett) <> 'array' or jsonb_array_length(sett) > 50 then
    raise exception 'the settlements must be a short list';
  end if;
  if jsonb_typeof(chk) <> 'array' or jsonb_array_length(chk) > 20 then
    raise exception 'the checklist must be a short list';
  end if;

  select * into existing from public.day_closings
   where project_id = in_project_id and closing_date = in_closing_date and voided_at is null;
  if found then
    raise exception 'that day is already closed -- reopen it first if the count was wrong';
  end if;

  -- 名字从登入的身分里取，不是页面传来的（页面传来的可以写成任何人）
  who := split_part(coalesce(auth.jwt() ->> 'email', ''), '@', 1);

  insert into public.day_closings (
    project_id, closing_date, counts, counted_cents, float_cents,
    expected_cash_cents, gross_cents, outflows_cents, settlements, checklist,
    note, locked_by, locked_by_name, idempotency_key
  ) values (
    in_project_id, in_closing_date, norm, counted, in_float_cents,
    in_expected_cash_cents, in_gross_cents, in_outflows_cents, sett, chk,
    left(btrim(coalesce(in_note, '')), 2000), auth.uid(), who, in_idempotency_key
  )
  returning * into row;

  return row;

exception
  when unique_violation then
    -- 两个分页同时按：输的那一个拿到赢的那一份，或者一句人话
    if in_idempotency_key is not null then
      select * into row from public.day_closings
       where project_id = in_project_id and idempotency_key = in_idempotency_key;
      if found then
        return row;
      end if;
    end if;
    raise exception 'that day is already closed -- reopen it first if the count was wrong';
end;
$$;

revoke execute on function public.lock_day_closing(uuid, date, jsonb, bigint, bigint, bigint, bigint, jsonb, jsonb, text, uuid) from public;
grant execute on function public.lock_day_closing(uuid, date, jsonb, bigint, bigint, bigint, bigint, jsonb, jsonb, text, uuid) to authenticated;

create or replace function public.reopen_day_closing(
  in_id uuid,
  in_reason text default ''
)
returns public.day_closings
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.day_closings;
begin
  select * into row from public.day_closings
   where id = in_id and public.sees_money(project_id);
  if not found then
    raise exception 'no such closing in your business';
  end if;

  -- 已经重开过的：原样回，不再标一次（按两下不改掉第一次的时间跟原因）
  if row.voided_at is not null then
    return row;
  end if;

  update public.day_closings
     set voided_at = now(),
         voided_by = auth.uid(),
         void_reason = left(btrim(coalesce(in_reason, '')), 500)
   where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.reopen_day_closing(uuid, text) from public;
grant execute on function public.reopen_day_closing(uuid, text) to authenticated;
