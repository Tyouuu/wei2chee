-- 宣纸. Eight 配色 become nine.
--
-- 「還有沒有一些熱門的主題配色可以用的」 -- 2026-08-26, right after the cull.
--
-- tweakcn's community gallery publishes a real signal, Popular / All Time with
-- like counts. Read the same day (.screenshots/themes/tweakcn-community.png):
-- Claude+ 300, Light Green 243, Zen Inspired 231, AstroVista 185, Tiesen 180,
-- qrafthive 172, Minimal Neutral 170, designbyte 164, claude blu 2 133,
-- Sage Green 128, Whatsapp 123, VTRON 118, Porfolio 106, autoblog 102,
-- Enterprise Mod 2 101, Deep Purple 95.
--
-- THIRTEEN OF THE SIXTEEN land on one of the eight kept an hour earlier. That
-- is the strongest thing the list says, and it is about the cull rather than
-- about this migration: the eight are the right eight.
--
-- The three that do not land are Light Green and designbyte -- lime and mint,
-- exactly the 花哨 he said nobody picks -- and Zen.
--
-- ZEN IS A REAL GAP. All eight put their accent on a WHITE ground. Zen puts a
-- near-black accent on a warm linen one, and two independent galleries rank it
-- near the top: third by all-time likes on tweakcn, and the third card on
-- 21st.dev's own Themes page as 「Zen Linen」. It is also the closest thing in
-- the entire list to 「白色跟黑色居多」, with the white warmed.
--
-- The site's tag counts say the same thing from the other side: across the
-- whole community library, minimal 267 and professional 223 against colorful
-- 148, playful 69, pastel 32, candy 5.
--
-- Nothing moves and nothing breaks: this only widens the check constraint. No
-- trade defaults to it yet -- 茶行 / 药材 / 古董 / 手作 are not in the seven
-- industry slugs, and inventing a slug to justify a palette is backwards.

alter table public.projects
  drop constraint if exists projects_palette_check;

alter table public.projects
  add constraint projects_palette_check
  check (
    palette is null
    or palette in (
      'vercel', 'modern-minimal', 'clean-slate', 'elegant-luxury',
      'tangerine', 'amber-minimal', 'nature', 'rosewood', 'zen'
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
      'tangerine', 'amber-minimal', 'nature', 'rosewood', 'zen'
    )
  );
