-- 小费——沙龙其余那一组一直挂着的一件，而它就长在已经在跑的那一行上。
--
-- ── 为什么（[任务 341] 沙龙其余那一组）───────────────────────────────────
--
-- `appointment_lines`（20260910010000）自己的注解写着沙龙的日记簿本来就长
-- 这样：一次来访底下几行，做什么 · 谁做 · 多少钱。四栏，没有时长、没有
-- 开始结束、没有段（[重点 34]）。小费是同一本簿子上第五栏——她剪完多给
-- 那个师傅一点，柜台记得下，而这个系统今天没有格子可以放这件事。
--
-- ── 不是营业额，一分钱都不进他的帐 ────────────────────────────────────────
--
-- 跟储值卡那次送的 200 同一条纪律（20260909360000 的注解）：客人自己付的
-- 是一笔真的收款，走 `add_ledger_entry`；小费是她直接给那个师傅的钱，
-- **从来没有经过老板的户口**。记进 `ledger_entries` 就是替他的帐上凭空
-- 加了一笔从来没有存在过的营业额，他月底对帐会发现多了一笔对不上的钱。
-- 所以这一支**只做一件事**：让这个事实留得下来。不碰钱那一层。
--
-- ── null 跟 0 是两句话，跟 price_cents 同一条规矩 ─────────────────────────
--
-- null：柜台没有问、或者没有想到要记。0：问过了，客人这次没给。
-- 猜一个 0 进去等於在说谎。
--
-- ── 老板真正会问的下一句话（[重点 35]）───────────────────────────────────
--
-- 光记得下小费不够——他会问「阿珍这个月拿了多少小费」，那是老板衡量
-- 客人喜不喜欢这个师傅的一个信号，也是师傅自己想知道的数字。
-- `tips_of` 直接读同一张表，works_here——不比 `price_cents` 更严：
-- 那一栏本来就是全店 `works_here` 都读得到的（这张表的政策是 `for all`），
-- 一支加总它的函式没有替任何人多打开一扇门。

alter table public.appointment_lines
  add column if not exists tip_cents bigint
    check (tip_cents is null or tip_cents >= 0);

comment on column public.appointment_lines.tip_cents is
  'What she left for whoever did this line, direct to that person -- never touches ledger_entries, never counted as revenue. Null means nobody asked; 0 means asked and she gave none. See 20260911190000.';

create or replace function public.set_visit_tip(
  in_line_id uuid,
  in_tip_cents bigint
)
returns public.appointment_lines
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row public.appointment_lines;
begin
  select * into row from public.appointment_lines
   where id = in_line_id and public.works_here(project_id);
  if row.id is null then
    raise exception 'no such line in your business';
  end if;
  if in_tip_cents is not null and in_tip_cents < 0 then
    raise exception 'a tip cannot be less than nothing';
  end if;

  update public.appointment_lines
     set tip_cents = in_tip_cents
   where id = in_line_id
  returning * into row;

  return row;
end;
$fn$;

revoke execute on function public.set_visit_tip(uuid, bigint) from public, anon;
grant execute on function public.set_visit_tip(uuid, bigint) to authenticated;

comment on function public.set_visit_tip(uuid, bigint) is
  'Records what she left for the person who did this line. Never writes to ledger_entries -- a tip is not the business''s money. See 20260911190000.';

-- ── 这个月谁拿了多少小费 ────────────────────────────────────────────────

create or replace function public.tips_of(
  in_project_id uuid,
  in_days integer default 30
)
returns table (
  staff_id uuid,
  staff_name text,
  tip_cents bigint,
  tipped_visits integer
)
language sql
stable
security definer
set search_path = public
as $fn$
  select l.staff_id, d.name, sum(l.tip_cents)::bigint, count(*)::integer
    from public.appointment_lines l
    join public.appointments a on a.id = l.appointment_id
    join public.directory_entries d on d.id = l.staff_id
   where l.project_id = in_project_id
     and public.works_here(in_project_id)
     and l.staff_id is not null
     and l.tip_cents is not null
     and l.tip_cents > 0
     and a.starts_at >= now() - (in_days || ' days')::interval
   group by l.staff_id, d.name
   order by sum(l.tip_cents) desc;
$fn$;

revoke execute on function public.tips_of(uuid, integer) from public, anon;
grant execute on function public.tips_of(uuid, integer) to authenticated;

comment on function public.tips_of(uuid, integer) is
  'How much each staff member has been left in tips over the window -- not revenue, just the fact rolled up. See 20260911190000.';
