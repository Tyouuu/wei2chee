/**
 * 故意把那道闸装回去，看守卫红一次 —— 然后 20260905430000 立刻拆掉。
 *
 * 重点 24 / 26：**一个没有人看过它红的守卫，等於没有守卫。**
 * 这一支跟下一支都留在历史里，因为它们就是「我验过了」的那份证据。
 *
 * ⚠️ 一定要**单独推一次**再跑 check:handoff —— 20260905070000 那次
 * 弄坏跟改回去在同一次 db push 里套用，红的那一刻没有人看得到。
 */
create or replace function public.save_project_page(target_page_key text, new_layout jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  is_paid boolean;
begin
  select id, paid into target_project_id, is_paid
  from public.projects
  where account_id = auth.uid();

  if target_project_id is null then
    raise exception 'project not found';
  end if;

  if not is_paid then
    raise exception 'payment required';
  end if;

  update public.project_pages
  set layout_json = new_layout, updated_at = now()
  where project_id = target_project_id
    and page_key = target_page_key;
end;
$$;
