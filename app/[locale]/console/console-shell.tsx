"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import chrome from "@/app/[locale]/portal/chrome.module.css";

/**
 * The console's own chrome.
 *
 * WHY IT IS NOT PortalShell. Until 2026-08-28 the founder's admin panel sat
 * inside the customer portal's shell, so reaching it meant passing a sidebar
 * built for somebody else: 总览 · 客户 · 报价单 · 订单 · 收款 (the founder's own
 * test system's pages), then the component libraries, then DELIVER, and CONSOLE
 * last. Two different products wearing one set of furniture -- the founder's own
 * word for the result was 「四不像」.
 *
 * WHY A TOP BAR AND NOT A SIDEBAR. The two shells should not be mistakable for
 * each other at a glance, and there is a real reason beyond distinctness: the
 * customer portal's rail lists a variable number of the customer's own pages,
 * which is what a rail is for. The console has three destinations and will have
 * three for a long time. A 260px sidebar holding three rows is a sidebar
 * holding mostly nothing.
 *
 * NOT A SECURITY BOUNDARY. Every read behind this shell goes through a
 * `security definer` RPC that checks `is_founder()` on its own first line. This
 * is furniture.
 */
export function ConsoleShell({
  locale,
  email,
  children,
}: {
  locale: string;
  email: string;
  children: React.ReactNode;
}) {
  const t = useTranslations("portal.console");
  const pathname = usePathname();
  const router = useRouter();
  const base = `/${locale}/console`;

  // `/console/<uuid>` is a customer detail page and belongs under Overview:
  // it is where Overview's rows lead, so leaving the tab unlit there reads as
  // having navigated out of the app.
  const onLeads = pathname.startsWith(`${base}/leads`);
  const onLaw = pathname.startsWith(`${base}/law`);

  /* 把这条顶栏的高度交给 `PageBar` —— 见下面 `<main>` 上的那一段。
     写的是 DOM 上的一个 CSS 变数，不是 state：这个值只有排版要用，
     而经过一次 render 只会让画面多闪一次。 */
  const headerRef = useRef<HTMLElement>(null);
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const head = headerRef.current;
    const main = mainRef.current;
    if (!head || !main) return;
    const sync = () =>
      main.style.setProperty(
        "--bar-top",
        `${head.getBoundingClientRect().height}px`,
      );
    sync();
    const ro = new ResizeObserver(sync);
    ro.observe(head);
    return () => ro.disconnect();
  }, []);

  async function signOut() {
    await createBrowserSupabaseClient().auth.signOut();
    router.push(`/${locale}/login`);
    router.refresh();
  }

  const tab =
    "rounded-[var(--radius-md)] px-3 py-1.5 [font-size:var(--text-sm)] transition-colors";
  const on = `${tab} [background-color:var(--color-ink-850)] [color:var(--color-paper)] [font-weight:var(--fw-semibold)]`;
  const off = `${tab} [color:var(--color-paper-dim)] hover:[color:var(--color-paper)]`;

  /* `.chrome` is where every --color-ink-* and --color-paper token is declared
     -- it is Formae's own palette, deliberately separate from the customer's
     register. Without it this shell rendered with the tokens unresolved: the
     stat grid's `gap-px` showed as a bare line pattern because the cells had no
     background to sit on. The console is Formae's product, so it wears Formae's
     chrome; what it does NOT take is `.workbench`, which is the sidebar
     geometry this shell exists to not have. */
  return (
    <div
      className={`${chrome.chrome} min-h-screen [background-color:var(--color-ink-950)] [color:var(--color-paper)]`}
    >
      <header
        ref={headerRef}
        className="sticky top-0 z-20 flex flex-wrap items-center gap-x-5 gap-y-3 border-b px-6 py-3 [background-color:var(--color-ink-950)] [border-color:var(--color-ink-800)]"
      >
        <Link href={base} className="flex items-baseline gap-2">
          <span className="[font-size:var(--text-sm)] uppercase tracking-[0.22em] [color:var(--color-paper)] [font-weight:var(--fw-semibold)]">
            Formae
          </span>
          {/* The word that says which of the two products this is. It is the
              only place the distinction is stated, so it is not decoration. */}
          <span className="[font-size:var(--text-xs)] uppercase tracking-[0.18em] [color:var(--color-brass-bright)]">
            {t("shellName")}
          </span>
        </Link>

        <nav className="flex items-center gap-1">
          <Link href={base} className={onLeads || onLaw ? off : on}>
            {t("navOverview")}
          </Link>
          <Link href={`${base}/leads`} className={onLeads ? on : off}>
            {t("leadsTitle")}
          </Link>
          {/* The statutory rate tables. They are Formae's to maintain and not
              the customer's -- both writing functions check `is_founder()` on
              their own first line -- so until this tab existed neither had an
              entry point anywhere in the product. The customer's payroll page
              says the same thing in its own header: 「它们的家在 /console，
              不在这一页」. */}
          <Link href={`${base}/law`} className={onLaw ? on : off}>
            {t("navLaw")}
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-4">
          <span className="max-w-[16rem] truncate [font-size:var(--text-xs)] [color:var(--color-paper-dim)]">
            {email}
          </span>
          <button
            type="button"
            onClick={signOut}
            className="[font-size:var(--text-xs)] underline underline-offset-4 [color:var(--color-paper-dim)] transition-colors hover:[color:var(--color-paper)]"
          >
            {t("signOut")}
          </button>
        </div>
      </header>

      {/* 🔴 `PageBar` 也是 `sticky top-0`，而这条顶栏也是 —— 两条都停在 0，
          一滚下去页面那一条就把这里的导航整个盖掉（2026-09-07 那几张图上
          看得到）。他看不到自己在哪一格，Overview / Leads / Statutory
          三个连结也点不到。而在这一行之前，console **三页都是这样**。

          ⚠️ 这个高度**量出来，不写死**。第一版我照 class 算了一个
          57px（`py-3` 24 ＋ 分页 32 ＋ 1px 的线），量出来是 58 ——
          而更要紧的是这条顶栏 `flex-wrap`：窄屏它会**折成两行**，
          高度跟着变。一个写死的数字在手机上一定是错的。 */}
      <main ref={mainRef}>{children}</main>
    </div>
  );
}
