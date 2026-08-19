-- Final-review fix: handle_new_account()'s lead_id resolution (Task 1,
-- supabase/migrations/20260818120000) could abort the whole auth.users
-- insert -- and therefore hard-fail signup -- on either a malformed or a
-- well-formed-but-nonexistent `lead_id` in the signup call's user metadata.
-- That metadata is fully client-controlled (it comes straight from the
-- public /signup?lead=<id> URL), so both failure modes are reachable by an
-- ordinary visitor, not just a malicious one. Replaces the function body
-- only -- the trigger itself (on_auth_user_created) still points at this
-- same function name, so it does not need to be recreated.
create or replace function public.handle_new_account()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  new_project_id uuid;
  each_page_key text;
  resolved_lead_id uuid;
begin
  begin
    resolved_lead_id := nullif(new.raw_user_meta_data ->> 'lead_id', '')::uuid;
  exception when invalid_text_representation then
    -- Malformed value (not a valid UUID at all) -- treat as "no lead"
    -- rather than aborting the signup.
    resolved_lead_id := null;
  end;

  if resolved_lead_id is not null then
    -- Well-formed but possibly nonexistent -- resolve via a lookup instead
    -- of letting accounts.lead_id's FK reject the insert. A miss here
    -- (id not found) leaves resolved_lead_id NULL.
    select id into resolved_lead_id from public.leads where id = resolved_lead_id;
  end if;

  insert into public.accounts (id, email, lead_id)
  values (
    new.id,
    new.email,
    resolved_lead_id
  );

  insert into public.projects (account_id)
  values (new.id)
  returning id into new_project_id;

  foreach each_page_key in array array['dashboard', 'customers', 'quotations', 'projects', 'payments']
  loop
    insert into public.project_pages (project_id, page_key)
    values (new_project_id, each_page_key);
  end loop;

  return new;
end;
$$;
