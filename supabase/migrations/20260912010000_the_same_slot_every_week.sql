-- 固定周期预约——沙龙其余那一组，[任务 396] 重新判过的第二件。
--
-- 手写簿的做法是「柜台一次写好接下来四个礼拜二」，不是一套排程引擎，
-- 不用先决定「重复几次算一批」这种更复杂的设计。这一支照
-- [任务 391] complete_visit 证明过的做法：**新写一支去串旧的，
-- 一行都不碰 add_appointment**——原样呼叫它 N 次，时间各自加一个礼拜。
--
-- 撞到别人的时段（`add_appointment` 自己那条排他约束）就跳过那一次、
-- 讲得出是哪一週撞到了，其余照排——跟这个仓库一贯的「warn not block」
-- 同一条纪律（[重点 31]），不整批失败。
--
-- 🔴 幂等：整批给一个 `in_idempotency_key`，每一週各自从它派生一把
-- 自己的钥匙（`md5(base || ':' || 週次)`）传给 `add_appointment` 自己的
-- 幂等——按第二次整批重推，已经排成的那几週原样吐回同一笔，不会
-- 变成两份，跟撞到时段的那几週各自独立处理无关。
create or replace function public.add_recurring_appointments(
  in_project_id uuid,
  in_module_key text,
  in_starts_at timestamptz,
  in_ends_at timestamptz,
  in_weeks integer,
  in_party text default '',
  in_party_id uuid default null,
  in_staff_id uuid default null,
  in_service text default '',
  in_room_id uuid default null,
  in_note text default '',
  in_idempotency_key uuid default null
)
returns table (week_number integer, appointment_id uuid, skipped boolean, reason text)
language plpgsql
security definer
set search_path = public
as $$
declare
  i integer;
  the_start timestamptz;
  the_end timestamptz;
  the_duration interval;
  new_id uuid;
  week_key uuid;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your project';
  end if;
  if in_starts_at is null or in_ends_at is null then
    raise exception 'an appointment needs a time';
  end if;
  if in_ends_at <= in_starts_at then
    raise exception 'it has to end after it starts';
  end if;
  if coalesce(in_weeks, 0) < 1 or in_weeks > 52 then
    raise exception 'say how many weeks, from 1 to 52';
  end if;
  the_duration := in_ends_at - in_starts_at;

  for i in 0..(in_weeks - 1) loop
    the_start := in_starts_at + (i || ' weeks')::interval;
    the_end := the_start + the_duration;
    week_key := case when in_idempotency_key is not null
      then md5(in_idempotency_key::text || ':' || i::text)::uuid
      else null
    end;

    begin
      new_id := public.add_appointment(
        in_project_id := in_project_id,
        in_module_key := in_module_key,
        in_starts_at := the_start,
        in_ends_at := the_end,
        in_party := in_party,
        in_party_id := in_party_id,
        in_staff_id := in_staff_id,
        in_service := in_service,
        in_source := 'staff',
        in_note := in_note,
        in_room_id := in_room_id,
        in_idempotency_key := week_key
      );
      week_number := i + 1;
      appointment_id := new_id;
      skipped := false;
      reason := null;
      return next;
    exception
      when others then
        /* 🔴 只吞 add_appointment 自己讲的那两句「撞到了」——
           不是这一句就原样往上抛，不要把一个真的错误当成「跳过」。 */
        if sqlstate = '23514' and (
             sqlerrm = 'that time is already taken'
             or sqlerrm = 'that room is already taken then'
           ) then
          week_number := i + 1;
          appointment_id := null;
          skipped := true;
          reason := sqlerrm;
          return next;
        else
          raise;
        end if;
    end;
  end loop;
  return;
end;
$$;

revoke execute on function public.add_recurring_appointments(
  uuid, text, timestamptz, timestamptz, integer, text, uuid, uuid, text, uuid, text, uuid
) from public;
grant execute on function public.add_recurring_appointments(
  uuid, text, timestamptz, timestamptz, integer, text, uuid, uuid, text, uuid, text, uuid
) to authenticated;

comment on function public.add_recurring_appointments(
  uuid, text, timestamptz, timestamptz, integer, text, uuid, uuid, text, uuid, text, uuid
) is
  'Books the same slot every week for N weeks by calling add_appointment N times, unchanged. A week that collides with an existing booking is skipped and reported, not a batch failure -- warn, not block. Each week derives its own idempotency key from the caller''s base key, so retrying the whole batch does not duplicate weeks that already succeeded. See 20260912010000.';
