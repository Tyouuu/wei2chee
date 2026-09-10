-- 找到了真正挡住删帐号的那一支——不是[任务 350] 那 44 栏，是审计触发器
-- 自己的写入，在层叠删除的路上撞上了它自己要连去的那一张表。
--
-- ── 怎么找到的 ────────────────────────────────────────────────────────────
--
-- 44 栏那支迁移（20260911390000）推上去之后，同一个最小重现
-- （只建一个客户，删那个帐号）**照样失败**——证明那 44 栏不是全部
-- 真相。直接对 `accounts` 那一行发一次真的 delete（不经过 Auth 那一层，
-- 它的错误讯息含糊），拿到了真的 Postgres 错误：
--
--   insert or update on table "record_changes" violates foreign key
--   constraint "record_changes_project_id_fkey"
--   Key (project_id)=(...) is not present in table "projects"
--
-- ── 为什么会这样 ─────────────────────────────────────────────────────────
--
-- 删帐号层叠到 `projects`，`projects` 层叠到 `directory_entries`，
-- `directory_entries` 那一行被删的那一刻，`log_record_change()` 的
-- DELETE 分支想帮它写一笔「这一行被删了」的历史——**而它要写进去的
-- `record_changes.project_id` 那时候已经跟着 `projects` 一起被删掉了**。
-- 同一次层叠删除里，两张表谁先谁后，触发器赌不赢。
--
-- ── 怎么补：一本记性不可以挡住它在记录的那件事 ───────────────────────────
--
-- 审计日志的立场从头到尾都是「观察，不挡任何一条写入路径」
-- （[重点 31]：收紧最危险，这支从来没打算挡人）。而层叠删除整个专案
-- 是老板真的要做的事——**审计日志不该是那件事做不成的理由**。
-- 只在这两句 insert 外面包一层：专门接住
-- `foreign_key_violation`（这个情况只会在专案本身也在同一刻被删的
-- 时候发生），接到了就跳过这一笔历史不记，其余的例外原样往上抛
-- （不要不小心把一个真的错也吞掉）。回圈本身、the_label、via_ai
-- 那一段，一个字不动。

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
  acted_via_ai boolean;
begin
  which := case tg_table_name
             when 'pipeline_records' then 'pipeline'
             when 'directory_entries' then 'directory'
             when 'ledger_entries' then 'ledger'
             when 'appointments' then 'appointment'
           end;
  if which is null then
    return coalesce(new, old);
  end if;

  acted_via_ai := coalesce(
    nullif(current_setting('request.headers', true), '')::json->>'x-formae-actor',
    ''
  ) = 'assistant';

  the_label := case which
                 when 'directory' then coalesce(
                   to_jsonb(old)->>'name', to_jsonb(new)->>'name', ''
                 )
                 when 'appointment' then btrim(
                   coalesce(to_jsonb(old)->>'party', to_jsonb(new)->>'party', '') || ' ' ||
                   coalesce(to_jsonb(old)->>'service', to_jsonb(new)->>'service', '')
                 )
                 else btrim(
                   coalesce(to_jsonb(old)->>'doc_no', to_jsonb(new)->>'doc_no', '') || ' ' ||
                   case which
                     when 'pipeline' then coalesce(to_jsonb(old)->>'title', to_jsonb(new)->>'title', '')
                     else coalesce(to_jsonb(old)->>'note', to_jsonb(new)->>'note', '')
                   end
                 )
               end;

  if tg_op = 'DELETE' then
    begin
      insert into public.record_changes (project_id, entity, entity_id, label, field, was, now_is, changed_by, via_ai)
      values (old.project_id, which, old.id, left(the_label, 200), 'deleted', 'yes', null, auth.uid(), acted_via_ai);
    exception when foreign_key_violation then
      -- 🔴 专案本身跟这一行同一刻被层叠删掉了——没有地方可以记这一笔，
      -- 而且也没有人会再读得到它。跳过，不挡这次删除。
      null;
    end;
    return old;
  end if;

  fields := case which
              when 'pipeline' then array['title', 'party', 'amount_cents', 'stage', 'due_on', 'site_address_id']
              when 'directory' then array['name', 'phone', 'whatsapp', 'email', 'status']
              when 'appointment' then array['status', 'starts_at', 'staff_id']
              else array['amount_cents', 'entry_on', 'party', 'note']
            end;

  foreach f in array fields
  loop
    execute format('select ($1).%I::text, ($2).%I::text', f, f)
      into before_val, after_val
      using old, new;
    if before_val is distinct from after_val then
      begin
        insert into public.record_changes (project_id, entity, entity_id, label, field, was, now_is, changed_by, via_ai)
        values (new.project_id, which, new.id, left(the_label, 200), f,
                left(before_val, 400), left(after_val, 400), auth.uid(), acted_via_ai);
      exception when foreign_key_violation then
        null;
      end;
    end if;
  end loop;

  return new;
end;
$$;

comment on function public.log_record_change() is
  'Shared audit trigger across pipeline_records, directory_entries, ledger_entries, and appointments. Its own writes never block a real deletion: if the project itself is being cascade-deleted in the same transaction, the history insert is skipped rather than raising. See 20260911300000 for why appointments joined, 20260911160000 for the to_jsonb()->>field fix, and 20260911410000 for why the insert cannot be allowed to fail a cascade.';

-- 探针用完了。
drop function if exists public.probe_remaining_fks();
