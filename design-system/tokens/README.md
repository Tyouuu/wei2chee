# Design System Token Sets

This directory contains three visual registers for the Formae design system. Each defines the same custom-property names under its own values, allowing a consuming app to import exactly one token set that matches its visual identity and use case.

## Token Files

- **`ledger.css`** — Precision/high-density register for ops-heavy B2B businesses (wholesale, distribution, accounting). Navy-tinted neutrals, restrained blue accent, status-color family (jade, brass, clay, slate), intentionally light canvas for table-on-surface composition.

- **`hearth.css`** (Task 5) — Warmth-forward register for admin/operator onboarding and customer success. To be ported with separate color strategy emphasizing approachability and guidance.

- **`blueprint.css`** (Task 6) — Dark register for brand/identity contexts. Drafted-surface aesthetic with blueprint-blue linework and monospace annotations. Deliberately a single committed visual world (no light/dark pair).

## Token Pattern

Every token file exports the same custom-property names so components never reference a style name directly — only the custom properties:

```css
/* What components read: */
color: var(--color-paper);
background: var(--color-canvas);
font-weight: var(--fw-semibold);
```

The consuming app imports exactly one token file and adds it to its stylesheet or `@theme` block. Components never know which register is active; the tokens abstract that away.

## Consuming a Token Set

In your app's global stylesheet, import the token file:

```css
@import "design-system/tokens/ledger.css";
```

Or wire it into Tailwind's `@theme` inline block:

```css
@theme inline {
  /* Your app's font stack goes here */
  --font-sans: var(--font-your-sans);
  --font-mono: var(--font-your-mono);
  
  /* Token set takes care of the rest */
}
```

Then use the tokens on any element:

```tsx
<div className="text-[var(--color-paper)] bg-[var(--color-canvas)]">
  I am styled using the active token set.
</div>
```

## Design Rationale

Each token file includes detailed comments explaining *why* values were chosen, not only what they are. The rationales are universal — navy-tinted neutrals avoid the visual incoherence of mixing unrelated greys; a weight ceiling stops buttons and headings from racing into 800–900; tinted shadows preserve surface color fidelity. Read the comments in each file for the full design story.

## Reference Consumer: the Style Picker

`app/[locale]/style-picker/` is the one place this design system mounts all three token sets on the same page at once, so a client can compare them side by side before choosing one. It's worth reading as a worked example of the "same custom-property names, different values" pattern in action — three complete registers rendering the identical component tree (`PageHeader`, `DataGrid`, `StatusDot`, `Field`, `FilterChips`, `EmptyState`), with only the wrapping token scope changing between them.

It's also the one consumer that *doesn't* follow the "import exactly one token file" pattern above — a normal app only ever needs one register active, so a single `@theme`/`:root` import is exactly right for it. Mounting three registers simultaneously runs into a real constraint: `@theme` always compiles to `:root`, and `:root` cannot be scoped to a subtree, so importing `ledger.css`, `hearth.css` and `blueprint.css` directly into one page would have all three collide on every custom-property name, with the last import winning. `app/[locale]/style-picker/style-scope.module.css` works around this by rebinding each file's declarations to a `.ledger` / `.hearth` / `.blueprint` class instead of `:root` — see that file's header comment for the full reasoning and its sync-with-source-of-truth caveat.

## Validated against: Nadayu28 (real production codebase)

To test whether the token layer alone — not the component library, just `ledger.css`'s `@theme`/`:root` block — is portable into a real, unrelated, already-shipped app, it was dropped into a past-client production repo (`Tyouuu/Nadayu28-booking-`, a three-perspective smart-community management system) with zero component changes, on a throwaway branch that was never merged: [`design-system-validation`](https://github.com/Tyouuu/Nadayu28-booking-/tree/design-system-validation) (see `docs/design-system-validation-notes.md` on that branch for the full write-up).

**Style picked:** Ledger — Nadayu28's admin console (audit log, billing/arrears reporting, CSV export, violation tracking) and even its resident dashboard read as a dense operational register, not Hearth's "handful of large things on a page" shape.

**Result:** `next build` and TypeScript both pass with zero errors after the swap — and that's the finding. It's a false-green: Tailwind v4 silently drops any utility class whose backing custom property no longer exists rather than erroring, so all 1,111 usages of Nadayu28's own `nadayu-*` color classes across 23 files compiled to *no CSS at all* (verified directly in the compiled bundle, not inferred). `--font-sans` — the one property name both files share by convention — is left commented out in `ledger.css`, so the app silently lost its Inter font and fell back to system fonts. A secondary issue: pasting Ledger's `body`/`:focus-visible` global rules above Nadayu28's own pre-existing versions of the same selectors produced same-specificity source-order collisions (Nadayu28's older, un-tokenized rules partially winning), including a compound broken state where two focus rings render at once.

**Verdict:** the token *values* themselves are self-consistent and dropped in without errors, but the token layer needs (1) a rename/compatibility mechanism for a pre-existing app's own custom-property names — since a mismatch here fails silently, not loudly, and (2) `--font-sans` to ship with an explicit system-font default rather than commented out. Both are structural gaps, not general-purpose polish.
