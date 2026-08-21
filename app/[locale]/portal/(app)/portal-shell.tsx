"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { createBrowserSupabaseClient } from "@/lib/supabase/client";
import { WHATSAPP_NUMBER } from "@/lib/brand";
import { LocaleSwitcher } from "@/components/locale-switcher";
import { SettingsDialog } from "../settings-dialog";
import { AddPageDialog } from "../add-page-dialog";
import chrome from "../chrome.module.css";
import {
  IconBlocks,
  IconConsole,
  IconHandoff,
  IconHome,
  IconPages,
  IconPlus,
  IconSettings,
  IconSpec,
  IconStyles,
  IconTemplates,
} from "./shell-icons";

/**
 * FORMAE'S APP SHELL.
 *
 * WHY IT EXISTS. The founder's question was 「为什么我会连个 sidebar 都没有」and
 * the answer was that there was not one. `/portal` was a 1643px scrolling page
 * under a single header bar with three text links in the corner — a landing
 * page's layout language (serif display type, an eyebrow, a centred narrow
 * column, big gaps between sections) wrapped around an application's content.
 * Every product this one is measured against — Linear, Vercel, Supabase,
 * Durable, 21st.dev — signs you in to a persistent left rail beside a working
 * surface. The irony he spotted is exact: the systems this product GENERATES
 * have a proper rail; the product selling them did not.
 *
 * WHY IT IS NOT `design-system/components/rail-nav.tsx`. That component is the
 * customer's navigation, inside the customer's chosen light style, naming the
 * customer's pages. Reusing it here would make Formae look like one of its own
 * outputs. This rail is Formae: the dark chrome, Instrument Serif nowhere near
 * it, and its own icon set (`shell-icons.tsx`).
 *
 * WHY THE EDITOR DOES NOT GET IT. `/portal/[pageKey]` deliberately sits outside
 * this route group. The canvas at 1440px already has to share the window with
 * Puck's component palette and a fields/assistant column; a fourth fixed column
 * would take it to about 550px, which is below what a five-column record table
 * can render without clipping — a defect this codebase has already fixed twice.
 * Durable, Framer and Webflow all go full-screen in their editors for the same
 * reason. The editor keeps its own page tabs and a 「← 我的系统」 exit.
 *
 * WHY THE TWO DIALOGS LIVE HERE. Settings and 加一页 used to be owned by the
 * home page, so they existed on exactly one screen. Mounted in the shell they
 * are reachable from every screen, which is what a rail is for.
 */

type NavPage = { key: string; label: string };

const ROW =
  "group relative flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-[7px] [font-size:var(--text-sm)] transition-colors duration-100";

function NavRow({
  href,
  active,
  icon,
  children,
  external,
}: {
  href: string;
  active?: boolean;
  icon: ReactNode;
  children: ReactNode;
  external?: boolean;
}) {
  const className = `${ROW} ${
    active
      ? "[background-color:var(--color-nav-active)] [color:var(--color-nav-fg)] [font-weight:var(--fw-semibold)]"
      : "[color:var(--color-nav-fg-dim)] hover:[background-color:var(--color-nav-hover)] hover:[color:var(--color-nav-fg)]"
  }`;

  const body = (
    <>
      {/* The active marker is a bar in the rail's own gutter, not a border on
          the row: a border shifts the row's text by its own width and makes the
          whole list twitch as you navigate. */}
      {active && (
        <span
          aria-hidden="true"
          className="absolute -left-2 top-1/2 h-[15px] w-[2.5px] -translate-y-1/2 rounded-full [background-color:var(--color-nav-accent)]"
        />
      )}
      <span className="shrink-0">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{children}</span>
    </>
  );

  if (external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
        {body}
      </a>
    );
  }
  return (
    <Link href={href} className={className}>
      {body}
    </Link>
  );
}

function SectionLabel({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2.5 pb-1 pt-5">
      <span className="[font-size:var(--text-micro)] uppercase tracking-[0.13em] [color:var(--color-nav-fg-dim)] [font-weight:var(--fw-semibold)] opacity-70">
        {children}
      </span>
      {action}
    </div>
  );
}

export function PortalShell({
  children,
  locale,
  accountEmail,
  businessName,
  savedBusinessName,
  savedOwnerName,
  ownerName,
  pages,
  paid,
  isFounder,
}: {
  children: ReactNode;
  locale: string;
  accountEmail: string;
  /** What the system calls itself today — the customer's own answer if they
   *  gave one, otherwise the per-trade placeholder. */
  businessName: string;
  savedBusinessName: string | null;
  savedOwnerName: string | null;
  ownerName: string;
  pages: NavPage[];
  paid: boolean;
  /** Shows the founder's console entry. Never a security boundary — the console
   *  routes and their RPCs check the role themselves. This only decides whether
   *  a link is drawn. */
  isFounder: boolean;
}) {
  const t = useTranslations("portal.shell");
  const tHome = useTranslations("portal.home");
  const tEditor = useTranslations("portal.editor");
  const pathname = usePathname();
  const router = useRouter();

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [identity, setIdentity] = useState({
    businessName: savedBusinessName,
    ownerName: savedOwnerName,
  });
  const shownName = identity.businessName ?? businessName;

  const base = `/${locale}/portal`;
  // `endsWith` rather than `===`: next-intl's pathname carries the locale
  // prefix, and the home route has no trailing segment to compare against.
  const is = (suffix: string) => pathname === `${base}${suffix}`;

  async function handleSignOut() {
    await createBrowserSupabaseClient().auth.signOut();
    router.push("/login");
  }

  const handoffHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `我的系统设计已经确定了，请开始帮我建系统（账号：${accountEmail}）`,
  )}`;

  return (
    <div className={`${chrome.chrome} ${chrome.workbench} flex min-h-screen`}>
      <aside
        aria-label={t("navLabel")}
        className="sticky top-0 flex h-screen w-[236px] shrink-0 flex-col border-r [background-color:var(--color-nav-bg)] [border-color:var(--color-nav-border)]"
      >
        {/* The workspace block. The BUSINESS is named first and Formae second,
            in the place a tool names itself — the same call Durable's Home
            makes, and the difference between "I am inside Formae" and "I am
            inside my own system". */}
        <Link
          href={base}
          className="flex items-center gap-2.5 border-b px-4 py-3.5 [border-color:var(--color-nav-border)] hover:[background-color:var(--color-nav-hover)]"
        >
          <span
            aria-hidden="true"
            className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-md)] [background-color:var(--color-nav-accent)] [color:var(--color-nav-bg)] [font-size:var(--text-sm)] [font-weight:var(--fw-display)]"
          >
            F
          </span>
          <span className="min-w-0 leading-tight">
            <span className="block truncate [font-size:var(--text-sm)] [color:var(--color-nav-fg)] [font-weight:var(--fw-semibold)]">
              {shownName}
            </span>
            <span className="block [font-size:var(--text-micro)] uppercase tracking-[0.14em] [color:var(--color-nav-fg-dim)] [font-family:var(--font-mono)]">
              Formae
            </span>
          </span>
        </Link>

        <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          <div className="pt-3">
            <NavRow href={base} active={is("")} icon={<IconHome />}>
              {t("home")}
            </NavRow>
          </div>

          {/* The customer's own pages, in the rail. This is the single biggest
              reason the product read as a page rather than an app: the five
              things a customer actually works on were reachable only by
              scrolling a gallery. */}
          <SectionLabel
            action={
              <button
                type="button"
                onClick={() => setAddPageOpen(true)}
                aria-label={tHome("addPageCta")}
                title={tHome("addPageCta")}
                className="grid h-5 w-5 place-items-center rounded-[var(--radius-xs)] [color:var(--color-nav-fg-dim)] hover:[background-color:var(--color-nav-hover)] hover:[color:var(--color-nav-fg)]"
              >
                <IconPlus className="h-[13px] w-[13px]" />
              </button>
            }
          >
            {t("systemSection")}
          </SectionLabel>
          {pages.map((page) => (
            <NavRow
              key={page.key}
              href={`${base}/${page.key}`}
              active={is(`/${page.key}`)}
              icon={<IconPages />}
            >
              {page.label}
            </NavRow>
          ))}

          <SectionLabel>{t("librarySection")}</SectionLabel>
          <NavRow href={`${base}/library`} active={is("/library")} icon={<IconBlocks />}>
            {t("library")}
          </NavRow>
          <NavRow href={`${base}/templates`} active={is("/templates")} icon={<IconTemplates />}>
            {t("templates")}
          </NavRow>
          <NavRow href={`${base}/styles`} active={is("/styles")} icon={<IconStyles />}>
            {t("styles")}
          </NavRow>

          <SectionLabel>{t("deliverSection")}</SectionLabel>
          <NavRow href={`${base}/spec`} active={is("/spec")} icon={<IconSpec />}>
            {t("spec")}
          </NavRow>
          <NavRow href={handoffHref} external icon={<IconHandoff />}>
            {t("handoff")}
          </NavRow>

          {isFounder && (
            <>
              <SectionLabel>{t("founderSection")}</SectionLabel>
              <NavRow href={`${base}/console`} active={is("/console")} icon={<IconConsole />}>
                {t("console")}
              </NavRow>
              <NavRow href={`${base}/console/leads`} active={is("/console/leads")} icon={<IconSpec />}>
                {t("leads")}
              </NavRow>
            </>
          )}
        </nav>

        <div className="shrink-0 border-t px-2 py-2 [border-color:var(--color-nav-border)]">
          {/* Two different things, deliberately separate. 生意资料 is about the
              BUSINESS (its name, the owner's name) and is a dialog because it
              is two fields. 我的账号 is about the PERSON — password, email,
              exporting their data, deleting it — and is a page because none of
              that belongs in a popup. */}
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className={`${ROW} w-full [color:var(--color-nav-fg-dim)] hover:[background-color:var(--color-nav-hover)] hover:[color:var(--color-nav-fg)]`}
          >
            <span className="shrink-0">
              <IconSettings />
            </span>
            <span className="min-w-0 flex-1 truncate text-left">{t("settings")}</span>
          </button>
          <NavRow href={`${base}/account`} active={is("/account")} icon={<IconPages />}>
            {t("account")}
          </NavRow>

          <div className="mt-1 flex items-center gap-2 rounded-[var(--radius-md)] px-2.5 py-2">
            <span
              aria-hidden="true"
              className="grid h-6 w-6 shrink-0 place-items-center rounded-[var(--radius-xs)] [font-size:var(--text-micro)] [background-color:var(--color-nav-border)] [color:var(--color-nav-fg)] [font-weight:var(--fw-semibold)]"
            >
              {ownerName.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              <span className="block truncate [font-size:var(--text-xs)] [color:var(--color-nav-fg)]">
                {ownerName}
              </span>
              <span className="block truncate [font-size:var(--text-micro)] [color:var(--color-nav-fg-dim)]">
                {paid ? t("planPaid") : t("planFree")}
              </span>
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 px-2.5 pb-0.5 pt-1 [font-size:var(--text-xs)]">
            <LocaleSwitcher tone="dark" />
            <button
              type="button"
              onClick={handleSignOut}
              className="[color:var(--color-nav-fg-dim)] hover:[color:var(--color-nav-fg)] hover:underline"
            >
              {tEditor("signOut")}
            </button>
          </div>
        </div>
      </aside>

      {/* min-w-0 so a wide table inside a page scrolls itself instead of
          stretching the flex row and pushing the rail off-screen. */}
      <div className="min-w-0 flex-1">{children}</div>

      <AddPageDialog
        open={addPageOpen}
        onClose={() => setAddPageOpen(false)}
        existingKeys={pages.map((p) => p.key)}
      />
      <SettingsDialog
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        businessName={identity.businessName}
        ownerName={identity.ownerName}
        onSaved={setIdentity}
      />
    </div>
  );
}
