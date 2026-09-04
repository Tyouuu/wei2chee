/**
 * 保存不再收钱，而「交给我去建」变成一行写下来的记录。
 *
 * 老板 2026-09-05 拍板两件（任务 158 · 159 · 160）：
 *   `去除旧的概念吧` —— 那面写着「付钱才能保存你的设计」的墙
 *   `就按照你所说的去改`
 *
 * ── 一 · 为什么保存那道闸要拆 ────────────────────────────────────────────
 *
 * 「付钱才能保存你的设计」是 A' 那一套的话（RM500 规格书 ＋ 按模块开发费）。
 * 2026-09-03 定案换成**卖一套系统收年费**（重点 9c），而新的概念里
 * **没有人会为了保存一份草稿付钱** —— 他买的是我们帮他建那套系统，
 * 跟一年的维护。
 *
 * 而它真正的代价不在概念上，在那一秒钟上：一个老板花十分钟加页、删页、
 * 看到自己的系统，按下「交给我去建」——那颗按钮先呼叫保存，保存看到
 * 没付款，就把整片画布盖起来跟他要钱，而价钱还没有人讲过。
 * 重点 11 说那一屏就是产品；在那一屏上盖画面收钱，是把唯一一次
 * 他用眼睛判断我们的机会花掉。
 *
 * ⚠️ **代价摊开，不假装没有**：从今天起一个陌生人可以永远免费设计一套
 * 系统而不付钱。那正好是我们要的 —— **只要交接那条线真的收得到人**，
 * 而那就是下面第二件事存在的理由。付费的东西没有消失，它换了位置：
 * 我们卖的是「帮他建」跟年费，不是一份草稿。
 *
 * ⚠️ 两支函式都**整支重写**，不是 alter。plpgsql 到执行才解析名字
 * （重点 26），而这两支的 body 里还有版本历史那一整段逻辑 ——
 * 抄漏一段的下场，20260831080000 已经示范过一次（漏掉
 * unique_violation 那一段，按两下就报错）。
 *
 * ⚠️ `projects.paid` 这一栏**没有删**。它还有两个读者：console 算营收，
 * 跟 20260828010000 那条「stage='paid' 就一定 paid」的约束。
 * 它从今天起不再挡任何人保存，但它仍然记着「这一单收到钱了没有」。
 *
 * ── 二 · 为什么「交给我去建」要先写一行 ──────────────────────────────────
 *
 * 那颗按钮今天只开一个 WhatsApp 视窗。**客户没按送出，我们永远不知道
 * 有人交接过** —— 一则要客户自己按送出的讯息，就是一个会漏的漏斗，
 * 而它漏的正好是我们最看不见的那一次：他回家自己按的那一次。
 *
 * 上门那一群漏了还救得回来（人就在旁边）；**广告进来那一群，
 * 这一行是唯一的线索**。
 *
 * ── 三 · 为什么号码长在 projects 上 ──────────────────────────────────────
 *
 * 任务 48（2026-08-28）记着：客户帐号跟专案两张表**一个电话栏位都没有**，
 * 所以 console 那颗「联络客户」只能寄 email，而任务 40 那条
 * 「推一格通知客户」根本没有管道。这个市场的管道是 WhatsApp。
 *
 * 长在 `projects` 不长在 `accounts`：一个帐号将来可能有第二个专案，
 * 而「这一门生意的联络号码」是那门生意的属性，不是那个人的。
 *
 * ⚠️ **可以是空的，而且永远可以跳过**。注册那一刻不问（那会在
 * 「看到自己的系统」之前多一格，挡掉人 —— 重点 29），交接那一刻才问，
 * 因为那时候他已经做完设计、他自己想要我们联络他。
 * **就算他跳过，那一行照样写进去。**
 */

-- ── 一 · 保存不再收钱 ────────────────────────────────────────────────────

/**
 * 整支重写。跟 20260820220000 那一版逐字一样，只有中间那三行
 * （`is_paid` 的宣告 · select · 那个 raise）拿掉了。
 */
create or replace function public.save_project_page(target_page_key text, new_layout jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  previous jsonb;
  newest timestamptz;
begin
  select id into target_project_id
  from public.projects
  where account_id = auth.uid();

  if target_project_id is null then
    raise exception 'project not found';
  end if;

  select layout_json into previous
  from public.project_pages
  where project_id = target_project_id
    and page_key = target_page_key;

  if not found then
    raise exception 'page not found: %', target_page_key;
  end if;

  select max(created_at) into newest
  from public.page_versions
  where project_id = target_project_id
    and page_key = target_page_key;

  -- 节流跟上限一个字都没动，理由见 20260820220000：一分钟存二十次的
  -- 历史不是历史，是穿着历史衣服的杂讯。
  if previous is not null
     and previous <> '{}'::jsonb
     and previous is distinct from new_layout
     and (newest is null or newest < now() - interval '3 minutes')
  then
    insert into public.page_versions (project_id, page_key, layout_json)
    values (target_project_id, target_page_key, previous);

    delete from public.page_versions
    where project_id = target_project_id
      and page_key = target_page_key
      and id not in (
        select id from public.page_versions
        where project_id = target_project_id
          and page_key = target_page_key
        order by created_at desc
        limit 20
      );
  end if;

  update public.project_pages
  set layout_json = new_layout, updated_at = now()
  where project_id = target_project_id
    and page_key = target_page_key;
end;
$$;

revoke execute on function public.save_project_page(text, jsonb) from public;
revoke execute on function public.save_project_page(text, jsonb) from anon;
grant execute on function public.save_project_page(text, jsonb) to authenticated;

/**
 * 同一件事的另一半。一个还没付款的客户既然存得了，就一定要退得回去 ——
 * 一个存得进去、退不回来的编辑器，比不给存更糟。
 */
create or replace function public.restore_page_version(version_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  v_page_key text;
  v_layout jsonb;
  current_layout jsonb;
begin
  select id into target_project_id
  from public.projects
  where account_id = auth.uid();

  if target_project_id is null then
    raise exception 'project not found';
  end if;

  select page_key, layout_json into v_page_key, v_layout
  from public.page_versions
  where id = version_id
    and project_id = target_project_id;

  if v_page_key is null then
    raise exception 'version not found';
  end if;

  select layout_json into current_layout
  from public.project_pages
  where project_id = target_project_id
    and page_key = v_page_key;

  if current_layout is not null and current_layout <> '{}'::jsonb then
    insert into public.page_versions (project_id, page_key, layout_json)
    values (target_project_id, v_page_key, current_layout);
  end if;

  update public.project_pages
  set layout_json = v_layout, updated_at = now()
  where project_id = target_project_id
    and page_key = v_page_key;

  return v_layout;
end;
$$;

revoke execute on function public.restore_page_version(uuid) from public;
revoke execute on function public.restore_page_version(uuid) from anon;
grant execute on function public.restore_page_version(uuid) to authenticated;

-- ── 二 · 一个放得下客户号码的格子（任务 48，8-28 记着，一直没做）──────────

alter table public.projects
  add column if not exists contact_phone text;

alter table public.projects drop constraint if exists projects_contact_phone_len;
alter table public.projects add constraint projects_contact_phone_len
  check (contact_phone is null or char_length(contact_phone) between 5 and 40);

comment on column public.projects.contact_phone is
  '这门生意的联络号码，这个市场就是 WhatsApp。永远可选：交接那一刻问一格，跳得过。';

-- ── 三 · 交接留下一行 ────────────────────────────────────────────────────

create table if not exists public.handoff_requests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  -- 他想要的那个功能，我们库里没有的那一个。可以是空的：
  -- 「我看完了，就这样，帮我建」本身就是一次完整的交接。
  note text,
  created_at timestamptz not null default now()
);

alter table public.handoff_requests drop constraint if exists handoff_requests_note_len;
alter table public.handoff_requests add constraint handoff_requests_note_len
  check (note is null or char_length(note) <= 2000);

-- console 读的是「最近谁交接过」，所以索引按时间倒着。
create index if not exists handoff_requests_recent_idx
  on public.handoff_requests (created_at desc);

create index if not exists handoff_requests_project_idx
  on public.handoff_requests (project_id, created_at desc);

alter table public.handoff_requests enable row level security;

-- 客户读得到自己交接过几次（画面上要讲「已经交给我们了」）。
-- 写入**只走下面那支函式** —— 没有 insert policy，所以没有人伪造得了一行。
drop policy if exists handoff_requests_select_own on public.handoff_requests;
create policy handoff_requests_select_own on public.handoff_requests
  for select
  using (
    exists (
      select 1 from public.projects p
      where p.id = handoff_requests.project_id
        and p.account_id = auth.uid()
    )
  );

/**
 * 「交给我去建」按下去真正发生的事。
 *
 * 三件，顺序有意义：写下那一行 → 顺手记下号码 → 把交付状态推一格。
 * **WhatsApp 是这三件之后的第四件，而且它在浏览器那一端** ——
 * 讯息送不送得出去，都不影响老板在 console 上看得到。
 *
 * ⚠️ **只有老板自己按得了。** 一个师傅不该把老板的生意交接出去，
 * 所以这里问的是 `account_id = auth.uid()`，不是 works_here()。
 *
 * ⚠️ **按两下只留一行。** 同一段话在两分钟内重复送进来，回原本那一行，
 * 不新增。而两分钟之外的第二次是真的第二次请求（他先要 A、后来又要 B），
 * 那两行都该留着 —— 所以这里不用唯一索引，那会把真的第二次也挡掉。
 *
 * ⚠️ **状态只往前推一格，而且只从 designing 推。** 一个已经在 building
 * 的专案再按一次，不可以被推回 quoted —— 那是让 console 上的进度倒退，
 * 而老板是照那一栏决定今天做什么的。
 */
create or replace function public.request_handoff(
  in_note text default null,
  in_phone text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_project_id uuid;
  clean_note text;
  clean_phone text;
  existing_id uuid;
  new_id uuid;
begin
  select id into target_project_id
  from public.projects
  where account_id = auth.uid();

  if target_project_id is null then
    raise exception 'project not found';
  end if;

  -- 空白字串跟 null 是同一件事：他什么都没打。
  clean_note := nullif(btrim(coalesce(in_note, '')), '');
  clean_phone := nullif(btrim(coalesce(in_phone, '')), '');

  if clean_note is not null and char_length(clean_note) > 2000 then
    clean_note := left(clean_note, 2000);
  end if;

  -- 号码打得太短或太长，**不要整支拒绝** —— 他要交接的是一套系统，
  -- 不是一个号码。丢掉那一格，其余照走。
  if clean_phone is not null
     and char_length(clean_phone) between 5 and 40
  then
    update public.projects
    set contact_phone = clean_phone
    where id = target_project_id;
  end if;

  select id into existing_id
  from public.handoff_requests
  where project_id = target_project_id
    and note is not distinct from clean_note
    and created_at > now() - interval '2 minutes'
  order by created_at desc
  limit 1;

  if existing_id is not null then
    return existing_id;
  end if;

  insert into public.handoff_requests (project_id, note)
  values (target_project_id, clean_note)
  returning id into new_id;

  update public.projects
  set stage = 'quoted',
      stage_changed_at = now()
  where id = target_project_id
    and stage = 'designing';

  return new_id;
end;
$$;

revoke execute on function public.request_handoff(text, text) from public;
revoke execute on function public.request_handoff(text, text) from anon;
grant execute on function public.request_handoff(text, text) to authenticated;
