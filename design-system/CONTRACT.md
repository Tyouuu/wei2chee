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
