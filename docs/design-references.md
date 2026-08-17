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
| [21st.dev](https://21st.dev/) | shadcn-compatible community component registry | Not yet |
| [GSAP](https://gsap.com/) | Scroll-driven animation library (ScrollTrigger) | No — the site uses Framer Motion `useScroll` instead |
| [ShaderGradient](https://www.shadergradient.co/) | WebGL animated gradient meshes | Yes — `AmbientBackdrop` (site-wide fixed layer) |
| MotionSites | Motion-design showcase gallery | Not yet |
| [UIverse](https://uiverse.io/) | Community CSS component gallery (buttons, cards, loaders) | Not yet |
| [Awwwards](https://www.awwwards.com/websites/) | Award-winner baseline | Yes — the continuity rework was derived from it |

**Still unused: Aceternity, 21st.dev, GSAP, MotionSites, UIverse.** Check these
before inventing anything from scratch, especially for 组件模板 / 卡片模板 work.
