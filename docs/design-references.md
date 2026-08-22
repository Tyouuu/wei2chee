# Design references

Durable list of the design sites we work from. **Append here — never rely on chat
history.** Conversation context gets compacted; this file does not.

## Awwwards-tier technique sources

| Site | What we take from it |
| --- | --- |
| [awwwards.com](https://www.awwwards.com/websites/) | Current award-winner baseline: scroll choreography, persistent atmosphere, oversized kinetic type, vivid luminous accents on rich dark grounds. |

## Prompt / template libraries (business model reference too)

| Site | What it is | Note |
| --- | --- | --- |
| [sceneai.art](https://sceneai.art/) | Paid AI-prompt library: 130+ landing pages & hero sections, 70+ animated backgrounds, gradients. "Fresh drops every week." By Orixadesign. | Direct precedent for our own template-library idea. Design lesson: near-black quiet chrome, gradient used **only** on the headline type, all colour comes from the content thumbnails. Every card carries like + view counts as built-in social proof. |
| [uiprompt.site/styles](https://www.uiprompt.site/styles) | Free-looking library of 73 named UI styles, grouped into Core Styles / Visual / Typography / Retro / Layout / Interaction, each with a copyable AI prompt + templates. Has a 中文 toggle. | Useful **vocabulary** for our 风格模板 work: Flat Design System, Minimalism, Typography, Fluent Design 2.0, Scroll Narrative, 3D Elements, Material Design System, Skeuomorphism, … |
| [landinghero.ai/library](https://www.landinghero.ai/library) | 1000+ UI components copyable as prompts. | Not yet inspected. |

Both sceneai.art and uiprompt.site return **403 to plain fetching** — read them
with the Playwright scrape script pattern instead (see git history for
`.tmp-scrape-scene.mjs`).

## Style vocabulary in circulation (2026)

Minimalism · Flat · Swiss/International · Bauhaus · Art Deco · Neo-brutalism ·
Retro/Y2K · Glassmorphism · Aurora UI (gradient meshes, glowing animated
backgrounds) · Claymorphism · Bento grids · Kinetic typography · Grain textures ·
3D · Geominimalism · Modern surrealism

Commonly paired with: SaaS → glassmorphism / aurora / dark mode. E-commerce →
bento / claymorphism / kinetic type. Agencies → brutalism / grain / Y2K.

## Sites the founder shared

Recovered from the SDD ledger (`.superpowers/sdd/2026-08-17-formae-acquisition-site/progress.md`),
which recorded them at the time of the design-quality pushback. This is the list
to work from.

| Site | Type | Used yet? |
| --- | --- | --- |
| [React Bits](https://reactbits.dev/) | Animated React components (text effects, backgrounds) | Yes — GlitchText was used in Task 14, then removed with the multi-theme cleanup |
| [Aceternity UI](https://ui.aceternity.com/) | Tailwind + Framer Motion component library, heavy on hero/background effects | Not yet |
| [21st.dev](https://21st.dev/) | shadcn-compatible community registry: 12,000+ components + **a Themes library** (Vercel/Zen Linen/Sage Garden/Amber Hearth/Neo Brutalism/Candyland/…). Every component ships as a copy-paste **prompt** that self-adapts to your theme. | **YES — researched 2026-08-20.** Themes are drop-in: our `app/globals.css` already declares the exact shadcn variable set they target. Primary source for Phase 1 style expansion. See docs/portal-editor-known-issues.md |
| [GSAP](https://gsap.com/) | Scroll-driven animation library (ScrollTrigger) | No — the site uses Framer Motion `useScroll` instead |
| [ShaderGradient](https://www.shadergradient.co/) | WebGL animated gradient meshes | Yes — `AmbientBackdrop` (site-wide fixed layer) |
| [MotionSites](https://motionsites.ai/) | AI-SaaS site design gallery; each entry has "Copy full prompt" | Researched 2026-08-20 — earmarked for **Phase 2** (landing-page builder), not Phase 1 |
| [UIverse](https://uiverse.io/) | Community CSS component gallery (buttons, cards, loaders) | Not yet |
| [Awwwards](https://www.awwwards.com/websites/) | Award-winner baseline | Yes — the continuity rework was derived from it |

reactbits.dev re-checked 2026-08-20: **165+ components, free forever**, open source
(ColorBends / Aurora / Beams / Grainient / DotField …), every value parameterised.
Earmarked for **Phase 2** landing-page work.

**Still unused: Aceternity, GSAP, UIverse.** Check these before inventing anything
from scratch, especially for 组件模板 / 卡片模板 work.

## 2026-08-22 — what each of these actually yielded

Checked every site on this page with Playwright (all returned 200; the 403 note
above applies to plain fetching, not to a real browser).

| Site | Publishes a prompt? | Verdict |
| --- | --- | --- |
| [uiprompt.site/styles](https://www.uiprompt.site/styles) | **Yes — 73 of them, free, with a copy button** | **The richest source we have.** Each is a written design brief (Role / Scene / Visual philosophy / Material / Interaction / Mood), 300–3700 chars. Harvested to `docs/style-briefs/`. Two already shipped as registers: `swiss.css`, `soft.css`. |
| [21st.dev](https://21st.dev/) | Yes — an AI-ready prompt per component, plus an official MCP | Component-level. Useful, but a component lands with hardcoded colours; see below. |
| [motionsites.ai](https://motionsites.ai/) | Not visible to a scraper | Loads, but the "Copy full prompt" is behind interaction. Re-check by hand. |
| [landinghero.ai/library](https://www.landinghero.ai/library) | Not visible to a scraper | Loads; ~1900 chars of shell text only. Re-check by hand. |
| [ui.aceternity.com](https://ui.aceternity.com/components) | No | Component source, MIT-ish. Still unused. |
| [uiverse.io](https://uiverse.io/) | No | CSS components. Still unused. |

### The rule this settled

**Take STYLES, not components.** A component arrives with its colours written
in, so it becomes the one block on the page that does not change when the
customer changes register — the exact thing the ten-register promise cannot
survive. A style brief lands in the token layer and every one of the 54
components we already have inherits it for free.

Cost per register, measured on Swiss and Soft: one token file (derive from the
closest existing one), one Latin face in `app/[locale]/layout.tsx`, the
`STYLES` array in `scripts/build-style-scope.mjs`, the `StyleName` union and
five `Record<StyleName, …>` maps (TypeScript names every one of them), two
message files, and one migration mirroring the value into
`projects_style_check`, `industries_style_recommendation_is_real`,
`update_project_style` and `set_project_style`. About an hour.
