import type { ReactNode } from "react";
import Link from "next/link";
import { BRAND_NAME } from "@/lib/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";

/**
 * The frame around signing in and signing up.
 *
 * Both pages were a `max-w-sm` column holding a heading and a form, floating on
 * the acquisition site's dark grid with no brand mark, no context and no way to
 * change language — which is `docs/portal-editor-known-issues.md` issue 5,
 * still open. It matters more than a login page usually does here: this is
 * where a Malaysian SME owner, who has just been asked to trust a stranger with
 * their business data, decides whether there is a company behind the URL.
 *
 * Deliberately modest. A card, a mark, a line saying what the page is for, and
 * the language control — not a redesign. The strongest trust signal available
 * is the sentence under the heading, because it is the only one that is
 * actually true this early: nothing has been paid for yet.
 */
export function AuthShell({
  locale,
  title,
  subtitle,
  children,
  footer,
}: {
  locale: string;
  title: string;
  subtitle: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-16">
      <div className="mb-8 flex items-center justify-between gap-4">
        <Link href={`/${locale}`} className="annotation !text-white/70 transition-colors hover:!text-white">
          {BRAND_NAME} / SYS.DESIGN
        </Link>
        <LocaleSwitcher tone="dark" />
      </div>

      <div className="rounded-xl border border-border bg-background/60 p-7 backdrop-blur-sm">
        <h1 className="font-serif text-[1.75rem] leading-tight tracking-[-0.02em] text-balance">
          {title}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{subtitle}</p>
        <div className="mt-7">{children}</div>
      </div>

      {footer && <div className="mt-6 text-center text-sm text-muted-foreground">{footer}</div>}
    </main>
  );
}
