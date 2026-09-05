-- 十张表的守卫，会挡住删一个使用者。
--
-- 🔴 发现的方式：做「下一步自己长出来」那一件的时候，尺子跑完删不掉自己的
-- 测试帐号 —— `Database error deleting user`。那句话是 API 包过的，
-- 问不出是哪一条，所以推了一支临时探针去问资料库原话:
--
--     P0001 | that project is not yours
--
-- **是我自己刚写的那支守卫。** 顺着查下去，同一个形状有十张表。
--
-- 怎么发生的:
--   删一个使用者 → `references auth.users(id) on delete set null` 那几栏
--   （created_by · recorded_by · taken_by · done_by · by_who）
--   要被设成 null → 那是一次 **update** → 守卫开火 → 而这时候它要查的
--   上一层（project · 单据 · 货品）可能已经被 cascade 删掉了 → raise
--   → **整句删除被挡下来**。
--
-- [任务 129] 一模一样炸过一次（那次是稽核那张表），而 20260905810000
-- 已经替 `follow_ups` 修好并写下这个形状。这一支把它补到其余九张。
--
-- ⚠️ 为什么**不**改成 `before insert or update of <那几栏>`（follow_ups 那一支
-- 两样都做了）：这十支里有四支顺手在写 `updated_at`
-- （deliveries · rentals · stock_batches · vehicles）—— 收窄触发的栏，
-- 那一栏会静静地不再更新。**加一句放行，不动触发的范围。**
--
-- ⚠️ 十支都是从**最后一次定义它的那个档案**原样抽出来、在 begin 之后插一段，
-- 不是照记忆重打。[重点 31] 第 1 条。

create or replace function public.deliveries_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $fn$
declare
  owner_project uuid;
begin
  /* 🔴 公司都不在了就放行。
     删一个使用者的时候，`... references auth.users(id) on delete set null`
     会对这一张表发一次 **update**，而那一次 update 会走进这里 ——
     这时候它上面那几张表（project · 单据 · 货品）可能已经被 cascade 删掉了，
     於是下面那句查询查不到东西，一 raise 就把**整句删除**挡下来。
     画面上看到的只有一句 `Database error deleting user`。

     [任务 129] 就是这样炸的（那次是稽核那张表），20260905810000 替
     `follow_ups` 修过一次并写下这个形状。这一支把同一个形状补到其余九张。

     ⚠️ 而**不可以**改成 `update of <那几栏>` —— 这十支里有四支
     （deliveries · rentals · stock_batches · vehicles）顺手在写 `updated_at`，
     收窄触发的栏会让那一栏静静地不再更新。 */
  if not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;

  select project_id into owner_project
  from public.pipeline_records where id = new.record_id;
  if owner_project is null then
    raise exception 'no such document';
  end if;
  new.project_id := owner_project;
  new.updated_at := now();
  return new;
end;
$fn$;

create or replace function public.package_uses_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  /* 🔴 公司都不在了就放行。
     删一个使用者的时候，`... references auth.users(id) on delete set null`
     会对这一张表发一次 **update**，而那一次 update 会走进这里 ——
     这时候它上面那几张表（project · 单据 · 货品）可能已经被 cascade 删掉了，
     於是下面那句查询查不到东西，一 raise 就把**整句删除**挡下来。
     画面上看到的只有一句 `Database error deleting user`。

     [任务 129] 就是这样炸的（那次是稽核那张表），20260905810000 替
     `follow_ups` 修过一次并写下这个形状。这一支把同一个形状补到其余九张。

     ⚠️ 而**不可以**改成 `update of <那几栏>` —— 这十支里有四支
     （deliveries · rentals · stock_batches · vehicles）顺手在写 `updated_at`，
     收窄触发的栏会让那一栏静静地不再更新。 */
  if not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;

  select project_id into owner_project
  from public.service_packages where id = new.package_id;
  if owner_project is null then
    raise exception 'no such package';
  end if;
  new.project_id := owner_project;

  if new.staff_id is not null then
    perform 1 from public.directory_entries
      where id = new.staff_id and project_id = owner_project and module_key = 'staff';
    if not found then
      raise exception 'that person is not a staff member in this project';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.record_photos_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  /* 🔴 公司都不在了就放行。
     删一个使用者的时候，`... references auth.users(id) on delete set null`
     会对这一张表发一次 **update**，而那一次 update 会走进这里 ——
     这时候它上面那几张表（project · 单据 · 货品）可能已经被 cascade 删掉了，
     於是下面那句查询查不到东西，一 raise 就把**整句删除**挡下来。
     画面上看到的只有一句 `Database error deleting user`。

     [任务 129] 就是这样炸的（那次是稽核那张表），20260905810000 替
     `follow_ups` 修过一次并写下这个形状。这一支把同一个形状补到其余九张。

     ⚠️ 而**不可以**改成 `update of <那几栏>` —— 这十支里有四支
     （deliveries · rentals · stock_batches · vehicles）顺手在写 `updated_at`，
     收窄触发的栏会让那一栏静静地不再更新。 */
  if not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;

  select project_id into owner_project
  from public.pipeline_records where id = new.record_id;
  if owner_project is null then
    raise exception 'no such document';
  end if;
  new.project_id := owner_project;
  return new;
end;
$$;

create or replace function public.rentals_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $fn$
declare
  owner_project uuid;
begin
  /* 🔴 公司都不在了就放行。
     删一个使用者的时候，`... references auth.users(id) on delete set null`
     会对这一张表发一次 **update**，而那一次 update 会走进这里 ——
     这时候它上面那几张表（project · 单据 · 货品）可能已经被 cascade 删掉了，
     於是下面那句查询查不到东西，一 raise 就把**整句删除**挡下来。
     画面上看到的只有一句 `Database error deleting user`。

     [任务 129] 就是这样炸的（那次是稽核那张表），20260905810000 替
     `follow_ups` 修过一次并写下这个形状。这一支把同一个形状补到其余九张。

     ⚠️ 而**不可以**改成 `update of <那几栏>` —— 这十支里有四支
     （deliveries · rentals · stock_batches · vehicles）顺手在写 `updated_at`，
     收窄触发的栏会让那一栏静静地不再更新。 */
  if not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;

  select project_id into owner_project
  from public.pipeline_records where id = new.record_id;
  if owner_project is null then
    raise exception 'no such document';
  end if;
  new.project_id := owner_project;
  new.updated_at := now();
  return new;
end;
$fn$;

create or replace function public.service_contracts_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
  the_module text;
begin
  /* 🔴 公司都不在了就放行。
     删一个使用者的时候，`... references auth.users(id) on delete set null`
     会对这一张表发一次 **update**，而那一次 update 会走进这里 ——
     这时候它上面那几张表（project · 单据 · 货品）可能已经被 cascade 删掉了，
     於是下面那句查询查不到东西，一 raise 就把**整句删除**挡下来。
     画面上看到的只有一句 `Database error deleting user`。

     [任务 129] 就是这样炸的（那次是稽核那张表），20260905810000 替
     `follow_ups` 修过一次并写下这个形状。这一支把同一个形状补到其余九张。

     ⚠️ 而**不可以**改成 `update of <那几栏>` —— 这十支里有四支
     （deliveries · rentals · stock_batches · vehicles）顺手在写 `updated_at`，
     收窄触发的栏会让那一栏静静地不再更新。 */
  if not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;

  select project_id, module_key into owner_project, the_module
  from public.directory_entries where id = new.party_id;
  if owner_project is null then
    raise exception 'no such person';
  end if;
  /* 🔴 保养合约是签给**客人**的。挂在供应商身上的合约，在画面上完全正常，
     而它会让「这个月要去哪几家」里出现一个我们要去拜访的五金行。 */
  if the_module <> 'customers' then
    raise exception 'a service contract belongs to a customer';
  end if;
  if new.project_id is distinct from owner_project then
    new.project_id := owner_project;
  end if;
  if new.site_address_id is not null and not exists (
    select 1 from public.directory_addresses a
    where a.id = new.site_address_id and a.party_id = new.party_id
  ) then
    raise exception 'that address belongs to someone else';
  end if;
  if new.branch_id is not null and not exists (
    select 1 from public.branches b
    where b.id = new.branch_id and b.project_id = new.project_id
  ) then
    raise exception 'that branch belongs to another business';
  end if;
  return new;
end;
$$;

create or replace function public.service_packages_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
  the_module text;
begin
  /* 🔴 公司都不在了就放行。
     删一个使用者的时候，`... references auth.users(id) on delete set null`
     会对这一张表发一次 **update**，而那一次 update 会走进这里 ——
     这时候它上面那几张表（project · 单据 · 货品）可能已经被 cascade 删掉了，
     於是下面那句查询查不到东西，一 raise 就把**整句删除**挡下来。
     画面上看到的只有一句 `Database error deleting user`。

     [任务 129] 就是这样炸的（那次是稽核那张表），20260905810000 替
     `follow_ups` 修过一次并写下这个形状。这一支把同一个形状补到其余九张。

     ⚠️ 而**不可以**改成 `update of <那几栏>` —— 这十支里有四支
     （deliveries · rentals · stock_batches · vehicles）顺手在写 `updated_at`，
     收窄触发的栏会让那一栏静静地不再更新。 */
  if not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;

  select project_id, module_key into owner_project, the_module
  from public.directory_entries where id = new.party_id;
  if owner_project is null then
    raise exception 'no such person';
  end if;
  /* 🔴 套票是卖给**客人**的。挂在供应商或师傅身上的套票，在画面上完全正常，
     而它会让「他还剩几次」出现在一个永远不会来消费的人身上。 */
  if the_module <> 'customers' then
    raise exception 'a package belongs to a customer';
  end if;
  if new.project_id is distinct from owner_project then
    new.project_id := owner_project;
  end if;
  if new.expires_on is not null and new.expires_on < new.sold_on then
    raise exception 'it cannot expire before it was sold';
  end if;
  return new;
end;
$$;

create or replace function public.service_visits_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  /* 🔴 公司都不在了就放行。
     删一个使用者的时候，`... references auth.users(id) on delete set null`
     会对这一张表发一次 **update**，而那一次 update 会走进这里 ——
     这时候它上面那几张表（project · 单据 · 货品）可能已经被 cascade 删掉了，
     於是下面那句查询查不到东西，一 raise 就把**整句删除**挡下来。
     画面上看到的只有一句 `Database error deleting user`。

     [任务 129] 就是这样炸的（那次是稽核那张表），20260905810000 替
     `follow_ups` 修过一次并写下这个形状。这一支把同一个形状补到其余九张。

     ⚠️ 而**不可以**改成 `update of <那几栏>` —— 这十支里有四支
     （deliveries · rentals · stock_batches · vehicles）顺手在写 `updated_at`，
     收窄触发的栏会让那一栏静静地不再更新。 */
  if not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;

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
  if new.status = 'done' and new.done_on is null then
    new.done_on := public.today_myt();
  end if;
  return new;
end;
$$;

create or replace function public.stock_batches_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  /* 🔴 公司都不在了就放行。
     删一个使用者的时候，`... references auth.users(id) on delete set null`
     会对这一张表发一次 **update**，而那一次 update 会走进这里 ——
     这时候它上面那几张表（project · 单据 · 货品）可能已经被 cascade 删掉了，
     於是下面那句查询查不到东西，一 raise 就把**整句删除**挡下来。
     画面上看到的只有一句 `Database error deleting user`。

     [任务 129] 就是这样炸的（那次是稽核那张表），20260905810000 替
     `follow_ups` 修过一次并写下这个形状。这一支把同一个形状补到其余九张。

     ⚠️ 而**不可以**改成 `update of <那几栏>` —— 这十支里有四支
     （deliveries · rentals · stock_batches · vehicles）顺手在写 `updated_at`，
     收窄触发的栏会让那一栏静静地不再更新。 */
  if not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;

  select c.project_id into owner_project
  from public.catalog_items c where c.id = new.item_id;
  if owner_project is null then
    raise exception 'no such item';
  end if;
  new.project_id := owner_project;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.vehicles_own_project()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  owner_project uuid;
begin
  /* 🔴 公司都不在了就放行。
     删一个使用者的时候，`... references auth.users(id) on delete set null`
     会对这一张表发一次 **update**，而那一次 update 会走进这里 ——
     这时候它上面那几张表（project · 单据 · 货品）可能已经被 cascade 删掉了，
     於是下面那句查询查不到东西，一 raise 就把**整句删除**挡下来。
     画面上看到的只有一句 `Database error deleting user`。

     [任务 129] 就是这样炸的（那次是稽核那张表），20260905810000 替
     `follow_ups` 修过一次并写下这个形状。这一支把同一个形状补到其余九张。

     ⚠️ 而**不可以**改成 `update of <那几栏>` —— 这十支里有四支
     （deliveries · rentals · stock_batches · vehicles）顺手在写 `updated_at`，
     收窄触发的栏会让那一栏静静地不再更新。 */
  if not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;

  if new.party_id is not null then
    select d.project_id into owner_project
    from public.directory_entries d where d.id = new.party_id;
    if owner_project is distinct from new.project_id then
      raise exception 'that owner is not in this business''s directory';
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.nudge_snoozes_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  /* 🔴 公司都不在了就放行。
     删一个使用者的时候，`... references auth.users(id) on delete set null`
     会对这一张表发一次 **update**，而那一次 update 会走进这里 ——
     这时候它上面那几张表（project · 单据 · 货品）可能已经被 cascade 删掉了，
     於是下面那句查询查不到东西，一 raise 就把**整句删除**挡下来。
     画面上看到的只有一句 `Database error deleting user`。

     [任务 129] 就是这样炸的（那次是稽核那张表），20260905810000 替
     `follow_ups` 修过一次并写下这个形状。这一支把同一个形状补到其余九张。

     ⚠️ 而**不可以**改成 `update of <那几栏>` —— 这十支里有四支
     （deliveries · rentals · stock_batches · vehicles）顺手在写 `updated_at`，
     收窄触发的栏会让那一栏静静地不再更新。 */
  if not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;

  if not public.works_here(new.project_id) then
    raise exception 'that project is not yours';
  end if;
  return new;
end;
$$;

/* 探针用完就删（[任务 129] 同一条：弄坏跟问出来的东西不留在库里）。 */
drop function if exists public.probe_delete_user_3(uuid);
