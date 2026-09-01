-- supabase/migrations/20260901030000_which_business_am_i_standing_in.sql
--
-- 20260901010000 gave a supervisor the RIGHT to read his boss's job list.
-- This is the wire that takes him there.
--
-- ── THE GAP, MEASURED ─────────────────────────────────────────────────────
--
-- Thirteen files in the app answer 「which business is this?」 the same way:
--
--     .from("projects").eq("account_id", user.id).single()
--
-- Every one of them means 「the project I OWN」. A supervisor owns a project --
-- the signup trigger provisions one for everybody -- so he logs in, lands in
-- his own empty shell, and the permission system he was just added to is
-- invisible to him.
--
-- That is this repository's signature defect, fifteen times over: the
-- capability exists and the wire is never connected. It is not going to be the
-- sixteenth on the same day it was built.
--
-- ── AND WHY THE RULE LIVES HERE, NOT IN THIRTEEN FILES ────────────────────
--
-- Because it is the same argument 010000 made about the 125 copies of
-- `account_id = auth.uid()`: a rule written in thirteen places is a rule that
-- will be right in twelve of them. my_workspace() is asked once, at the shell,
-- and the answer is passed down.
--
-- ── HOW IT DECIDES, AND WHY THE SIGNAL IS MEASURED RATHER THAN GUESSED ────
--
-- `projects.style` is null until somebody actually sets a business up. So an
-- invited supervisor's own project is distinguishable from a real one WITHOUT
-- asking anybody: it has no style because nobody ever chose one.
--
--   1. a project I own that has been set up   -> owner, mine
--   2. otherwise, the business I work in      -> staff
--   3. otherwise, my own (unset) project      -> owner, mine
--
-- ⚠️ SOMEBODY WHO IS BOTH -- a real owner who is also somebody else's
-- supervisor -- gets his own, and there is deliberately no switcher. A
-- switcher built before one person is in that state is a switcher built from
-- imagination (任务 32's lesson: one field system serving one value is
-- over-engineering). When the first person is in that state, the answer is a
-- picker, and this function is the one place it goes.

create or replace function public.my_workspace()
returns table (project_id uuid, role text)
language sql
stable
security definer
set search_path = public
as $$
  with mine as (
    select p.id, p.style from public.projects p where p.account_id = auth.uid()
  ),
  theirs as (
    select m.project_id as id
    from public.project_members m
    where m.user_id = auth.uid() and m.active
    order by m.created_at
    limit 1
  )
  select id, 'owner'::text from mine where style is not null
  union all
  select id, 'staff'::text from theirs
    where not exists (select 1 from mine where style is not null)
  union all
  select id, 'owner'::text from mine
    where style is null and not exists (select 1 from theirs)
  limit 1;
$$;

comment on function public.my_workspace() is
  'Which business this person opens the portal into, and as what. One answer in one place -- see the header of 20260901030000 for why it is not thirteen .eq("account_id") calls.';

revoke execute on function public.my_workspace() from public;
grant execute on function public.my_workspace() to authenticated;

-- ── THE BUSINESS'S OWN WORDS, FOR ANYONE WHO WORKS THERE ──────────────────
--
-- get_my_business_context() roots itself at auth.uid() -- deliberately, and it
-- was right when one person meant one business. A supervisor calling it gets
-- HIS OWN empty context, so his boss's system would render in the wrong
-- language, with generic page names, under a company name that is not the one
-- he works for.
--
-- ⚠️ THE OLD FUNCTION IS NOT COPIED, IT IS REWRITTEN AS A CALLER. Two bodies
-- answering the same question is how 「客户改了字没生效」 happened six times
-- (任务 50/52/53): the second copy is right on the day it is written and drifts
-- afterwards. So the whole body moves here, takes a project id, and
-- get_my_business_context() becomes one line pointing at it.

create or replace function public.get_business_context(in_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  their_lead_id uuid;
  their_identity jsonb;
  their_language text;
  result jsonb;
begin
  /* The only gate. Not 「the caller owns it」 -- 「the caller works here」,
     which for an owner is the same sentence. */
  if not public.works_here(in_project_id) then
    raise exception 'you do not work in that business';
  end if;

  select jsonb_build_object(
    'business_name', p.business_name,
    'owner_name', p.owner_name
  ), p.system_language, a.lead_id
  into their_identity, their_language, their_lead_id
  from public.projects p
  join public.accounts a on a.id = p.account_id
  where p.id = in_project_id;

  if their_lead_id is null then
    return jsonb_build_object(
      'industry', null,
      'language', null,
      'analysis', null,
      'lang', coalesce(their_language, 'en'),
      'identity', coalesce(their_identity, jsonb_build_object('business_name', null, 'owner_name', null))
    );
  end if;

  select jsonb_build_object(
    'industry', case when i.id is null then null else jsonb_build_object(
      'slug', i.slug,
      'name_zh', i.name_zh,
      'name_en', i.name_en,
      'labels', i.labels,
      'default_workflow', i.default_workflow,
      'suggested_modules', i.suggested_modules,
      'style_recommendation', i.style_recommendation
    ) end,
    'language', l.language,
    'analysis', case when a.id is null then null else jsonb_build_object(
      'summary', a.summary,
      'summary_en', a.summary_en,
      'before_workflow', a.before_workflow,
      'after_workflow', a.after_workflow,
      'after_workflow_en', a.after_workflow_en,
      'bottlenecks', a.bottlenecks,
      'enquiry', a.enquiry
    ) end,
    'lang', coalesce(their_language, 'en'),
    'identity', coalesce(their_identity, jsonb_build_object('business_name', null, 'owner_name', null))
  )
  into result
  from public.leads l
  left join public.industries i on i.id = l.industry_id
  left join lateral (
    select ar.*
    from public.analysis_results ar
    where ar.lead_id = l.id
    order by ar.generated_at desc
    limit 1
  ) a on true
  where l.id = their_lead_id;

  return result;
end;
$$;

revoke execute on function public.get_business_context(uuid) from public;
grant execute on function public.get_business_context(uuid) to authenticated;

/** Unchanged from the caller's side, and now one line instead of a second copy
 *  of the body above. Everything that already calls it keeps working. */
create or replace function public.get_my_business_context()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  ws uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  select project_id into ws from public.my_workspace();
  if ws is null then
    return null;
  end if;
  return public.get_business_context(ws);
end;
$$;

revoke execute on function public.get_my_business_context() from public;
grant execute on function public.get_my_business_context() to authenticated;

-- ── WHO WORKS HERE, AS THE OWNER SEES IT ──────────────────────────────────
--
-- The membership table holds user ids. An owner knows people by their email,
-- so a settings screen listing uuids would be a screen nobody can use.
-- auth.users is not readable from the client, which is exactly why this is a
-- function rather than a join in the app.

create or replace function public.list_project_members()
returns table (user_id uuid, email text, role text, active boolean, created_at timestamptz)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  my_project uuid;
begin
  select id into my_project from public.projects where account_id = auth.uid();
  if my_project is null then
    return;
  end if;

  return query
    select m.user_id, u.email::text, m.role, m.active, m.created_at
    from public.project_members m
    join auth.users u on u.id = m.user_id
    where m.project_id = my_project
    order by m.created_at;
end;
$$;

revoke execute on function public.list_project_members() from public;
grant execute on function public.list_project_members() to authenticated;
