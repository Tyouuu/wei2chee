-- 改回去 —— 走人按的那一支。
--
-- 20260905700000 那一版自己 insert 一行，单独推过、单独跑过，红出来四条：
--
--     FAIL  开得出一张单 — violates check constraint "pipeline_records_doc_no_fits"
--     FAIL  🔴 有单号 —— 走的是人按的那一支 — undefined
--
-- 🔴 **而第一行是这一次真正的收获**：那张表上有一条 `doc_no` 的格式约束，
-- 所以「比较方便」那条路**根本插不进去**，不是插进去一张没有单号的单。
-- 也就是说 20260830040000 那句「单号由 `next_doc_no()` 发，永远不是应用层」
-- **不只是一句注解，它是资料库真的在挡的一条**。写下来，因为我今天才知道。
--
-- ⚠️ 底下这一段是**从 20260905680000 原样搬回来的**，不是照记忆重打。

create or replace function public.record_from_request(
  in_request_id uuid,
  in_module_key text
)
returns public.pipeline_records
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
  made public.pipeline_records;
begin
  select * into r from public.party_requests q where q.id = in_request_id;
  if r.id is null or not public.works_here(r.project_id) then
    raise exception 'no such request in your project';
  end if;

  /* 已经开过一张了 —— 把那一张还给他，不要开第二张。 */
  if r.record_id is not null then
    select * into made from public.pipeline_records where id = r.record_id;
    if made.id is not null then
      return made;
    end if;
  end if;

  made := public.add_pipeline_record(
    in_project_id := r.project_id,
    in_module_key := in_module_key,
    in_title := left(r.what, 200),
    in_party_id := r.party_id,
    in_amount_cents := r.amount_cents,
    /* 一笔请求本身就是防重复的那把钥匙：同一笔按两次，回同一张单。 */
    in_idempotency_key := r.id
  );

  update public.party_requests
     set status = 'done', record_id = made.id,
         handled_by = auth.uid(), handled_at = now()
   where id = in_request_id;

  return made;
end;
$$;

revoke execute on function public.record_from_request(uuid, text) from public, anon;
grant execute on function public.record_from_request(uuid, text) to authenticated;
