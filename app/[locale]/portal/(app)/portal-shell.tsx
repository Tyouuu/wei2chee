"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { WHATSAPP_NUMBER } from "@/lib/brand";
import { SettingsDialog } from "../settings-dialog";
import type { SystemLang } from "@/lib/system-lang";
import { AddPageDialog } from "../add-page-dialog";
import chrome from "../chrome.module.css";
import {
  IconBlocks,
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
  trailing,
}: {
  href: string;
  active?: boolean;
  icon: ReactNode;
  children: ReactNode;
  external?: boolean;
  /** A badge or dot at the right end. Used by the 官网 group, where the two
   *  facts an owner opens this product for -- is it live, has anything come in
   *  -- have to be visible without navigating to find out. */
  trailing?: ReactNode;
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
      {trailing}
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

/** The public side's icon. A page icon on 官网 was part of the problem: it
 *  said "another one of your pages" about the only thing on this rail a
 *  stranger can reach. */
function IconGlobe() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-[15px] w-[15px]" aria-hidden="true">
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path d="M2.4 6.4h11.2M2.4 9.6h11.2" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M8 2c1.7 1.7 2.5 3.7 2.5 6S9.7 12.3 8 14c-1.7-1.7-2.5-3.7-2.5-6S6.3 3.7 8 2Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
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
  systemLang,
  ownerName,
  pages,
  sitePublished,
  enquiryCount,
  paid,
  isOwner,
}: {
  children: ReactNode;
  locale: string;
  accountEmail: string;
  /** What the system calls itself today — the customer's own answer if they
   *  gave one, otherwise the per-trade placeholder. */
  businessName: string;
  savedBusinessName: string | null;
  savedOwnerName: string | null;
  /** `projects.system_language` -- the language the customer's SYSTEM is built
   *  in, which this shell only passes through to the settings dialog. The
   *  shell itself is Formae and is always in the owner's locale. */
  systemLang: SystemLang;
  ownerName: string;
  pages: NavPage[];
  /** Whether /s/<slug> is actually reachable by a stranger today. */
  sitePublished: boolean;
  /** Enquiries posted through the public site. */
  enquiryCount: number;
  paid: boolean;
  /** 🔴 An OWNER adjusts the business; a 师傅 works in it.

      Everything hidden below is hidden because it is not his: the public site
      and its enquiries are the owner's marketing, the libraries and the
      specification are what he hands to us to build, and 交付 is a message to
      us about a job he is paying for. The money pages are already gone before
      this component sees them -- the layout filters them out by shape.

      ⚠️ This hides; it does not enforce. The enforcement is RLS
      (`sees_money()`) and each route's own refusal, because a rail is a
      suggestion and a URL is typeable. */
  isOwner: boolean;
}) {
  const t = useTranslations("portal.shell");

  /*
    THE ONE PAGE THAT IS NOT AN INTERNAL PAGE. Matched on `page_key`, which is
    the same key the home screen splits on and the same one the public route
    /s/<slug> renders -- not on the label, which the owner can rename to
    anything (「我的网站」, "Shopfront") without changing what it is.
  */
  const sitePage = pages.find((p) => p.key === "website") ?? null;
  const systemPages = pages.filter((p) => p.key !== "website");
  const tHome = useTranslations("portal.home");
  const pathname = usePathname();

  // The rail is a drawer below `lg`. Closed by default, and closed again by
  // any navigation — see the effect below.
  const [navOpen, setNavOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addPageOpen, setAddPageOpen] = useState(false);
  const [identity, setIdentity] = useState({
    businessName: savedBusinessName,
    ownerName: savedOwnerName,
    systemLang,
  });
  const shownName = identity.businessName ?? businessName;

  // Any navigation closes the drawer. The shell persists across route changes
  // rather than remounting, so without this a customer taps a page, the page
  // loads behind the drawer, and the drawer is still covering it.
  useEffect(() => {
    setNavOpen(false);
  }, [pathname]);

  const base = `/${locale}/portal`;
  // `endsWith` rather than `===`: next-intl's pathname carries the locale
  // prefix, and the home route has no trailing segment to compare against.
  const is = (suffix: string) => pathname === `${base}${suffix}`;

  const handoffHref = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(
    `我的系统设计已经确定了，请开始帮我建系统（账号：${accountEmail}）`,
  )}`;

  return (
    <div className={`${chrome.chrome} ${chrome.workbench} flex min-h-screen`}>
      {/* THE RAIL IS A DRAWER ON A PHONE.
          It was a fixed 236px column with no breakpoint on it, so at 390px it
          took 60% of the screen and pushed the working area off the right edge:
          tested with a hit-test sweep rather than measured, and「Read the
          specification」,「Message on WhatsApp」and every「Open and edit →」
          landed outside the viewport — present in the DOM, unreachable with a
          thumb, and not scrollable to because the shell is a flex row.

          Below `lg` it slides in over the page instead. Above it, nothing about
          the rail changes. */}
      {navOpen && (
        <button
          type="button"
          aria-label={t("navClose")}
          onClick={() => setNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/55 lg:hidden"
        />
      )}
      <aside
        aria-label={t("navLabel")}
        className={`fixed inset-y-0 left-0 z-50 flex h-screen w-[236px] shrink-0 flex-col border-r transition-transform duration-200 [background-color:var(--color-nav-bg)] [border-color:var(--color-nav-border)] lg:sticky lg:top-0 lg:z-auto lg:translate-x-0 ${
          navOpen ? "translate-x-0" : "-translate-x-full"
        }`}
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
              /* Adding a page writes a layout, and `save_project_page` asks
                 for the owner. A 「+」 that raises 「payment required」 or
                 nothing at all is the control this whole change exists to
                 stop drawing. */
              !isOwner ? null : (
              <button
                type="button"
                onClick={() => setAddPageOpen(true)}
                aria-label={tHome("addPageCta")}
                title={tHome("addPageCta")}
                className="grid h-5 w-5 place-items-center rounded-[var(--radius-xs)] [color:var(--color-nav-fg-dim)] hover:[background-color:var(--color-nav-hover)] hover:[color:var(--color-nav-fg)]"
              >
                <IconPlus className="h-[13px] w-[13px]" />
              </button>
              )
            }
          >
            {t("systemSection")}
          </SectionLabel>
          {systemPages.map((page) => (
            <NavRow
              key={page.key}
              href={`${base}/${page.key}`}
              active={is(`/${page.key}`)}
              icon={<IconPages />}
            >
              {page.label}
            </NavRow>
          ))}

          {/* ── THE PUBLIC SIDE ──────────────────────────────────────────
              「客户的system页面 跟客户的landing pages跟website应该是要分开放的」.

              官网 was the sixth row of 我的系统, between 客户 and nothing, drawn
              with the same page icon as the others. It is not another internal
              page: it has an address a stranger can type, it is either live or
              it is not, and enquiries arrive through it. The home screen was
              split on 2026-08-25 and the rail was not, which left the product
              saying two different things about the same six pages.

              This is Shopify's Online Store sitting apart from the admin, and
              Vercel putting Production in its own panel with the URL and the
              state on it rather than as one more item in a list.

              询价 moves here from 交付 with it. The note that put it there
              argued the generated pages were still a draft while these rows
              are real -- true, and beside the point: an enquiry is what the
              官网 produces, and the two belong to each other more than either
              belongs to a list of deliverables. */}
          {sitePage && isOwner && (
            <>
              <SectionLabel>{t("publicSection")}</SectionLabel>
              <NavRow
                href={`${base}/${sitePage.key}`}
                active={is(`/${sitePage.key}`)}
                icon={<IconGlobe />}
                trailing={
                  <span
                    aria-hidden="true"
                    title={sitePublished ? t("siteLive") : t("siteDraft")}
                    className={`h-[6px] w-[6px] shrink-0 rounded-full ${
                      sitePublished
                        ? "[background-color:var(--color-jade-bright)]"
                        : "[background-color:var(--color-nav-fg-dim)] opacity-60"
                    }`}
                  />
                }
              >
                {sitePage.label}
              </NavRow>
              <NavRow
                href={`${base}/enquiries`}
                active={is("/enquiries")}
                icon={<IconSpec />}
                trailing={
                  enquiryCount > 0 ? (
                    <span className="shrink-0 rounded-full px-1.5 [background-color:var(--color-nav-accent)] [color:var(--color-nav-bg)] [font-family:var(--font-numeric)] [font-size:10px] [font-weight:var(--fw-semibold)]">
                      {enquiryCount}
                    </span>
                  ) : null
                }
              >
                {t("enquiries")}
              </NavRow>
            </>
          )}

          {isOwner && (
            <>
          <SectionLabel>{t("librarySection")}</SectionLabel>
          <NavRow href={`${base}/library`} active={is("/library")} icon={<IconBlocks />}>
            {t("library")}
          </NavRow>
          <NavRow href={`${base}/templates`} active={is("/templates")} icon={<IconTemplates />}>
            {t("templates")}
          </NavRow>
          <NavRow href={`${base}/sections`} active={is("/sections")} icon={<IconTemplates />}>
            {t("sections")}
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
            </>
          )}

          {/* THE CONSOLE USED TO BE TWO ROWS HERE, AND THAT WAS THE BUG.

              「感覺我的平台有點四不像」. Reaching the admin panel meant scrolling
              past a sidebar built for somebody else -- the customer's own
              pages, then the component libraries, then DELIVER -- to find
              CONSOLE at the bottom. Two products, one set of furniture.

              It now lives at /console with its own shell, and on the admin
              deployment this file is not served at all. A link from here would
              therefore be a link to a 404 as often as not. See proxy.ts. */}
        </nav>

        <div className="shrink-0 border-t px-2 py-2 [border-color:var(--color-nav-border)]">
          {/* Two different things, deliberately separate. 生意资料 is about the
              BUSINESS (its name, the owner's name) and is a dialog because it
              is two fields. 我的账号 is about the PERSON — password, email,
              exporting their data, deleting it — and is a page because none of
              that belongs in a popup. */}
          {isOwner && (
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
          )}
          {/* THE ACCOUNT BLOCK.
              This replaces three separate things that used to sit stacked in
              this corner: a 「我的账号」 nav row, a non-interactive name/plan
              card under it, and — loose beneath both — a bare language
              switcher and an underlined "Sign out".

              The founder's objection was exact: 「语言切换就那么简单的躺在下面
              sign out也是」. Two unstyled controls lying in the corner of the
              rail is what a weekend build looks like, and this is the screen a
              Malaysian SME owner is on while deciding whether there is a
              company behind the URL.

              So it is one block, and it is a link. Avatar, who you are, what
              you are paying — the pattern every product of this shape uses.
              Language and Sign out are rows on the page it opens, alongside
              password, email and export, which is where settings belong. */}
          <Link
            href={`${base}/account`}
            aria-label={t("accountRow")}
            className={`mt-1 flex items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 transition-colors ${
              is("/account")
                ? "[background-color:var(--color-nav-active)]"
                : "hover:[background-color:var(--color-nav-hover)]"
            }`}
          >
            <span
              aria-hidden="true"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[var(--radius-pill)] [font-size:var(--text-micro)] [background-color:var(--color-nav-border)] [color:var(--color-nav-fg)] [font-weight:var(--fw-semibold)]"
            >
              {ownerName.slice(0, 1)}
            </span>
            <span className="min-w-0 flex-1 leading-tight">
              {/* 🔴 WHO AM I SIGNED IN AS. `ownerName` is the BUSINESS
                  OWNER's name, which is the right answer on his own screen and
                  a wrong one on anybody else's -- a supervisor was reading
                  「陈老板」 over his own email address, as though he had signed
                  in as his boss. */}
              <span className="block truncate [font-size:var(--text-xs)] [color:var(--color-nav-fg)] [font-weight:var(--fw-semibold)]">
                {isOwner ? ownerName : accountEmail.split("@")[0]}
              </span>
              <span className="block truncate [font-size:var(--text-micro)] [color:var(--color-nav-fg-dim)]">
                {accountEmail}
              </span>
            </span>
            {/* The plan is what the OWNER is paying. Beside a supervisor's own
                name it reads as a statement about him, and it is not one. */}
            {isOwner && (
            <span
              aria-hidden="true"
              className="shrink-0 rounded-[var(--radius-xs)] border px-1.5 py-0.5 [border-color:var(--color-nav-border)] [color:var(--color-nav-fg-dim)] [font-size:var(--text-micro)]"
            >
              {paid ? t("planPaid") : t("planFree")}
            </span>
            )}
          </Link>
        </div>
      </aside>

      {/* min-w-0 so a wide table inside a page scrolls itself instead of
          stretching the flex row and pushing the rail off-screen. */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* The only way back to the navigation once it is a drawer. It carries
            the business name for the same reason the rail's brand block does:
            on a phone this is the only place the customer is told whose system
            they are looking at. */}
        <div className="flex items-center gap-3 border-b px-4 py-2.5 [border-color:var(--color-ink-800)] lg:hidden">
          <button
            type="button"
            onClick={() => setNavOpen(true)}
            aria-label={t("navOpen")}
            aria-expanded={navOpen}
            className="-ml-1.5 grid h-9 w-9 shrink-0 place-items-center rounded-[var(--radius-md)] [color:var(--color-paper)] hover:[background-color:var(--color-ink-850)]"
          >
            <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
              <path d="M3 5.5h14M3 10h14M3 14.5h14" strokeLinecap="round" />
            </svg>
          </button>
          <span className="min-w-0 flex-1 truncate [color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
            {shownName}
          </span>
        </div>
        {children}
      </div>

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
        systemLang={identity.systemLang}
        onSaved={setIdentity}
      />
    </div>
  );
}
