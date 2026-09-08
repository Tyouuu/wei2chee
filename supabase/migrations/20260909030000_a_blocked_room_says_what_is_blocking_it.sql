-- 挡起来的那一间房，讲得出是什么挡着它。
--
-- `check:rooms` 第一次跑就红了一条：一间因为「消毒」挡起来的房，
-- `rooms_free` 回的 `busy_with` 是 **「面部护理」** —— 一个 block 身上
-- 留着的服务名字。
--
-- 🔴 而那不是道具的问题：`add_appointment` 对一个 `kind = 'block'` 的列
-- **不会清掉 `service`**，所以任何一个从「排一笔」那条路挡起来的时段，
-- 都可能带着一个不属於它的服务名。前台看到「1 号房 14:00 面部护理」
-- 会去找那一个客人，而那个客人不存在 —— 那一格是消毒。
--
-- 一个 block 的「是什么占着」就是**它自己那句备注**（午餐 · 消毒 · 请假），
-- 一笔预约的才是那个客人。两种东西，两条取法。
--
-- ⚠️ 从 20260909020000 —— 最后一次定义它的那个档案 —— 原样抽出来改那一段。
--
-- ⚠️ 而 `who_is_free`（对**人**答同一句）在挡起来而且没有备注的时候
-- 回一个**写死的中文**「挡起来了」（[任务 245](../../docs/founder-tasks.md) 登记过）
-- —— 这一支不跟：读不出来就回空字串，让画面自己决定那时候讲什么。
-- 一个写死的中文回进一个英文系统，是同一个仓库记过的那件事。

create or replace function public.rooms_free(
  in_project_id uuid,
  in_starts_at timestamptz,
  in_ends_at timestamptz
)
returns table (
  room_id uuid,
  name text,
  busy boolean,
  busy_with text
)
language sql
stable
security definer
set search_path = public
as $$
  select r.id,
         coalesce(r.name, ''),
         exists (
           select 1 from public.appointments a
           where a.room_id = r.id
             and a.archived_at is null
             and a.status <> 'cancelled'
             and tstzrange(a.starts_at, a.ends_at)
                 && tstzrange(in_starts_at, in_ends_at)
         ),
         coalesce((
           select nullif(btrim(
             case when a.kind = 'block'
               /* 挡起来的：它自己那句备注（消毒 · 午餐 · 请假）。 */
               then coalesce(nullif(btrim(a.note), ''), nullif(btrim(a.service), ''))
               /* 一笔预约的：那个客人。 */
               else coalesce(nullif(btrim(a.party), ''), nullif(btrim(a.service), ''))
             end
           ), '')
           from public.appointments a
           where a.room_id = r.id
             and a.archived_at is null
             and a.status <> 'cancelled'
             and tstzrange(a.starts_at, a.ends_at)
                 && tstzrange(in_starts_at, in_ends_at)
           order by a.starts_at
           limit 1
         ), '')
  from public.rooms r
  where r.project_id = in_project_id
    and r.active
    and public.works_here(in_project_id)
    and in_starts_at is not null
    and in_ends_at is not null
    and in_ends_at > in_starts_at
  order by r.sort_order, r.name;
$$;
