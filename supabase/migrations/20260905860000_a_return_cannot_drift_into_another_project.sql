-- 一笔退货挂到别人的单上，要**讲出来**，不是静静搬回去。
--
-- 20260905840000 的触发器抄的是 `deliveries_own_project`（20260905500000）：
-- 它把 `new.project_id` **改写**成那张单的那一家。
-- 那样是安全的（RLS 的 with check 在 before 触发器之后跑，所以一个只在 B 家的
-- 人插不进去），**而它把呼叫端的错藏起来了** —— 尺子跑出来是「居然让它过了」。
--
-- 🔴 这个仓库有两种写法并存，而 `follow_ups_own_project`（20260905800000）
-- 选的是抛：`that document is not in this project`。
-- **选抛的那一种**，理由是这个仓库一路在讲的同一条：
-- 一个被静静修正的错误，跟一个没有发生过的错误长得一模一样。
--
-- ⚠️ 产品那条路一个字都不用改：`record_return` 本来就传那张单自己的
-- `project_id`，所以这一条永远不会挡到它。

create or replace function public.returns_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $fn$
declare
  belongs uuid;
begin
  select r.project_id into belongs
  from public.pipeline_records r where r.id = new.record_id;
  if belongs is null then
    raise exception 'no such document';
  end if;
  if belongs <> new.project_id then
    raise exception 'that document is not in this project';
  end if;
  new.updated_at := now();
  return new;
end;
$fn$;

create or replace function public.return_lines_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $fn$
declare
  belongs uuid;
begin
  select t.project_id into belongs from public.returns t where t.id = new.return_id;
  if belongs is null then
    raise exception 'no such return';
  end if;
  if belongs <> new.project_id then
    raise exception 'that return is not in this project';
  end if;
  return new;
end;
$fn$;
