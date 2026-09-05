-- 每一栏「谁做的」，都要放得开那个人。
--
-- 20260906210000 补上了 `follow_ups` 那两个**档案里写着、资料库里没有**
-- 的外键。补一次不够 —— 下一张表会重来一次，而且一样看不出来。
--
-- 所以把那支临时探针变成常驻的：它**逐栏**问资料库，
-- 「这一栏叫 created_by / recorded_by / taken_by / done_by / by_who /
--  verified_by / recorded_by，那它有没有真的指向 auth.users，
--  而且是 on delete set null」。
--
-- 🔴 为什么一定要 `set null` 而不是 cascade:
--   那一栏记的是**谁做的**，不是**属於谁**。一个员工离职，
--   他去年做过的那几次保养、拍过的那几张工地照**一件都不该消失** ——
--   那是这门生意的历史。cascade 会把历史跟着人一起删掉。
--
-- ⚠️ 它是给尺子用的（`check:closable`），只给 service_role。

drop function if exists public.probe_user_fks();

create or replace function public.who_did_it_columns()
returns table (
  tbl text,
  col text,
  has_fk boolean,
  on_delete text
)
language sql
stable
security definer
set search_path = public
as $$
  select c.relname::text,
         a.attname::text,
         fk.confdeltype is not null,
         case fk.confdeltype
              when 'a' then 'no action' when 'r' then 'restrict'
              when 'c' then 'cascade'   when 'n' then 'set null'
              when 'd' then 'set default' end
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace and n.nspname = 'public'
  join pg_attribute a on a.attrelid = c.oid and a.attnum > 0 and not a.attisdropped
  left join lateral (
    select x.confdeltype
    from pg_constraint x
    where x.contype = 'f'
      and x.conrelid = c.oid
      and x.confrelid = 'auth.users'::regclass
      and a.attnum = any (x.conkey)
    limit 1
  ) fk on true
  where c.relkind = 'r'
    and a.attname in ('created_by', 'recorded_by', 'taken_by', 'done_by',
                      'by_who', 'verified_by', 'signed_by')
    /* 只看真的存 uuid 的那几栏 —— 有些「signed_by」存的是客人自己打的名字。 */
    and format_type(a.atttypid, null) = 'uuid'
  order by 1, 2;
$$;

grant execute on function public.who_did_it_columns() to service_role;
