-- `column reference "site_slug" is ambiguous`
--
-- The function took a parameter called `site_slug` and then selected from a
-- table with a COLUMN called `site_slug`, so plpgsql could not tell which one
-- `where p.site_slug = site_slug` meant. It resolved to neither and raised
-- 42702 on the first real submission -- found by filling the form on the live
-- published page rather than by reading the SQL, which is the only way this
-- class of bug is ever found.
--
-- Renamed rather than qualified: `where p.site_slug = p_slug` is unambiguous
-- and stays unambiguous when somebody adds a column next year, while
-- `where p.site_slug = submit_site_enquiry.site_slug` is correct and unreadable.
--
-- DROP first. `create or replace` matches on argument TYPES and refuses to
-- rename a parameter, so replacing in place would have failed and left the
-- broken body live.

drop function if exists public.submit_site_enquiry(text, text, text, jsonb);

create function public.submit_site_enquiry(
  p_slug text,
  p_name text,
  p_contact text,
  p_answers jsonb default '{}'::jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  target uuid;
  recent int;
begin
  if coalesce(trim(p_name), '') = '' or coalesce(trim(p_contact), '') = '' then
    return 'incomplete';
  end if;

  if length(p_name) > 120 or length(p_contact) > 120
     or length(p_answers::text) > 4000 then
    return 'too_long';
  end if;

  select p.id into target
  from public.projects p
  where p.site_slug = p_slug
    and p.site_published = true;

  -- Deliberately the same answer as a slug that does not exist: telling a
  -- caller "this site exists but is not published" says something about
  -- somebody else's business.
  if target is null then
    return 'not_found';
  end if;

  select count(*) into recent
  from public.site_enquiries e
  where e.project_id = target
    and e.created_at > now() - interval '1 minute';

  if recent >= 5 then
    return 'too_many';
  end if;

  insert into public.site_enquiries (project_id, lands_in, name, contact, answers)
  values (
    target,
    coalesce(
      (select a.enquiry ->> 'lands_in'
       from public.accounts ac
       join public.analysis_results a on a.lead_id = ac.lead_id
       where ac.id = (select pr.account_id from public.projects pr where pr.id = target)
       order by a.generated_at desc
       limit 1),
      'customers'
    ),
    trim(p_name),
    trim(p_contact),
    coalesce(p_answers, '{}'::jsonb)
  );

  return 'ok';
end;
$$;

revoke execute on function public.submit_site_enquiry(text, text, text, jsonb) from public;
grant execute on function public.submit_site_enquiry(text, text, text, jsonb) to anon, authenticated;
