-- 把守卫改回 `sees_money`。20260905270000 故意换成 `works_here`，
-- 而中间那一次 `FAIL 师傅算不出… — 1` 是这条守卫唯一的证据（[重点 24]）。
--
-- 内容跟 20260905260000 那一版一模一样。
create or replace function public.referrals_owing(in_project_id uuid)
returns table (
  referrer_id uuid,
  name text,
  whatsapp text,
  jobs integer,
  received_cents bigint,
  promised_cents bigint,
  paid_cents bigint,
  owing_cents bigint
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
  with jobs as (
    select r.id, r.referrer_id, r.referral_portion, r.referral_amount_cents,
           /* 这一单真的收到多少。冲正过的、跟自己是冲正的都不算 ——
              同一条规矩在 lib/portal/allocations.ts 的 countsAsReceived。 */
           coalesce((
             select sum(a.amount_cents)
             from public.ledger_allocations a
             join public.ledger_entries e on e.id = a.entry_id
             where a.record_id = r.id
               and e.direction = 'in'
               and e.adjusts_id is null
               and not exists (
                 select 1 from public.ledger_entries x where x.adjusts_id = e.id
               )
           ), 0)::bigint as got
    from public.pipeline_records r
    where r.project_id = in_project_id
      and r.referrer_id is not null
      and r.archived_at is null
  ),
  owed as (
    select j.referrer_id,
           count(*)::integer as jobs,
           sum(j.got)::bigint as received,
           /* 写死的金额照写；比例算在**收到的钱**上。 */
           sum(coalesce(
             j.referral_amount_cents,
             floor(j.got * j.referral_portion / 100)
           ))::bigint as promised
    from jobs j
    group by j.referrer_id
  ),
  handed as (
    /* 🔴 「给了多少」是加出来的：方向是出 · 收款人是他 ·
       而且挂在这几单其中一单上。 */
    select e.party_id as who, sum(e.amount_cents)::bigint as total
    from public.ledger_entries e
    where e.project_id = in_project_id
      and e.direction = 'out'
      and e.party_id is not null
      and e.job_id in (select j.id from jobs j)
      and e.adjusts_id is null
      and not exists (
        select 1 from public.ledger_entries x where x.adjusts_id = e.id
      )
    group by e.party_id
  )
  select d.id, d.name, d.whatsapp,
         o.jobs, o.received, o.promised,
         coalesce(h.total, 0)::bigint,
         greatest(o.promised - coalesce(h.total, 0), 0)::bigint
  from owed o
  join public.directory_entries d on d.id = o.referrer_id
  left join handed h on h.who = o.referrer_id
  /* 欠最多的排前面 —— 那一行就是他今天要处理的那一件。 */
  order by greatest(o.promised - coalesce(h.total, 0), 0) desc, d.name;
end;
$$;
