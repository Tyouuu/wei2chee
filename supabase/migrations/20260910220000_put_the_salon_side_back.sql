-- 把 20260910210000 拿掉的那一半搬回去。
--
-- ⚠️ **原样从 20260910200000 抽出来**（[重点 31] 第 1 条）。
--
-- 弄坏那一版红出来的（`check:recall`）：
--   FAIL  两个人都在名单上
--   FAIL  🔴 沙龙那一位讲得出是来访的哪一行

create or replace function public.who_got_batch(in_batch_id uuid)
returns table (
  party_id uuid,
  party text,
  done_on date,
  what text,
  qty numeric,
  unit text
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  batch public.stock_batches;
begin
  select * into batch from public.stock_batches where id = in_batch_id;
  /* 🔴 works_here —— 找出谁碰过这一批是柜台/护理师要马上做的事，
     不是等着老板批准才能看的钱。 */
  if batch.id is null or not public.works_here(batch.project_id) then
    raise exception 'no such batch in your business';
  end if;

  return query
  /* 医美那一边：一笔疗程记录。 */
  select n.party_id, coalesce(d1.name, ''), n.done_on, n.what, p.qty, p.unit
    from public.treatment_products p
    join public.treatment_notes n on n.id = p.note_id
    join public.directory_entries d1 on d1.id = n.party_id
   where p.batch_id = in_batch_id
  union all
  /* 沙龙那一边：一次来访底下的一行。 */
  select a.party_id, coalesce(d2.name, ''),
         (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date, l.service, p.qty, p.unit
    from public.treatment_products p
    join public.appointment_lines l on l.id = p.line_id
    join public.appointments a on a.id = l.appointment_id
    join public.directory_entries d2 on d2.id = a.party_id
   where p.batch_id = in_batch_id
     and a.party_id is not null
  order by done_on desc;
end;
$$;


revoke execute on function public.who_got_batch(uuid) from public, anon;
grant execute on function public.who_got_batch(uuid) to authenticated;
