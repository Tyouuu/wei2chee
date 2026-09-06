-- 「发过什么」—— 而它是**已经发过了**，不是**待发**。
--
-- 🔴 我今天下午顶回去过一次，理由三条，而其中一条当天就被他推翻了：
--
--   我写：「今天唯一那种要排队的东西，是要讲给他客人听的 ——
--         而那一整类他自己还没决定要不要开口。」
--   他四十分钟前就决定了（任务 219）：`現在就要對客戶開放就是兩個都開放`。
--   → 那一条整条收回。剩下的两条重新判：
--       ① 没有投递管道 —— **还成立**，发给客人那一半今天发不出去（卡真号码）
--       ② 没有真的写它的人 —— 🔴 **不成立了**。「提醒陈太太明天三点」
--          **只在那一刻为真、不讲就丢掉**，那正是要排队的东西
--
-- 而任务 219 自己写下的落地清单里也有同一句：
-- **一个总开关 ＋ 一份「发过什么」。**
--
-- ⚠️ 所以这一支**不建投递**（那要号码），建的是两样今天就成立的：
--   1. **一份帐**：这个系统替他讲过的每一句话（讲给谁 · 几点 · 讲了什么）
--   2. **一个总开关**：以后自动发的东西，他随时关得掉
--
-- 🔴 而两者的关系有一条要写清楚，不然它会变成一个吃掉事实的闸门：
-- **开关挡的是「以后自动去发」，不是「记下他已经发过的」。**
-- 他刚刚亲手按了 WhatsApp 把对帐单发出去 —— 那件事已经发生了，
-- 一个因为开关关着而拒绝记下它的系统，是在丢掉事实。

create table if not exists public.message_settings (
  project_id uuid primary key references public.projects(id) on delete cascade,

  -- 他自己收不收。预设开 —— 一个默认不告诉他任何事的系统没有用。
  to_owner boolean not null default true,

  -- 🔴 他的客人收不收。**预设开，因为他 2026-09-06 拍板了**
  -- （`現在就要對客戶開放就是兩個都開放`）。
  -- ⚠️ 开着不等於发得出去 —— 今天没有号码，所以那一半会排在这里发不出去。
  -- 那不是这个开关的事，是任务 11 的事。
  to_customer boolean not null default true,

  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.message_settings enable row level security;

create or replace function public.message_settings_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;
  if not public.sees_money(new.project_id) then
    raise exception 'that project is not yours';
  end if;
  return new;
end;
$$;

drop trigger if exists message_settings_guard on public.message_settings;
create trigger message_settings_guard
  before insert or update on public.message_settings
  for each row execute function public.message_settings_own_project();

drop policy if exists message_settings_read on public.message_settings;
create policy message_settings_read on public.message_settings
  for select using (public.sees_money(project_id));


-- 🔴 一份帐，不是一个佇列。
-- 每一行是**这个系统替他讲过的一句话** —— 今天全部是他自己按 WhatsApp
-- 发出去、画面顺手记一笔；哪一天号码来了，自动发的那几条也落在同一张表，
-- 只是多一个 queued 的状态。**一张表，两种来源** ——
-- 不然「他到底讲了没有」会有两个答案。
create table if not exists public.messages (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  -- 讲给谁听。**只有两种**，因为整个产品只有两种人：
  -- 他自己，跟他的客人（任务 219 他拍板两边都开）。
  audience text not null check (audience in ('owner', 'customer')),

  -- 哪一件事。**不做列举** —— 它对应 nudges_due 那份会长的清单，
  -- 加上他自己按出去的那几种（对帐单 · 请款 · 报价）。
  kind text not null check (btrim(kind) <> '' and length(kind) <= 40),

  -- 讲的是哪一张单 · 哪一份合约 · 哪一张套票。**不做外键**，同一个理由：
  -- 它指得到好几张表。
  subject_id uuid,

  -- 讲给哪一个人。**这一栏有外键** —— 一个客人删掉了，这句话讲给谁
  -- 就再也答不出来，所以 set null 不是 cascade（跟「谁做的」那一条同一句：
  -- 人走了，历史要留着）。
  party_id uuid references public.directory_entries(id) on delete set null,

  -- 走哪一条路出去。in_app 是「只画在他自己的页上」，不出门。
  channel text not null default 'whatsapp'
    check (channel in ('whatsapp', 'email', 'in_app')),

  -- 🔴 **讲了什么，原话存下来。**
  -- 一份不记得自己讲过什么话的帐，答不了他打开它要问的那一句
  -- （「我上个月跟他讲的是三千还是三千五」）。
  body text not null check (btrim(body) <> '' and length(body) <= 2000),

  status text not null default 'sent'
    check (status in ('queued', 'sent', 'failed', 'cancelled')),

  sent_at timestamptz,
  -- 谁按的。自动发的那几条是 null —— **没有人按过**，
  -- 填一个人的 id 会让这本帐说谎（跟收款闸道那一笔同一条）。
  sent_by uuid references auth.users(id) on delete set null,
  fail_reason text check (fail_reason is null or length(fail_reason) <= 300),

  idempotency_key uuid,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

-- 🔴 **只有老板看得到，也只有老板写得进去。**
-- 理由是 body —— 那是一段自由文字，而这一行的自由文字里
-- 常常会有钱（「你还欠我 RM 45,500」）。
-- 一段文字里的金额**遮不掉**，所以整张表按钱那一条线画。
-- ⚠️ 代价写出来，不要等他发现：
-- **师傅今天去追一张借出去的桌子，追了没有记不下来** ——
-- 那是一个真的洞，等它有第二个人要用的时候再开（任务 41：
-- 一次是个案，两次才升级）。
create or replace function public.messages_own_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and not exists (select 1 from public.projects p where p.id = new.project_id) then
    return new;
  end if;
  if not public.sees_money(new.project_id) then
    raise exception 'that project is not yours';
  end if;
  return new;
end;
$$;

drop trigger if exists messages_guard on public.messages;
create trigger messages_guard
  before insert or update on public.messages
  for each row execute function public.messages_own_project();

drop policy if exists messages_read on public.messages;
create policy messages_read on public.messages
  for select using (public.sees_money(project_id));

create unique index if not exists messages_idempotency_idx
  on public.messages (project_id, idempotency_key)
  where idempotency_key is not null;

-- 「这一件事上一次讲是几时」—— 讯号那一支要问的就是这个。
create index if not exists messages_subject_idx
  on public.messages (project_id, kind, subject_id, created_at desc);

create index if not exists messages_recent_idx
  on public.messages (project_id, created_at desc);


-- 🔴 **一份逻辑，两道门** —— 跟收款闸道那一支同一个形状
-- （20260905730000：add_ledger_entry_core 一份，人按的跟闸道回呼各一道门）。
-- 这一支自己不检查权限，而且**一个人都不 grant**：外面只走得到下面那两支。
create or replace function public.record_message_core(
  in_project_id uuid,
  in_audience text,
  in_kind text,
  in_body text,
  in_subject_id uuid,
  in_party_id uuid,
  in_channel text,
  in_idempotency_key uuid,
  in_status text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.messages;
  aud text;
  chn text;
begin
  aud := lower(btrim(coalesce(in_audience, '')));
  if aud not in ('owner', 'customer') then
    raise exception 'say who it went to - the owner or the customer';
  end if;
  chn := lower(btrim(coalesce(in_channel, 'whatsapp')));
  if chn not in ('whatsapp', 'email', 'in_app') then
    raise exception 'that is not a way we can send it';
  end if;
  if nullif(btrim(coalesce(in_body, '')), '') is null then
    raise exception 'a message with no words is not a message';
  end if;

  -- 那个人一定要是这一家自己的人 —— 不然这一句会记在别人家的客人身上。
  if in_party_id is not null
     and not exists (
       select 1 from public.directory_entries d
       where d.id = in_party_id and d.project_id = in_project_id
     ) then
    raise exception 'that person is not in this book';
  end if;

  if in_idempotency_key is not null then
    select * into row from public.messages
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
    if found then
      return row;
    end if;
  end if;

  insert into public.messages (
    project_id, audience, kind, subject_id, party_id, channel, body,
    status, sent_at, sent_by, idempotency_key
  )
  values (
    in_project_id, aud, left(btrim(in_kind), 40), in_subject_id, in_party_id,
    chn, left(btrim(in_body), 2000),
    in_status,
    case when in_status = 'sent' then now() end,
    case when in_status = 'sent' then auth.uid() end,
    in_idempotency_key
  )
  returning * into row;
  return row;

exception
  when unique_violation then
    select * into row from public.messages
    where project_id = in_project_id and idempotency_key = in_idempotency_key;
    return row;
end;
$$;

revoke execute on function public.record_message_core(uuid, text, text, text, uuid, uuid, text, uuid, text)
  from public, anon, authenticated;


-- 门一：他刚刚亲手发出去了，记一笔。**这是今天唯一走得通的那一条路。**
-- ⚠️ 它**不问开关** —— 见档头：开关挡的是以后自动去发，
-- 不是记下已经发生的事。
create or replace function public.record_message_sent(
  in_project_id uuid,
  in_audience text,
  in_kind text,
  in_body text,
  in_subject_id uuid default null,
  in_party_id uuid default null,
  in_channel text default 'whatsapp',
  in_idempotency_key uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.sees_money(in_project_id) then
    raise exception 'that project is not yours';
  end if;
  return public.record_message_core(
    in_project_id, in_audience, in_kind, in_body, in_subject_id, in_party_id,
    coalesce(in_channel, 'whatsapp'), in_idempotency_key, 'sent'
  );
end;
$$;

revoke execute on function public.record_message_sent(uuid, text, text, text, uuid, uuid, text, uuid)
  from public, anon;
grant execute on function public.record_message_sent(uuid, text, text, text, uuid, uuid, text, uuid)
  to authenticated;


-- 排一条等着发。**今天没有任何东西会把它发出去** —— 它存在是为了
-- 号码来的那一天不用改写这张表，而且开关从第一天就在挡着。
-- ⚠️ 开关关着就**拒绝**，不是静静吞掉 —— 一个静静不发的佇列，
-- 跟一个发了的佇列，在画面上长得一模一样。
create or replace function public.queue_message(
  in_project_id uuid,
  in_audience text,
  in_kind text,
  in_body text,
  in_subject_id uuid default null,
  in_party_id uuid default null,
  in_channel text default 'whatsapp',
  in_idempotency_key uuid default null
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.messages;
  aud text;
  ok boolean;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'that project is not yours';
  end if;
  aud := lower(btrim(coalesce(in_audience, '')));
  if aud not in ('owner', 'customer') then
    raise exception 'say who it goes to - the owner or the customer';
  end if;

  select case when aud = 'owner' then s.to_owner else s.to_customer end
    into ok
  from public.message_settings s
  where s.project_id = in_project_id;

  -- 一家从来没有碰过那个开关的公司 —— 两边都是开的（那是预设）。
  if ok is null then
    ok := true;
  end if;
  if not ok then
    raise exception 'he has turned off the messages that go to the %', aud;
  end if;

  return public.record_message_core(
    in_project_id, aud, in_kind, in_body, in_subject_id, in_party_id,
    coalesce(in_channel, 'whatsapp'), in_idempotency_key, 'queued'
  );
end;
$$;

revoke execute on function public.queue_message(uuid, text, text, text, uuid, uuid, text, uuid)
  from public, anon;
grant execute on function public.queue_message(uuid, text, text, text, uuid, uuid, text, uuid)
  to authenticated;


-- 投递那一段回来讲结果。**今天没有人呼叫它** —— 它跟着上面那一支一起立，
-- 因为一个只进不出的佇列，第一天就会被人拿去当成「发过了」。
create or replace function public.mark_message_sent(
  in_message_id uuid,
  in_channel text default null
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.messages;
begin
  select * into row from public.messages where id = in_message_id;
  if not found then
    raise exception 'no such message';
  end if;
  if not public.sees_money(row.project_id) then
    raise exception 'that project is not yours';
  end if;
  if row.status = 'sent' then
    return row;
  end if;

  update public.messages
     set status = 'sent',
         sent_at = now(),
         sent_by = auth.uid(),
         channel = coalesce(lower(btrim(in_channel)), channel),
         fail_reason = null
   where id = in_message_id
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.mark_message_sent(uuid, text) from public, anon;
grant execute on function public.mark_message_sent(uuid, text) to authenticated;


create or replace function public.mark_message_failed(
  in_message_id uuid,
  in_reason text
)
returns public.messages
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.messages;
begin
  select * into row from public.messages where id = in_message_id;
  if not found then
    raise exception 'no such message';
  end if;
  if not public.sees_money(row.project_id) then
    raise exception 'that project is not yours';
  end if;

  update public.messages
     set status = 'failed',
         fail_reason = left(btrim(coalesce(in_reason, 'it did not go out')), 300)
   where id = in_message_id
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.mark_message_failed(uuid, text) from public, anon;
grant execute on function public.mark_message_failed(uuid, text) to authenticated;


-- 两边的开关。**一支函式管两个** —— 不给的那一个不动
-- （null 是「这一个别碰」，不是「关掉」）。
create or replace function public.set_message_settings(
  in_project_id uuid,
  in_to_owner boolean default null,
  in_to_customer boolean default null
)
returns public.message_settings
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.message_settings;
begin
  if not public.sees_money(in_project_id) then
    raise exception 'that project is not yours';
  end if;

  insert into public.message_settings (project_id, to_owner, to_customer, updated_by)
  values (
    in_project_id,
    coalesce(in_to_owner, true),
    coalesce(in_to_customer, true),
    auth.uid()
  )
  on conflict (project_id) do update
    set to_owner = coalesce(in_to_owner, public.message_settings.to_owner),
        to_customer = coalesce(in_to_customer, public.message_settings.to_customer),
        updated_at = now(),
        updated_by = auth.uid()
  returning * into row;
  return row;
end;
$$;

revoke execute on function public.set_message_settings(uuid, boolean, boolean) from public, anon;
grant execute on function public.set_message_settings(uuid, boolean, boolean) to authenticated;
