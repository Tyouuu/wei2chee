"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import Link, { useLinkStatus } from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { SettingsDialog } from "../settings-dialog";
import type { SystemLang } from "@/lib/system-lang";
import { AddPageDialog } from "../add-page-dialog";
import { CommandBar, FindButton } from "./command-bar";
import { productHome, productPathFor } from "@/lib/portal/system-surface";
import chrome from "../chrome.module.css";
import {
  IconHome,
  IconPages,
  IconPlus,
  IconSettings,
  IconSpec,
  IconClock,
  IconCoin,
  IconWrench,
  IconCar,
  IconWallet,
  IconBook,
  IconPercent,
  IconHourglass,
  IconOut,
  IconTruck,
  IconCalendar,
  IconClockFace,
  IconMove,
  IconClass,
  IconChevron,
  IconHash,
  IconTag,
  IconTable,
  IconPot,
  IconSign,
  IconQueue,
  IconNoShow,
  IconStar,
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

/* 🔴 **44 只给触控那一边**（2026-09-07）。

   `walk:eyesight` 在 390 量出来：不到 44 的那四十一个里，**最大的一群
   是这一条侧栏的十三行，35px 高** —— 而在 390 上这条侧栏是一片
   `fixed inset-y-0` 的抽屉，也就是他真的用拇指去点的那一片。
   Apple 自己写的是「a button needs a hit region of at least 44x44 pt」，
   而[重点 24](../../../../docs/founder-points.md) 说判这一页的是**那个陌生人，
   而他在手机上**；这里更硬：按它的是站在客人后面、单手拿手机的老板。

   ⚠️ 而 `lg:min-h-0` 不是顺手加的。无条件长高，等於电脑上十三行
   各多 9px = **117px**，把底下那几行推到画面外 —— 而我们抄的那几个
   参考后台，侧栏行本来就是 35 上下。**触控要 44，滑鼠不要。**

   ⚠️ 那十三行里有一行不是这里画的：⌘K 那一颗在 `command-bar.tsx`，
   而那个档案现在**在别人手上**（[重点 20](../../../../docs/founder-points.md)）——
   只登记，没有动。所以这一轮收得掉十二行。 */
const ROW =
  "group relative flex min-h-11 items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-[7px] [font-size:var(--text-sm)] transition-colors duration-100 lg:min-h-0";

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
  nested,
}: {
  href: string;
  active?: boolean;
  icon: ReactNode;
  children: ReactNode;
  external?: boolean;
  /** 缩排 —— 它住在上面那一页底下，不是自己一行。 */
  nested?: boolean;
  /** A badge or dot at the right end. Used by the 官网 group, where the two
   *  facts an owner opens this product for -- is it live, has anything come in
   *  -- have to be visible without navigating to find out. */
  trailing?: ReactNode;
}) {
  const className = `${ROW} ${nested ? "ml-6" : ""} ${
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
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={className}
      >
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
    <svg
      viewBox="0 0 16 16"
      fill="none"
      className="h-[15px] w-[15px]"
      aria-hidden="true"
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="1.3" />
      <path
        d="M2.4 6.4h11.2M2.4 9.6h11.2"
        stroke="currentColor"
        strokeWidth="1.3"
      />
      <path
        d="M8 2c1.7 1.7 2.5 3.7 2.5 6S9.7 12.3 8 14c-1.7-1.7-2.5-3.7-2.5-6S6.3 3.7 8 2Z"
        stroke="currentColor"
        strokeWidth="1.3"
      />
    </svg>
  );
}

function SectionLabel({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
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
  hasSerials,
  hasCounter,
  hasTables,
  hasConsent,
  hasBatches,
  hasRentals,
  hasPurchases,
  hasStaff,
  twoShops,
  hasBookings,
  paid,
  isOwner,
  productSurface = false,
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
  /** 一台一台管的货 —— 一件都没有的生意看不到那一页。 */
  hasSerials: boolean;
  /** 货架上有没有一件货带着一个码。一个扫什么都扫不到的柜台
   *  不是一个功能，是一行要他跳过的东西（[任务 247] 那一条）。 */
  hasCounter: boolean;
  /** 他有没有开过桌 —— 绝大多数生意没有桌，而一间装修公司的侧栏上
   *  多两行「餐台 · 厨房」是两行要他跳过的东西（[任务 247] 那一条）。 */
  hasTables: boolean;
  /** 有没有写过一份同意书 —— 一间五金店永远没有，
   *  而一间 medi spa 每一个客人来都要签。 */
  hasConsent: boolean;
  hasBatches: boolean;
  hasRentals: boolean;
  /** 他有没有在买东西 —— 没有进货单的生意，「我欠人家的」永远是空的。 */
  hasPurchases: boolean;
  /** 名册上有没有人 —— 没有人就没有出勤可以记。 */
  hasStaff: boolean;
  /** 开着的店有没有两间 —— 一间店搬不了货。 */
  twoShops: boolean;
  /** 有没有预约那一页 —— 一个班住在它上面。 */
  hasBookings: boolean;
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
  /** 🔴 这个帐号每天用的是产品那套新界面（沙龙，见 lib/portal/system-surface.ts）。
   *  是的话：侧栏顶上多一行「打开你的系统」，而「客户 · 预约 · 收款 …」这几行
   *  点了直接去新版，不再落在旧样子的同一页。平台（这条侧栏）仍然在，
   *  它是建造期的地方；产品才是每天开的那一边。 */
  productSurface?: boolean;
}) {
  const t = useTranslations("portal.shell");

  /*
    THE ONE PAGE THAT IS NOT AN INTERNAL PAGE. Matched on `page_key`, which is
    the same key the home screen splits on and the same one the public route
    /s/<slug> renders -- not on the label, which the owner can rename to
    anything (「我的网站」, "Shopfront") without changing what it is.
  */
  const sitePage = pages.find((p) => p.key === "website") ?? null;
  /* 🔴 沙龙帐号（productSurface）的旧侧栏不列「不是沙龙的页」（任务 423/424）：
     报价单 · 工程 · 订单 是装修 / 批发的页，沙龙的默认页里本来就没有，
     示范帐号是先按通用页开出来再补的，才会带着它们。 */
  const systemPages = pages.filter(
    (p) =>
      p.key !== "website" &&
      !(productSurface && ["quotations", "projects", "orders"].includes(p.key)),
  );

  /**
   * 🔴 每一件工具属於哪一页。
   *
   * 老板 2026-09-06：**「现在太多东西了」**，而量出来他是对的 ——
   * 「你的工具」那一组早上七行、晚上十六行，**一天多九行**。
   * 那不是谁乱加，是**每接一扇门就多一行，而没有人管那一整条要长到多长**。
   *
   * 规矩换成一句：**每接一扇门，先问「它属於哪一页」，答不出来才给它自己一行。**
   *
   * 「谁欠我钱」不是一页，是他打开**客户**那一页时会问的那一句；
   * 「我欠人家的」在**供应商**底下；「帐 · 税」在**收款**底下。
   * 别人也是这样摆的：Xero 的 Bills to pay 在 Business 底下，
   * QuickBooks 的 Vendors 在 Expenses 底下。**一个问题不是一页。**
   *
   * ⚠️ **一页都没有少** —— 它只是住到它讲的那件事底下，
   * 而那一页没开的时候（`under` 不在他的清单里）它照旧自己一行。
   */
  const tools: {
    key: string;
    under: string | null;
    show: boolean;
    icon: ReactNode;
  }[] = [
    /* 今天要跟的跨每一页 —— 它不属於任何一件事，所以它留在最上面。 */
    { key: "today", under: null, show: true, icon: <IconClock /> },
    {
      key: "contracts",
      under: "customers",
      show: hasContracts,
      icon: <IconWrench />,
    },
    {
      key: "vehicles",
      under: "customers",
      show: hasVehicles,
      icon: <IconCar />,
    },
    { key: "owing", under: "customers", show: isOwner, icon: <IconCoin /> },
    /* 🔴 谁放过飞机 —— 跟「谁欠我钱」并排，但**不挡师傅**：
       `no_shows_of` 自己是 `works_here`，答的是「她可不可靠」不是「她欠多少」，
       站柜台的美发师自己就要知道明天来的那一个信不信得过（[任务 333/358]）。 */
    {
      key: "no-shows",
      under: "customers",
      show: hasBookings,
      icon: <IconNoShow />,
    },
    /* 🔴 完工请她给一句评价——[任务 371] 那个门牌的第二扇门,
       `reviews_of`（20260911010000）零个呼叫端。跟同意书/疗程记录
       同一条判断：一句评价属於一个人，柜台想到的时候正在看那个客人。
       跟「谁欠我钱」（钱）刻意不同：`reviews_of` 本身是 works_here，
       不挡师傅——她收到一句好评，做那件事的人自己该看得到。 */
    {
      key: "reviews",
      under: "customers",
      show: hasBookings,
      icon: <IconStar />,
    },
    /* 🔴 同意书住在**客户**底下 —— 一份同意书属於一个人，
       而她想到那件事的时候，正在看那个人（[任务 247] 那条规矩）。
       ⚠️ **不挡师傅**：那三支都是 works_here，而一份同意书上
       一个金额都没有 —— 写那一份字的人常常就是美疗师自己。 */
    { key: "consent", under: "customers", show: hasConsent, icon: <IconSign /> },
    /* 🔴 疗程记录 —— 跟同意书并排，理由一样：**一笔疗程属於一个人**。
       挡的是「这门生意会不会有这件事」，不是「她写过没有」：
       一间新开的 medi spa 一笔都还没记，而她正是最需要看到这个入口的人
       （同意书那一条靠「写过一份」，第一份是从别的地方进去的）。
       **有预约那一页 ＋ 有师傅那一页** —— 美容跟 medi spa 都有，
       补习没有师傅那一页，五金没有预约那一页。
       ⚠️ 不挡师傅：写这一笔的常常就是美疗师自己，而这一页上一个金额都没有。 */
    {
      key: "treatments",
      under: "customers",
      show: hasBookings && hasStaff,
      icon: <IconSign />,
    },
    /* 🔴 走单轮位 —— 住在**预约**底下，不是客户底下：它答的是「柜台现在该叫
       谁」，不是关於哪一个客人的事。跟同意书 · 疗程记录同一条判断：
       **有预约那一页 ＋ 有师傅那一页**才画（[任务 353/354]，
       Vagaro 没有这一件——不是每一行都有，[重点 34]）。
       不挡师傅：叫下一位的常常就是柜台自己，这一页上没有金额。 */
    {
      key: "walkin",
      under: "bookings",
      show: hasBookings && hasStaff,
      icon: <IconQueue />,
    },
    {
      key: "payables",
      under: "suppliers",
      show: isOwner && hasPurchases,
      icon: <IconTruck />,
    },
    { key: "books", under: "payments", show: isOwner, icon: <IconBook /> },
    { key: "tax", under: "payments", show: isOwner, icon: <IconPercent /> },
    {
      key: "attendance",
      under: "staff",
      show: isOwner && hasStaff,
      icon: <IconCalendar />,
    },
    {
      key: "rota",
      under: "staff",
      show: isOwner && hasStaff,
      icon: <IconClockFace />,
    },
    { key: "payroll", under: "staff", show: isOwner, icon: <IconWallet /> },
    {
      key: "serials",
      under: "inventory",
      show: hasSerials,
      icon: <IconHash />,
    },
    /* 🔴 柜台在收钱，所以只有老板 —— 那一支底下记帐那一步会拒绝师傅，
       而他要填完整篮才知道（那一页自己也挡了同一条）。 */
    {
      key: "counter",
      under: "inventory",
      show: isOwner && hasCounter,
      icon: <IconTag />,
    },
    /* 🔴 餐台 · 厨房都住在「订单」底下 —— 一张餐台单就是一张单
       （20260908010000：不另开一张中转单），所以它们讲的就是那一页那件事。
       ⚠️ **厨房不挡师傅**：`kitchen_queue` 是 works_here，而且它一栏金额都不回 ——
       炒粉那个人打得开，而他在那一页上读不到这门生意的任何一个数字。 */
    { key: "tables", under: "orders", show: hasTables, icon: <IconTable /> },
    { key: "kitchen", under: "orders", show: hasTables, icon: <IconPot /> },
    {
      key: "expiry",
      under: "inventory",
      show: hasBatches,
      icon: <IconHourglass />,
    },
    {
      key: "transfers",
      under: "inventory",
      show: isOwner && twoShops,
      icon: <IconMove />,
    },
    { key: "rentals", under: "inventory", show: hasRentals, icon: <IconOut /> },
    {
      key: "classes",
      under: "bookings",
      /* 班级是补习中心的页。沙龙帐号（productSurface）不出现 —— 它本来只判
         「老板 ＋ 有预约页」，没看行业（任务 423：沙龙只看沙龙需要的）。 */
      show: isOwner && hasBookings && !productSurface,
      icon: <IconClass />,
    },
  ];
  const hasPage = (k: string | null) =>
    k !== null && systemPages.some((p) => p.key === k);
  const toolsUnder = (k: string) =>
    tools.filter((x) => x.show && x.under === k);
  /* 🔴 规矩第四条：答得出「它属於哪一页」的，住在那一页底下；
     答不出来的（那一页他根本没开）才给它自己一行。 */
  const homeless = tools.filter((x) => x.show && !hasPage(x.under));
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

  /* 哪一页的工具摊开着。一次只摊一页 —— 全部摊开就是回到那条十四行的清单。 */
  const [openTools, setOpenTools] = useState<string | null>(null);

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
            {productSurface && (
              <NavRow href={productHome(locale)} active={false} icon={<IconPages />}>
                {t("openProduct")}
              </NavRow>
            )}
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
              /* 沙龙帐号没有「加一页」：那个菜单给的是旧模块库（订单 · 采购单 ·
                 报价单 …），新版是固定的十四页，要开关哪几页在租户设置里。 */
              !isOwner || productSurface ? null : (
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
            <Fragment key={page.key}>
              <NavRow
                href={
                  (productSurface ? productPathFor(locale, page.key) : null) ??
                  `${base}/${page.key}`
                }
                active={is(`/${page.key}`)}
                icon={<IconPages />}
                trailing={
                  toolsUnder(page.key).length > 0 ? (
                    <button
                      type="button"
                      onClick={(e) => {
                        /* 那一行本身是一条连结 —— 摊开不该顺便把他带走。 */
                        e.preventDefault();
                        e.stopPropagation();
                        setOpenTools((k) => (k === page.key ? null : page.key));
                      }}
                      aria-expanded={openTools === page.key}
                      aria-label={t("moreUnder")}
                      className="grid h-5 w-5 shrink-0 place-items-center rounded-[var(--radius-xs)] [color:var(--color-nav-fg-dim)] hover:[background-color:var(--color-nav-hover)] hover:[color:var(--color-nav-fg)]"
                    >
                      <IconChevron open={openTools === page.key} />
                    </button>
                  ) : undefined
                }
              >
                {page.label}
              </NavRow>
              {/* 🔴 它属於哪一页，就住在哪一页底下 —— **就地摊开，不用离开**。
                  ⚠️ 第一版写成「打开那一页才画」，而那**永远不会发生**：
                  模块页不在这个壳里（`[pageKey]` 是 `(app)` 的兄弟），
                  点进去连这条侧栏都没有了。一个到不了的入口跟没有入口一样。 */}
              {toolsUnder(page.key).length > 0 &&
                (openTools === page.key ||
                  toolsUnder(page.key).some((x) => is(`/${x.key}`))) &&
                toolsUnder(page.key).map((x) => (
                  <NavRow
                    key={x.key}
                    nested
                    href={`${base}/${x.key}`}
                    active={is(`/${x.key}`)}
                    icon={x.icon}
                  >
                    {t(x.key)}
                  </NavRow>
                ))}
            </Fragment>
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
              {/* 🔴 风格库从侧栏拿掉了（2026-09-08）—— 老板：「你先跳过风格库
                  因为现在有点不明不白 你先hide起来」。

                  它不明不白是有原因的，而那个原因量得出来：2026-09-04 之后
                  projects.style 只管一个画面 —— 客户的官网，工作台收敛成一套
                  （实测 shoot:one-register：工作台 1 种 · 官网 6 种）。
                  所以侧栏上这一行讲的是「我店面长什么样」，而它旁边站着的是
                  「我的系统」那一组 —— 一行在讲另一件事的东西，摆在这里就是不明不白。

                  ⚠️ 跟 2026-09-05 藏掉素材／模板／版段那三页同一个做法：
                  /portal/styles 照样打得开，只是不在侧栏上；而换官网风格
                  还有一个活着的地方 —— 官网那一页编辑器里那个换风格的面板。 */}
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
          {/* 🔴 这一组从十四行收到几行 —— 见 `tools` 那张表上面的注解。
              留在这里的只有两种：**跨每一页的**（今天要跟的），
              跟**那一页他根本没开的**（答不出「属於哪一页」）。 */}
          {homeless.length > 0 && (
            <>
              <SectionLabel>{t("toolsSection")}</SectionLabel>
              {homeless.map((x) => (
                <NavRow
                  key={x.key}
                  href={`${base}/${x.key}`}
                  active={is(`/${x.key}`)}
                  icon={x.icon}
                >
                  {t(x.key)}
                </NavRow>
              ))}
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
            <NavRow
              href={`${base}/spec`}
              active={is("/spec")}
              icon={<IconSpec />}
            >
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
              <span className="min-w-0 flex-1 truncate text-left">
                {t("settings")}
              </span>
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
            className={`mt-1 flex min-h-11 items-center gap-2.5 rounded-[var(--radius-md)] px-2.5 py-2 transition-colors lg:min-h-0 ${
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
            <svg
              viewBox="0 0 20 20"
              className="h-[18px] w-[18px]"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              aria-hidden="true"
            >
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
