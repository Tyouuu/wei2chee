-- 🔴 20260906150000 那一段放行，我插错了地方 —— 而 `check:records` 抓到了。
--
-- 那一支加的是「公司都不在了就放行」，插在每一支守卫的 `begin` 之后第一行。
-- 对**只做检查**的守卫是对的；对**顺手推导 `project_id`** 的那几支是错的:
--
--     insert into record_photos (record_id, ...)     -- project_id 没给
--       -> 守卫第一句：projects 里有没有 id = null 的？没有
--       -> **直接放行**，而底下那一句「从那张单查出 project_id」从来没跑
--       -> insert 带着一个空的 project_id -> 外键炸掉
--
-- `check:records` 红了七条（挂照片那一整段），而三个 shape 的守卫
-- （record_photos · stock_batches · vehicles …）都是这个形状。
--
-- 🔴 真正的修法比原本那一句窄:**那一段放行只在 UPDATE 的时候需要。**
-- cascade 把 `created_by` 设成 null 是一次 update；
-- 而 INSERT 的时候公司本来就一定要在，也一定要走完推导那几行。
--
-- ⚠️ 十支都是从 20260906150000 —— **最后一次定义它们的那个档案** ——
-- 原样抽出来改那一行，不是照记忆重打。

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
  if tg_op = 'UPDATE'
     and not exists (select 1 from public.projects p where p.id = new.project_id) then
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
  if tg_op = 'UPDATE'
     and not exists (select 1 from public.projects p where p.id = new.project_id) then
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
  if tg_op = 'UPDATE'
     and not exists (select 1 from public.projects p where p.id = new.project_id) then
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
  if tg_op = 'UPDATE'
     and not exists (select 1 from public.projects p where p.id = new.project_id) then
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
  if tg_op = 'UPDATE'
     and not exists (select 1 from public.projects p where p.id = new.project_id) then
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
  if tg_op = 'UPDATE'
     and not exists (select 1 from public.projects p where p.id = new.project_id) then
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
  if tg_op = 'UPDATE'
     and not exists (select 1 from public.projects p where p.id = new.project_id) then
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
  if tg_op = 'UPDATE'
     and not exists (select 1 from public.projects p where p.id = new.project_id) then
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
  if tg_op = 'UPDATE'
     and not exists (select 1 from public.projects p where p.id = new.project_id) then
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
  if tg_op = 'UPDATE'
     and not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;

  if not public.works_here(new.project_id) then
    raise exception 'that project is not yours';
  end if;
  return new;
end;
$$;
