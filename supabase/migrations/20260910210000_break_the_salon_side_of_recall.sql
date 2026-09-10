-- 🔴 故意弄坏，看它红（[重点 31] 第 3 条）。**单独推一次**。
--
-- 拿掉的是沙龙那一边的查询 —— 只剩医美的疗程记录那一半。
--
-- 坏起来的样子：一批染膏出问题，护理师查回来的名单**少了半间店**——
-- 沙龙那一位客人碰过同一批，而名单上没有她。
-- ⚠️ 画面上完全正常：一个查询，一份名单，看起来做完了。
-- 20260910220000 把它原样搬回去。

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
  order by done_on desc; /* 沙龙那一边被拿掉了 */
end;
$$;


revoke execute on function public.who_got_batch(uuid) from public, anon;
grant execute on function public.who_got_batch(uuid) to authenticated;
