-- 谁是我最值钱的客人 —— 跟货架、服务同一个骨架，第三个洞。
--
-- ── 为什么（[重点 35]，[任务 362] 收尾时点名的第三个洞）───────────────
--
-- `party_visits`（20260907010000）答得出「这个客人多久来一次」，
-- 而没有人把它排成一份「谁是我最值钱的客人」的榜——`RankList` 今天
-- 唯一排过的是「谁欠我最多钱」（`party_aging`），那是一份**要去追的**
-- 名单，不是一份**该好好留住**的名单，两件事答案通常不一样。
--
-- ── 只用已经在的资料，钱那条线走 ledger_entries 自己那一支 ──────────────
--
-- 「值钱」量的是**这个客人真的付过我多少钱**，不是他多常来（那是
-- `party_visits` 已经答的另一句）。所以这一支只读 `ledger_entries`，
-- 跟 `party_debts`（20260904060000）同一条纪律：**冲正过的不算**——
-- 一笔退款把它冲平的钱，不该继续算在客人的身价上。
--
-- 🔴 `sees_money`——这一支全部是钱的数字，跟 `party_aging` 同一档。
--
-- ⚠️ 「来往几次」量的是**收过几笔钱**，不是来店几次——一次套票可能
-- 一笔钱管几次来访，一次装修可能十次来访只收三笔钱。这一支不发明
-- 一套跨行业都对的「来访」定义，只答它真的答得了的那一句：
-- 这个客人的钱，一共付了多少、分几笔付的。

create or replace function public.party_value(in_project_id uuid)
returns table (
  party_id uuid,
  name text,
  times_paid bigint,
  total_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.sees_money(in_project_id) then
    return;
  end if;

  return query
  select
    d.id,
    d.name,
    count(e.id)::bigint,
    sum(e.amount_cents)::bigint
  from public.directory_entries d
  join public.ledger_entries e
    on e.party_id = d.id
   and e.direction = 'in'
   /* 🔴 冲正过的不算——跟 party_debts 同一条纪律。 */
   and e.adjusts_id is null
   and not exists (
     select 1 from public.ledger_entries r2 where r2.adjusts_id = e.id
   )
  where d.project_id = in_project_id
    and d.module_key = 'customers'
    and d.archived_at is null
  group by d.id
  order by sum(e.amount_cents) desc, d.name;
end;
$$;

revoke execute on function public.party_value(uuid) from public, anon;
grant execute on function public.party_value(uuid) to authenticated;

comment on function public.party_value(uuid) is
  'Who has actually paid the most, all time, reversed entries excluded -- the list worth keeping, next to party_aging which is the list worth chasing. sees_money-gated. See 20260910490000.';
