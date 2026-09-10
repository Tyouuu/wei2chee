-- add_appointment 验房间、验班级，唯独不验人——[任务 339] 登记过的那一格。
--
-- ── 为什么（[任务 339] 收尾自己写的）───────────────────────────────────
--
-- 「`add_appointment` 要验 `in_staff_id` 是这一家的人（房间跟班级它验，
-- 人它没有）——那是收紧，要单独做、单独推、看它红过」。今天一间店排给
-- 「另一家的师傅」或者一个编出来的 uuid，`insert` 照样成功——那一笔预约
-- 会挂在一个不存在（或者不是这一家）的人身上，画面上完全正常，直到有人
-- 点进去想看这位师傅是谁。
--
-- ── 只加这一段验证，其余一个字不动（[重点 31] 第 1 条）───────────────────
--
-- 跟 `in_group_id` / `in_room_id` 已经在验的同一个形状：查得到、
-- 属於这一家，两个条件都要成立。跟 `add_visit_line` 验 `in_staff_id`
-- 同一条纪律（[任务 89]）：只收编号，不靠名字配人。
--
-- ── 🔴 这是收紧——查过唯一的呼叫端 ─────────────────────────────────────
--
-- `record-ops.ts` 是今天唯一呼叫这支的地方，它的 `staffId` 本来就是从
-- 这个专案自己的师傅名单里解出来的编号（[任务 339] 的设计），从来不会
-- 传一个不属於这家的 id——这段验证只挡得住真的错的呼叫，不影响任何
-- 一条今天在跑的路。

create or replace function public.add_appointment(
  in_project_id uuid,
  in_module_key text,
  in_starts_at timestamptz,
  in_ends_at timestamptz,
  in_party text default '',
  in_party_id uuid default null,
  in_staff_id uuid default null,
  in_service text default '',
  in_kind text default 'booking',
  in_source text default 'staff',
  in_note text default '',
  in_branch_id uuid default null,
  in_extra jsonb default '{}'::jsonb,
  in_idempotency_key uuid default null,
  in_group_id uuid default null,
  in_room_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  grp public.class_groups;
  rm public.rooms;
  hit text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;

  if not public.is_calendar_module(in_module_key) then
    raise exception 'not a calendar module: %', in_module_key;
  end if;

  if in_starts_at is null or in_ends_at is null then
    raise exception 'an appointment needs a time';
  end if;

  if in_ends_at <= in_starts_at then
    raise exception 'it has to end after it starts';
  end if;

  if in_group_id is not null then
    select * into grp from public.class_groups where id = in_group_id;
    if not found or grp.project_id <> in_project_id then
      raise exception 'no such class';
    end if;
    if grp.archived_at is not null then
      raise exception 'that class is closed';
    end if;
  end if;

  if in_room_id is not null then
    select * into rm from public.rooms where id = in_room_id;
    if not found or rm.project_id <> in_project_id then
      raise exception 'no such room';
    end if;
    if not rm.active then
      raise exception 'that room is closed';
    end if;
  end if;

  /* 🔴 新的一段——那一位要真的是这家的人。跟房间、班级同一个形状：
     查得到、属於这一家。靠名字配人正是 [任务 89] 量过会把钱记到
     另一个人头上的那件事，所以这里只收编号，而且要验。 */
  if in_staff_id is not null then
    if not exists (
      select 1 from public.directory_entries
       where id = in_staff_id and project_id = in_project_id
    ) then
      raise exception 'that person does not work here';
    end if;
  end if;

  if coalesce(in_kind, 'booking') = 'booking'
     and in_group_id is null
     and btrim(coalesce(in_party, '')) = ''
     and in_party_id is null then
    raise exception 'a booking needs to say who it is for';
  end if;

  insert into public.appointments (
    project_id, module_key, branch_id, kind, starts_at, ends_at,
    party, party_id, staff_id, service, source, note, extra,
    recorded_by, idempotency_key, group_id, room_id
  ) values (
    in_project_id, in_module_key, in_branch_id,
    coalesce(nullif(btrim(coalesce(in_kind, '')), ''), 'booking'),
    in_starts_at, in_ends_at,
    left(btrim(coalesce(in_party, '')), 120), in_party_id,
    coalesce(in_staff_id, grp.staff_id), left(btrim(coalesce(in_service, '')), 120),
    coalesce(nullif(btrim(coalesce(in_source, '')), ''), 'staff'),
    btrim(coalesce(in_note, '')),
    coalesce(in_extra, '{}'::jsonb),
    auth.uid(), in_idempotency_key, in_group_id, in_room_id
  )
  returning id into new_id;

  return new_id;

exception
  when unique_violation then
    select id into new_id
    from public.appointments
    where project_id = in_project_id
      and in_idempotency_key is not null
      and idempotency_key = in_idempotency_key
    limit 1;
    return new_id;

  when exclusion_violation then
    get stacked diagnostics hit = constraint_name;
    if hit = 'appointments_no_double_room' then
      raise exception 'that room is already taken then'
        using errcode = 'check_violation';
    end if;
    raise exception 'that time is already taken'
      using errcode = 'check_violation';
end;
$$;

revoke execute on function public.add_appointment(
  uuid, text, timestamptz, timestamptz, text, uuid, uuid, text, text, text, text, uuid, jsonb, uuid, uuid, uuid
) from public, anon;
grant execute on function public.add_appointment(
  uuid, text, timestamptz, timestamptz, text, uuid, uuid, text, text, text, text, uuid, jsonb, uuid, uuid, uuid
) to authenticated;

comment on function public.add_appointment(
  uuid, text, timestamptz, timestamptz, text, uuid, uuid, text, text, text, text, uuid, jsonb, uuid, uuid, uuid
) is
  'Opens a slot on the calendar. Validates group_id, room_id, and now staff_id all belong to this project -- a bad or foreign id is refused rather than silently attached. See 20260909020000, staff_id validation added 20260911440000.';
