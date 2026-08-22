"use client";

import { Toaster as Sonner, toast } from "sonner";

/**
 * Toasts, wired to this project's tokens rather than to next-themes.
 *
 * WHY NOT shadcn's OWN sonner.tsx. Theirs opens with
 * `const { theme } = useTheme()` from next-themes and hands sonner a
 * light/dark string. This app has no next-themes and does not want one: the
 * light/dark question here is not a user preference, it is the rule in
 * project_formae_design_decisions — Formae's chrome is dark, the customer's
 * system is light, and a toast belongs to whichever surface it was raised on.
 * Installing a theme library to answer a question we have already answered
 * would add a provider, a hydration flash, and a second source of truth.
 *
 * So the colours come from the same `--color-*` tokens every other component
 * reads. Raised inside a StyleScope, a toast wears the customer's register;
 * raised in the editor chrome, it wears Formae's. Nothing to configure.
 *
 * WHY IT EXISTS AT ALL. 84 of the 241 sections in the @7Ovr registry declare
 * `sonner` — a form that says "saved", a copy button that says "copied". It
 * was the single cheapest unlock in the whole catalogue: one npm package and
 * this file.
 */
export function Toaster({ ...props }: React.ComponentProps<typeof Sonner>) {
  return (
    <Sonner
      className="toaster group"
      style={
        {
          "--normal-bg": "var(--color-ink-900)",
          "--normal-text": "var(--color-paper)",
          "--normal-border": "var(--color-ink-800)",
          "--border-radius": "var(--radius-md)",
        } as React.CSSProperties
      }
      {...props}
    />
  );
}

export { toast };
