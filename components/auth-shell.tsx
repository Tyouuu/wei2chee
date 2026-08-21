import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BRAND_NAME } from "@/lib/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";

/**
 * The frame around signing in and signing up.
 *
 * WHAT WAS WRONG WITH THE PREVIOUS ONE, MEASURED. A 400px card floating in a
 * 1440px window — about 70% of the screen empty — and not even centred in what
 * was left (293px of space above it, 235px below). The only brand mark was a
 * line of 11px monospace. The inputs were unstyled boxes with no placeholder,
 * no icon and no visible focus state. The language switcher hung off the card's
 * top-right corner, aligned to nothing.
 *
 * WHY A SPLIT AND NOT A BIGGER CARD. This is where a Malaysian SME owner who
 * has just been asked to trust a stranger with their business decides whether
 * there is a company behind the URL, and an empty screen answers that question
 * badly. The right half is not decoration: it is the same three facts the
 * landing page makes — what this is, how it works, what it costs — which are
 * the only trust signals available before anyone has paid for anything. Linear
 * and Supabase both solve the same problem the same way.
 *
 * It collapses to the form alone below `lg`. On a phone the proof panel would
 * push the form below the fold, and someone opening a login link on their phone
 * has already decided to sign in.
 */
export async function AuthShell({
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
  const t = await getTranslations("auth");

  const steps = [
    { n: "01", label: t("proofStep1") },
    { n: "02", label: t("proofStep2") },
    { n: "03", label: t("proofStep3") },
  ];

  return (
    <main className="grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
      {/* ---- the form ---- */}
      <div className="flex flex-col items-center px-6 py-8 sm:px-10 lg:px-14">
        <div className="flex w-full max-w-[26rem] items-center justify-between gap-4">
          <Link href={`/${locale}`} className="group flex items-center gap-2.5">
            {/* The same lockup as the signed-in shell's rail. One mark across
                the whole product is most of what "a company is behind this"
                is actually made of. */}
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-md)] bg-primary [font-size:var(--text-sm)] font-semibold text-primary-foreground"
            >
              F
            </span>
            <span className="leading-tight">
              <span className="block [font-size:var(--text-base)] font-semibold tracking-[-0.01em]">
                {BRAND_NAME}
              </span>
              <span className="block font-mono [font-size:var(--text-micro)] uppercase tracking-[0.16em] text-muted-foreground">
                sys.design
              </span>
            </span>
          </Link>
          <LocaleSwitcher tone="dark" />
        </div>

        {/* `my-auto` rather than `justify-center` on the column: the header
            above and the footer below keep their own positions, and only the
            form takes the remaining space — which is what centres it against
            the panel beside it rather than against the whole viewport. */}
        <div className="my-auto w-full max-w-[26rem] py-12">
          <h1 className="text-balance font-serif text-[2.75rem] leading-[1.05] tracking-[-0.03em]">
            {title}
          </h1>
          <p className="mt-2.5 [font-size:var(--text-sm)] leading-relaxed text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
          {footer && <div className="mt-6 [font-size:var(--text-sm)] text-muted-foreground">{footer}</div>}
        </div>

        <p className="w-full max-w-[26rem] [font-size:var(--text-xs)] text-muted-foreground">
          <Link href={`/${locale}`} className="transition-colors hover:text-foreground">
            ← {t("backToSite")}
          </Link>
        </p>
      </div>

      {/* ---- the proof ---- */}
      <aside className="relative hidden overflow-hidden border-l border-border bg-[color-mix(in_srgb,var(--color-foreground)_3.5%,transparent)] lg:flex lg:flex-col lg:justify-center">
        {/* The same ambient wash the Hero uses, so the two halves of the
            product read as one place. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_540px_at_78%_-8%,color-mix(in_srgb,var(--color-primary)_16%,transparent),transparent_70%)]"
        />
        <div className="relative mx-auto w-full max-w-[30rem] px-10 py-16">
          <p className="annotation">{t("proofEyebrow")}</p>
          <p className="mt-4 text-balance font-serif text-[1.75rem] leading-[1.25] tracking-[-0.02em]">
            {t("proofTitle")}
          </p>

          <ol className="mt-10 flex flex-col gap-5 border-t border-border pt-8">
            {steps.map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="mt-[3px] shrink-0 font-mono [font-size:var(--text-micro)] tracking-[0.14em] text-primary">
                  {step.n}
                </span>
                <span className="[font-size:var(--text-sm)] leading-relaxed text-muted-foreground">
                  {step.label}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-10 border-t border-border pt-6 [font-size:var(--text-sm)] leading-relaxed text-muted-foreground">
            {t("proofPrice")}
          </p>
        </div>
      </aside>
    </main>
  );
}
