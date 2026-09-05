-- 下一步 —— 这一单，哪一天，要做什么。
--
-- ── 为什么是这一件，而不是再多一个模块 ────────────────────────────────────
--
-- 2026-09-05 读了四家的功能页（Zoho CRM · Pipedrive · Zoho Inventory ·
-- Odoo 库存 · Odoo 会计 · Linnworks），然后逐条去我们自己的库里查。
-- 🔴 **CRM · 库存 · 订单三类的骨干我们都有**，而他们四家真正在卖、
-- 我们整片空白的是**「下一步」那条回路** —— Pipedrive 整个产品
-- （`Processes, pipeline and activities`）就是这件事。
--
-- 量出来的：`follow_up` · `next_action` · `remind` 在这个仓库里
-- **SQL 零个档案、TS 零个档案**。
--
-- 一个承包商手上十二张报价单，今天没有任何地方写着**星期五要打给谁**。
-- 而八个行业开局只有四页共有（总览 · 客户 · 收款 · 官网）——
-- 这一件长在**走单 ＋ 总览**上，八个行业都碰得到。
--
-- ── 🔴 一张单只有一个「下一步」 ───────────────────────────────────────────
--
-- Pipedrive 一个 deal 挂得了很多活动。**我们不给。**
-- 「下一步」这三个字本身就是单数：一张报价单上挂五件待办，那不是下一步，
-- 那是一份专案计划 —— 而一个五个人的装修公司不写专案计划。
-- 做完一件，才写下一件。（唯一索引挡着，不是靠画面客气。）
--
-- ── 挂在单据上，不挂在人身上 ──────────────────────────────────────────────
--
-- Zoho 跟 Pipedrive 的活动可以挂在人、公司或者机会上。这里只挂**单据**：
-- 一封询价在这个产品里**按一下就变成一张单**（20260901，任务 89），
-- 所以「一个还没有任何单据的跟进」在这里几乎不存在。
-- 而挂在单据上同时答得了三种追：追报价 · 追工程 · 追钱。
-- ⚠️ 哪天真的要挂在人身上，那是**多一栏**，不是多一张表。
--
-- ── 逾期是算出来的 ────────────────────────────────────────────────────────
--
-- 同一件事今天准时、明天逾期，而没有人半夜去改那一栏。
-- 跟架上有几件 · 过期 · 帐龄 · 保养到期 · 里程 · 批号剩几件同一条判断
-- （这是第七次）。
--
-- ── 🔴 不自动替他生 ───────────────────────────────────────────────────────
--
-- 「报价单发出去三天没回就自动排一个跟进」听起来贴心，而那是**替他决定
-- 他要不要追这一单**。他自己写的那一句话（「打电话问决定了没有」）
-- 才是他明天真正会做的事；一句我们生出来的「跟进」他会一路按掉。
-- 跟额度不挡单 · 架上不够照样出货同一条：**讲事实，判断留给他。**

create table if not exists public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  record_id uuid not null references public.pipeline_records(id) on delete cascade,
  /* 他自己写的那一句话。**不给选单** —— 「打电话问决定了没有」
     跟「叫师傅去量尺寸」是两件完全不同的事，而一份下拉选单
     会把他真正要做的那件事挤掉。 */
  what text not null check (btrim(what) <> '' and length(what) <= 200),
  due_on date not null default public.today_myt(),
  done_at timestamptz,
  done_by uuid references auth.users(id) on delete set null,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

/* 🔴 一张单只有一个还没做完的下一步 —— 见档头。
   做完的那几件留着（那是他做过什么的纪录），所以条件只挡没做完的。 */
create unique index if not exists follow_ups_one_open_per_record
  on public.follow_ups (record_id) where done_at is null;

create index if not exists follow_ups_due_idx
  on public.follow_ups (project_id, due_on) where done_at is null;

alter table public.follow_ups enable row level security;

/* `works_here`，不是 `sees_money`：「明天去工地量尺寸」是师傅一天的工作。
   而追钱那一句挂在收款那一边的单上，师傅本来就打不开那一页。 */
drop policy if exists follow_ups_read on public.follow_ups;
create policy follow_ups_read on public.follow_ups
  for select using (public.works_here(project_id));

comment on table public.follow_ups is
  'The one next thing on a document: what, and which day. One open row per document -- 「next step」 is singular, and five of them is a project plan, which a five-person contractor does not write. Overdue is computed from due_on, never stored. See 20260905800000.';

-- ── 那一行属於那张单的那一家 ──────────────────────────────────────────────
--
-- 抄 20260903020000 的做法：一条外键挡不住「我的跟进挂到别人的单上」，
-- 因为两个 id 各自都是合法的。

create or replace function public.follow_ups_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $fn$
declare
  belongs uuid;
begin
  select r.project_id into belongs
  from public.pipeline_records r where r.id = new.record_id;
  if belongs is null or belongs <> new.project_id then
    raise exception 'that document is not in this project';
  end if;
  return new;
end;
$fn$;

drop trigger if exists follow_ups_own_project_trg on public.follow_ups;
create trigger follow_ups_own_project_trg
  before insert or update on public.follow_ups
  for each row execute function public.follow_ups_own_project();

-- ── 写下一步 ──────────────────────────────────────────────────────────────

create or replace function public.set_follow_up(
  in_record_id uuid,
  in_what text,
  in_due_on date default null
)
returns public.follow_ups
language plpgsql
security definer
set search_path = public
as $fn$
declare
  rec public.pipeline_records;
  row_out public.follow_ups;
begin
  select * into rec from public.pipeline_records r where r.id = in_record_id;
  if rec.id is null or not public.works_here(rec.project_id) then
    raise exception 'no such document';
  end if;
  if rec.archived_at is not null then
    raise exception 'that document is put away -- take it back out first';
  end if;
  if in_what is null or btrim(in_what) = '' then
    raise exception 'write what you are going to do';
  end if;

  /* 已经有一个还没做完的 → **改它**，不是开第二个。
     他改主意了（本来星期五打电话，现在变成先去量尺寸）是常态。 */
  update public.follow_ups
     set what = left(btrim(in_what), 200),
         due_on = coalesce(in_due_on, due_on)
   where record_id = in_record_id and done_at is null
  returning * into row_out;
  if found then return row_out; end if;

  insert into public.follow_ups (project_id, record_id, what, due_on, created_by)
  values (
    rec.project_id, in_record_id, left(btrim(in_what), 200),
    coalesce(in_due_on, public.today_myt()), auth.uid()
  )
  returning * into row_out;
  return row_out;
end;
$fn$;

revoke execute on function public.set_follow_up(uuid, text, date) from public, anon;
grant execute on function public.set_follow_up(uuid, text, date) to authenticated;

-- ── 做完了 ────────────────────────────────────────────────────────────────
--
-- ⚠️ **不删，盖一个时间章。** 他做过什么是纪录，而一份消失的跟进
-- 读起来像系统把它忘了。而且盖完章之后那张单就可以写下一个了
-- （唯一索引只挡没做完的）。

create or replace function public.finish_follow_up(in_id uuid)
returns public.follow_ups
language plpgsql
security definer
set search_path = public
as $fn$
declare
  row_out public.follow_ups;
begin
  update public.follow_ups f
     set done_at = now(), done_by = auth.uid()
   where f.id = in_id
     and f.done_at is null
     and public.works_here(f.project_id)
  returning * into row_out;
  if not found then
    raise exception 'no such follow-up, or it is already done';
  end if;
  return row_out;
end;
$fn$;

revoke execute on function public.finish_follow_up(uuid) from public, anon;
grant execute on function public.finish_follow_up(uuid) to authenticated;

-- ── 不跟了 ────────────────────────────────────────────────────────────────
--
-- 「做完了」跟「算了不追了」是两件事，而只给他一颗「做完」，
-- 他会拿它来关掉一件他其实没有做的事 —— 那本帐从此在说谎。

create or replace function public.drop_follow_up(in_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $fn$
begin
  delete from public.follow_ups f
   where f.id = in_id
     and f.done_at is null
     and public.works_here(f.project_id);
  if not found then
    raise exception 'no such follow-up, or it is already done';
  end if;
end;
$fn$;

revoke execute on function public.drop_follow_up(uuid) from public, anon;
grant execute on function public.drop_follow_up(uuid) to authenticated;

-- ── 今天要跟哪几件 ────────────────────────────────────────────────────────
--
-- 🔴 **逾期的排最前面。** 一个承包商打开系统的那一秒要看到的不是
-- 「今天有三件」，是「有一件昨天就该做而你没做」。

create or replace function public.follow_ups_due(
  in_project_id uuid,
  /* 看到哪一天为止。不给就是今天 —— 「这个礼拜要跟的」他自己往后拨。 */
  in_until date default null
)
returns table (
  id uuid,
  record_id uuid,
  module_key text,
  doc_no text,
  title text,
  party text,
  amount_cents bigint,
  what text,
  due_on date,
  days_late integer
)
language plpgsql
stable
security definer
set search_path = public
as $fn$
declare
  cutoff date;
begin
  if not public.works_here(in_project_id) then
    return;
  end if;
  cutoff := coalesce(in_until, public.today_myt());

  return query
  select f.id, f.record_id, r.module_key, r.doc_no, r.title, r.party, r.amount_cents,
         f.what, f.due_on,
         /* 逾期是**算出来的** —— 同一件事今天准时、明天逾期。 */
         greatest((public.today_myt() - f.due_on), 0)::integer
  from public.follow_ups f
  join public.pipeline_records r on r.id = f.record_id
  where f.project_id = in_project_id
    and f.done_at is null
    and r.archived_at is null
    and f.due_on <= cutoff
  order by f.due_on asc, r.amount_cents desc nulls last;
end;
$fn$;

revoke execute on function public.follow_ups_due(uuid, date) from public, anon;
grant execute on function public.follow_ups_due(uuid, date) to authenticated;

comment on function public.follow_ups_due(uuid, date) is
  'What has to be chased by that day, oldest first so the one he already missed is at the top. days_late is computed, never stored. See 20260905800000.';

-- ── 那一张单自己的下一步 ──────────────────────────────────────────────────

create or replace function public.follow_up_of(in_record_id uuid)
returns table (id uuid, what text, due_on date, days_late integer)
language plpgsql
stable
security definer
set search_path = public
as $fn$
begin
  return query
  select f.id, f.what, f.due_on,
         greatest((public.today_myt() - f.due_on), 0)::integer
  from public.follow_ups f
  join public.pipeline_records r on r.id = f.record_id
  where f.record_id = in_record_id
    and f.done_at is null
    and public.works_here(r.project_id)
  limit 1;
end;
$fn$;

revoke execute on function public.follow_up_of(uuid) from public, anon;
grant execute on function public.follow_up_of(uuid) to authenticated;
