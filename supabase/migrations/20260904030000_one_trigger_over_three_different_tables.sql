-- 一支触发器，三张长得不一样的表。
--
-- 20260904020000 的 `log_record_change` 里有这一句：
--
--     the_label := case which
--                    when 'directory' then coalesce(old.name, ...)
--                    else coalesce(old.doc_no, ...)
--                  end;
--
-- 读起来完全正确 —— 名册那一边看 `name`，别的看 `doc_no`。
--
-- 🔴 **而 plpgsql 不是那样跑的。** `old.name` 是在**执行**的时候解析的，
-- 而且不管那个 CASE 走哪一支都要解析得开。所以：
--
--     record "old" has no field "name"      ← 一笔收款被改的时候
--     record "old" has no field "doc_no"    ← 一个客户被改的时候
--
-- 而它炸掉的不是稽核那一行，是**那个人本来要做的那件事** ——
-- 改一张报价单、删一个客户，全部当场失败。
--
-- ⚠️ `supabase db push` 成功了。上一支的每一句 SQL 都是对的 SQL。
-- 抓到它的只有**拿真的帐号去乱按**（check:records，[重点 26]），
-- 而这已经是这个仓库第三次栽在同一件事上
-- （20260831060000 的 `missing FROM-clause entry`、
--   submit_site_enquiry 第一次真的有人填表时的 42702）。
--
-- 修法：不要按名字点栏位，**把整行转成 jsonb 再问**。
-- `to_jsonb(old) ->> 'name'` 对一张没有那一栏的表回 null，不会炸 ——
-- 而那正是这一支要的行为：三张表共用一支，问的东西各自不同。
--
-- 顺带一个好处：栏位比对那一段不用再 `execute format(...)` 动态组 SQL 了。

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
  b jsonb;
  a jsonb;
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

  b := to_jsonb(old);
  a := case when tg_op = 'DELETE' then null else to_jsonb(new) end;

  /* 那一行当时叫什么。删掉之后 entity_id 查不回来，而这一句要留得住。
     ⚠️ 用 jsonb 问，不用 old.name —— 见档头。 */
  the_label := btrim(
    case which
      when 'directory' then coalesce(b ->> 'name', a ->> 'name', '')
      else
        coalesce(b ->> 'doc_no', a ->> 'doc_no', '') || ' ' ||
        case which
          when 'pipeline' then coalesce(b ->> 'title', a ->> 'title', '')
          else coalesce(b ->> 'note', a ->> 'note', '')
        end
    end
  );

  if tg_op = 'DELETE' then
    insert into public.record_changes (project_id, entity, entity_id, label, field, was, now_is, changed_by)
    values ((b ->> 'project_id')::uuid, which, (b ->> 'id')::uuid,
            left(the_label, 200), 'deleted', 'yes', null, auth.uid());
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
    before_val := b ->> f;
    after_val := a ->> f;
    if before_val is distinct from after_val then
      insert into public.record_changes (project_id, entity, entity_id, label, field, was, now_is, changed_by)
      values ((a ->> 'project_id')::uuid, which, (a ->> 'id')::uuid,
              left(the_label, 200), f,
              left(before_val, 400), left(after_val, 400), auth.uid());
    end if;
  end loop;

  return new;
end;
$$;
