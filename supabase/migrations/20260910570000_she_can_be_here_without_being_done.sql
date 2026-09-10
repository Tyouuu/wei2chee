-- 她到了，还没轮到她 —— 一个跟「做完了」不一样的时刻。
--
-- ── 为什么（[任务 341] 便宜又值钱那一组最后一件）───────────────────────
--
-- 今天只有四种状态：booked · done · no_show · cancelled。柜台手上
-- 没有一个字可以打「她人已经在店里，还没轮到她」——而这不是一个
-- 冷门情况，走单排队（[任务 353]）本身就是「她到了，等着」那一段时间。
--
-- 🔴 而这条空缺会反过来咬「她到了没有」这句话本身：柜台唯一能记下
-- 「她来了」的办法，是提前按「来了」（`done`）——**而那一按同时扣了
-- 套票、算进了当月做了多少活**（`set_appointment_status` 20260906460000
-- 那一支两件事一起做）。人还没剪完，套票已经扣了。
--
-- ── 加一栏，不碰 `status` ────────────────────────────────────────────────
--
-- `arrived_at`——跟 `status` 完全分开的另一个时刻，不是第五个状态。
-- 一笔预约可以同时是 `status = 'booked'` 而且 `arrived_at` 有值：
-- 她在店里，还没做完。等真的做完，柜台照旧按「来了」（`done`），
-- 套票在那一刻才扣，跟今天一模一样——**这一支不改任何一条已经在跑的
-- 规矩**，只是多给柜台一个字可以打，不用借用「做完了」去说「到了」。

alter table public.appointments
  add column if not exists arrived_at timestamptz;

comment on column public.appointments.arrived_at is
  'When she actually walked in -- separate from status, so the front desk is not forced to press "done" (which cashes out a package session) just to record that somebody is here waiting. Null means not yet arrived, or a walk-in with no booking at all. See 20260910570000.';

create or replace function public.mark_appointment_arrived(in_id uuid)
returns public.appointments
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.appointments;
begin
  select * into row from public.appointments
   where id = in_id and public.works_here(project_id);
  if row.id is null then
    raise exception 'not your appointment';
  end if;
  if row.status not in ('booked') then
    raise exception 'that booking is not waiting to happen';
  end if;

  update public.appointments
     set arrived_at = coalesce(arrived_at, now())
   where id = in_id
  returning * into row;

  return row;
end;
$$;

revoke execute on function public.mark_appointment_arrived(uuid) from public, anon;
grant execute on function public.mark_appointment_arrived(uuid) to authenticated;

comment on function public.mark_appointment_arrived(uuid) is
  'She is here now -- a fact, not a disposition. Idempotent: pressing it twice does not move the clock. Never touches status, never touches a package balance. See 20260910570000.';

-- ── 谁现在在等 ────────────────────────────────────────────────────────────

create or replace function public.who_is_waiting(in_project_id uuid)
returns table (
  id uuid,
  party text,
  service text,
  arrived_at timestamptz
)
language sql
stable
security definer
set search_path = public
as $$
  select a.id, a.party, a.service, a.arrived_at
    from public.appointments a
   where a.project_id = in_project_id
     and a.archived_at is null
     and a.status = 'booked'
     and a.arrived_at is not null
     and public.works_here(in_project_id)
   order by a.arrived_at;
$$;

revoke execute on function public.who_is_waiting(uuid) from public, anon;
grant execute on function public.who_is_waiting(uuid) to authenticated;

comment on function public.who_is_waiting(uuid) is
  'Who has arrived and is still waiting -- oldest first, the same order she is actually standing in. Empties itself the moment a booking moves to done, no_show, or cancelled, because arrived_at answers a question about right now. See 20260910570000.';
