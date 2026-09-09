-- 把 20260909330000 发明的那个数字拿掉。
--
-- ⚠️ **原样从 20260909320000 抽出来**，不是照记忆重打（[重点 31] 第 1 条）。
--
-- 弄坏那一版红出来的（`check:deposits`）：
--   FAIL  🔴 而他还没讲那个次数 → **一句话都不讲**

create or replace function public.deposit_advice(
  in_project_id uuid,
  in_party_id uuid
)
returns table (
  missed integer,
  came integer,
  last_missed_on date,
  /* 他自己设的那个次数。null = 他还没讲，而那时候 `advise` 一定是 false。 */
  rule_after integer,
  advise boolean,
  /* 🔴 这两栏对看不到钱的人是 **null，不是 0** —— 见档头。 */
  suggest_cents bigint,
  on_hand_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  rules public.booking_rules;
  n_missed integer := 0;
  n_came integer := 0;
  last_on date;
  money boolean;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;
  money := public.sees_money(in_project_id);

  select * into rules from public.booking_rules where project_id = in_project_id;

  select
    count(*) filter (where a.status = 'no_show')::integer,
    count(*) filter (where a.status = 'done')::integer,
    max(a.starts_at at time zone 'Asia/Kuala_Lumpur')
      filter (where a.status = 'no_show')::date
  into n_missed, n_came, last_on
  from public.appointments a
  where a.project_id = in_project_id
    and a.party_id = in_party_id
    and a.kind = 'booking'
    and a.archived_at is null;

  return query select
    coalesce(n_missed, 0),
    coalesce(n_came, 0),
    last_on,
    rules.no_show_deposit_after,
    /* 🔴 他没讲那个次数 → **不讲话**。见档头：不知道的东西不要编。 */
    (rules.no_show_deposit_after is not null
      and coalesce(n_missed, 0) >= rules.no_show_deposit_after),
    case when money then rules.default_deposit_cents end,
    case when money then public.party_deposit(in_project_id, in_party_id) end;
end;
$$;

revoke execute on function public.deposit_advice(uuid, uuid) from public, anon;
grant execute on function public.deposit_advice(uuid, uuid) to authenticated;

comment on function public.deposit_advice(uuid, uuid) is
  'Answers the one sentence a counter says out loud: is this customer reliable, and should we ask for a deposit. Advises nothing until the shop has given its own threshold. Money columns are NULL, never 0, for someone who cannot see money. See 20260909320000.';
