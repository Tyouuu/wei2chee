-- 把「那一桌已经坐着人 → 把那一张单还给他」原样搬回去。
--
-- 20260908020000 拿掉它，尺子红十二条，而读数就是它坏掉时的样子：
--   🔴 所以那一家只有一张单，不是两张 — **2 张**
--   🔴 而且写着两行 · RM 21.50 — **0 行 / 0**   ← 桌子指着第二张空单，
--                                                 那两碗云吞面在第一张上，没有人看得到
--   🔴 进帐是 RM 21.50 — **[]**                  ← 结的是空的那一张，收到 RM 0
--
-- ⚠️ 这一段是从 20260908010000 **原样搬回来的**，不是照记忆重打
--    （重点 31 第一条：整支重写咬过三次）。

create or replace function public.seat_table(
  in_project_id uuid,
  in_table_id uuid,
  in_module_key text,
  in_party text default '',
  in_party_id uuid default null,
  in_title text default '',
  in_idempotency_key uuid default null
)
returns table (
  record_id uuid,
  doc_no text,
  table_name text,
  seated_at timestamptz,
  /* 🔴 这一按有没有真的开台 —— 那一桌本来就坐着人的话是 false。
     一支静静开出第二张单的函式，会让三号桌今晚有两张帐。 */
  seated boolean
)
language plpgsql
security definer
set search_path = public
as $fn$
declare
  tbl public.dining_tables;
  rec public.pipeline_records;
  fresh boolean := true;
begin
  if not public.works_here(in_project_id) then
    raise exception 'that project is not yours';
  end if;
  if not public.is_pipeline_module(in_module_key) then
    raise exception 'that page does not hold documents';
  end if;

  /* 🔴 锁住那一行：两个伙计同一秒替三号桌开台，只准开出一张。 */
  select * into tbl from public.dining_tables
   where id = in_table_id and project_id = in_project_id
   for update;
  if not found then
    raise exception 'no such table in this business';
  end if;
  if not tbl.active then
    raise exception 'that table is closed — open it again first';
  end if;

  /* 已经坐着人了：把那一张单还给他，不开第二张。 */
  if tbl.seated_record_id is not null then
    select * into rec from public.pipeline_records where id = tbl.seated_record_id;
    if found then
      return query select rec.id, rec.doc_no, tbl.name, tbl.seated_at, false;
      return;
    end if;
    /* 那张单不见了（被删掉）—— 桌子其实是空的，照常开。 */
  end if;

  select * into rec from public.add_pipeline_record(
    in_project_id => in_project_id,
    in_module_key => in_module_key,
    in_title => left(btrim(coalesce(in_title, '')), 200),
    in_party => coalesce(in_party, ''),
    in_party_id => in_party_id,
    in_idempotency_key => in_idempotency_key
  );

  /* 那一晚它在哪一桌 —— 历史，之后再也不改。 */
  update public.pipeline_records
     set table_id = tbl.id, updated_at = now()
   where id = rec.id;

  update public.dining_tables
     set seated_record_id = rec.id, seated_at = now()
   where id = tbl.id
  returning * into tbl;

  return query select rec.id, rec.doc_no, tbl.name, tbl.seated_at, fresh;
end;
$fn$;
