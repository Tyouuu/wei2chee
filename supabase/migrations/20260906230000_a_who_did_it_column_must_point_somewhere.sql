-- 那把新守卫第一次跑就抓到两栏，而**其中一栏是它自己误报的** ——
-- 值得写下来，因为那个误报正好讲清楚这一条真正在守什么。
--
--   🔴 `returns.recorded_by`   —— 真的漏了。**我今天自己写的**
--      （20260905840000 那张退货表），写成了一个光秃秃的 uuid。
--   ⚠️ `ledger_entries.done_by` —— **不是漏，是我的尺子太窄**。
--      那一栏指的是**名册上的那个师傅**（`directory_entries`），
--      不是登入的那个人 —— 同一个栏名，两件事
--      （20260904120000：「Which staff member earned this money」）。
--
-- 所以那一条要问的不是「有没有指向 auth.users」，是:
--   **一栏「谁做的」不可以是光秃秃的 uuid，而且它的外键要 `set null`。**
--
-- 🔴 为什么一定是 `set null`:
--   那一栏记的是**谁做的**，不是**属於谁**。一个员工离职，
--   他去年做过的那几次保养、拍过的那几张工地照**一件都不该消失** ——
--   那是这门生意的历史。cascade 会把历史跟着人一起删掉。
--
-- 🔴 而光秃秃的 uuid 最糟，因为它**看起来完全正常**：
--   那个人删掉之后，那一栏还握着一个已经不存在的 id，
--   「这一笔是谁做的」从此答不出来，而画面上跟一个真的 id 一模一样。

update public.returns t
   set recorded_by = null
 where t.recorded_by is not null
   and not exists (select 1 from auth.users u where u.id = t.recorded_by);

alter table public.returns
  drop constraint if exists returns_recorded_by_fkey,
  add constraint returns_recorded_by_fkey
    foreign key (recorded_by) references auth.users(id) on delete set null;


/* 尺子那一支改成问「指到哪里 · 删的时候怎么办」，不再假设一定是 auth.users。 */
drop function if exists public.who_did_it_columns();

create or replace function public.who_did_it_columns()
returns table (
  tbl text,
  col text,
  points_at text,
  on_delete text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.relname::text,
         a.attname::text,
         fk.target,
         fk.rule
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join lateral (
    select x.confrelid::regclass::text as target,
           case x.confdeltype
                when 'a' then 'no action' when 'r' then 'restrict'
                when 'c' then 'cascade'   when 'n' then 'set null'
                when 'd' then 'set default' end as rule
    from pg_constraint x
    where x.contype = 'f'
      and x.conrelid = c.oid
      and a.attnum = any (x.conkey)
    limit 1
  ) fk on true
  where c.relkind = 'r'
    and a.attname in ('created_by', 'recorded_by', 'taken_by', 'done_by',
                      'by_who', 'verified_by', 'signed_by')
    /* 只看真的存 id 的那几栏 —— 有些「签收人」存的是客人自己打的名字。 */
    and format_type(a.atttypid, null) = 'uuid'
  order by 1, 2;
$$;

grant execute on function public.who_did_it_columns() to service_role;
