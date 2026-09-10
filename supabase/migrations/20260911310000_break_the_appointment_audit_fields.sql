-- 故意弄坏：appointment 那一支的 fields 改成不含 status——看过它红。
-- 单独推、单独看红，见 20260911300000 档头。

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
              -- 🔴 故意拿掉 'status'，只留 starts_at 跟 staff_id
              when 'appointment' then array['starts_at', 'staff_id']
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
