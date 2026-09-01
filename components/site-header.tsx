"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BRAND_NAME } from "@/lib/brand";

/**
 * The landing page's navigation bar.
 *
 * WHAT WAS WRONG. There was none. The page was 4,655px of scroll with the only
 * brand mark and the only language control sitting inside the hero's first
 * 900px — so both disappeared the moment anyone scrolled — and **there was no
 * way to sign in from the landing page at all**. An existing customer arriving
 * at the site had to already know the /login URL. That is not a polish gap; it
 * is a returning customer hitting a wall on the front page.
 *
 * WHY IT IS THERE FROM THE TOP NOW, 2026-08-25. It used to slide in past 70vh,
 * and the hero carried its own brand line and its own language control in a
 * mono annotation row. Two navigations, two brand marks, two language
 * switchers, in two different type systems — which is what the founder was
 * looking at when he said 「这个语言切换器 就很影响颜值 ... 你自己用眼睛去看 协调
 * 吗」. It was not the switcher. It was that the page had two of everything.
 *
 * Photographed the same day: Linear, Attio, Stripe, Vercel and Polar all carry
 * ONE bar, present from the first pixel, transparent over the hero and solid
 * once you scroll past it. None of the five shows a language control in it at
 * all — Stripe and Vercel put theirs in the footer, which is where a decision
 * nobody makes in their first second belongs.
 *
 * So: transparent over the hero with light type, solid and dark-on-light after
 * it. The bar never competes with the headline because over the hero it has no
 * ground of its own; it only ever gains one when there is content behind it to
 * separate from.
 */
export function SiteHeader() {
  const t = useTranslations("nav");
  const locale = useLocale();
  // `landed` is "has the reader scrolled off the hero", not "should the bar
  // exist". The bar always exists now; this only decides whether it has a
  // ground under it.
  const [landed, setLanded] = useState(false);

  useEffect(() => {
    // 70vh rather than a pixel constant: the hero is sized to the viewport, so
    // a fixed number is wrong on every screen except the one it was tuned on.
    const onScroll = () => setLanded(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      data-landed={landed ? "" : undefined}
      className={`fixed inset-x-0 top-0 z-40 border-b transition-[background-color,border-color,color] duration-300 ${
        landed
          ? "border-border bg-background/85 text-foreground backdrop-blur-md"
          : "border-transparent bg-transparent text-white"
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3 sm:px-10">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className={`grid h-7 w-7 shrink-0 place-items-center rounded-[6px] text-[12px] font-semibold transition-colors ${
              "bg-primary text-primary-foreground"
            }`}
          >
            F
          </span>
          <span className="text-[14px] font-semibold tracking-[-0.01em]">{BRAND_NAME}</span>
        </Link>

        <span className="flex-1" />

        <nav className="flex items-center gap-1.5 sm:gap-3">
          {/* In-page anchors, because everything they point at is on this page.
              The ids are set by SectionShell. */}
          <a
            href="#how"
            className="hidden rounded-lg px-2.5 py-1.5 text-[13px] opacity-70 transition-opacity hover:opacity-100 sm:block"
          >
            {t("how")}
          </a>
          <a
            /* ⚠️ 从锚点改成网址（2026-09-01）。理由不是导航，是**可以贴**：
               这个市场讲给别人听的动作就是把连结贴进 WhatsApp，
               而一个 `#pricing` 贴出去，对方拿到的是首页。
               见 app/[locale]/pricing/page.tsx 的档头。 */
            href={`/${locale}/pricing`}
            className="hidden rounded-lg px-2.5 py-1.5 text-[13px] opacity-70 transition-opacity hover:opacity-100 sm:block"
          >
            {t("pricing")}
          </a>
          <Link
            href={`/${locale}/login`}
            className="rounded-lg px-2.5 py-1.5 text-[13px] opacity-70 transition-opacity hover:opacity-100"
          >
            {t("signIn")}
          </Link>
          <Link
            href={`/${locale}/signup`}
            className={`rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition-colors ${
              landed
                ? "bg-primary text-primary-foreground hover:bg-primary/90"
                : "bg-primary text-primary-foreground hover:brightness-110"
            }`}
          >
            {t("start")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
