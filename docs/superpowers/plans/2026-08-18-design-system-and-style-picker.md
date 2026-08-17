# Formae Design System & Style Picker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a three-style, token-driven design system (Ledger / Hearth / Blueprint) with a shared ~25-component library and a generation-constraints doc, expose it through a client-facing gallery picker, and validate it by reskinning a real client system (Nadayu28) on a branch.

**Architecture:** Lives inside the existing `wei2chee` repo, not a new one — a new `design-system/` folder (tokens + components + `CONTRACT.md`) plus a new route `app/[locale]/style-picker/`. No new hosting, no new auth, no Supabase persistence in this phase — the picker's selection action reuses the existing WhatsApp-deep-link pattern from `ConversionCta`.

**Tech Stack:** Next.js (App Router) + Tailwind CSS v4 (`@theme` tokens) + TypeScript + next-intl (existing zh/en setup) + Framer Motion (component-level only, no scroll choreography).

## Global Constraints

- **The real source in `vibe-dealer` is the authority, not this plan's guessed prop names.** This plan's "Interfaces" sections describe expected shapes for planning purposes (verified directly for `Field` in Task 2 — its real signature is a render-prop, not plain `children`, and the plan reflects that exact signature). Where any other component's real source differs from what a later task assumes, fetch and read the real file first and follow it; update the affected downstream task's assumption in your report rather than silently reconciling by guesswork.
- Every component in `design-system/components/` must be **token-driven with zero hardcoded colors** — every color comes from a CSS custom property, so the same component file works under all three token sets without per-style branching in the component code itself.
- No Vibe-specific identifiers survive extraction: no `dealer`, `commission`, `reload`, `top-up`, `Vibe`, `master`, `RM` (currency symbol is fine as a prop default, not hardcoded business logic) anywhere in `design-system/`.
- Source repos (`Tyouuu/vibe-dealer`, `Tyouuu/Nadayu28-booking-`) are real, live client systems. **Never push to their `main`/`master`.** Nadayu28 validation (Task 8) happens on a new branch in that repo only.
- Every port task ends with `tsc --noEmit` clean in this repo and a `grep -riE "dealer|commission|reload|vibe456"` over the new files returning nothing beyond code comments explicitly attributing the source (e.g. "ported from vibe-dealer's X").
- Bilingual (zh default, en secondary) for any user-facing text, matching the acquisition site's existing next-intl setup.

---

### Task 1: Scaffold `design-system/` + Ledger token set

**Files:**
- Create: `design-system/tokens/ledger.css`
- Create: `design-system/tokens/README.md`
- Test: none (CSS token file; verified visually in Task 7)

**Interfaces:**
- Produces: a `@theme` block defining every token later components read — `--color-canvas`, `--color-ink-950` … `--color-ink-700`, `--color-paper`, `--color-paper-dim`, `--color-primary` (+`-deep`/`-soft`), `--color-brass` (+`-bright`), `--color-jade` (+`-bright`), `--color-clay` (+`-bright`/`-deep`), `--color-slate` (+`-bright`), `--color-info` (+`-bright`), `--color-medal-gold`/`-silver`/`-bronze`, `--fw-medium`/`-semibold`, `--tracking-body`/`-sm`/`-title`/`-title-lg`, `--border-subtle`/`-strong`, `--shadow-hue`, `--hairline`, `--ease-out-quad`, `--dur-fast`/`-dur`. Later tasks (2, 3, 7) consume these exact custom-property names — do not rename them.

- [ ] **Step 1: Fetch the real source**

Run:
```bash
gh api repos/Tyouuu/vibe-dealer/contents/src/app/globals.css --jq '.content' | base64 -d > /tmp/vibe-globals.css
```
This is the "Vibe456 token system v3" — a real, already-argued token system (navy-tinted neutrals, Stripe-blue accent, 5-hue status family, weight ceiling 600, tinted shadows). Read the whole file before touching it; the comments explain *why* each value was chosen, not just what it is — port the reasoning as comments too, not only the values.

- [ ] **Step 2: Port the `@theme` block verbatim, generalize the file-level comment**

Copy the `@theme { ... }` block (color tokens, medal tokens, chart-alias tokens) into `design-system/tokens/ledger.css` unchanged — these values are already correct for the "precision/ops-heavy" register this style targets. Copy the `:root { ... }` craft-tokens block (weight ceiling, tracking, border alpha, shadow hue, hairline, easing/duration) unchanged too — these are the Linear/Vercel/Stripe-derived values, not Vibe-specific.

Rewrite only the block comments: replace "Vibe456 — App design reference" / "dealer" / "master" language with generic framing (e.g. "Ledger — precision/high-density register for ops-heavy B2B businesses (wholesale, distribution, accounting)"). Keep every *design* rationale sentence (why navy-tinted not pure grey, why the weight ceiling, why tinted shadows) — those are universal, not Vibe-specific, and are the most valuable part of the file.

Do **not** port `@theme inline { --font-sans: var(--font-plex-sans); ... }` (IBM Plex is Vibe-dealer's own font choice) — leave a `--font-sans`/`--font-mono` declaration commented out with a note that the consuming app supplies its own font stack (matching how this repo's own `app/globals.css` composes `next/font` variables).

Do **not** port the `@layer components` block (the twelve-column grid, `.btn-primary`, `.figure-money` etc.) — that's component-layer CSS, out of scope for this task, handled per-component in Tasks 2–3.

- [ ] **Step 3: Write `design-system/tokens/README.md`**

One short doc explaining: three token files exist (`ledger.css`, `hearth.css` — Task 5, `blueprint.css` — Task 6), each defines the same custom-property names under its own values, a consuming app imports exactly one, components never reference a style name directly — only the custom properties.

- [ ] **Step 4: Verify**

Run `tsc --noEmit` (should be unaffected, this task touches no `.ts`/`.tsx`). Run the grep from Global Constraints over `design-system/tokens/ledger.css` — it will legitimately match "vibe-dealer" once, in the attribution comment; anything beyond that attribution line is a failure.

- [ ] **Step 5: Commit**

```bash
git add design-system/tokens/ledger.css design-system/tokens/README.md
git commit -m "Port the Ledger token set from vibe-dealer, generalized"
```

---

### Task 2: Core structural components (field, page-header, empty-state, status-dot, modal, listbox, combobox, data-grid)

**Files:**
- Create: `design-system/components/field.tsx`
- Create: `design-system/components/page-header.tsx`
- Create: `design-system/components/empty-state.tsx`
- Create: `design-system/components/status-dot.tsx`
- Create: `design-system/components/modal.tsx`
- Create: `design-system/components/listbox.tsx`
- Create: `design-system/components/combobox.tsx`
- Create: `design-system/components/data-grid.tsx`
- Test: `design-system/components/__tests__/field.test.tsx` (the one component with real logic worth a unit test — see Step 2)

**Interfaces:**
- Consumes: token custom properties from Task 1 (`--color-*`, `--fw-*`, `--tracking-*`, `--border-*`, `--hairline`, `--ease-out-quad`, `--dur*`) — reference them via Tailwind arbitrary-value/`var()` syntax, never a hardcoded hex.
- Produces: `Field` (props: `label: string`, `hint?: ReactNode`, `error?: string`, `required?: boolean`, `children: (id: string) => ReactNode` — a **render-prop**, not a plain node: cloning breaks the moment a caller wraps its input in anything, and several callers render custom controls like `DatePicker`/`Combobox` rather than a bare `<input>`. `Field` generates the `id` via `useId()`, sets `htmlFor` on the `<label>`, and renders `id={`${id}-error`}`/`id={`${id}-hint`}` on the message text — the **caller** is responsible for passing that same `id` and `aria-describedby={`${id}-error`}` (when `error` is set) to whatever it renders inside the render-prop. This is the fix for "every control has an associated label"). `PageHeader` (props: `title: string`, `subtitle?: string`, `action?: ReactNode`). `EmptyState` (props: `icon?: ReactNode`, `title: string`, `description?: string`, `action?: ReactNode` — supports the three kinds from the acquisition-site's Global Constraints research: blank-slate, no-results, informational, distinguished by which props are passed). `StatusDot` (props: `tone: "positive" | "warning" | "negative" | "neutral" | "info"`, `label: string` — renders dot + text, never color alone). `Modal`, `Listbox`, `Combobox`, `DataGrid` — later tasks (3, 7) import these by name from `design-system/components`.

- [ ] **Step 1: Fetch the real sources**

```bash
gh api repos/Tyouuu/vibe-dealer/contents/src/app/\(app\)/field.tsx --jq '.content' | base64 -d > /tmp/vibe-field.tsx
gh api repos/Tyouuu/vibe-dealer/contents/src/app/\(app\)/page-header.tsx --jq '.content' | base64 -d > /tmp/vibe-page-header.tsx
gh api repos/Tyouuu/vibe-dealer/contents/src/app/\(app\)/empty-state.tsx --jq '.content' | base64 -d > /tmp/vibe-empty-state.tsx
gh api repos/Tyouuu/vibe-dealer/contents/src/app/\(app\)/status-dot.tsx --jq '.content' | base64 -d > /tmp/vibe-status-dot.tsx
gh api repos/Tyouuu/vibe-dealer/contents/src/app/\(app\)/modal.tsx --jq '.content' | base64 -d > /tmp/vibe-modal.tsx
gh api repos/Tyouuu/vibe-dealer/contents/src/app/\(app\)/listbox.tsx --jq '.content' | base64 -d > /tmp/vibe-listbox.tsx
gh api repos/Tyouuu/vibe-dealer/contents/src/app/\(app\)/combobox.tsx --jq '.content' | base64 -d > /tmp/vibe-combobox.tsx
gh api repos/Tyouuu/vibe-dealer/contents/src/app/\(app\)/data-grid.tsx --jq '.content' | base64 -d > /tmp/vibe-data-grid.tsx
```

- [ ] **Step 2: Port each, generalizing business logic out**

For each file: keep the interaction/accessibility contract (keyboard nav, focus management, ARIA) and the visual structure exactly — that's the validated, hard-won part. Strip anything that references dealers, rates, commissions, or Vibe-specific data shapes; replace with generic prop-driven equivalents (e.g. if `data-grid.tsx` has a dealer-row-specific column renderer, generalize it to an accept-any-column-def table).

`field.tsx` is the one with real logic to preserve carefully: it must call `useId()` once via the exact render-prop contract described above — do not "simplify" it to plain `children: ReactNode` with cloning, that's the bug this component exists to remove (cloning breaks silently the moment a caller wraps its input in anything).

Write a failing test first for `Field`, using the render-prop signature and wiring `aria-describedby` at the call site exactly as a real consumer must:

```tsx
// design-system/components/__tests__/field.test.tsx
import { render, screen } from "@testing-library/react";
import { Field } from "../field";

test("label is associated with its control via a real id", () => {
  render(
    <Field label="Company name">
      {(id) => <input id={id} />}
    </Field>,
  );
  const input = screen.getByLabelText("Company name");
  expect(input).toBeInTheDocument();
});

test("error text is exposed via aria-describedby when the caller wires it", () => {
  render(
    <Field label="Company name" error="Required">
      {(id) => <input id={id} aria-describedby={`${id}-error`} />}
    </Field>,
  );
  const input = screen.getByLabelText("Company name");
  expect(input).toHaveAccessibleDescription("Required");
});
```

- [ ] **Step 3: Run the test, verify it fails, then implement `field.tsx` to pass it**

Run: `npx vitest run design-system/components/__tests__/field.test.tsx`
Expected first: FAIL (`Field` doesn't exist yet). Implement `field.tsx` per Step 2, re-run: PASS.

- [ ] **Step 4: Implement the remaining seven components (no unit tests — visual/structural, verified in Task 7's Playwright pass)**

Port `page-header.tsx`, `empty-state.tsx`, `status-dot.tsx`, `modal.tsx`, `listbox.tsx`, `combobox.tsx`, `data-grid.tsx` per Step 2's generalization rules.

- [ ] **Step 5: Verify**

Run `tsc --noEmit` and `npx vitest run design-system/components/__tests__/field.test.tsx` (both clean). Run the Global Constraints grep over all eight new files.

- [ ] **Step 6: Commit**

```bash
git add design-system/components/field.tsx design-system/components/page-header.tsx design-system/components/empty-state.tsx design-system/components/status-dot.tsx design-system/components/modal.tsx design-system/components/listbox.tsx design-system/components/combobox.tsx design-system/components/data-grid.tsx design-system/components/__tests__/field.test.tsx
git commit -m "Port core structural components from vibe-dealer, generalized"
```

---

### Task 3: Remaining components (date-picker, month-picker, filter-chips, columns-menu, text-autocomplete, confirm-submit-button, receipt-field, anchored-panel, avatar, rail-nav, mobile-nav, notification-toast, hero-card)

**Files:**
- Create: `design-system/components/date-picker.tsx`
- Create: `design-system/components/month-picker.tsx`
- Create: `design-system/components/filter-chips.tsx`
- Create: `design-system/components/columns-menu.tsx`
- Create: `design-system/components/text-autocomplete.tsx`
- Create: `design-system/components/confirm-submit-button.tsx`
- Create: `design-system/components/receipt-field.tsx`
- Create: `design-system/components/anchored-panel.tsx`
- Create: `design-system/components/avatar.tsx`
- Create: `design-system/components/rail-nav.tsx`
- Create: `design-system/components/mobile-nav.tsx`
- Create: `design-system/components/notification-toast.tsx`
- Create: `design-system/components/hero-card.tsx`

**Interfaces:**
- Consumes: same token custom properties as Task 2; `Modal` from Task 2 (`notification-toast.tsx` likely composes it — check the source).
- Produces: all thirteen, importable from `design-system/components` by Task 7's gallery page. `filter-chips` specifically: per-chip removal + a clear-all affordance (per Global Constraints research already applied in vibe-dealer — keep this behavior).

- [ ] **Step 1: Fetch the real sources**

Same `gh api repos/Tyouuu/vibe-dealer/contents/src/app/\(app\)/<name>.tsx --jq '.content' | base64 -d > /tmp/vibe-<name>.tsx` pattern as Task 2, Step 1, for all thirteen files. `rail-nav.tsx` also has a sibling `rail-icons.tsx` — fetch that too and port it as `design-system/components/rail-icons.tsx` since `rail-nav` depends on it.

- [ ] **Step 2: Port each, generalizing per Task 2's rules**

Same approach as Task 2 Step 2: keep interaction/accessibility contracts, strip Vibe-specific data shapes and copy, replace with generic props. `receipt-field.tsx` in the source is dealer-receipt-upload-specific (ties to Supabase Storage for a specific bucket) — generalize to a generic `FileUploadField` that accepts an `onUpload` callback rather than hardcoding a bucket name; keep the component's name as `receipt-field.tsx` for now per the file list above (renaming is a later cleanup, not blocking).

- [ ] **Step 3: Verify**

Run `tsc --noEmit` (clean). Run the Global Constraints grep over all fourteen new files (thirteen plus `rail-icons.tsx`).

- [ ] **Step 4: Commit**

```bash
git add design-system/components/date-picker.tsx design-system/components/month-picker.tsx design-system/components/filter-chips.tsx design-system/components/columns-menu.tsx design-system/components/text-autocomplete.tsx design-system/components/confirm-submit-button.tsx design-system/components/receipt-field.tsx design-system/components/anchored-panel.tsx design-system/components/avatar.tsx design-system/components/rail-nav.tsx design-system/components/rail-icons.tsx design-system/components/mobile-nav.tsx design-system/components/notification-toast.tsx design-system/components/hero-card.tsx
git commit -m "Port remaining vibe-dealer components, generalized"
```

---

### Task 4: `design-system/CONTRACT.md`

**Files:**
- Create: `design-system/CONTRACT.md`

**Interfaces:**
- Produces: the standalone generation-constraints document Task 7's picker links to and future system-generation work (subsystem 3/4, later) reads as a hard constraint list.

- [ ] **Step 1: Write the document**

```markdown
# Formae Design System — Generation Contract

Every page built with this design system, in any of the three styles
(Ledger / Hearth / Blueprint), must satisfy these rules. They are
constraints on generation — human or AI — not background reading.

## The five page rules

1. **The page states its answer.** Find the one question the page exists
   to answer and make that the largest thing on it.
2. **States are designed, not defaulted.** Before data exists, the entry
   form *is* the page — no placeholder dashes standing in for a verdict
   that cannot exist yet. After it exists, the input collapses to a
   summary with a Change affordance.
3. **Explanation sits beside the thing it explains.** Never a permanent
   banner above everything.
4. **Actions are named for what they do**, and the label matches the
   heading above it.
5. **Detail folds away.** Supporting evidence opens automatically only
   when the verdict says something is wrong.

## Two layout rules

- **Full width, left-aligned, like every other page.** A centred narrow
  column squeezes content into the middle and leaves a dead right-hand
  gutter. Cap *fields*, not pages.
- **Rows of cards don't stretch.** Where two cards of different natural
  heights sit side by side, use `items-start` — don't let the shorter one
  grow to match.

## Component rules (from the craft tokens, all three styles)

- Weight ceiling: nothing exceeds `--fw-semibold`. No 700/800/900 weights,
  anywhere, in any style.
- Tracking scales negatively with size — a large heading needs tighter
  tracking than body text, not zero tracking at every size.
- Every control has a real associated `<label>` (via `Field`, `useId()`)
  — never a placeholder standing in for a label.
- Numeric columns get `tabular-nums`. Never on running prose.
- Status is never color alone — pair every status color with a text label
  (`StatusDot` does this by construction).
- Disabled means a real `disabled` attribute, not `opacity-40` on a
  non-interactive element.

Source: extracted from `vibe-dealer`'s redesign against Stripe, Linear and
Vercel as references (`docs/redesign-plan.md` in that repo), validated
across thirteen in-shell pages plus login at axe wcag2a/wcag2aa, 1440×1000
and 390×844, zero horizontal scroll.
```

- [ ] **Step 2: Commit**

```bash
git add design-system/CONTRACT.md
git commit -m "Write the design-system generation contract"
```

---

### Task 5: Hearth token set (new design)

**Files:**
- Create: `design-system/tokens/hearth.css`

**Interfaces:**
- Produces: the same custom-property names as `ledger.css` (Task 1) — `--color-canvas`, `--color-primary` (+variants), `--color-jade`/`-brass`/`-clay`/`-slate`/`-info` (+variants), `--fw-*`, `--tracking-*`, `--border-*`, `--shadow-hue`, `--hairline`, `--ease-out-quad`, `--dur*` — under different values. Any component from Tasks 2–3 must render correctly under this file with zero code changes.

- [ ] **Step 1: Design the palette**

Target register: 美容/沙龙, 零售/门店, 服务型公司 — client-facing service businesses, lower data density than Ledger's wholesale-ledger use case. Explicitly avoid the generic-AI "warm cream + terracotta" pairing (flagged during this session's research as one of the most common AI-generated-design tells). Direction:
- Neutral background: a soft sage-leaning off-white (not literal cream) — pick a value with a slight green/grey bias, matching Ledger's precedent of a *biased* neutral rather than a pure grey.
- Accent: a muted teal or warm clay (not pink — avoid "beauty industry = pink"). Must hit ≥4.5:1 contrast on the canvas as text, same bar Ledger's primary blue was held to.
- Radii and spacing: more generous than Ledger's — this style's pages have fewer rows, more breathing room is appropriate where Ledger's density is not.
- Status five-hue family (jade/brass/clay/slate/info): keep Ledger's actual hue *values* — status meaning should be recognizable across styles, only the neutrals and accent change per style. Do not redesign status colors per style.
- Weight ceiling, tracking scale, hairline, easing/duration: copy from `ledger.css` unchanged — these are universal craft tokens (Linear/Vercel-derived), not style-specific.

- [ ] **Step 2: Write `design-system/tokens/hearth.css`**

Same `@theme { ... }` and `:root { ... }` structure as `ledger.css`, same custom-property names, new values per Step 1. Comment each color choice with its rationale (why this neutral bias, why this accent, contrast ratio measured), matching the level of argument in the Ledger file — an uncommented palette is exactly the failure mode this whole plan exists to avoid (see Nadayu28's current `globals.css` for what an unargued palette looks like).

- [ ] **Step 3: Verify**

Run the Global Constraints grep (should be entirely clean — this file has no Vibe-derived content to attribute).

- [ ] **Step 4: Commit**

```bash
git add design-system/tokens/hearth.css
git commit -m "Design the Hearth token set for client-facing service businesses"
```

---

### Task 6: Blueprint token set (adapted from the acquisition site)

**Files:**
- Create: `design-system/tokens/blueprint.css`
- Read: `app/globals.css` (this repo's own file — the source for this task)

**Interfaces:**
- Produces: the same custom-property names as `ledger.css`/`hearth.css`, under values adapted from this repo's existing `--ink`/`--blueprint`/`--signal`/`--rust` palette.

- [ ] **Step 1: Read the existing source**

Read `app/globals.css` in this repo (already built, live in production) — the `--ink`, `--blueprint`, `--signal`, `--rust` custom properties and the drafting-grid/`sheet-marks`/`.annotation` vocabulary.

- [ ] **Step 2: Map to the shared token names, de-tuned for an internal tool**

Translate the acquisition site's marketing-page palette into the `design-system` token names (`--color-canvas` ← a much lighter-weight, quieter version of `--ink`'s dark ground or a light variant if this style should run light-mode for a dashboard — decide based on what a contractor's internal ops tool actually needs: high information density, used dozens of times a day, not a one-time atmospheric impression). Map `--blueprint` toward `--color-primary`, keep `--signal`/`--rust` as the closest-matching entries in the five-hue status family rather than inventing new status hues (status meaning must stay recognizable across all three styles, per Task 5 Step 1's rule).

Explicitly drop: the ShaderGradient/ambient-motion machinery, the scroll-choreography (`SectionShell`'s parallax), the oversized ghost-numeral treatment — those serve a marketing hero's one-time impression, not a tool opened dozens of times a day. Keep, at a much quieter opacity: the drafting-grid background, `sheet-marks` registration ticks, `.annotation` mono-label voice — these read as "technical/precise," which is the actual fit for a contractor's own vocabulary, without the motion overhead.

Craft tokens (weight ceiling, tracking, hairline, easing/duration): same values as `ledger.css`/`hearth.css` — universal, not style-specific.

- [ ] **Step 3: Write `design-system/tokens/blueprint.css`**

Same structure as the other two token files, values per Step 2, comments explaining the de-tuning decisions (what was dropped and why, matching the argument density of the other two files).

- [ ] **Step 4: Verify**

Run the Global Constraints grep (should be clean — nothing Vibe-derived here to attribute; a comment attributing this repo's own `app/globals.css` as the source is fine and expected).

- [ ] **Step 5: Commit**

```bash
git add design-system/tokens/blueprint.css
git commit -m "Adapt the Blueprint token set from the acquisition site, de-tuned for internal-tool use"
```

---

### Task 7: Style-picker gallery page

**Files:**
- Create: `app/[locale]/style-picker/page.tsx`
- Create: `app/[locale]/style-picker/style-column.tsx`
- Create: `app/[locale]/style-picker/sample-content.tsx`
- Modify: `messages/en.json`, `messages/zh.json` (add `stylePicker.*` keys)
- Modify: `design-system/tokens/README.md` (note the picker as the reference consumer)

**Interfaces:**
- Consumes: all three token files (Tasks 1, 5, 6), all components from Tasks 2–3, `design-system/CONTRACT.md` (Task 4, linked from the page footer), `BRAND_NAME` from `lib/brand` (existing), the WhatsApp-deep-link pattern from `components/sections/conversion-cta.tsx` (existing — read it, this task's selection action follows the identical `wa.me` URL-construction approach, not a new mechanism).
- Produces: the page a client visits post-signing to pick a style — the terminal deliverable of this plan.

- [ ] **Step 1: Build `sample-content.tsx` — one representative content set, style-agnostic**

A single set of generic business data (not dealer-specific, not Nadayu28-specific) rendered through the Task 2–3 components: a `PageHeader` ("本月概览" / "This Month"), an `EmptyState` example, a small `DataGrid` (5-6 rows of generic transaction-like data: date, description, amount, status via `StatusDot`), a `Field`-wrapped form input, and a `FilterChips` row. This is the *same* JSX rendered three times (once per style) — only the wrapping token scope changes, which is the entire point: the client compares style against style, not content against content.

- [ ] **Step 2: Build `style-column.tsx`**

Props: `styleName: "ledger" | "hearth" | "blueprint"`, `label: string`. Wraps `<SampleContent />` in a container whose `className` or inline `style` scopes to that style's CSS file (import the three token files as CSS modules or scope via a wrapping class per style — pick whichever approach this repo's existing Tailwind v4 setup makes cleanest, matching how `app/globals.css` is currently loaded). Renders a heading with `label` and a "选这个风格" button.

- [ ] **Step 3: Build `page.tsx`**

Three `StyleColumn`s side by side (`grid-cols-3` on desktop, stacking to one column on mobile — reuse the acquisition site's existing responsive patterns). Page header explaining what's being compared. Footer link to `design-system/CONTRACT.md`'s content (render its rules inline or link out — pick inline, since this is the one place a client sees why the styles aren't just color swaps).

- [ ] **Step 4: Wire the selection action**

On "选这个风格" click, build a `wa.me` deep link exactly like `conversion-cta.tsx`'s existing `whatsappHref` construction (`https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(...)}`), with prefill text naming the chosen style (e.g. "我选择 Ledger 风格" / "I'd like the Ledger style"). Reuse the same `WHATSAPP_NUMBER` constant — do not duplicate it; import it from wherever `conversion-cta.tsx` will keep it once the real number is set (check whether it's already been extracted to `lib/brand.ts` or similar; if still a local constant in `conversion-cta.tsx`, extract it to `lib/brand.ts` as part of this step so both call sites share one source).

- [ ] **Step 5: Add i18n keys**

Add `stylePicker.title`, `stylePicker.subtitle`, `stylePicker.selectCta`, `stylePicker.contractLinkLabel`, and the three style labels/descriptions, to both `messages/en.json` and `messages/zh.json`.

- [ ] **Step 6: Verify**

Run `tsc --noEmit` (clean). Start the dev server, use Playwright to screenshot `/zh/style-picker` and `/en/style-picker` at desktop and mobile widths — confirm all three styles render visually distinct (different neutrals, different accent, different radii), no console errors, no horizontal scroll on mobile.

- [ ] **Step 7: Commit**

```bash
git add app/[locale]/style-picker/page.tsx app/[locale]/style-picker/style-column.tsx app/[locale]/style-picker/sample-content.tsx messages/en.json messages/zh.json design-system/tokens/README.md
git commit -m "Build the style-picker gallery page"
```

---

### Task 8: Validate against Nadayu28 (branch only, no merge to its main)

**Files:**
- External repo: `Tyouuu/Nadayu28-booking-`, new branch `design-system-validation`
- Modify (in that branch, that repo): `app/globals.css`
- Create (in that branch, that repo): `docs/design-system-validation-notes.md`

**Interfaces:**
- Consumes: `design-system/tokens/ledger.css` or `hearth.css` (pick whichever this task's implementer judges the closer fit to Nadayu28's actual pages — a smart-community system leans toward Ledger's ops-density register; confirm by skimming a couple of its page files before deciding, and record the choice in the validation notes).

- [ ] **Step 1: Set up the branch**

```bash
gh repo clone Tyouuu/Nadayu28-booking- /tmp/nadayu28-validation
cd /tmp/nadayu28-validation
git checkout -b design-system-validation
```

- [ ] **Step 2: Replace the token layer only**

Replace Nadayu28's `@theme` block in `app/globals.css` with the chosen style's token file content from this repo's `design-system/tokens/`. Do **not** port components in this task — the goal is to measure whether the *token layer alone*, dropped into a real unrelated codebase, is coherent and sufficient, or whether Nadayu28's existing components immediately break in ways that reveal a missing token.

- [ ] **Step 3: Run Nadayu28's own build and typecheck**

`npm run build` (or its equivalent — check `package.json`) inside `/tmp/nadayu28-validation`. Record every error or visibly broken page.

- [ ] **Step 4: Write the validation notes**

`docs/design-system-validation-notes.md` in that branch: which style was used and why, what broke, what token was missing (if anything), whether the port was mechanical or required real rework, and a concrete verdict — "the token layer is portable as-is" or "the token layer needs X before it's portable," with X being specific.

- [ ] **Step 5: Push the branch (not main), do not open a PR**

```bash
git push -u origin design-system-validation
```

- [ ] **Step 6: Bring the verdict back to this repo**

Back in this repo (`wei2chee`), append a short summary of the validation notes to `design-system/tokens/README.md` under a "Validated against" heading, linking the Nadayu28 branch.

- [ ] **Step 7: Commit (in this repo)**

```bash
git add design-system/tokens/README.md
git commit -m "Record the Nadayu28 token-layer validation result"
```
