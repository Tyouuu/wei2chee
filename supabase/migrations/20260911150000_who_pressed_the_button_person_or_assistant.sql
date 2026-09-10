-- 审计日志分得出「是人按的，还是助手按的」了 —— [任务 370] 他问的那一件。
--
-- ── 为什么两边要一起动，而这一支只做资料库那一半 ─────────────────────────
--
-- `record_changes`（20260904020000）早就接得住每一条写入路径，
-- 而 `changed_by` 存的是 `auth.uid()` —— [重点 23]（AI 平权）故意让助手
-- 走老板自己那个登入，跟他自己按按钮是同一个身分。好处是权限、防重复、
-- 审计全部自动一致；代价是今天这一栏分不出「他自己点的」跟
-- 「他叫助手做的」。硬开一个「助手专用帐号」会破掉那条线（变成第二条
-- 写入路径）。助手层那个 session 已经把设计传过来：**同一个身分上
-- 多带一个「这次是谁按的方向盘」的记号，不新开一条路**。
--
-- ── 先探针，再动手（[重点 26]：不准假设，一支都要真的打一次）──────────────
--
-- 助手层的提案用 `current_setting('request.headers', true)`，他们自己
-- 写着「没有对着这个专案的真实设定验证过」。已经用 20260911040000 那支
-- 探针打过一次真的 RPC：不带自订头的连线看不到它，带
-- `x-formae-actor: assistant` 的连线读得到那个值——**PostgREST 在这个
-- 专案上真的会把请求头递进这个 GUC**，不是假设。这一支收尾，探针拿掉。
--
-- ── 契约：一个头，一个字 ──────────────────────────────────────────────────
--
-- 请求头 `x-formae-actor: assistant`——只有助手那条伺服器端连线会送，
-- 人手动按的那条路（浏览器直连）什么都不用改，默认就是 `false`。
-- 🔴 `request.headers` 整包里带着 `authorization`（真的 JWT）——
-- 这支函式只取一个 key，从来不整包存进任何一张表。

drop function if exists public.probe_request_headers();

alter table public.record_changes
  add column if not exists via_ai boolean not null default false;

comment on column public.record_changes.via_ai is
  'True when this write carried the request header x-formae-actor: assistant -- the AI edit route sets it on its own server-side client, never on the customer''s own browser session. Same identity either way (auth.uid()), this only tags who was holding the wheel. See 20260911150000.';

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

  /* 只有助手那条伺服器端连线会送这个头，人手动按的那条路没有它。
     缺这个设定（例如不是从一次真的 HTTP 请求触发）也不报错——
     `current_setting(..., true)` 的第二个参数就是「查不到就回 null」。 */
  acted_via_ai := coalesce(
    nullif(current_setting('request.headers', true), '')::json->>'x-formae-actor',
    ''
  ) = 'assistant';

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
