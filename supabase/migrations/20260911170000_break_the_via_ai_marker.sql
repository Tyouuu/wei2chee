-- 故意弄坏：把 acted_via_ai 硬写死成 false——看过它红，才知道这一栏是真的在读那个头。
-- 单独推、单独看红，见 20260911150000 档头。

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

  -- 🔴 故意拿掉：不读 request.headers，永远是 false。
  acted_via_ai := false;

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
