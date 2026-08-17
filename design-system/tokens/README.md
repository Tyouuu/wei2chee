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
