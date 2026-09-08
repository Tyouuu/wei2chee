import type { ReactNode } from "react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { Render } from "@puckeditor/core";
import { BRAND_NAME } from "@/lib/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { AuthSettle } from "@/components/auth-settle";
import { puckConfig } from "@/design-system/editor/puck-config";
import { scopeClasses } from "@/lib/portal/palettes";
import { sampleSystem } from "@/lib/portal/sample-system";
import { SystemLangProvider } from "@/design-system/system-lang-context";
import chrome from "@/app/[locale]/portal/chrome.module.css";

/**
 * The frame around signing in and signing up.
 *
 * WHY IT MOVED ONTO THE PORTAL'S OWN TOKENS (2026-08-21)
 *
 * Measured across all thirteen reachable surfaces, the product was two
 * different design efforts and this page was the seam:
 *
 *   portal home / templates / library / styles / editor ... 2-3 shadow kinds,
 *                                                           55-223 transitions
 *   login / signup / forgot / legal / 404 / account / spec . 0 shadow kinds,
 *                                                           0 transforms
 *
 * Login measured 61 elements, zero shadows, zero transforms. It was styled from
 * app/globals.css — the MARKETING palette — while the product it opens is
 * styled from chrome.module.css. Two token systems either side of one click is
 * precisely the 「每个页面都是自己做自己」 the founder kept pointing at, and no
 * amount of polish inside either half fixes a seam.
 *
 * So this page now wears `.chrome`. It inherits Formae's own type scale,
 * elevation ladder and colour, and chrome-scale.test.ts governs it like every
 * other product surface.
 *
 * WHY THE PROOF PANEL SHOWS A REAL SYSTEM
 *
 * It used to state three facts and a price. True, and entirely tell rather than
 * show — on the one screen where somebody is deciding whether a stranger should
 * hold their business. A rendered fragment of an actual generated system, in
 * one of the three styles, is the same argument made with the product: this is
 * what you get, and it already speaks your trade. Same reasoning as the styles
 * page refusing to show colour swatches for the 版式.
 *
 * WHY A SPLIT AND NOT A BIGGER CARD, still. This is where a Malaysian SME owner
 * who has just been asked to trust a stranger decides whether there is a
 * company behind the URL, and an empty screen answers that badly. It collapses
 * to the form alone below `lg`: on a phone the panel would push the form under
 * the fold, and somebody opening a login link on their phone has already
 * decided.
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
  // Was a hardcoded Chinese copy of the landing page's sample, which meant
  // /en/login argued for the product in the wrong language on the exact
  // screen where somebody decides whether to trust it. Shared with the
  // showroom so a visitor who signs up finds what they were shown.
  const sample = sampleSystem(locale, "auth");

  const steps = [
    { n: "01", label: t("proofStep1") },
    { n: "02", label: t("proofStep2") },
    { n: "03", label: t("proofStep3") },
  ];

  return (
    <main
      className={`${chrome.chrome} grid min-h-screen lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]`}
    >
      {/* ---- the form ---- */}
      <div className="flex flex-col items-center px-6 py-8 sm:px-10 lg:px-14">
        <div className="flex w-full max-w-[26rem] items-center justify-between gap-4">
          <Link href={`/${locale}`} className="group flex items-center gap-2.5">
            {/* The same lockup as the signed-in shell's rail. One mark across
                the whole product is most of what "a company is behind this"
                is actually made of. */}
            <span
              aria-hidden="true"
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-md)] [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]"
            >
              F
            </span>
            <span className="leading-tight">
              <span className="block [color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)] tracking-[-0.01em]">
                {BRAND_NAME}
              </span>
              <span className={chrome.annotation}>sys.design</span>
            </span>
          </Link>
          <LocaleSwitcher />
        </div>

        {/* `my-auto` rather than `justify-center` on the column: the header
            above and the footer below keep their own positions, and only the
            form takes the remaining space — which is what centres it against
            the panel beside it rather than against the whole viewport. */}
        <AuthSettle className="my-auto w-full max-w-[26rem] py-12">
          <h1 className="text-balance [color:var(--color-paper)] [font-family:var(--font-display)] [font-size:var(--text-hero)] [font-weight:var(--fw-regular)] [letter-spacing:var(--tracking-title-lg)] leading-[1.05]">
            {title}
          </h1>
          <p className="mt-3 [color:var(--color-paper-dim)] [font-size:var(--text-base)] [line-height:var(--leading-body)]">
            {subtitle}
          </p>

          {/* The form is a real card now. It measured zero shadows before —
              every element on one plane — which is most of why the page read as
              flat next to the product behind it. */}
          {/* The ring is stated on its own rather than composed with
              var(--shadow-raised). On the dark ground that token is `none`,
              and `0 0 0 1px x, none` is invalid CSS — the browser drops the
              whole declaration and the panel loses its edge entirely. Same
              rewrite as `.sheet` in chrome.module.css, same reason. */}
          <div className="mt-8 rounded-[var(--radius-lg)] [background-color:var(--color-ink-900)] [box-shadow:0_0_0_1px_var(--border-subtle)] [padding:var(--pad-card-lg)]">
            {children}
          </div>

          {footer && (
            <div className="mt-6 [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">{footer}</div>
          )}
        </AuthSettle>

        <p className="w-full max-w-[26rem] [color:var(--color-paper-dim)] [font-size:var(--text-xs)]">
          <Link href={`/${locale}`} className="transition-colors hover:[color:var(--color-paper)]">
            ← {t("backToSite")}
          </Link>
        </p>
      </div>

      {/* ---- the proof ---- */}
      {/* The panel has to be a DIFFERENT SURFACE, not a slightly different
          one. --color-ink-950 measured #eaeae7 against a #f4f4f2 canvas — a
          delta of five in one channel, which at this size reads as a rendering
          artefact rather than as a split. Mixing 6% ink into the canvas keeps
          it derived from the tokens (so it follows a palette) while making the
          seam legible, and the radial gives the panel the one gradient this
          product had anywhere: measured across all thirteen surfaces, Formae
          used ZERO. Every reference product page runs between 2 and 47. */}
      <aside
        className="relative hidden overflow-hidden border-l [background-color:color-mix(in_oklab,var(--color-paper)_6%,var(--color-canvas))] [border-color:var(--color-ink-800)] lg:flex lg:flex-col lg:justify-center"
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:radial-gradient(760px_460px_at_72%_-6%,color-mix(in_oklab,var(--color-primary)_11%,transparent),transparent_68%)]"
        />
        <div className="relative mx-auto w-full max-w-[32rem] px-10 py-16">
          <p className={chrome.annotation}>{t("proofEyebrow")}</p>
          <p className="mt-4 text-balance [color:var(--color-paper)] [font-family:var(--font-display)] [font-size:var(--text-title)] [letter-spacing:var(--tracking-title)] leading-[1.25]">
            {t("proofTitle")}
          </p>

          {/* A real page of a real system, lifted off the panel. Two surfaces
              at two heights is the cheapest honest depth there is, and it is
              what the product's own home screen does with its page previews —
              so the door and the room are built the same way. */}
          <AuthSettle delay={0.12} className={`${chrome.mount} mt-9`}>
            <div
              className={`${scopeClasses("blueprint")} [background-color:var(--color-canvas)]`}
            >
              <div className="pointer-events-none origin-top-left [width:125%] [transform:scale(0.8)]">
                <div className="[padding:var(--pad-card-lg)]">
                  {/* 🔴 示范的**资料**跟着他的语言走，而示范画面上那几个字没有 ——
                  2026-09-08 `audit:platform` 在 `/en` 上量到「共 4 条」
                  「全部 4 笔都在这里」。那几个字来自 `SYSTEM_WORDS`，
                  而那个 context **预设是中文**（system-lang-context.tsx 写着
                  为什么：一个没有被包起来的组件，读它的是那个要被卖的老板）。

                  **同一件事两条路，只修了一条** —— showroom 那一支的注解
                  自己就写着上一半：「It used to be hardcoded Chinese, so /en
                  showed the product's central demonstration in a language the
                  visitor had explicitly declined」。这是它的下一半。 */}
                <SystemLangProvider lang={locale === "zh" ? "zh" : "en"}>
                    <Render config={puckConfig} data={sample as never} />
                  </SystemLangProvider>
                </div>
              </div>
            </div>
          </AuthSettle>

          <ol className="mt-9 flex flex-col gap-4 border-t pt-7 [border-color:var(--color-ink-800)]">
            {steps.map((step) => (
              <li key={step.n} className="flex gap-4">
                <span className="mt-[3px] shrink-0 [color:var(--color-primary)] [font-family:var(--font-numeric)] [font-size:var(--text-micro)] tracking-[0.14em]">
                  {step.n}
                </span>
                <span className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
                  {step.label}
                </span>
              </li>
            ))}
          </ol>

          <p className="mt-8 border-t pt-6 [border-color:var(--color-ink-800)] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
            {t("proofPrice")}
          </p>
        </div>
      </aside>
    </main>
  );
}
