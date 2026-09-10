-- 哪几个客人打了 X 批号 —— 一个查询，一页，资料早就有了。
--
-- ── 为什么（2026-09-10 深度研究，[任务 341](../docs/founder-tasks.md#341)）────
--
-- Pabau 讲得最直白：「identify exactly which clients received a specific
-- batch if a product recall or adverse reaction occurs」。填充物在马来西亚是
-- 医疗器材法令 2012 下的管制品，供应商召回是诊所自己的责任。
--
-- 🔴 **这是研究列出来最便宜的一件**：批号从 20260909040000 就记在每一笔
-- 疗程用料上，**资料早就有了，缺的只是一个问句**。
--
-- ── 🔴 两边共用，因为这张表本来就服务两边 ──────────────────────────────────
--
-- `treatment_products`（20260910070000 之后）挂两种主人：疗程记录（medi spa）
-- 或来访明细（沙龙的一次来访）。召回这件事不该只答一半 ——
-- 一批染膏出问题，沙龙那一边一样要知道谁碰过它。
-- 所以这一支两条路都查，跟 `pick_batch` 是同一条纪律：
-- **一个问题只有一份答案，不管她从哪一道门进来的。**
--
-- ⚠️ **这一支不发起召回，只回答「谁碰过」。** 打不打电话、要不要通知，
-- 是老板的判断 —— 这里只做他判断之前要的那份名单。

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

comment on function public.who_got_batch(uuid) is
  'Everyone who received something from one batch, from either the medi-spa treatment path or the salon visit-line path -- a supplier recall does not care which door she used. Answers who was touched; whether to act on it is hers. See 20260910200000.';
