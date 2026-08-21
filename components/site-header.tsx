"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { BRAND_NAME } from "@/lib/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";

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
 * WHY IT APPEARS ON SCROLL RATHER THAN SITTING THERE FROM THE START. The hero
 * is a full-bleed composition whose whole job is the first impression, and a
 * solid bar across the top of it competes with the one line of type it is built
 * around. So the hero keeps its own in-composition brand line, and this takes
 * over once that line has scrolled away — which is also the moment a reader
 * starts wanting navigation rather than atmosphere.
 */
export function SiteHeader() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const [shown, setShown] = useState(false);

  useEffect(() => {
    // 70vh rather than a pixel constant: the hero is sized to the viewport, so
    // a fixed number is wrong on every screen except the one it was tuned on.
    const onScroll = () => setShown(window.scrollY > window.innerHeight * 0.7);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 border-b transition-all duration-300 ${
        shown
          ? "translate-y-0 border-border bg-background/85 backdrop-blur-md"
          : "-translate-y-full border-transparent"
      }`}
    >
      <div className="mx-auto flex max-w-5xl items-center gap-4 px-6 py-3 sm:px-10">
        <Link href={`/${locale}`} className="flex items-center gap-2.5">
          <span
            aria-hidden="true"
            className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] bg-primary text-[12px] font-semibold text-primary-foreground"
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
            className="hidden rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            {t("how")}
          </a>
          <a
            href="#pricing"
            className="hidden rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground sm:block"
          >
            {t("pricing")}
          </a>
          <LocaleSwitcher tone="page" />
          <Link
            href={`/${locale}/login`}
            className="rounded-lg px-2.5 py-1.5 text-[13px] text-muted-foreground transition-colors hover:text-foreground"
          >
            {t("signIn")}
          </Link>
          <Link
            href={`/${locale}/signup`}
            className="rounded-lg bg-primary px-3.5 py-1.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
          >
            {t("start")}
          </Link>
        </nav>
      </div>
    </header>
  );
}
