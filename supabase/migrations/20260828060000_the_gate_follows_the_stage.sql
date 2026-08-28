-- supabase/migrations/20260828060000_the_gate_follows_the_stage.sql
--
-- Softening what 20260828010000 hardened, because hardening it broke a path
-- that is allowed to exist.
--
-- THE PROBLEM THAT MIGRATION FIXED IS REAL and is not being undone: `paid` is
-- the gate save_project_page reads, `stage` is where the customer is in the
-- business, console_set_stage derives one from the other, and a row was found
-- sitting at stage='paid' with paid=false -- shown as paid, counted in
-- revenue_dev, and unable to save its own pages. A prose invariant that only
-- one of two write paths honours is not an invariant.
--
-- THE COST I UNDER-WEIGHTED. A CHECK constraint does not repair a write, it
-- REFUSES it. 20260818120000 says outright that flipping `paid` by hand in
-- Supabase Studio is how this was meant to work before the console existed, and
-- that is still muscle memory. After the constraint, `update projects set paid
-- = true` raises -- and a Studio edit that raises is a founder who thinks he
-- marked somebody paid and did not. `npm run check:isolation` found it
-- immediately, doing exactly that update and then failing on the save.
--
-- So: a BEFORE trigger that makes the two agree instead of rejecting the write,
-- with the CHECK left in place as a backstop. Every write now succeeds and no
-- write can leave them disagreeing.
--
-- WHICH COLUMN WINS. Whichever one the writer actually changed:
--
--   * `stage` moved -> `paid` follows it. This is console_set_stage's own
--     direction and the one that matters most: stage is the business fact.
--   * only `paid` moved -> `stage` follows IT, to 'paid' or back to 'quoted'.
--     Someone ticking the box in Studio means "this customer has paid", and the
--     honest reading is to move them along rather than to argue.
--   * both moved -> stage wins, for the same reason as the first case.
--
-- `stage_changed_at` is stamped here too, so the timestamp the CUSTOMER now
-- sees on their own home screen ("in this step since 27 Aug") stays true no
-- matter which path moved them -- console, Studio, or a future one. It was
-- previously stamped only inside console_set_stage, which is the same
-- one-of-two-write-paths mistake this migration exists to stop repeating.

create or replace function public.projects_keep_gate_in_step()
returns trigger
language plpgsql
as $$
declare
  gate_for_stage boolean;
begin
  if tg_op = 'INSERT' then
    new.paid := (new.stage in ('paid', 'building', 'live'));
    new.stage_changed_at := coalesce(new.stage_changed_at, now());
    return new;
  end if;

  gate_for_stage := (new.stage in ('paid', 'building', 'live'));

  if new.stage is distinct from old.stage then
    new.paid := gate_for_stage;
    new.stage_changed_at := now();
  elsif new.paid is distinct from old.paid then
    -- Only the gate moved: carry the stage to match it. 'quoted' rather than
    -- 'designing' on the way back, because un-ticking paid means the money did
    -- not arrive, not that the design was never done.
    new.stage := case when new.paid then 'paid' else 'quoted' end;
    new.stage_changed_at := now();
  end if;

  return new;
end;
$$;

drop trigger if exists projects_keep_gate_in_step on public.projects;
create trigger projects_keep_gate_in_step
  before insert or update on public.projects
  for each row execute function public.projects_keep_gate_in_step();

-- Repair anything that drifted between the two migrations, then leave the
-- constraint standing: with the trigger in front of it, it can now only fire
-- for a write that bypasses triggers entirely, which is the case worth hearing
-- about.
update public.projects
set paid = (stage in ('paid', 'building', 'live'))
where paid is distinct from (stage in ('paid', 'building', 'live'));
