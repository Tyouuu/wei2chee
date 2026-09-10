-- 预约也进审计日志了——今天只有走单·名册·收款三张表有历史，预约没有。
--
-- ── 为什么（[任务 347] 第二点：改状态没有留下改之前是什么）───────────────
--
-- 老板问「陈太太那一笔是谁取消的」，今天答不出来——`record_changes`
-- （20260904020000）只挂在 `pipeline_records` / `directory_entries` /
-- `ledger_entries` 三张表上，`appointments` 从来没被接上去。而这正是
-- 他昨晚问「audit log 要分真人还是助手改的」（[任务 370]）那句话
-- 真正在问的范围——不是三张表，是**这门生意会写的每一张表**。
--
-- ── 只加一张表，不碰另外三张——[重点 31] 第 1 条 ─────────────────────────
--
-- `log_record_change()` 那份档头刚被 [任务 373] 修过一次真的会炸的
-- 坑：`the_label` 那句赋值把三张表的栏位全部写在同一句 CASE 表达式里，
-- 而 SQL 要求每一个分支引用的栏位都存在，不管走的是哪一支。补法是
-- `to_jsonb(old)->>'field'`——这一支从第一天就用这个写法，不再犯
-- 同一种「点栏位名」的错，加第四张表不会重演那次的坑。
--
-- ── 只记三栏，不是全部——跟原本那三张表同一条纪律 ─────────────────────────
--
-- 「只记人真的会改、而且改了要紧的那几栏」（档头原话）：`status`
-- （谁把它标成取消／没来／做完了）· `starts_at`（改期）· `staff_id`
-- （换了谁做）。`arrived_at` 不算「改」，是一个事实的记录，跟
-- `deposit_cents` 一样另有自己的地方看（前者是柜台按的按钮，
-- 后者钱本来就走 `ledger_entries`，不需要在这里重复一次）。
--
-- ── 预约今天没有真的删除路径 ──────────────────────────────────────────────
--
-- 取消是改 `status`，不是 `delete from appointments`——DELETE 分支
-- 理论上接得住（触发器一样挂），但今天没有任何函式会真的删一笔预约，
-- 这条分支只是跟另外三张表一样留着，不是这一支特别为它写的。

alter table public.record_changes
  drop constraint if exists record_changes_entity_check;
alter table public.record_changes
  add constraint record_changes_entity_check
  check (entity in ('pipeline', 'directory', 'ledger', 'appointment'));

drop trigger if exists appointments_log_trg on public.appointments;
create trigger appointments_log_trg
  after update or delete on public.appointments
  for each row execute function public.log_record_change();

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
    insert into public.record_changes (project_id, entity, entity_id, label, field, was, now_is, changed_by, via_ai)
    values (old.project_id, which, old.id, left(the_label, 200), 'deleted', 'yes', null, auth.uid(), acted_via_ai);
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
      insert into public.record_changes (project_id, entity, entity_id, label, field, was, now_is, changed_by, via_ai)
      values (new.project_id, which, new.id, left(the_label, 200), f,
              left(before_val, 400), left(after_val, 400), auth.uid(), acted_via_ai);
    end if;
  end loop;

  return new;
end;
$$;

comment on function public.log_record_change() is
  'Shared audit trigger across pipeline_records, directory_entries, ledger_entries, and now appointments. See 20260911300000 for why appointments joined, and 20260911160000 for why the_label uses to_jsonb()->>field rather than direct dot access.';
