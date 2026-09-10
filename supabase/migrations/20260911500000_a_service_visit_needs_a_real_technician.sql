-- service_visits 也漏了这一格——跟 add_appointment 那次一样的洞，
-- 顺着同一类问题排查找到的第三个真错。
--
-- ── 为什么（补完[任务 382][任务 383] 之后，系统性查一遍同类洞找到的）───
--
-- `package_uses_own_project()` 早就验过 `staff_id` 属於哪一家
-- （20260904190000 建表那天就有），`service_visits_own_project()`
-- （20260905220000）只验了 `record_id`，`staff_id` 完全没验。真登入
-- 打过：`log_service_visit` 传一个真的、属於**另一家生意**的员工编号，
-- 直接成功，那笔服务记录挂在别人家的员工身上。
--
-- ── 补在触发器上，不是补在 RPC 里——跟 package_uses 同一个做法 ───────────
--
-- `service_visits_own_project()` 是 BEFORE INSERT/UPDATE 触发器，
-- 挡得住每一条写入路径（RPC · 直接写表 · 以后任何新函式），比只补
-- `log_service_visit` 这一支更彻底。跟 `package_uses_own_project()`
-- 逐字同一个形状。

create or replace function public.service_visits_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  select project_id into owner_project
  from public.service_contracts where id = new.contract_id;
  if owner_project is null then
    raise exception 'no such contract';
  end if;
  if new.project_id is distinct from owner_project then
    new.project_id := owner_project;
  end if;
  if new.record_id is not null and not exists (
    select 1 from public.pipeline_records r
    where r.id = new.record_id and r.project_id = owner_project
  ) then
    raise exception 'that document belongs to another business';
  end if;

  /* 🔴 新的一段，跟 package_uses_own_project() 同一个形状：
     那一位要真的是这家的人。 */
  if new.staff_id is not null and not exists (
    select 1 from public.directory_entries d
    where d.id = new.staff_id and d.project_id = owner_project
  ) then
    raise exception 'that person is not a staff member in this project';
  end if;

  if new.status = 'done' and new.done_on is null then
    new.done_on := public.today_myt();
  end if;
  return new;
end;
$$;
