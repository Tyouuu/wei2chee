-- 🔴 故意弄坏，看它红（[重点 31] 第 3 条）。**单独推一次**。
--
-- 拿掉的是「只数做完的那几次」。
--
-- 坏起来的样子：一个客人**放了飞机**，而那一次底下记着的活
-- 照样算进师傅的抽成 —— 也就是**替一件没有发生过的事付钱**。
-- ⚠️ 而画面上完全正常：一个数字，一份名单，没有任何东西会红。
-- 20260910030000 把它原样搬回去。

create or replace function public.visit_earnings(
  in_project_id uuid,
  /* 「2026-09」。跟 `staff_earnings` 同一个写法，同一个马来西亚月份。 */
  in_month text
)
returns table (
  staff_id uuid,
  name text,
  visits integer,
  lines integer,
  did_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  first_day date;
begin
  /* 🔴 `sees_money` —— 跟 `staff_earnings` 同一条。这一支回的是钱。 */
  if not public.sees_money(in_project_id) then
    return;
  end if;
  first_day := to_date(in_month || '-01', 'YYYY-MM-DD');

  return query
  select
    d.id,
    d.name,
    count(distinct a.id)::integer,
    count(*)::integer,
    coalesce(sum(l.price_cents), 0)::bigint
  from public.appointment_lines l
  join public.appointments a on a.id = l.appointment_id
  join public.directory_entries d on d.id = l.staff_id
  where l.project_id = in_project_id
    and a.archived_at is null
    /* ⚠️ 只数**做完的**。一个还没来的客人身上的抽成不是抽成，是一个愿望。 */
    and a.status is not null
    and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date >= first_day
    and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date
        < (first_day + interval '1 month')::date
  group by d.id, d.name
  order by coalesce(sum(l.price_cents), 0) desc, d.name;
end;
$$;


revoke execute on function public.visit_earnings(uuid, text) from public, anon;
grant execute on function public.visit_earnings(uuid, text) to authenticated;
