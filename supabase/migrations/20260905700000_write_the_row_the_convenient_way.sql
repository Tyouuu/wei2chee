-- 故意弄坏：一按变单的时候自己 insert 一行，不走人按的那一支。
--
-- 这就是[重点 23](../docs/founder-points.md)（AI 平权）挡的那件事，而它是
-- 这个仓库二十次「说了没做」的同一个形状：**同一件事两条路，只修了一条。**
-- 自己 insert 会静静地少掉四样：**单号 · 第一个阶段 · 防重复 · 分店守卫。**
--
-- ⚠️ **单独推一次** —— 弄坏跟改回去在同一次推送里，红的那一刻没有人看得到
--    （重点 31 第三条）。20260905710000 把它改回去。
--
-- ⚠️ 故意挑这一条来弄坏，而不是挑那道「路人读不到那张表」的墙：
--    **把一道墙拆掉，就算只有一分钟，那是真的资料真的露出去。**
--    一把尺不值得拿别人的生意资料去证明。

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

  if r.record_id is not null then
    select * into made from public.pipeline_records where id = r.record_id;
    if made.id is not null then
      return made;
    end if;
  end if;

  /* 🔴 「比较方便」的那条路。 */
  insert into public.pipeline_records (project_id, module_key, doc_no, title, party_id, amount_cents)
  values (r.project_id, in_module_key, '', left(r.what, 200), r.party_id, r.amount_cents)
  returning * into made;

  update public.party_requests
     set status = 'done', record_id = made.id,
         handled_by = auth.uid(), handled_at = now()
   where id = in_request_id;

  return made;
end;
$$;

revoke execute on function public.record_from_request(uuid, text) from public, anon;
grant execute on function public.record_from_request(uuid, text) to authenticated;
