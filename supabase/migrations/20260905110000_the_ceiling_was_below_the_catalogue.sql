-- 十八个模块，而一个专案只开得到十二页。
--
-- ── 怎么发现的 ────────────────────────────────────────────────────────────
--
-- `npm run audit:demo` 第一次跑，十八页只开出十一页，另外七页全部回
-- **`page limit reached`** —— 客户 · 供应商 · 师傅 · 库存 · 对帐 · 报表 · 排行。
--
-- **一间批发商真的会要那七页里的六页。**
--
-- ── 那个 12 不是错的，是过期的 ────────────────────────────────────────────
--
-- 20260820200000 立它的时候写着理由，而那个理由今天还是对的：
--
--   「A ceiling, because the rail is a fixed-width column and the
--     specification document is something a person reads: forty pages is not
--     a system anybody designed on purpose, it is a runaway loop or a stuck
--     button.」
--
-- **它挡的是失控，不是十八。** 而那一天目录里没有十八个模块 ——
-- 走单五个 · 记帐三个 · 名册三个 · 库存 · 对帐 · 预约 · 总览 · 报表 ·
-- 排行 · 官网 = **18**。
--
-- 🔴 **一个低於自己目录的上限，是产品在跟自己打架**：AI 照他的生意挑了
-- 十四个模块，第十三个开始静静地开不出来，而画面上不会讲。
--
-- 改成 20：十八个全要还剩两页给他自己加，而失控那一条照样挡得住。
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

  return v_key;
end;
$$;
