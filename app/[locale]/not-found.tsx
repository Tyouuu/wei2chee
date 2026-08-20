import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BRAND_NAME } from "@/lib/brand";

/**
 * The 404.
 *
 * There wasn't one — a customer who mistyped a URL, or followed a link to a
 * page they had deleted, got Next's unstyled default: black Helvetica on white,
 * in English, with no way back. On a product sold in Chinese to people who are
 * being asked to trust it with their business, that page says "nobody is
 * running this".
 */
export default async function NotFound() {
  const t = await getTranslations("system");

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
      <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-primary">404</span>
      <h1 className="mt-4 font-serif text-[2rem] leading-tight tracking-[-0.025em]">
        {t("notFoundTitle")}
      </h1>
      <p className="mt-3 text-[14px] leading-relaxed text-muted-foreground">
        {t("notFoundBody")}
      </p>
      <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
        <Link
          href="/portal"
          className="rounded-lg bg-primary px-4 py-2.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
        >
          {t("backToPortal")}
        </Link>
        <Link
          href="/"
          className="rounded-lg border border-border px-4 py-2.5 text-[13px] transition-colors hover:border-foreground/30"
        >
          {BRAND_NAME}
        </Link>
      </div>
    </main>
  );
}
