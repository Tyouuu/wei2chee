-- 谁改了什么，改之前是什么。
--
-- ── 为什么现在做 ──────────────────────────────────────────────────────────
--
-- 20260901010000 之前这个系统只有一个人，所以「谁改的」只有一个答案。
-- 员工帐号一落地，那一句就有第二个答案了 —— 而老板打开一张报价单看到
-- RM 38,000，记得自己写的是 48,000，今天**没有任何地方**答得出发生过什么。
--
-- ── 读的是他自己的表 ──────────────────────────────────────────────────────
--
-- `Tyouuu/vibe-dealer`（他第一门生意，真的钱在跑）的
-- `0005_statement_revisions` · `0006_dealer_rate_history` · `0007_audit_hardening`。
-- 那三支的形状一模一样，而且他自己把理由写在档头上：
--
--   「saveStatement upserts company_statements, so editing a month's numbers a
--    second time silently overwrites the first — no record of what it used to
--    say or who changed it. This adds an append-only log: every save inserts a
--    revision row here (company_statements itself is unchanged).」
--
-- 抄的四件：
--   ✅ **只加不改的一张表，摆在旁边** —— 原本那张表一个字都不动
--   ✅ **改之前跟改之后放在同一行**（`old_rate` / `new_rate`）
--   ✅ **`changed_by`**
--   ✅ 按时间倒着建索引 —— 那一页问的就是「最近发生了什么」
--
-- ── 一张，不是五张 ────────────────────────────────────────────────────────
--
-- 他写了三张（rate history · statement revisions · transactions），
-- 因为那三样的栏位本来就不一样。我们不是：这里每一条都是同一句话 ——
-- **「这一行的这一栏，从这个变成那个」**。五张同样形状的表，
-- 是同一个 bug 有五个地方可以出。
--
-- ⚠️ 代价讲出来：值存成文字，所以**加不起来**。那是对的 ——
-- 没有人会去加总一本流水帐，他只会读它。
--
-- ── 🔴 触发器，不是写在那几支 RPC 里 ──────────────────────────────────────
--
-- 写在 RPC 里，只挡得住走 RPC 那条路。而这个仓库已经吃过一次亏：
-- [任务 43] 「`console_set_stage` 会把 paid 跟 stage 一起设、注解写着
-- 『永远不会不一致』—— 但那只是两条写入路径之一，**另一条是在 Supabase
-- Studio 手改**」，然后 dealer 那个 project 就卡在 stage='paid' 配 paid=false。
--
-- **一本只记得住老实人的帐，答不了它存在的那个问题。**
-- 触发器接得住每一条路：RPC · AI · 前端直写 · Studio 手改。

create table if not exists public.record_changes (
  id uuid primary key default gen_random_uuid(),

  project_id uuid not null references public.projects(id) on delete cascade,

  /* 哪一张表。不是外键 —— 一条历史不可以跟着被它记录的那一行消失，
     那正好是它最该讲话的时候。 */
  entity text not null check (entity in ('pipeline', 'directory', 'ledger')),
  entity_id uuid not null,

  /* 那一行当时叫什么。删掉之后 `entity_id` 就查不回来了，
     而「QT-2026-0067 被谁删掉了」是他真正要问的那一句。 */
  label text not null default '',

  /* 栏位名。存的是资料库的栏名，翻成人话是画面那一层的事
     （lib/portal/change-log.ts）—— 存一份翻好的字，等於把两种语言
     冻进一张只会变长的表。 */
  field text not null,

  /* 改之前 / 改之后。文字，因为金额 · 日期 · 名字混在同一栏。
     null 代表那时候是空的 —— 跟空字串不一样，而他看得出差别
     （「本来没有」跟「本来是空白」）。 */
  was text,
  now_is text,

  changed_by uuid references auth.users(id) on delete set null,

  created_at timestamptz not null default now()
);

comment on table public.record_changes is
  'Append-only: one row per field a person changed. Written by triggers, not by the RPCs, so a hand edit in Studio is caught too. Shape taken from vibe-dealer 0005/0006. See the header of 20260904020000.';
comment on column public.record_changes.label is
  'What the row was called at the time. The only way 「who deleted QT-2026-0067」 stays answerable after the row is gone.';

-- 「最近发生了什么」，跟他自己那三条索引同一个理由。
create index if not exists record_changes_recent_idx
  on public.record_changes (project_id, created_at desc);
create index if not exists record_changes_row_idx
  on public.record_changes (entity, entity_id, created_at desc);

-- ── 谁看得到 ──────────────────────────────────────────────────────────────
--
-- `sees_money()`。这本帐存在的理由是**老板看得到员工做了什么**，
-- 给员工读它既没有用、也不对。他自己那三张表也是只给 accountant / master。

alter table public.record_changes enable row level security;

drop policy if exists "record_changes_owner_reads" on public.record_changes;
create policy "record_changes_owner_reads" on public.record_changes
  for select using (public.sees_money(project_id));

/* 🔴 没有 insert / update / delete 的 policy，而那是故意的：
   **只有触发器写得进去**（security definer 绕过 RLS）。
   一个前端写得进去的稽核帐，是一个可以被伪造的稽核帐；
   一个删得掉的，连伪造都不用。 */

-- ── 写它 ──────────────────────────────────────────────────────────────────

create or replace function public.log_record_change()
returns trigger language plpgsql
security definer
set search_path = public
as $$
declare
  which text;
  the_label text;
  fields text[];
  f text;
  before_val text;
  after_val text;
begin
  which := case tg_table_name
             when 'pipeline_records' then 'pipeline'
             when 'directory_entries' then 'directory'
             when 'ledger_entries' then 'ledger'
           end;
  if which is null then
    return coalesce(new, old);
  end if;

  /* 那一行当时叫什么。删掉之后 entity_id 查不回来，而这一句要留得住。 */
  the_label := case which
                 when 'directory' then coalesce(old.name, new.name, '')
                 else btrim(
                   coalesce(old.doc_no, new.doc_no, '') || ' ' ||
                   case which
                     when 'pipeline' then coalesce(old.title, new.title, '')
                     else coalesce(old.note, new.note, '')
                   end
                 )
               end;

  if tg_op = 'DELETE' then
    insert into public.record_changes (project_id, entity, entity_id, label, field, was, now_is, changed_by)
    values (old.project_id, which, old.id, left(the_label, 200), 'deleted', 'yes', null, auth.uid());
    return old;
  end if;

  /* 只记人真的会改、而且改了要紧的那几栏。
     记全部，等於让他在二十行噪音里找那一行 —— 而找不到的帐等於没有帐。 */
  fields := case which
              when 'pipeline' then array['title', 'party', 'amount_cents', 'stage', 'due_on', 'site_address_id']
              when 'directory' then array['name', 'phone', 'whatsapp', 'email', 'status']
              /* 钱不给改，只给冲正（20260831100000）。所以 amount_cents 变了
                 就是有人绕过了那条规矩 —— **那正是这本帐存在的理由**。 */
              else array['amount_cents', 'entry_on', 'party', 'note']
            end;

  foreach f in array fields
  loop
    execute format('select ($1).%I::text, ($2).%I::text', f, f)
      into before_val, after_val
      using old, new;
    if before_val is distinct from after_val then
      insert into public.record_changes (project_id, entity, entity_id, label, field, was, now_is, changed_by)
      values (new.project_id, which, new.id, left(the_label, 200), f,
              left(before_val, 400), left(after_val, 400), auth.uid());
    end if;
  end loop;

  return new;
end;
$$;

/* AFTER，不是 BEFORE：BEFORE 的触发器可以改掉正在写的那一行，
   而一本改得动它记录的东西的帐，不是一本帐。 */
drop trigger if exists pipeline_records_log_trg on public.pipeline_records;
create trigger pipeline_records_log_trg
  after update or delete on public.pipeline_records
  for each row execute function public.log_record_change();

drop trigger if exists directory_entries_log_trg on public.directory_entries;
create trigger directory_entries_log_trg
  after update or delete on public.directory_entries
  for each row execute function public.log_record_change();

drop trigger if exists ledger_entries_log_trg on public.ledger_entries;
create trigger ledger_entries_log_trg
  after update or delete on public.ledger_entries
  for each row execute function public.log_record_change();

/* ⚠️ INSERT 故意不记。一张新开的单，它自己就是那条记录 ——
   而记一次「从无变成有」会让每一张单的历史第一行都是废话，
   然后他就不看那一栏了。`created_at` 已经答得了「什么时候开的」。 */
