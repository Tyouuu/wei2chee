"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";

/**
 * The cookie notice.
 *
 * WHY IT IS A NOTICE AND NOT A CONSENT WALL WITH TOGGLES. This product sets
 * exactly one kind of cookie: the Supabase session that keeps someone signed
 * in. There is no advertising pixel, no third-party analytics, no cross-site
 * tracking — so there is nothing to consent to and nothing to switch off. A
 * banner offering "Manage preferences" over a single strictly-necessary cookie
 * is theatre, and it trains people to dismiss the ones that matter.
 *
 * So it says what is true, once, with a link to the detail, and remembers that
 * it was read. IF ANALYTICS OR A PIXEL IS EVER ADDED, this has to become a real
 * consent gate that blocks those scripts until accepted — that is the line, and
 * it is written here so the next person changing this file meets it.
 *
 * Mounted below the fold's content and after hydration so it cannot cause a
 * layout shift on the landing page's first paint.
 */
const KEY = "formae-cookie-notice-v1";

export function CookieNotice({ locale }: { locale: string }) {
  const t = useTranslations("legal.cookie");
  const [show, setShow] = useState(false);

  useEffect(() => {
    let seen = true;
    try {
      seen = Boolean(window.localStorage.getItem(KEY));
    } catch {
      // A blocked localStorage must not take the page with it. Not showing the
      // notice is the right failure: it is informational, and the alternative
      // is showing it on every single navigation.
      return;
    }
    if (seen) return;

    /*
      NOT ON THE FIRST SCREEN.

      This is `position: fixed`, and the landing page's first screen is a
      full-viewport composition ending in the product screenshot -- so wherever
      the notice sat, it sat on top of the one object the page exists to show.
      Photographed at 1440 on 2026-08-25: a 384px card across the bottom-left
      corner of the dashboard shot, in every screenshot of the fold.

      Waiting for the reader to leave the fold costs nothing. There is no
      script to gate (see the note above -- one session cookie, set at login,
      which nobody on the landing page has reached yet), so showing the notice
      four hundred pixels later is not a compliance difference. It is the
      difference between a first impression with a grey box on it and one
      without.
    */
    const reveal = () => {
      if (window.scrollY > window.innerHeight * 0.6) {
        setShow(true);
        window.removeEventListener("scroll", reveal);
      }
    };
    reveal();
    window.addEventListener("scroll", reveal, { passive: true });
    return () => window.removeEventListener("scroll", reveal);
  }, []);

  function dismiss() {
    setShow(false);
    try {
      window.localStorage.setItem(KEY, new Date().toISOString());
    } catch {
      // Same reasoning — dismissing has to work even if it cannot be remembered.
    }
  }

  if (!show) return null;

  return (
    <div
      role="region"
      aria-label={t("label")}
      // Smaller, further in from the corner, and rounder. It used to be a
      // 512px slab pinned 16px off the corner, so on the hero it landed
      // across the product screenshot -- the one object on the fold the
      // page exists to show. max-w-sm and bottom-6/left-6 keep it clear.
      // ⚠️ 手机上它以前是 **141px 高，占一支手机萤幕的 16.7%**，而且每一屏都在
      // （实测 390×844）—— 一条同意条挡掉六分之一的画面，挡的还是这一页
      // 唯一在卖东西的那几屏。现在字挤成一行、按钮跟它并排，量出来 141 → 74。
      className="fixed right-3 bottom-4 left-3 z-50 mx-auto flex max-w-sm items-center gap-3 rounded-2xl border border-border/80 bg-background/95 p-3 shadow-[0_18px_50px_-18px_rgba(0,0,0,0.6)] backdrop-blur-md sm:right-auto sm:bottom-6 sm:left-6 sm:block sm:p-4"
    >
      <p className="min-w-0 text-[12px] leading-snug text-muted-foreground sm:text-[13px] sm:leading-relaxed">
        {t("body")}{" "}
        <Link
          href={`/${locale}/legal/privacy`}
          className="font-medium text-foreground underline underline-offset-4"
        >
          {t("link")}
        </Link>
      </p>
      <button
        type="button"
        onClick={dismiss}
        className="shrink-0 rounded-lg bg-primary px-4 py-1.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90 sm:mt-3"
      >
        {t("dismiss")}
      </button>
    </div>
  );
}
