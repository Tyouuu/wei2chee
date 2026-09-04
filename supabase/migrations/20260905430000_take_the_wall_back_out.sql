/**
 * 把那道闸再拆掉 —— 20260905420000 装回去只为了看守卫红一次。
 *
 * 红的那一刻长这样，逐字抄在这里，因为它才是这条守卫存在的证据：
 *   FAIL  🔴 没付款也存得了 — payment required
 *   FAIL  存进去的真的是他那一版 — {}
 *   FAIL  看得到历史 — 0 版
 *
 * ⚠️ **420000 没有改回去，是这一支把它盖掉。** 一支已经跑过的
 * migration 不可以回头去改（任务 81 学到的：改了会让 git 跟线上不一样）。
 */
create or replace function public.save_project_page(target_page_key text, new_layout jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  previous jsonb;
  newest timestamptz;
begin
  select id into target_project_id
  from public.projects
  where account_id = auth.uid();

  if target_project_id is null then
    raise exception 'project not found';
  end if;

  select layout_json into previous
  from public.project_pages
  where project_id = target_project_id
    and page_key = target_page_key;

  if not found then
    raise exception 'page not found: %', target_page_key;
  end if;

  select max(created_at) into newest
  from public.page_versions
  where project_id = target_project_id
    and page_key = target_page_key;

  -- 节流跟上限一个字都没动，理由见 20260820220000：一分钟存二十次的
  -- 历史不是历史，是穿着历史衣服的杂讯。
  if previous is not null
     and previous <> '{}'::jsonb
     and previous is distinct from new_layout
     and (newest is null or newest < now() - interval '3 minutes')
  then
    insert into public.page_versions (project_id, page_key, layout_json)
    values (target_project_id, target_page_key, previous);

    delete from public.page_versions
    where project_id = target_project_id
      and page_key = target_page_key
      and id not in (
        select id from public.page_versions
        where project_id = target_project_id
          and page_key = target_page_key
        order by created_at desc
        limit 20
      );
  end if;

  update public.project_pages
  set layout_json = new_layout, updated_at = now()
  where project_id = target_project_id
    and page_key = target_page_key;
end;
$$;
