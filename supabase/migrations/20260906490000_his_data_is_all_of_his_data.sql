-- 「拿走我的资料」那一颗 —— 而它今天只给他三十四张表里的四张。
--
-- ── 🔴 这是一个已经出去的承诺破掉了，不是少一个功能 ──────────────────
-- [任务 64] 白纸黑字定过三层，第一层是:
--     **① 资料 —— 他的行 ＋ 他上传的照片，免费，随时。**
--     「这是**销售资产不是成本**：一个疑心的承包商，因为走得掉才签得下来。」
--
-- 而那颗按钮今天抓的是 `projects` · `project_pages` · `site_enquiries`
-- ＋ 官网照片 —— **四样**。
-- 8-30 之后建的每一张表一张都不在里面：走单 · 记帐 · 名册 · 库存 · 预约 ·
-- 逐项 · 分期 · 分摊 · 地址 · 工地照 · 改动 · 套票 · 保养 · 租赁 · 送货 ·
-- 退货 · 车 · 班级 · 排班 · 讯息 · 薪资 …
--
-- 🔴 **而它比少一个功能糟**: 他按下去、拿到一个档案、以为他的资料在手上。
-- 那是这个仓库最不能接受的那一类 —— 一个宣称做了而没做的东西。
--
-- ── 🔴 修法不是补一份清单 ────────────────────────────────────────────
-- 手写一份「要汇出哪几张表」，下一张表建出来的那天它就过期了，
-- 而**没有任何东西会讲**（这个仓库栽在「第二份手写清单」上至少八次）。
--
-- → 这一支**去问资料库自己**: 每一张带着 `project_id` 的表，都是他的资料。
--   新的表建出来那天，它自己就在汇出档里。
--
-- ⚠️ 而那句「问资料库」要有一把尺盯着，不然它哪天悄悄回一张空的
--    也没有人知道 —— `check:export` 就是那把尺，而且它反过来问一次:
--    **每一张带 project_id 的表，有没有真的出现在汇出档里。**

/* 哪几张表是「他的资料」—— 一句查询答完，而且它自己会长。
   ⚠️ 独立成一支，是为了那把尺跟这一支**问同一句话** ——
   两边各写一次就是两个答案。 */
create or replace function public.his_data_tables()
returns table (tbl text)
language sql
stable
security definer
set search_path = public
as $$
  select c.table_name::text
  from information_schema.columns c
  join information_schema.tables t
    on t.table_schema = c.table_schema and t.table_name = c.table_name
  where c.table_schema = 'public'
    and c.column_name = 'project_id'
    and t.table_type = 'BASE TABLE'
  order by c.table_name;
$$;

revoke execute on function public.his_data_tables() from public, anon;
grant execute on function public.his_data_tables() to authenticated;

comment on function public.his_data_tables() is
  'Every table that carries a project_id is his data. Derived from the catalog so a new table exports itself -- see 20260906490000 for why a hand-written list was refused.';


/* 整份拿走。
   🔴 `sees_money` —— 汇出档里有他每一笔钱，而师傅看不到钱。
   ⚠️ 照片不在这里: 那些住在储存空间，要签名的网址，
      而这一支是纯资料库的（画面那一边本来就在抓它们）。 */
create or replace function public.export_my_data(in_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  out_data jsonb := '{}'::jsonb;
  t text;
  rows_of jsonb;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'that project is not yours';
  end if;

  /* 公司自己那一行 —— 它的栏位叫 `id` 不是 `project_id`，
     所以上面那一句问不到它。 */
  select coalesce(to_jsonb(p), '{}'::jsonb) into rows_of
  from public.projects p where p.id = in_project_id;
  out_data := jsonb_set(out_data, '{projects}', jsonb_build_array(rows_of));

  for t in select tbl from public.his_data_tables()
  loop
    /* 名字来自资料库自己的目录，而且用 %I 包起来 —— 注入不了。 */
    execute format(
      'select coalesce(jsonb_agg(to_jsonb(x)), ''[]''::jsonb) from public.%I x where x.project_id = $1',
      t
    ) into rows_of using in_project_id;
    out_data := jsonb_set(out_data, array[t], rows_of);
  end loop;

  return out_data;
end;
$$;

revoke execute on function public.export_my_data(uuid) from public, anon;
grant execute on function public.export_my_data(uuid) to authenticated;

comment on function public.export_my_data(uuid) is
  'Task 64 promised his rows, free, any time. This returns every project-scoped table by asking the catalog, so it cannot fall behind the schema. Photos live in storage and stay with the screen that can sign their URLs.';
