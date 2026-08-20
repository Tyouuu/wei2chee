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
    try {
      if (!window.localStorage.getItem(KEY)) setShow(true);
    } catch {
      // A blocked localStorage must not take the page with it. Not showing the
      // notice is the right failure: it is informational, and the alternative
      // is showing it on every single navigation.
    }
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
      className="fixed bottom-4 left-4 right-4 z-50 mx-auto max-w-lg rounded-xl border border-border bg-background/95 p-4 shadow-lg backdrop-blur-sm sm:left-6 sm:right-auto"
    >
      <p className="text-[13px] leading-relaxed text-muted-foreground">
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
        className="mt-3 rounded-lg bg-primary px-4 py-1.5 text-[13px] font-semibold text-primary-foreground transition-colors hover:bg-primary/90"
      >
        {t("dismiss")}
      </button>
    </div>
  );
}
