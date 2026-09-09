-- 一次来访做了哪几样，每一样是谁做的 —— 而**没有一个时间段**。
--
-- ── 他 2026-09-10 把这一件变简单了，而那句话是这一支的全部设计 ────────────
--
--     `就是我觉得就做成客户进到来 然后说是谁负责完这一切的 就可以了
--      不一定要规范时间`
--     `不要往太复杂的想法去做 因为这些就是很简单的东西 你要想想
--      他们不用system之前 手写肯定写不了那么多 那么细节`
--
-- 研究读回来的做法是 Square / Zenoti 那一套：把一个服务切成
-- `initial / processing / final` 三段，好让别人插进染发等待的那 35 分钟 ——
-- 而那**要重写我们最强的那条守卫**（`appointments` 那条资料库层的排他约束，
-- 今天保证同一个人同一个钟头不会排两笔）。[重点 31]：收紧最危险，
-- 而把一条挡死的规矩改成「只挡某几段」，是同一件事换个方向。
--
-- 🔴 **他把那个风险整个拿掉了**：不排时间，只记**谁做了这一段**。
-- 而那一句同时解掉了另一件研究列在第四位的事 ——
-- 「洗的是学徒、剪的是师傅，而抽成分不了」。**同一张表。**
--
-- ── 纸上长什么样，这张表就长什么样 ────────────────────────────────────────
--
-- 一间沙龙的日记簿，一次来访底下就是几行：
--
--     10:30  陈太太   洗       Ah Girl    12
--                     剪       师傅       38
--                     染       师傅      180
--
-- 四栏：做什么 · 谁做 · 多少钱 · 顺序。**没有时长、没有开始结束、没有段。**
-- 手写簿上没有的，这里也不要有。
--
-- ── 🔴 抽成：两个问题，不是同一个数字的两份 ──────────────────────────────
--
-- `staff_earnings`（20260905720000）算的是 `ledger_entries.done_by` ——
-- **谁收了这笔钱**。那在一个人的店里等於「谁做的」，在一间四个人的店里不是：
-- 柜台收钱的那一位，跟洗头的那一位，是两个人。
--
-- 所以这里**不去改那一支**（[重点 31] 第 1 条：不整支重写在跑的东西），
-- 而是多一支答另一个问题：
--
--     `staff_earnings`  谁**收了**多少钱   —— 收款那一边
--     `visit_earnings`  谁**做了**多少钱的活 —— 做工那一边，抽成问的是这个
--
-- 两个都是真的，而且它们本来就会不一样。**一份会漂的第二份定义**是
-- 同一个问题两个答案；这里是**两个问题**。
--
-- ⚠️ 而这一支**只数做完的那几次**（`status = 'done'`）——
-- 一个还没来的客人身上的抽成不是抽成，是一个愿望。

create table if not exists public.appointment_lines (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  appointment_id uuid not null references public.appointments(id) on delete cascade,

  /* 做什么 —— **他自己的话**（洗 · 剪 · 染 · 头皮护理），永远不是一个代号。
     跟 `appointments.service` 同一条：每一行生意卖法不一样。 */
  service text not null,

  /* 🔴 谁做的。**可以是空的** —— 走单客人进来的时候还没派人，
     而一个逼他当场指人的系统，会让他干脆不记。 */
  staff_id uuid references public.directory_entries(id) on delete restrict,

  /* 多少钱。**可以是空的** —— 剪完才讲价的店是真的存在。
     0 跟 null 是两句话：0 是「这一样不收钱」（洗头免费），
     null 是「还没讲」。 */
  price_cents bigint check (price_cents is null or price_cents >= 0),

  sort_order integer not null default 0,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  constraint appointment_lines_service_not_blank check (btrim(service) <> '')
);

create index if not exists appointment_lines_by_visit
  on public.appointment_lines (appointment_id, sort_order, created_at);
create index if not exists appointment_lines_by_staff
  on public.appointment_lines (project_id, staff_id);

alter table public.appointment_lines enable row level security;

drop policy if exists "appointment_lines_members" on public.appointment_lines;
create policy "appointment_lines_members" on public.appointment_lines
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

comment on table public.appointment_lines is
  'What was done in one visit and who did each part. No durations and no segments: the founder ruled that out on 2026-09-10 -- record who was responsible, do not schedule the gap. Also the answer to splitting commission between the junior who washed and the stylist who cut. See 20260910010000.';

-- ── 加一行 ────────────────────────────────────────────────────────────────

create or replace function public.add_visit_line(
  in_appointment_id uuid,
  in_service text,
  in_staff_id uuid default null,
  in_price_cents bigint default null
)
returns public.appointment_lines
language plpgsql
security definer
set search_path = public
as $$
declare
  appt public.appointments;
  seat integer;
  made public.appointment_lines;
begin
  select * into appt from public.appointments where id = in_appointment_id;
  if appt.id is null or not public.works_here(appt.project_id) then
    raise exception 'no such visit in your business';
  end if;
  if coalesce(btrim(in_service), '') = '' then
    raise exception 'say what was done';
  end if;
  if in_price_cents is not null and in_price_cents < 0 then
    raise exception 'a price cannot be less than nothing';
  end if;

  /* 🔴 那一位要真的是他店里的人 —— 靠名字配人正是 [任务 89] 量过
     会把钱记到另一个人头上的那件事，所以这里只收编号，而且要验。 */
  if in_staff_id is not null then
    perform 1 from public.directory_entries
     where id = in_staff_id and project_id = appt.project_id;
    if not found then
      raise exception 'that person does not work here';
    end if;
  end if;

  select coalesce(max(sort_order), -1) + 1 into seat
    from public.appointment_lines where appointment_id = in_appointment_id;

  insert into public.appointment_lines
    (project_id, appointment_id, service, staff_id, price_cents, sort_order, created_by)
  values (appt.project_id, in_appointment_id, left(btrim(in_service), 120),
          in_staff_id, in_price_cents, seat, auth.uid())
  returning * into made;
  return made;
end;
$$;

revoke execute on function public.add_visit_line(uuid, text, uuid, bigint)
  from public, anon;
grant execute on function public.add_visit_line(uuid, text, uuid, bigint)
  to authenticated;

-- ── 删一行 ────────────────────────────────────────────────────────────────
--
-- ⚠️ 这一支**真的删**，跟退货 · 调拨那几个「写一笔反的」不一样。
-- 理由：那几支背后是钱跟货的移动，删掉等於让历史说谎。
-- 这里一行还没有连到任何一笔钱、也没有动过任何库存 —— 它就是他打错的一行字。
-- （用掉染膏那一件走的是 `move_stock`，而**那一边**照旧不准删。）

create or replace function public.drop_visit_line(in_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  gone integer;
begin
  delete from public.appointment_lines l
   where l.id = in_id and public.works_here(l.project_id);
  get diagnostics gone = row_count;
  if gone = 0 then
    raise exception 'no such line on that visit';
  end if;
  return true;
end;
$$;

revoke execute on function public.drop_visit_line(uuid) from public, anon;
grant execute on function public.drop_visit_line(uuid) to authenticated;

-- ── 这一次做了哪几样 ──────────────────────────────────────────────────────

create or replace function public.visit_lines_of(in_appointment_id uuid)
returns table (
  id uuid,
  service text,
  staff_id uuid,
  staff_name text,
  price_cents bigint,
  sort_order integer
)
language sql
stable
security definer
set search_path = public
as $$
  select l.id, l.service, l.staff_id, coalesce(d.name, ''), l.price_cents, l.sort_order
    from public.appointment_lines l
    left join public.directory_entries d on d.id = l.staff_id
   where l.appointment_id = in_appointment_id
     and public.works_here(l.project_id)
   order by l.sort_order, l.created_at;
$$;

revoke execute on function public.visit_lines_of(uuid) from public, anon;
grant execute on function public.visit_lines_of(uuid) to authenticated;

-- ── 🔴 谁做了多少钱的活 ───────────────────────────────────────────────────

create or replace function public.visit_earnings(
  in_project_id uuid,
  /* 「2026-09」。跟 `staff_earnings` 同一个写法，同一个马来西亚月份。 */
  in_month text
)
returns table (
  staff_id uuid,
  name text,
  visits integer,
  lines integer,
  did_cents bigint
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  first_day date;
begin
  /* 🔴 `sees_money` —— 跟 `staff_earnings` 同一条。这一支回的是钱。 */
  if not public.sees_money(in_project_id) then
    return;
  end if;
  first_day := to_date(in_month || '-01', 'YYYY-MM-DD');

  return query
  select
    d.id,
    d.name,
    count(distinct a.id)::integer,
    count(*)::integer,
    coalesce(sum(l.price_cents), 0)::bigint
  from public.appointment_lines l
  join public.appointments a on a.id = l.appointment_id
  join public.directory_entries d on d.id = l.staff_id
  where l.project_id = in_project_id
    and a.archived_at is null
    /* ⚠️ 只数**做完的**。一个还没来的客人身上的抽成不是抽成，是一个愿望。 */
    and a.status = 'done'
    and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date >= first_day
    and (a.starts_at at time zone 'Asia/Kuala_Lumpur')::date
        < (first_day + interval '1 month')::date
  group by d.id, d.name
  order by coalesce(sum(l.price_cents), 0) desc, d.name;
end;
$$;

revoke execute on function public.visit_earnings(uuid, text) from public, anon;
grant execute on function public.visit_earnings(uuid, text) to authenticated;

comment on function public.visit_earnings(uuid, text) is
  'How much work each person actually did in a month, from the visit lines. Deliberately NOT the same question as staff_earnings, which sums who TOOK the money -- in a four-chair salon the person at the till and the person who washed are two different people, and commission is owed on the second. Only visits marked done. See 20260910010000.';
