-- 那把「谁做的」的守卫，认得的栏名不够多。
--
-- 🔴 我在同一个 session 里造了 `appointments.seen_by`，而它**它看不到** ——
-- 因为它的名单里没有 `seen_by`。那一栏正好又把一个帐号锁住了
-- （20260906300000 拿掉了它）。
--
-- 所以名单补几个真的会有人取的名字。⚠️ 而这一条本身就是它的边界:
-- **它只认得写下来的那几个名字**，换一个 `entered_by` 它照样看不到。
-- 真正接得住那一类的是 `check:closable` 那两段「删得掉 · 关得掉」——
-- 而那两段今天也补上了一笔官网预约，因为 `appointments`
-- 从来没有被那一支种过（所以那个洞在它眼皮底下过了一整轮）。

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
                      'by_who', 'verified_by', 'signed_by',
                      /* 2026-09-06 补的两个 —— 我自己造过其中一个。 */
                      'seen_by', 'approved_by', 'sent_by', 'checked_by',
                      'entered_by', 'closed_by', 'cancelled_by')
    /* 只看真的存 id 的那几栏 —— 有些「签收人」存的是客人自己打的名字。 */
    and format_type(a.atttypid, null) = 'uuid'
  order by 1, 2;
$$;

grant execute on function public.who_did_it_columns() to service_role;
