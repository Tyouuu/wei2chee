-- 真的插头炸了——`log_record_change()` 那一句 `the_label` 会拿一张表的栏位
-- 去问另一张表要，而它一直都会炸，只是炸不炸看运气。
--
-- ── 怎么发现的 ────────────────────────────────────────────────────────────
--
-- 建审计日志分身分（20260911150000）的尺子第一次呼叫 `update_pipeline_record`
-- 就半路炸了：`record "old" has no field "name"`。先怀疑是自己那一栏
-- `via_ai` 加错了，拿掉重测——**跟 via_ai 一点关系都没有**：
-- 直接用 admin 权限对 `pipeline_records` 做一次最原始的 `update`
-- （不经过任何 RPC，不带任何自订头），一样炸；对 `directory_entries`
-- 做同一件事，炸的是另一句（`old` has no field "doc_no"）——
-- **两张表，两种炸法，而且一连三次用全新的连线试，一次都没有绕过去**。
--
-- ── 为什么会这样 ─────────────────────────────────────────────────────────
--
-- `the_label := case which when 'directory' then coalesce(old.name, new.name, '')
--   else btrim(coalesce(old.doc_no, new.doc_no,'') || ' ' || ...) end;`
--
-- 这不是一句 plpgsql 的流程控制（`case ... when ... then <一串指令>`），
-- 是一句**赋值**，右手边整句会被送进资料库的查询规划器当一句 SQL 处理——
-- 而 SQL 的 CASE **要求每一个分支的栏位都真的存在**，不管最后走的是哪一支
-- （这跟一般程式语言的 if/else 不一样，SQL 是静态检查全部分支）。
-- `record_changes` 的触发器同一支挂在三张栏位完全不同的表上
-- （`pipeline_records` · `directory_entries` · `ledger_entries`），
-- 於是 `old`/`new` 到底是哪张表的形状，只有真的触发那一刻才知道——
-- 而这一句里三张表的栏位全部写在同一句表达式里，资料库一律要它们
-- 都存在。101 笔历史资料证明它**曾经**成功过（连线怎么被前一个呼叫
-- 排到哪一条快取路径，运气会变），但 20260911150000 重新整支函式之后，
-- 现在这一刻是**每一次都炸，不是偶尔**——不管哪张表先炸，**这三张表的
-- 每一笔修改、每一笔删除，从今天起都可能因为这一句半路失败**。
--
-- ── 怎么补 ────────────────────────────────────────────────────────────────
--
-- `to_jsonb(old)->>'name'`——`to_jsonb()` 吃任何一种表的列都不会炸
-- （它是真的多态函式，不是在问一个固定的栏位名），查不到那把 key
-- 就回 null，不会抛例外。下面这个迴圈（`execute format(...)`）本来就
-- 没有这个问题——它是动态 SQL，`f` 这个栏位名保证是 `which` 那张表
-- 自己的清单里挑出来的，每次重新规划，不会被这个问题咬。
-- 🔴 只改 `the_label` 那五行，其余一个字不动（[重点 31] 第 1 条）。

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
           end;
  if which is null then
    return coalesce(new, old);
  end if;

  acted_via_ai := coalesce(
    nullif(current_setting('request.headers', true), '')::json->>'x-formae-actor',
    ''
  ) = 'assistant';

  /* 🔴 这五行是这一支的修补：改成 to_jsonb()->>'field'，不再用
     old.field / new.field 直接点栏位名——那种写法要求 SQL 引擎
     替全部分支的栏位存在与否做静态检查，而这支触发器同时服务
     三张栏位不同的表，静态检查在这里永远是错的路。 */
  the_label := case which
                 when 'directory' then coalesce(
                   to_jsonb(old)->>'name', to_jsonb(new)->>'name', ''
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
