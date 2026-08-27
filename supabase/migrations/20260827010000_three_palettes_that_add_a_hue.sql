-- 三套配色：咖啡、藏青、艾绿
--
-- ── WHY THREE AND WHY THESE ─────────────────────────────────────────────────
--
-- The founder, 2026-08-27: 「tweakcn 剩下约 30 套主题 怎么还没拿啊 去拿啊 看看
-- 如何搭配出多几套不同的风格」.
--
-- All 42 themes in tweakcn's registry were rendered as swatches and LOOKED at
-- (.screenshots/themes42/sheet.jpg) rather than filtered by name, then held
-- against his two standing rules: the ground is neutral, and a Malaysian SME
-- owner would actually pick it.
--
-- Twenty went on sight -- doom-64, cyberpunk, candyland, bubblegum,
-- neo-brutalism, claymorphism, retro-arcade and the rest are costumes, not
-- business software. Most of what remained duplicated a hue the library already
-- carries: solar-dusk and darkmatter are 橘 again, northern-lights and
-- ocean-breeze are 森绿 again, mono and graphite are 极简黑 again.
--
-- These three each add a hue nothing in the library had:
--
--   caffeine      #644a40  deep coffee brown -- cafes, bakeries, tea shops,
--                          furniture, carpentry. The library had no brown.
--   starry-night  #3a5ba0  a deep, serious navy. Our blues were BRIGHT
--                          (#3b82f6) and violet (#6366f1); accounting, law,
--                          engineering and surveying want neither.
--   sage-garden   #7c9082  muted grey-green. 森绿 is a deep forest; sage is the
--                          other answer -- wellness, spa, clinics, florists.
--
-- ── WHAT THIS FUNCTION IS FOR ───────────────────────────────────────────────
--
-- The 配色 layer lives in four places at once: CSS files in
-- design-system/palettes/, a class each in the generated style-scope.module.css,
-- a list in lib/portal/palettes.ts, and this guard. Nothing makes them agree
-- except lib/portal/__tests__/palettes.test.ts, which failed on `sage-garden`
-- the moment the generator wrote it -- which is the test doing its job.
--
-- The list is rewritten rather than appended to. The one it replaces still
-- named sixteen palettes that were culled on 2026-08-26 (bubblegum, t3-chat,
-- kodama-grove, turquoise-stone…), and a guard that accepts keys the app can no
-- longer produce is a guard that would let a stale client write one.

-- ── THE THREE PLACES THE LIST LIVES IN SQL ─────────────────────────────────
--
-- A table CHECK on projects, the same CHECK on industries (a trade's opening
-- recommendation has to be a palette that exists), and the guard inside
-- set_project_style below. lib/portal/__tests__/palettes.test.ts reads the
-- CHECK; the two are asserted against the generated TypeScript list, which is
-- itself generated from the CSS directory. That chain is the only thing that
-- keeps four copies of one list honest.

alter table public.projects
  drop constraint if exists projects_palette_check;

alter table public.projects
  add constraint projects_palette_check
  check (
    palette is null
    or palette in (
      'vercel', 'modern-minimal', 'clean-slate', 'elegant-luxury',
      'tangerine', 'amber-minimal', 'nature', 'rosewood', 'zen',
      'caffeine', 'starry-night', 'sage-garden'
    )
  );

alter table public.industries
  drop constraint if exists industries_palette_recommendation_is_real;

alter table public.industries
  add constraint industries_palette_recommendation_is_real
  check (
    palette_recommendation is null
    or palette_recommendation in (
      'vercel', 'modern-minimal', 'clean-slate', 'elegant-luxury',
      'tangerine', 'amber-minimal', 'nature', 'rosewood', 'zen',
      'caffeine', 'starry-night', 'sage-garden'
    )
  );

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
  if new_style is not null and not public.is_known_register(new_style) then
    raise exception 'invalid register: %', new_style;
  end if;

  if new_palette is not null and new_palette not in (
    'vercel', 'modern-minimal', 'clean-slate', 'elegant-luxury',
    'tangerine', 'amber-minimal', 'nature', 'rosewood', 'zen',
    'caffeine', 'starry-night', 'sage-garden'
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
