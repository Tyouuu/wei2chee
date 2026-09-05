"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SettingsDialog } from "../settings-dialog";
import type { SystemLang } from "@/lib/system-lang";
import { AddPageDialog } from "../add-page-dialog";
import { CommandBar, FindButton } from "./command-bar";
import chrome from "../chrome.module.css";
import {
  IconHome,
  IconPages,
  IconPlus,
  IconSettings,
  IconSpec,
  IconStyles,
  IconClock,
  IconCoin,
  IconWrench,
  IconCar,
  IconWallet,
  IconBook,
  IconPercent,
  IconHourglass,
  IconOut,
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


/**
 * 点下去到画面真的换掉之间，那一格自己会讲一句话。
 *
 * 🔴 走一遍量出来的（`npm run walk`，2026-09-02）：
 * **手机上从侧栏点进报价单，等 1330ms 才有第一个变化，而中间画面上
 * 没有任何「正在做」的样子。** 一秒三，对一个站在客人后面的老板来说，
 * 那就是「这个按钮坏了」—— 然后他会再按一次。
 *
 * `useLinkStatus` 只能长在 `<Link>` 里面（它读的是那一条连结自己的状态），
 * 所以它是 NavRow 的一个子元素，不是外面包一层。
 *
 * ⚠️ 故意只画一条极细的进度线，不是转圈圈：这一格是导航，
 * 一个转圈圈会把「你在哪一页」这件事变成一个动画。
 * 而且 200ms 以内不显示 —— 预取过的页面是瞬间的，
 * **给一个已经完成的动作画一个载入中，比不画更吵。**
 */
function NavPending() {
  const { pending } = useLinkStatus();
  if (!pending) return null;
  return (
    <span
      aria-hidden="true"
      /* 走一遍那把尺认这个属性 —— 一个没有人看过它亮起来的指示器，
         跟没有指示器是同一回事。 */
      data-nav-pending=""
      className="pointer-events-none absolute inset-x-2 bottom-0 h-[2px] overflow-hidden rounded-full"
    >
      <span className="block h-full w-full origin-left [animation:nav-pending_600ms_200ms_ease-out_both] [background-color:var(--color-brand)]" />
    </span>
  );
}

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
      <NavPending />
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
  hasVehicles,
  hasContracts,
  hasBatches,
  hasRentals,
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
  /** 🔴 两条跟行业走的工具，按**有没有资料**决定画不画。

      一间沙龙没有车，一家五金店不做定期保养 —— 而侧栏上一条永远用不到的
      连结，就是他讲过的「四不像」那件事的第 N 次（任务 20 砍掉六行的理由）。

      ⚠️ 而那留下一个洞：一台车都还没有的车厂看不到入口。
      补它的是「加一单」那一页底下那条架子，第一次从那里进去。 */
  hasVehicles: boolean;
  hasContracts: boolean;
  hasBatches: boolean;
  hasRentals: boolean;
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
  const [findOpen, setFindOpen] = useState(false);

  /* ⌘K / Ctrl+K，全域。
     ⚠️ 只在**没有在打字**的时候接管 —— 一个在编辑器里改标题的人按 Ctrl+K
     是在选字，不是在找东西。而 macOS 上 ⌘K 本来就是浏览器的网址列，
     所以两边都要 preventDefault，不然面板开了、网址列也跳出来。 */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "k" && e.key !== "K") return;
      if (!e.metaKey && !e.ctrlKey) return;
      e.preventDefault();
      setFindOpen((v) => !v);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
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

        <FindButton onOpen={() => setFindOpen(true)} />

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
              {/* The register is a decision about the PUBLIC site now — since
                  2026-09-04 every workbench page wears one system register, so
                  this row stopped being about 「my system's look」 and became
                  「what my shopfront looks like」. It belongs to 官网. */}
              <NavRow href={`${base}/styles`} active={is("/styles")} icon={<IconStyles />}>
                {t("styles")}
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

          {/* 他自己的工具。

              ⚠️ 这一组跟 2026-09-05 砍掉的那六行正好相反：那六行（组件库 ·
              模板库 · 版段库 …）是**我们的**东西摆在他的侧栏上；
              这几行每一行都是**他自己生意上的一件事**。

              🔴 而它们到 2026-09-06 为止全部没有入口：六十多支函式建好了 ·
              用真身分验过了 · 守卫红过了，而他打开浏览器找不到那颗按钮 ——
              而一个做完而没有人碰得到的功能，跟没做是同一件事。

              ⚠️ 每一行都按它那一页自己的守卡挡一次 ——
              钱那几页（欠钱 · 薪水 · 帐 · 税）对师傅是 404，
              **而一条通往 404 的连结比没有连结糟**。 */}
          <SectionLabel>{t("toolsSection")}</SectionLabel>
          <NavRow href={`${base}/today`} active={is("/today")} icon={<IconClock />}>
            {t("today")}
          </NavRow>
          {hasContracts && (
            <NavRow href={`${base}/contracts`} active={is("/contracts")} icon={<IconWrench />}>
              {t("contracts")}
            </NavRow>
          )}
          {hasVehicles && (
            <NavRow href={`${base}/vehicles`} active={is("/vehicles")} icon={<IconCar />}>
              {t("vehicles")}
            </NavRow>
          )}
          {hasBatches && (
            <NavRow href={`${base}/expiry`} active={is("/expiry")} icon={<IconHourglass />}>
              {t("expiry")}
            </NavRow>
          )}
          {hasRentals && (
            <NavRow href={`${base}/rentals`} active={is("/rentals")} icon={<IconOut />}>
              {t("rentals")}
            </NavRow>
          )}
          {isOwner && (
            <>
              <NavRow href={`${base}/owing`} active={is("/owing")} icon={<IconCoin />}>
                {t("owing")}
              </NavRow>
              <NavRow href={`${base}/payroll`} active={is("/payroll")} icon={<IconWallet />}>
                {t("payroll")}
              </NavRow>
              <NavRow href={`${base}/books`} active={is("/books")} icon={<IconBook />}>
                {t("books")}
              </NavRow>
              <NavRow href={`${base}/tax`} active={is("/tax")} icon={<IconPercent />}>
                {t("tax")}
              </NavRow>
            </>
          )}

          {/* 🔴 SIX ROWS USED TO SIT HERE AND THEY WERE THE 「四不像」.

              「我的formae现在感觉不伦不类啊」(2026-09-05), and the count says
              why: 组件库 · 模板库 · 版段库 · 风格库 · 需求书 · 交付 — six rows
              of a SECOND product wedged between the customer's own system and
              his public site. The first three are 21st.dev, a gallery built
              for engineers to browse; a renovation contractor does not shop
              for 69 components and 216 sections. We copied 21st.dev's gallery
              and copied its USERS along with it, and its users are us.

              交付 went with them for a harder reason: it opened a WhatsApp
              chat with a placeholder number, carrying a hardcoded Chinese
              sentence 「请开始帮我建系统」 — a dead button, in the wrong
              language, describing the superseded A' concept where the customer
              tuned a design and handed it back for us to build. Since
              2026-09-03 we sell a system on an annual fee; there is no
              handover.

              风格 and 需求书 did not die, they moved to where they belong:
              the register now governs the PUBLIC SITE only (the workbench
              collapsed to one on 2026-09-04), so it sits inside 官网; and the
              specification is a reference document about what he bought, so
              it sits by the account, not in the daily list.

              ⚠️ The pages themselves are untouched — /library, /templates,
              /sections all still render at their URLs. This removes them from
              the rail, not from the product. */}
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
          {/* 需求书 is not a page he opens daily — it is the written answer to
              「我买的这套包含什么」. It sits with the account for the same
              reason 我的账号 does: it is about the arrangement, not the work. */}
          {isOwner && (
            <NavRow href={`${base}/spec`} active={is("/spec")} icon={<IconSpec />}>
              {t("spec")}
            </NavRow>
          )}
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
            className="-ml-2.5 grid h-11 w-11 shrink-0 place-items-center rounded-[var(--radius-md)] [color:var(--color-paper)] hover:[background-color:var(--color-ink-850)]"
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

      <CommandBar
        locale={locale}
        open={findOpen}
        onClose={() => setFindOpen(false)}
        pages={pages}
        isOwner={isOwner}
      />
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
