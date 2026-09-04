-- 🔴 故意把守卫从 `sees_money` 换成 `works_here`，**看它红**。
--
-- [重点 24]：一条没有人看过它红的守卫，等於没有守卫。
-- 而 20260904140000 学过一次更贵的：那一次守卫本身是绿的，
-- 因为测试专案里根本没有人欠钱 —— **量的是空气**。
-- 所以 check:referrals ⑧ 那一段带着一个控制组（老板自己看得到）。
--
-- 下一支（20260905280000）改回去。两支都留在历史里。
create or replace function public.referrals_owing(in_project_id uuid)
returns table (
  referrer_id uuid, name text, whatsapp text, jobs integer,
  received_cents bigint, promised_cents bigint,
  paid_cents bigint, owing_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  /* 🔴 这一行就是那个洞。 */
  if not public.works_here(in_project_id) then
    return;
  end if;

  return query
  with jobs as (
    select r.id, r.referrer_id, r.referral_portion, r.referral_amount_cents,
           coalesce((
             select sum(a.amount_cents)
             from public.ledger_allocations a
             join public.ledger_entries e on e.id = a.entry_id
             where a.record_id = r.id and e.direction = 'in'
               and e.adjusts_id is null
               and not exists (select 1 from public.ledger_entries x where x.adjusts_id = e.id)
           ), 0)::bigint as got
    from public.pipeline_records r
    where r.project_id = in_project_id
      and r.referrer_id is not null and r.archived_at is null
  ),
  owed as (
    select j.referrer_id, count(*)::integer as jobs,
           sum(j.got)::bigint as received,
           sum(coalesce(j.referral_amount_cents,
                        floor(j.got * j.referral_portion / 100)))::bigint as promised
    from jobs j group by j.referrer_id
  ),
  handed as (
    select e.party_id as who, sum(e.amount_cents)::bigint as total
    from public.ledger_entries e
    where e.project_id = in_project_id and e.direction = 'out'
      and e.party_id is not null
      and e.job_id in (select j.id from jobs j)
      and e.adjusts_id is null
      and not exists (select 1 from public.ledger_entries x where x.adjusts_id = e.id)
    group by e.party_id
  )
  select d.id, d.name, d.whatsapp, o.jobs, o.received, o.promised,
         coalesce(h.total, 0)::bigint,
         greatest(o.promised - coalesce(h.total, 0), 0)::bigint
  from owed o
  join public.directory_entries d on d.id = o.referrer_id
  left join handed h on h.who = o.referrer_id
  order by greatest(o.promised - coalesce(h.total, 0), 0) desc, d.name;
end;
$$;
