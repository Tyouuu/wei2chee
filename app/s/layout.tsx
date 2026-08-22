import { fontVariables } from "@/app/fonts";
import "../globals.css";

/**
 * The root layout for a customer's published website.
 *
 * ── WHY THERE ARE TWO ROOT LAYOUTS ────────────────────────────────────────
 *
 * `app/[locale]/layout.tsx` is the other one, and everything under it is
 * Formae talking to a business owner: a locale in the URL, next-intl's
 * provider, our Open Graph card, our title template. None of that belongs on
 * /s/<slug>, which is that business talking to ITS customers — a URL they may
 * print. So this branch is its own root: its own <html>, its own <body>, and
 * deliberately nothing else.
 *
 * ── WHAT IT DELIBERATELY DOES NOT HAVE ────────────────────────────────────
 *
 * No `NextIntlClientProvider`. The page's language is `projects.system_language`,
 * resolved on the server and passed through `SystemLangProvider` — a visitor's
 * browser preference is not a vote on what words a business uses about its own
 * quotations. No Formae metadata: the tab says the business's name and nothing
 * appended, because a generated site whose tab advertises the generator is
 * advertising us on their page.
 *
 * ── lang="en" ─────────────────────────────────────────────────────────────
 *
 * The DEFAULT system language (lib/system-lang.ts), and the honest answer for
 * the attribute a screen reader picks a voice from. A per-site value would be
 * better and needs the slug, which a layout does not receive; the page's own
 * <html lang> cannot be set from a child. Worth revisiting the day a customer
 * switches their system to Chinese and publishes.
 */
export default function PublicSiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={fontVariables}>
      <body>{children}</body>
    </html>
  );
}
