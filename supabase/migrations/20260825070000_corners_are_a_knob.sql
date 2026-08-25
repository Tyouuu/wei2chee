-- 圆角 — one slider over whatever radius ladder the register defines.
--
-- WHY IT IS ITS OWN COLUMN AND NOT PART OF THE REGISTER. The register decides
-- the RELATIONSHIP between the radii (台账's 3px square corners, 柔和's 14px
-- softness, 粗野's zero), and that relationship is the design. This scales the
-- whole ladder without changing it, which is a different statement: 「我要这一套,
-- 但圆一点」. Durable keeps Corners beside Palette and Fonts for the same
-- reason — it is one of the three things an owner can say about a look without
-- being a designer, and the founder marked it 拿 on 2026-08-25.
--
-- WHY A MULTIPLIER AND NOT A PIXEL VALUE. A pixel value would have to be the
-- same in every register, which is exactly what the register layer exists to
-- prevent: 8px is a soft corner on 台账 and a sharp one on 柔和. A factor keeps
-- each register's own proportions and moves them together.
--
-- The range is deliberately narrow. Below 0 is meaningless and above 2 turns
-- every card into a pill, which is not a preference, it is a broken page.

alter table public.projects
  add column if not exists corners real not null default 1;

alter table public.projects
  drop constraint if exists projects_corners_range;

alter table public.projects
  add constraint projects_corners_range check (corners >= 0 and corners <= 2);

comment on column public.projects.corners is
  'Multiplier over the register''s own radius ladder. 1 is the register as designed; '
  '0 squares every corner; 2 is the roundest this allows. See design-system/tokens/*.css.';

-- security definer + auth.uid(), like every other setter on this table: the
-- client never names which project it is writing to.
create or replace function public.set_project_corners(new_corners real)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_corners is null or new_corners < 0 or new_corners > 2 then
    raise exception 'corners out of range: %', new_corners;
  end if;

  update public.projects
  set corners = new_corners, updated_at = now()
  where account_id = auth.uid();

  if not found then
    raise exception 'project not found';
  end if;
end;
$$;

revoke execute on function public.set_project_corners(real) from public;
grant execute on function public.set_project_corners(real) to authenticated;
