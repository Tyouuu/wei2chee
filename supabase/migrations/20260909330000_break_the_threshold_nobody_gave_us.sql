-- 🔴 故意弄坏，看它红（[重点 31] 第 3 条）。**单独推一次**。
--
-- 弄坏的方式是**替他挑一个数字**：他还没讲放几次算多，而系统自己用 3。
--
-- 坏起来的样子：一间**从来没有跟我们讲过它的规矩**的店，打开系统就看到
-- 「这个客人要先收订金」—— 而那条规矩是我发明的。对一间高档沙龙它太宽，
-- 对一间街边店它太苛，**而两边都会觉得这套系统不懂他的生意**。
-- ⚠️ 最坏的是它**看起来完全正常**：一个数字、一句建议、一张会红不了的报告。
-- 20260909340000 把它原样搬回去。

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
    (coalesce(n_missed, 0) >= coalesce(rules.no_show_deposit_after, 3)),
    case when money then rules.default_deposit_cents end,
    case when money then public.party_deposit(in_project_id, in_party_id) end;
end;
$$;

revoke execute on function public.deposit_advice(uuid, uuid) from public, anon;
grant execute on function public.deposit_advice(uuid, uuid) to authenticated;

comment on function public.deposit_advice(uuid, uuid) is
  'Answers the one sentence a counter says out loud: is this customer reliable, and should we ask for a deposit. Advises nothing until the shop has given its own threshold. Money columns are NULL, never 0, for someone who cannot see money. See 20260909320000.';
