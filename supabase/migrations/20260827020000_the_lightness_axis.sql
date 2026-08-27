-- 深夜 —— 配色层缺的那一根轴：明度
--
-- ── THE MEASUREMENT ─────────────────────────────────────────────────────────
--
-- Ground lightness in oklch across all twelve palettes, 2026-08-27:
--
--   0.9380 zen        0.9755 starry-night   0.9842 clean-slate
--   0.9383 tangerine  0.9761 sage-garden    0.9900 vercel
--   0.9711 nature     0.9779 elegant-luxury 1.0000 modern-minimal
--                     0.9790 rosewood        1.0000 amber-minimal
--                     0.9821 caffeine
--
-- TWELVE OUT OF TWELVE ARE NEAR-WHITE, including 藏青 and 咖啡 added the same
-- morning: those are dark ACCENTS on white pages. So the assistant answering
-- 「换成深色一点的」 with 「换成藏青配色，整体暗一点」 was describing a change the
-- owner could not see -- caught by measuring, not by reading the sentence.
--
-- The palette layer has had a hue axis and a chroma axis and no LIGHTNESS axis,
-- which docs/founder-tasks.md 任务 17 has said since 2026-08-26.
--
-- ── WHY IT MATTERS BEYOND DARK MODE ─────────────────────────────────────────
--
-- 夜 is a REGISTER, and its own brief admits the problem: its thesis is 「暗」,
-- and 暗 is a lightness, so by 重点 7c it is a palette wearing a register's
-- coat. It survived the 2026-08-26 cull only because nothing else could make a
-- page dark. Now something can, and every OTHER register gains a dark mode --
-- fourteen registers x dark, instead of one register that is dark.
--
-- Demoting 夜 is NOT done here. That is a register cull with a migration of its
-- own, and it needs the founder: he has said 「不达标的就不要了」 but he has not
-- looked at this pair side by side yet.

alter table public.projects
  drop constraint if exists projects_palette_check;

alter table public.projects
  add constraint projects_palette_check
  check (
    palette is null
    or palette in (
      'vercel', 'modern-minimal', 'clean-slate', 'elegant-luxury',
      'tangerine', 'amber-minimal', 'nature', 'rosewood', 'zen',
      'caffeine', 'starry-night', 'sage-garden', 'midnight'
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
      'caffeine', 'starry-night', 'sage-garden', 'midnight'
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
    'caffeine', 'starry-night', 'sage-garden', 'midnight'
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
