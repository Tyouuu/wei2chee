-- 把 20260910020000 拿掉的那一句搬回去。
--
-- ⚠️ **原样从 20260910010000 抽出来**，不是照记忆重打（[重点 31] 第 1 条）。
--
-- 弄坏那一版红出来的（`check:visit-lines`）：
--   FAIL  🔴 师傅做了 RM 218（38 ＋ 180）
--   FAIL  🔴 而那一次没来的 RM 500 一分都没有算进去（抽成不是愿望）

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
    and a.status = 'done'
    and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date >= first_day
    and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date
        < (first_day + interval '1 month')::date
  group by d.id, d.name
  order by coalesce(sum(l.price_cents), 0) desc, d.name;
end;
$$;


revoke execute on function public.visit_earnings(uuid, text) from public, anon;
grant execute on function public.visit_earnings(uuid, text) to authenticated;
