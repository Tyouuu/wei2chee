-- update_appointment 也要验 staff_id——add_appointment 补的那一格，
-- 姐妹函式一个字都没接到。
--
-- ── 为什么（[任务 382] 补完之后顺手验一次姐妹函式才发现的）───────────────
--
-- `add_appointment` 昨晚补了「那一位要真的是这家的人」；`update_appointment`
-- 是改期／换人那一支，从 2026-09-02 建表那天起从来没有重新定义过，
-- 一个字都没验过 `in_staff_id`。真登入打过一次：**用真的、属於另一家
-- 生意的师傅编号去重新指派一笔预约，直接成功**——那笔预约现在挂在
-- 别人家的员工身上，画面上完全正常。
--
-- ── 只加这一段验证，其余一个字不动（[重点 31] 第 1 条）───────────────────
--
-- 跟 `add_appointment` 昨晚补的同一个形状：查得到、属於这一家。
-- 传 `null`（清掉这一格）或者不传，一律放行——那是「不指定谁做」，
-- 不是一个要验证的编号。

create or replace function public.update_appointment(
  in_id uuid,
  in_starts_at timestamptz,
  in_ends_at timestamptz,
  in_party text default '',
  in_party_id uuid default null,
  in_staff_id uuid default null,
  in_service text default '',
  in_note text default '',
  in_extra jsonb default '{}'::jsonb,
  in_clear_party boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  proj uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select project_id into proj from public.appointments where id = in_id;
  if proj is null or not public.works_here(proj) then
    raise exception 'not your appointment';
  end if;

  if in_ends_at <= in_starts_at then
    raise exception 'it has to end after it starts';
  end if;

  /* 🔴 新的一段——跟 add_appointment（20260911440000）同一个形状：
     那一位要真的是这家的人，不靠名字配人（[任务 89]）。 */
  if in_staff_id is not null then
    if not exists (
      select 1 from public.directory_entries
       where id = in_staff_id and project_id = proj
    ) then
      raise exception 'that person does not work here';
    end if;
  end if;

  update public.appointments
  set starts_at = in_starts_at,
      ends_at = in_ends_at,
      party = left(btrim(coalesce(in_party, '')), 120),
      party_id = case when in_clear_party then null else in_party_id end,
      staff_id = in_staff_id,
      service = left(btrim(coalesce(in_service, '')), 120),
      note = btrim(coalesce(in_note, '')),
      extra = coalesce(in_extra, '{}'::jsonb),
      updated_at = now()
  where id = in_id;

exception
  when exclusion_violation then
    raise exception 'that time is already taken'
      using errcode = 'check_violation';
end;
$$;

comment on function public.update_appointment(
  uuid, timestamptz, timestamptz, text, uuid, uuid, text, text, jsonb, boolean
) is
  'Reschedules or reassigns a booking. Validates staff_id belongs to this project, same as add_appointment. See 20260902030000, staff_id validation added 20260911470000.';
