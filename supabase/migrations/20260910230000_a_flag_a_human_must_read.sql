-- 病史 · 禁忌 —— 一句红字提醒，不挡预约。
--
-- ── 为什么（2026-09-10 深度研究，[任务 341](../docs/founder-tasks.md#341)）────
--
-- MMC 的美容医学指引：医生要「pay particular attention to exclude, through
-- proper physical examination and relevant investigations, any pathological
-- or clinically morbid conditions … before embarking on a procedure」。
-- 客人真的出事、投诉到 MMC，「我们有口头问」不是抗辩，要有纪录。
--
-- 🔴 **而「问过」这件事，一半已经有了**：`request_consent` 送出去的同意书
-- 内文（20260909130000 那一套）本来就写着「I have disclosed any pregnancy,
-- allergy and medication」——**客人签名那一刻，就已经承认她被问过、
-- 也确认了她讲的是实话**。这一支补的是**另一半**：她讲出来的那句话，
-- 要**留在她的档案上、每一次治疗师打开都看得到**，不是签完就锁进同意书里。
--
-- ── 🔴 只做提醒，不做拦截 ─────────────────────────────────────────────────
--
-- 研究读遍十家：**只有 Zenoti 一家做结构化的禁忌症筛检并且拦住预约**，
-- 其余（Pabau · Cliniko · Nookal）全部是「客人照片下面一行红字」，
-- **人看得到，系统不拦**。Fresha 甚至讲明白「While bookings are not
-- blocked, these reminders help ensure the test is completed in time」。
--
-- 我们跟多数那一派——[重点 31](./founder-points.md)：收紧最危险，而且是
-- 在替她的诊所发明一条它没有的规矩。一个真的在诊所里的美疗师，客人已经
-- 躺在那里，系统告诉她「存不了」——那不是安全，那是她当天就不再用系统。
--
-- ── 只留一条现役的，旧的不删 ──────────────────────────────────────────────
--
-- 跟今晚 `assistant_facts` 同一条纪律：**只加不覆盖**。她改口了（怀孕的客人
-- 生完了）是撤销旧的、开一条新的，不是就地改字——旧的那一条**为什么**被
-- 收起来，跟是谁收的、几时收的，本身也是纪录的一部分。

create table if not exists public.party_alerts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  party_id uuid not null references public.directory_entries(id) on delete cascade,

  /* 她自己讲的那一句 —— 「怀孕，预产期十一月」「对 lidocaine 过敏」。
     跟同意书内文同一条：原话，不是我们发明的分类。 */
  body text not null,

  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  /* 收起来了，而且讲得出是谁、为什么。null = 现役。 */
  cleared_on timestamptz,
  cleared_by uuid references auth.users(id) on delete set null,
  cleared_reason text not null default '',

  constraint party_alerts_body_not_blank check (btrim(body) <> ''),
  constraint party_alerts_body_not_long check (length(body) <= 400)
);

/* 一个客人**最多一条现役** —— 跟客人照片下面那一行红字同一个形状，
   不是一份会长的清单。她的情况变了，先收起旧的，才挂新的。 */
create unique index if not exists party_alerts_one_active
  on public.party_alerts (party_id)
  where cleared_on is null;

create index if not exists party_alerts_by_project
  on public.party_alerts (project_id, party_id);

alter table public.party_alerts enable row level security;

drop policy if exists "party_alerts_members" on public.party_alerts;
create policy "party_alerts_members" on public.party_alerts
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

comment on table public.party_alerts is
  'A note that must be read before treating this person -- allergy, pregnancy, medication -- shown, never enforced. Only one active per party at a time, the way the photo-card red line works everywhere it is copied from; changing it clears the old one rather than editing it in place, so who cleared it and why stays on record. See 20260910230000.';

-- ── 挂一条 ────────────────────────────────────────────────────────────────

create or replace function public.set_party_alert(
  in_party_id uuid,
  in_body text
)
returns public.party_alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  who public.directory_entries;
  made public.party_alerts;
begin
  select * into who from public.directory_entries where id = in_party_id;
  /* 🔴 works_here —— 任何一个治疗师都要看得到、也要挂得上，
     这一整张表没有一分钱，见档头。 */
  if who.id is null or not public.works_here(who.project_id) then
    raise exception 'that person is not in your directory';
  end if;
  if coalesce(btrim(in_body), '') = '' then
    raise exception 'say what the alert is';
  end if;
  if length(in_body) > 400 then
    raise exception 'that is too long for an alert -- keep it to one line';
  end if;

  /* 先收起旧的那一条（如果有）—— 只加不覆盖，见档头。 */
  update public.party_alerts
     set cleared_on = now(), cleared_by = auth.uid(),
         cleared_reason = 'replaced'
   where party_id = in_party_id and cleared_on is null;

  insert into public.party_alerts (project_id, party_id, body, created_by)
  values (who.project_id, in_party_id, btrim(in_body), auth.uid())
  returning * into made;
  return made;
end;
$$;

revoke execute on function public.set_party_alert(uuid, text) from public, anon;
grant execute on function public.set_party_alert(uuid, text) to authenticated;

-- ── 收起来（她的情况不用再提醒了）──────────────────────────────────────────

create or replace function public.clear_party_alert(
  in_id uuid,
  in_reason text default ''
)
returns public.party_alerts
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.party_alerts;
begin
  update public.party_alerts a
     set cleared_on = now(), cleared_by = auth.uid(),
         cleared_reason = left(btrim(coalesce(in_reason, '')), 200)
   where a.id = in_id
     and a.cleared_on is null
     and public.works_here(a.project_id)
  returning * into row;
  if row.id is null then
    raise exception 'no active alert to clear';
  end if;
  return row;
end;
$$;

revoke execute on function public.clear_party_alert(uuid, text) from public, anon;
grant execute on function public.clear_party_alert(uuid, text) to authenticated;

-- ── 🔴 打开她的档案，那一句提醒在不在 ──────────────────────────────────────

create or replace function public.party_alert_of(in_party_id uuid)
returns table (
  id uuid,
  body text,
  set_on date
)
language sql
stable
security definer
set search_path = public
as $$
  /* ⚠️ 不带「谁挂的」——那一句会被读成「Amy 说她怀孕」，而实际上
     可能是柜台代客人打进去的字。挂的人是谁留在 `created_by` 那一栏，
     那是查证时才要问的问题，不是治疗前扫一眼要看到的东西。 */
  select a.id, a.body, (a.created_at at time zone 'Asia/Kuala_Lumpur')::date
    from public.party_alerts a
    join public.directory_entries d on d.id = a.party_id
   where a.party_id = in_party_id
     and a.cleared_on is null
     and public.works_here(d.project_id);
$$;

revoke execute on function public.party_alert_of(uuid) from public, anon;
grant execute on function public.party_alert_of(uuid) to authenticated;

comment on function public.party_alert_of(uuid) is
  'The one line staff must see before touching this person, or nothing. Empty is not silence-as-failure -- most people have nothing to flag, and an empty result here means exactly that, unlike owing/party_debts which distinguish "not asked" from "asked, nothing found". See 20260910230000.';
