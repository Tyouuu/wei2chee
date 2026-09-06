-- 🔴 故意弄坏：把「哪几张表是他的资料」换成一份**手写的清单**，
-- 也就是今天那颗按钮本来的样子（三张表）。**单独推一次**（重点 31 第三条）。
--
-- 这一支要证明的不是汇出会坏 —— 是**那把尺的第二个来源有没有用**。
-- 照资料库问的那一条会跟着一起错、一起继续绿（两边问同一句话）；
-- 只有去问磁碟上那几百支 migration 的那一条会红。
create or replace function public.his_data_tables()
returns table (tbl text)
language sql
stable
security definer
set search_path = public
as $$
  select x from unnest(array['project_pages', 'site_enquiries', 'page_versions']) as x;
$$;
