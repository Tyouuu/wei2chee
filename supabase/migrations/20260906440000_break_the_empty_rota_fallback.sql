-- 🔴 故意弄坏：拿掉「一行班都没排 → 每一个人都算有空」那一句。
-- **单独推一次**（重点 31 第三条）。
--
-- 它坏掉的时候长什么样子：一间刚开始用、还没有填过班表的沙龙，
-- 问「谁有空」回答是**一个人都没有** ——
-- 而那正好是 20260902030000 拒绝那套上班时间引擎的理由。

create or replace function public.who_is_free(
  in_project_id uuid,
  in_starts_at timestamptz,
  in_ends_at timestamptz
)
returns table (
  staff_id uuid,
  name text,
  on_duty boolean,
  busy boolean,
  busy_with text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  wd smallint;
  local_start time;
  local_end time;
  anyone_rostered boolean;
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  if in_starts_at is null or in_ends_at is null or in_ends_at <= in_starts_at then
    raise exception 'say a time that ends after it starts';
  end if;

  /* 墙上时钟。一个跨过午夜的时段答不了（星期几会变），
     而一间沙龙没有跨午夜的班 —— 真的有的时候这里要重想。 */
  wd := extract(dow from (in_starts_at at time zone 'Asia/Kuala_Lumpur'))::smallint;
  local_start := (in_starts_at at time zone 'Asia/Kuala_Lumpur')::time;
  local_end := (in_ends_at at time zone 'Asia/Kuala_Lumpur')::time;

  /* 🔴 一行班都没排 → **每一个人都算有空**，也就是今天的行为。
     那正是「不填也用得了」那一句写在代码里的样子。 */
  select exists (select 1 from public.staff_hours where project_id = in_project_id)
    into anyone_rostered;

  return query
  select d.id,
         coalesce(d.name, ''),
         exists (
             select 1 from public.staff_hours h
             where h.staff_id = d.id
               and h.weekday = wd
               and h.starts_at <= local_start
               and h.ends_at >= local_end
           ),
         exists (
           select 1 from public.appointments a
           where a.project_id = in_project_id
             and a.staff_id = d.id
             and a.archived_at is null
             and a.status <> 'cancelled'
             and tstzrange(a.starts_at, a.ends_at)
                 && tstzrange(in_starts_at, in_ends_at)
         ),
         coalesce((
           select case when a.kind = 'block' then coalesce(nullif(a.note, ''), '挡起来了')
                       else coalesce(nullif(a.party, ''), coalesce(nullif(a.service, ''), '有人')) end
           from public.appointments a
           where a.project_id = in_project_id
             and a.staff_id = d.id
             and a.archived_at is null
             and a.status <> 'cancelled'
             and tstzrange(a.starts_at, a.ends_at)
                 && tstzrange(in_starts_at, in_ends_at)
           order by a.starts_at
           limit 1
         ), '')
  from public.directory_entries d
  where d.project_id = in_project_id
    and d.module_key = 'staff'
    and d.archived_at is null
  order by d.name;
end;
$$;
