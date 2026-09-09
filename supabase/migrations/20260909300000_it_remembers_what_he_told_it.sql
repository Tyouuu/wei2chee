-- 助手记得住他讲过的话 —— **关掉分页也还在**。
--
-- ── 为什么（[任务 323](../docs/founder-tasks.md#323) 自己留下的第一行）──────
--
-- 他 2026-09-09 讲 `我要那种很智能的后台system 的ai 助手`。
-- 而今天那三轮对话**活在一个分页里**：他纠正过它一次（「Madam Chong 不要翻成
-- 陈太太」）、讲过一次他的规矩（「合发那家都是三十天付款」）——
-- 明天早上开电脑，两句都不在了，他要再讲一次。
--
-- 一个每天忘记你纠正过什么的助手，用三个礼拜就会被丢掉，
-- 而那正是 [重点 9c](../docs/founder-points.md) 那张表里最浅的一层：
-- **功能好、好用、稳 —— 换一家一样好用的就没了。** 记性不一样：
-- 他教了半年的那一个，换一家就要从头教起。
--
-- ── 🔴 读了 mem0（64,990 ★ · Apache-2.0），拿三条做法，不接它 ──────────────
--
-- 它是 embedding ＋ BM25 ＋ 实体连结那一整套，为**几万条**记忆做的检索。
-- 一间店的记忆是**几十条**，而几十条全部送进去比一套检索**又便宜又准**
-- （[重点 7d-2](../docs/founder-points.md)：找更简单的那一个做法）。
-- 所以这里没有检索、没有向量、没有第二个服务。
--
-- 拿它三条：
--   ① **只加不覆盖** —— 他改口了就是**多一条**，旧那一条留着（`archived_at`
--      是他自己按掉的，不是被新的一条挤掉的）。一条被静静改写的记忆，
--      跟一条没有记过的记忆，在画面上长得一模一样
--   ② **做成了的事实优先** —— 从一次**真的写进他帐里**的动作上留下来的那几条，
--      排在只是嘴上讲过的前面（`landed`）
--   ③ **注入成一段带标题的话** —— 不是一堆散句，见 `live-answers.ts`
--
-- ── 🔴 谁写得了、代价是什么 ───────────────────────────────────────────────
--
-- `works_here`，跟助手自己同一条：一个师傅也在用那个助手，
-- 而「我讲的『装好了』是指师傅走了，不是收了钱」就该记得住。
--
-- ⚠️ **代价写出来**（[重点 30] 第 4 步）：一个员工因此写得进老板的助手会读到
-- 的那一段话。今天没有第三种角色（[任务 84] 判过：一个人都还没有两个员工的
-- 时候做权限表格是照想像做的），而**第二个员工出现那天，这一条要单独收紧一次**。
-- 那一天可以做的最小的一件：多一栏「谁讲的」（已经有 `said_by`），
-- 老板那一份只读老板自己那几条。
--
-- 🔴 而**钱不会经过这里**：这张表上只有一句他自己打的话，没有金额、没有连到
-- 任何一张单。它不是一个新的资料来源，是一段**他自己写的备忘**。

create table if not exists public.assistant_facts (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,

  /* 他讲的那一句，**原样**。不摘要、不改写 —— 一句被我压缩过的话，
     下次注进去的时候已经不是他讲的那一句了。 */
  body text not null,

  /* 🔴 这一条是从一次**真的做成了的动作**上留下来的吗（mem0 第 ② 条）。
     「照上次那样再开一张」做成了之后记下来的，比一句「以后都这样」可信 ——
     前者有一张单在旁边站着。 */
  landed boolean not null default false,

  /* 他当时在哪一页讲的。**不是用来筛选**（几十条全部送进去），
     是用来讲给他听：「你在收款那一页跟我讲过」。 */
  page_key text not null default '',

  said_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),

  /* 他自己按掉的。**不删** —— 见档头 ①。 */
  archived_at timestamptz,

  /* 同一句话记两次没有意义。`md5(小写去空白)`，一家一份。 */
  fingerprint uuid not null,

  constraint assistant_facts_body_not_blank check (btrim(body) <> ''),
  constraint assistant_facts_body_not_long check (length(body) <= 400),
  constraint assistant_facts_one_of_each unique (project_id, fingerprint)
);

create index if not exists assistant_facts_by_project
  on public.assistant_facts (project_id, landed desc, created_at desc)
  where archived_at is null;

alter table public.assistant_facts enable row level security;

drop policy if exists "assistant_facts_members" on public.assistant_facts;
create policy "assistant_facts_members" on public.assistant_facts
  for all to authenticated
  using (public.works_here(project_id))
  with check (public.works_here(project_id));

comment on table public.assistant_facts is
  'What the owner has told the assistant that should outlive the tab: corrections, house rules, the way he says things. Append-only in spirit -- a change of mind is a new row, and the old one stays until he puts it away. No retrieval, no embeddings: a shop has dozens of these, and dozens fit in the prompt whole. See 20260909300000.';

-- ── 记住这一句 ────────────────────────────────────────────────────────────

create or replace function public.remember_this(
  in_project_id uuid,
  in_body text,
  /* 这一条是从一次真的做成了的动作上留下来的吗。见表的注解 ②。 */
  in_landed boolean default false,
  in_page_key text default ''
)
returns public.assistant_facts
language plpgsql
security definer
set search_path = public
as $$
declare
  said text;
  made public.assistant_facts;
  key uuid;
begin
  if not public.works_here(in_project_id) then
    raise exception 'not your business';
  end if;

  said := btrim(coalesce(in_body, ''));
  if said = '' then
    raise exception 'say what to remember';
  end if;
  if length(said) > 400 then
    raise exception 'that is too long to remember in one line';
  end if;

  key := md5(lower(regexp_replace(said, '\s+', ' ', 'g')))::uuid;

  /* 🔴 记过了就把原来那一条还回来，**不开第二条**，也不覆盖它 ——
     他按第二下（或者模型同一轮讲两次）不该在那一段话里出现两次。
     ⚠️ 而 `landed` 只往上走：一句先被嘴上讲过、后来真的做成了的话，
     是同一句话的更强版本；反过来把它降回去，等於让最后一次呼叫赢，
     而那不是这一栏在讲的事。 */
  select * into made from public.assistant_facts
   where project_id = in_project_id and fingerprint = key;
  if made.id is not null then
    update public.assistant_facts
       set landed = made.landed or coalesce(in_landed, false),
           archived_at = null
     where id = made.id
    returning * into made;
    return made;
  end if;

  insert into public.assistant_facts
    (project_id, body, landed, page_key, said_by, fingerprint)
  values (
    in_project_id, said, coalesce(in_landed, false),
    left(btrim(coalesce(in_page_key, '')), 60), auth.uid(), key
  )
  returning * into made;

  return made;
end;
$$;

revoke execute on function public.remember_this(uuid, text, boolean, text)
  from public, anon;
grant execute on function public.remember_this(uuid, text, boolean, text)
  to authenticated;

comment on function public.remember_this(uuid, text, boolean, text) is
  'Stores one sentence the owner wants the assistant to keep. Saying the same thing twice returns the row already there rather than making a second one, and `landed` only ever rises. See 20260909300000.';

-- ── 别再记着了 ────────────────────────────────────────────────────────────

create or replace function public.forget_that(in_id uuid)
returns public.assistant_facts
language plpgsql
security definer
set search_path = public
as $$
declare
  row public.assistant_facts;
begin
  update public.assistant_facts f
     set archived_at = now()
   where f.id = in_id
     and public.works_here(f.project_id)
  returning * into row;
  if row.id is null then
    raise exception 'no such note in your business';
  end if;
  return row;
end;
$$;

revoke execute on function public.forget_that(uuid) from public, anon;
grant execute on function public.forget_that(uuid) to authenticated;

comment on function public.forget_that(uuid) is
  'Puts one remembered sentence away. Archives rather than deletes -- what he told the assistant is history, not a row that may vanish. See 20260909300000.';

-- ── 它记得的那几句 ────────────────────────────────────────────────────────

create or replace function public.assistant_memory(
  in_project_id uuid,
  /* 上限。**送进去的是全部，不是搜出来的几条**（见档头）——
     这个数字只是防一个记了三年的帐号把提示撑爆。 */
  in_limit integer default 40
)
returns table (
  id uuid,
  body text,
  landed boolean,
  page_key text,
  said_on date
)
language sql
stable
security definer
set search_path = public
as $$
  select f.id, f.body, f.landed, f.page_key,
         (f.created_at at time zone 'Asia/Kuala_Lumpur')::date
    from public.assistant_facts f
   where f.project_id = in_project_id
     and f.archived_at is null
     and public.works_here(f.project_id)
   /* 做成了的排前面（mem0 第 ② 条），然后是新的。
      ⚠️ 截断从**尾巴**截，所以被截掉的永远是「只是讲过、而且最旧」那几条。 */
   order by f.landed desc, f.created_at desc
   limit greatest(1, least(coalesce(in_limit, 40), 200));
$$;

revoke execute on function public.assistant_memory(uuid, integer) from public, anon;
grant execute on function public.assistant_memory(uuid, integer) to authenticated;

comment on function public.assistant_memory(uuid, integer) is
  'Everything the assistant has been told to keep, acted-on first, newest next. Read whole into the prompt -- there is no retrieval step. See 20260909300000.';
