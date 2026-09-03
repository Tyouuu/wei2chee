-- 一家公司走的时候，那本帐不要拦着它。
--
-- ── 资料库自己讲的 ────────────────────────────────────────────────────────
--
-- 20260904170000 那支探针问出来的原话：
--
--   23503 | insert or update on table "record_changes"
--          violates foreign key constraint "record_changes_project_id_fkey"
--
-- **那是我昨天自己造的。** 删一个 auth 使用者会往下 cascade：
-- accounts → projects → pipeline_records，而 `log_record_change` 的
-- AFTER DELETE 会替每一行写一笔「deleted」——
-- 而那一笔的 `project_id` 指着**同一句里已经被删掉的那个 project**。
--
-- 於是：**一家公司被它自己的稽核帐拦住，关不掉。**
--
-- ⚠️ 而 `supabase db push` 一直是成功的，单元测试 951 条全绿，
-- `check:records` 253 条全绿 —— 因为**没有一条在删一整家公司**。
-- 抓到它的是去数了一次资料库：46 个帐号，45 个是我自己的
-- （[重点 26](docs/founder-points.md)：判一张表对不对，是拿真的帐号去乱按）。
--
-- ── 修法：公司不在了，就没有人要读那本帐了 ────────────────────────────────
--
-- 不是把那条外键放宽（那会留下一堆指着空气的稽核行），
-- 是**问一句这家公司还在不在**。删一整家的时候它已经不在了，那就不记。
--
-- 单独删一行的时候公司当然还在，所以那一笔照记 ——
-- `check:records` 里那几条「删一张单会记一笔」照样是绿的，而那才是证据。

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
  pid uuid;
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

  /* 🔴 这家公司还在不在。
     整家一起被删掉的时候，这一行的 project 已经在同一句里没了 ——
     再往一本挂在它身上的帐写一笔，就是那个 23503。
     而且它讲得通：**公司都不在了，没有人要读那本帐。** */
  pid := coalesce(a ->> 'project_id', b ->> 'project_id')::uuid;
  if pid is null or not exists (select 1 from public.projects p where p.id = pid) then
    return coalesce(new, old);
  end if;

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
    values (pid, which, (b ->> 'id')::uuid,
            left(the_label, 200), 'deleted', 'yes', null, auth.uid());
    return old;
  end if;

  fields := case which
              when 'pipeline' then array['title', 'party', 'amount_cents', 'stage', 'due_on', 'site_address_id']
              when 'directory' then array['name', 'phone', 'whatsapp', 'email', 'status']
              else array['amount_cents', 'entry_on', 'party', 'note']
            end;

  foreach f in array fields
  loop
    before_val := b ->> f;
    after_val := a ->> f;
    if before_val is distinct from after_val then
      insert into public.record_changes (project_id, entity, entity_id, label, field, was, now_is, changed_by)
      values (pid, which, (a ->> 'id')::uuid,
              left(the_label, 200), f,
              left(before_val, 400), left(after_val, 400), auth.uid());
    end if;
  end loop;

  return new;
end;
$$;

-- ── 那支探针的活干完了 ────────────────────────────────────────────────────
--
-- 20260904170000 留在历史里（它就是「我怎么查出来的」那份记录），
-- 但那支函式不留在资料库里 —— 一支会删使用者的函式，没有理由多活一天。

drop function if exists public.probe_delete_user(uuid);
