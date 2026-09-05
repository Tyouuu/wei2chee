-- 故意弄坏：加一页的时候不再把它需要的那一页开出来。
--
-- 那正是 2026-09-06 之前它真实的样子（地基决定 5 从 8-30 就没接）。
--
-- 弄坏之后 `npm run check:page-deps` 该红几条，而最要紧的是最后那一条：
-- 一张进货单靠名字认不出那家供应商 -> `party_id` 是空的
-- -> 「我欠谁多少」永远是空白的，**而他看不出为什么**。
--
-- 20260906330000 弄坏 · 20260906340000 改回去，两支都留在历史里。

create or replace function public.add_project_page(
  requested_key text,
  new_title text
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_project_id uuid;
  v_key text;
  v_title text;
  v_count int;
  v_next int;
  v_needs text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select id into v_project_id
  from public.projects
  where account_id = auth.uid();

  if v_project_id is null then
    raise exception 'no project for this account';
  end if;

  select count(*) into v_count from public.project_pages where project_id = v_project_id;
  if v_count >= 20 then
    raise exception 'page limit reached';
  end if;

  v_title := nullif(btrim(coalesce(new_title, '')), '');
  v_title := left(v_title, 24);

  if requested_key is null or requested_key = '' then
    if v_title is null then
      raise exception 'a custom page needs a title';
    end if;
    v_key := 'custom_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
  else
    if requested_key not in (
      'dashboard', 'customers', 'payments',
      'quotations', 'orders', 'bookings', 'projects', 'tasks',
      'reconciliation', 'commission', 'expenses', 'reports',
      'ranking', 'suppliers', 'staff', 'inventory', 'purchases',
      'website'
    ) then
      raise exception 'unknown page type: %', requested_key;
    end if;
    v_key := requested_key;
    if exists (
      select 1 from public.project_pages
      where project_id = v_project_id and page_key = v_key
    ) then
      return v_key;
    end if;
  end if;

  select coalesce(max(sort_order), 0) + 1 into v_next
  from public.project_pages
  where project_id = v_project_id;

  insert into public.project_pages (project_id, page_key, title, sort_order)
  values (v_project_id, v_key, v_title, v_next);

  /* ── 🔴 它需要的那一页，跟着一起开（地基决定 5，8-30 定的） ───────────
     [任务 69] 那六个决定里，第五个是「模块之间的关系照 Odoo 的 `depends`
     只做一层」，而它从 8-30 到今天**一直靠人记得**。

     🔴 而今天它变成一个看得见的洞：`party_payables`（我欠这一家多少，
     20260906020000）是**按供应商加起来**的，所以它要 `party_id`；
     而 `party_id` 是 `add_pipeline_record` 拿名字去供应商名册里对出来的。
     一间五金店自己加了「进货单」而没有「供应商」，那一页上
     **一个供应商都建不了** —— 於是每一张进货单的 party_id 都是空的，
     而「我欠谁多少」永远是空白的。他看不出为什么。

     ⚠️ **补一页，不是拒绝。**（[重点 29]：能不要他做的就不要他做。）
     Odoo 装一个模块会连它依赖的一起装 —— 抄那个做法。

     ⚠️ **只做一层，而且只在这里。**
     · 只做一层：`purchases → suppliers` 就停，不再问供应商需要什么。
       两层以上就要处理成环，而这份关系今天只有三条。
     · 只在这里：三个呼叫端（加一页的对话框 · AI 那条 · 模板那一页）
       全部走这一支，所以补在这里**每一条路自动拿到**，
       而写在 TypeScript 那一边要改三个档案、漏一个就是一条断掉的路
       （[重点 23] 的同一条：不准有第二条写入路径）。

     ⚠️ **上限照旧挡在前面** —— 补出来的那一页也是一页。
       满了就不补，而**主页照样开得出来**：他要的是那一页，
       少一页依赖比少他要的那一页好。 */

  return v_key;
end;
$$;
