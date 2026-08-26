-- 工作室 (studio) — a seventeenth register.
--
-- WHERE IT CAME FROM, and why the method matters more than the register.
-- The founder pointed back at a GitHub link he had given on 2026-08-23 and
-- set the standard with it:
--
--   「他的设计做成一种风格 然后我给你很多link」
--   「只是给你一个标准 就是可以看到我们与他们的分别 要认准自己的不足
--     才是最大的进步」
--   「也是要当素材 两个都要」
--
-- So the link is BOTH: a yardstick that says where we fall short, and material
-- to build from. This migration is the second half.
--
-- The source is arhamkhnz/next-shadcn-admin-dashboard (MIT) — the same stack
-- this product is built on. It was cloned, installed, run locally and read
-- with getComputedStyle rather than described from a screenshot. Five facts
-- came back that no register here had, and not one of them is a colour a
-- palette could repaint:
--
--   ground and card are the SAME white, held apart by a 1px ring
--   the primary is #141414 — the only colour on the page is the delta pills
--   rows are 52px, roomier than anything in the library
--   the table head is neither dimmed nor tracked — it is just the first row
--   headings are 16px, the size of body text; space carries the hierarchy
--
-- Nothing is copied. Their licence covers their code; what is taken is shape.
-- See design-system/tokens/studio.css for the full reading.
--
-- NO DATA MOVES. This adds a value nobody is on yet. Every existing project
-- keeps the register it has.

alter table public.projects
  drop constraint if exists projects_style_check;

alter table public.projects
  add constraint projects_style_check
  check (
    style is null
    or style in (
      'ledger', 'hearth', 'blueprint', 'stamp', 'swiss', 'soft', 'brut',
      'glass', 'night', 'signboard', 'lacquer', 'code', 'tile', 'pop',
      'console', 'counter', 'studio'
    )
  );

-- ── AND THE LIST STOPS BEING KEPT IN THREE PLACES ─────────────────────────
--
-- `update_project_style` and `set_project_style` each carried their own copy
-- of the sixteen register names. Both still said 'large', cut on 2026-08-26 by
-- migration 20260826040000, which dropped it from the table's CHECK and from
-- nothing else — so the functions would happily have written a value the table
-- then refused, and the customer would have seen a constraint error instead of
-- a register.
--
-- Three lists that must agree is two lists too many. The CHECK constraint above
-- is the authority; the functions just write, and the table raises if the value
-- is not one it allows. Adding the eighteenth register is then one edit.
--
-- The palette list in `set_project_style` is left exactly as it is, on purpose:
-- `projects.palette` has no CHECK constraint of its own, so that list is not a
-- duplicate — it is the only guard there is.

create or replace function public.update_project_style(new_style text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.projects
  set style = new_style, updated_at = now()
  where account_id = auth.uid();
end;
$$;

revoke execute on function public.update_project_style(text) from public;
grant execute on function public.update_project_style(text) to authenticated;

create or replace function public.set_project_style(
  new_style text,
  new_palette text default null,
  clear_palette boolean default false
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if new_palette is not null and new_palette not in (
    'elegant-luxury', 'neo-brutalism', 't3-chat', 'bubblegum',
    'tangerine', 'claude', 'mocha-mousse', 'caffeine',
    'amber-minimal', 'vintage-paper', 'gold-grain', 'kodama-grove',
    'nature', 'northern-lights', 'supabase', 'turquoise-stone',
    'perpetuity', 'twitter', 'modern-minimal', 'starry-night',
    'clean-slate', 'amethyst-haze', 'rosewood', 'vercel', 'graphite', 'zen'
  ) then
    raise exception 'invalid palette: %', new_palette;
  end if;

  update public.projects
  set style = new_style,
      palette = case
        when clear_palette then null
        when new_palette is not null then new_palette
        else palette
      end,
      updated_at = now()
  where account_id = auth.uid();

  if not found then
    raise exception 'project not found';
  end if;
end;
$$;

revoke execute on function public.set_project_style(text, text, boolean) from public;
grant execute on function public.set_project_style(text, text, boolean) to authenticated;
