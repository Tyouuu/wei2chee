# Formae Design System & Style Picker — Design Spec

**Status:** Approved for implementation
**Source:** Brainstorming session 2026-08-18, conducted conversationally (context: existing acquisition-site spec, plus live inspection of two real client repos — `Tyouuu/vibe-dealer` and `Tyouuu/Nadayu28-booking-`).

## 1. Context

The parent proposal (`AI Business System Generator V5.docx`) describes four subsystems. Subsystem 1 (acquisition site) is built and live. This spec covers the design-system half of **subsystem 2 — client co-design tooling**: a reusable visual style library the client picks from, plus the component library and generation rules that make picking a style mean something concrete. The "workflow builder" half of subsystem 2 is out of scope here.

**Why this now, not later:** two real client systems already exist — `vibe-dealer` (Vibe Mobile dealer management, live, 242 dealers) and `Nadayu28-booking-` (smart community system). They currently share almost nothing design-wise. `vibe-dealer` went through a real redesign effort against Stripe/Linear/Vercel as references and has a genuinely argued token system and a validated "page contract" (see §4). `Nadayu28` does not — its `globals.css` is Tailwind default colors with a project-specific prefix, no argument behind any value. Every future client built the way `Nadayu28` was built repeats that cost. Formae's RM5,000 price point only works if per-client build time keeps falling — a shared design system is the mechanism, not a nice-to-have (same rationale the acquisition-site spec already states for its own data model, §11 of that spec).

## 2. What this is not

- **Not a live theme-switcher on a running system.** At the moment a client picks a style, their system does not exist yet — they've signed, but nothing is built. A live-preview switcher would mean standing up a fake demo system just to skin it. Rejected on cost and on timing: there is nothing real to switch yet.
- **Not part of the acquisition site's funnel.** The acquisition site's job is the AI-analysis payoff moment (already built). Style selection happens *after* a client signs, as the first step of actually building their system — matching the original proposal's own phase boundary ("client co-design tooling... later").
- **Not the workflow builder.** Deferred; picking a visual style and configuring business workflow are different problems.
- **Not a new repo.** Building this as a new GitHub repo (with its own Vercel project, its own CI) is real infrastructure overhead for a solo founder with tight budget. It lives inside the existing `wei2chee` repo as a clearly separated area (`design-system/`), reusing the stack, hosting, and i18n setup already paid for.

## 3. Mechanism: a gallery picker, not a live switcher

A new route in the existing app (`app/[locale]/style-picker/`) renders all three styles side-by-side, each showing the **same representative content** (a generic dealer-list-style table, a form, a status card, a chart) built from the shared component library, so the client is comparing style against style, not comparing different content. This mirrors the acquisition site's own `IndustrySelect` pattern (§Section 2 of the acquisition-site spec) — pick one, move on — which the client has already used once during onboarding, and mirrors how `sceneai.art` and `uiprompt.site` present their own libraries: static previews, not live switching.

Selection action: reuses the acquisition site's proven low-infrastructure pattern (`ConversionCta`'s WhatsApp deep link) rather than building new client auth/persistence. Clicking "选这个风格" opens a prefilled WhatsApp message naming the chosen style. No new database table, no client login. This can graduate to real persistence once client volume justifies a dashboard — premature now.

## 4. The three styles

Each style is a complete token set (colors, weight ceiling, tracking, radii, shadow tint, motion durations) plus the shared component library skinned through it. Three, not one and not ten:

| Style | Target verticals | Origin | Design direction |
|---|---|---|---|
| **Ledger** | 批发/分销, 记账, B2B ops-heavy businesses | Extracted verbatim from `vibe-dealer`'s `globals.css` (the "Vibe456 token system v3") | Navy-tinted neutrals (not pure grey), Stripe link-blue accent (`#0570de`), five-hue status family (jade/brass/clay/slate/info), weight ceiling 600, negative tracking that scales with size, high information density. Already built and argued — this style is a port + genericization (strip `vibe-`/`dealer` naming), not new design work. |
| **Hearth** | 美容/沙龙, 零售/门店, 服务型公司 | New | The four verified verticals *other than* wholesale are all client-facing service businesses — none of them should look like a trading ledger. Direction: soft sage-leaning neutral background (not literal cream — avoid the generic-AI "warm cream + terracotta" pairing), a muted teal or clay accent (not pink — avoid "beauty = pink" cliché), more generous radii and whitespace than Ledger reflecting genuinely lower data density (a salon's daily bookings vs. a wholesaler's 242-account ledger). Same weight ceiling and status-color logic as Ledger for consistency, different neutral bias and accent. Exact hex values are an implementation-task decision, not a spec-level one — same precedent as the acquisition site's own spec, which described "editorial vs. technical-precision" directions before the actual oklch values were chosen during implementation. |
| **Blueprint** | 装修/承包商 | Adapted from the acquisition site's own `app/globals.css` (`--ink`, `--blueprint`, `--signal`, `--rust` and the drafting-grid/sheet-marks vocabulary) | The acquisition site already built a technical/precision aesthetic that fits a contractor's own visual vocabulary (drafting grids, registration marks, annotation labels) better than either of the other two. Reused, not reinvented — but **de-tuned for an internal tool**: drop the ShaderGradient/ambient motion and scroll choreography (those serve a marketing hero, not a dashboard used forty times a day), keep the drafting-grid background, sheet-marks, and mono annotation labels at a much quieter opacity, raise information density to match Ledger's. |

**Why three and not more:** every additional style multiplies the component-compatibility surface — all ~25 shared components (§5) must be re-verified against each new token set. Uiprompt.site's 73-style library was inspected directly during this session and found to reuse near-identical boilerplate copy across nearly every entry ("This design approach offers a distinctive visual language suitable for modern applications...") — evidence that breadth-without-depth reads as generated, not as effort. Three, each mapped to a real vertical and validated against a real client re-skin (§6), is the number this session settled on after that finding. A fourth style is added only when a real client's vertical genuinely doesn't fit any of the three — driven by demand, not by browsing reference sites for more options.

## 5. Component library

Extracted and generalized from `vibe-dealer`'s `src/app/(app)/` — the ~25 components already exist and are already token-driven (no hardcoded colors), which is what makes porting them across three styles possible without a rewrite:

`data-grid`, `combobox`, `listbox`, `date-picker`, `month-picker`, `modal`, `field` (the `useId`-based label-association component — keep this, it's the fix for Geist's "every control has an associated label" rule), `filter-chips`, `empty-state`, `page-header`, `status-dot`, `notification-toast`, `columns-menu`, `anchored-panel`, `avatar`, `rail-nav`, `mobile-nav`, `text-autocomplete`, `hero-card`, `confirm-submit-button`, `receipt-field`.

Generalization means: strip Vibe-specific naming and business logic (dealer rates, commission math), keep the visual/interaction contract. These move to `design-system/components/`.

## 6. Page contract (generation rules, not just documentation)

`vibe-dealer`'s `docs/redesign-plan.md` Part 2 defines five rules that made its redesign work, plus two layout rules. These get copied into `design-system/CONTRACT.md`, framed explicitly as **constraints a generation process (human or AI) must follow**, not as background reading:

1. The page states its answer — find the one question the page exists to answer, make it the largest thing on the page.
2. States are designed, not defaulted — before data exists, the entry form *is* the page; no placeholder dashes standing in for a verdict that can't exist yet.
3. Explanation sits beside the thing it explains, never a permanent banner above everything.
4. Actions are named for what they do, matching the heading above them.
5. Detail folds away — supporting evidence opens automatically only when the verdict says something is wrong.
6. Full width, left-aligned — cap *fields*, not pages.
7. Rows of cards don't stretch — mismatched-height siblings use `items-start`, not a forced stretch.

This doc is the artifact that makes style selection mean something beyond color: whichever of the three styles a client picks, every page generated for them is checked against these seven rules.

## 7. Validation

Reskin `Nadayu28-booking-` — a real client system, not a synthetic demo — with the Ledger or Hearth style, on a branch, without touching its production deployment. This is the acceptance test for the whole system: if the token set and component library can actually replace Nadayu28's ad-hoc CSS without a rewrite, the library is real. If it can't, that failure teaches us what's missing before a third paying client hits the same gap. Blueprint is not validated this way (no current client fits it) — it inherits validation from the acquisition site's own production use.

## 8. Tech stack

Same as the existing repo: Next.js (App Router) + Tailwind CSS v4 (`@theme` tokens, one block per style) + TypeScript + next-intl (reuse existing zh/en setup) + Framer Motion (component-level only — no scroll choreography here, this is a tool, not a marketing page). No Supabase persistence in this phase (§3). No new hosting.

## 9. File structure

- `design-system/tokens/ledger.css`, `hearth.css`, `blueprint.css` — one `@theme` block per style.
- `design-system/components/` — the ~25 generalized components, token-driven, no per-style branching in component code.
- `design-system/CONTRACT.md` — §6 verbatim, as a standalone generation-constraints document.
- `app/[locale]/style-picker/page.tsx` — the gallery: three columns (stacking on mobile), each rendering the same representative content set through that style's tokens.
- `messages/en.json` / `messages/zh.json` — new `stylePicker.*` keys.

## 10. Out of scope (explicitly deferred)

- Live/runtime theme switching on a real generated system.
- The workflow builder half of subsystem 2.
- Client auth/portal and persisted style selections.
- A fourth+ style, until a real client's vertical demands one.
- Rewriting `vibe-dealer` or `Nadayu28` production code directly — both stay untouched except for the Nadayu28 validation branch in §7, which does not merge to its `main`.
