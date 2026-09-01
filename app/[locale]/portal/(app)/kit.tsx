"use client";

import type { ReactNode } from "react";
import chrome from "../chrome.module.css";

/**
 * FORMAE 自己的零件 —— 这个平台一直没有的那一层。
 *
 * ── 数出来的（2026-09-01，老板：`什么样的组件搭配到一起才是最好的啊 我们的元素啊`）──
 *
 * 我们自己的外壳有几个零件，各有几页在用：
 *
 *     PageBar 顶栏 ............ 11
 *     .mount  装客户预览的台子 .. 7
 *     Section 段落骨架 ......... 5（而且其中四个是 account 自己抄了一份）
 *     .annotation 眉标 ......... 2
 *     .sheet  Formae 自己的卡片 . **1**
 *
 * **没有的**：栏位 · 空状态 · 按钮 · 清单行。所以每要一个输入框就现写一次
 * class —— 整个 portal 里手写的「圆角 + 框」class 串有 **36 个**。
 *
 * 对照读到的（都读了原文，不是印象）：
 *   shadcn `dashboard-01` = **19 个零件**（sidebar breadcrumb separator label
 *     chart card select tabs table toggle-group badge button checkbox
 *     dropdown-menu drawer input avatar sheet sonner）
 *   shadcn `login-01` = 5 个：button **card** **input** **label** **field**
 *     —— 最后那个 `field` 就是「标签＋控件＋说明」，我们没有
 *   tabler（MIT · 41.5k★）的设定页 = **一张卡装整页**，卡里左边一列小导航，
 *     右边表单**并排两三栏**（`row g-3` + `col-md`）
 *
 * 我们的账号页：**没有卡**、没有小导航、每个输入框独占一整行，
 * 而且**没有看得见的标签** —— 标签是 placeholder，打了字就消失，
 * 你再也不知道那一格原本要填什么。`Field` 就是来修这一件的。
 *
 * ⚠️ 这一份只给 **Formae 自己的外壳**用。客户系统的零件在 `design-system/`，
 * 两边不可以混：那一边每一套风格长得不一样，这一边永远只有一个样子。
 */

/** 一张卡。`.sheet` 是这个外壳本来就有的卡片，一直只有一个人用。 */
export function Card({
  children,
  className = "",
  pad = true,
}: {
  children: ReactNode;
  className?: string;
  pad?: boolean;
}) {
  return (
    <div className={`${chrome.sheet} ${pad ? "p-6" : ""} ${className}`}>{children}</div>
  );
}

/** 卡里面的一段小标题。tabler 的 `CardTitle`，同一个位子。 */
export function CardTitle({ children, hint }: { children: ReactNode; hint?: string }) {
  return (
    <div className="mb-4">
      <h2 className="[color:var(--color-paper)] [font-size:var(--text-base)] [font-weight:var(--fw-semibold)]">
        {children}
      </h2>
      {hint && (
        <p className="mt-1 max-w-[62ch] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * 一个栏位 = 看得见的标签 ＋ 控件 ＋（说明）。
 *
 * 🔴 这是这一份里最重要的一个，因为它修的是一个真的毛病：
 * 账号页每一个输入框的标签都是 **placeholder**，打了第一个字就不见了。
 * 一个人改密码打到一半被打断，回来看到两个一模一样的空框，
 * 分不出哪个是新密码、哪个是再打一次。
 */
export function Field({
  label,
  hint,
  htmlFor,
  children,
  className = "",
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex min-w-0 flex-col gap-1.5 ${className}`}>
      <label
        htmlFor={htmlFor}
        className={`${chrome.annotation} [color:var(--color-paper-dim)]`}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p className="[color:var(--color-paper-dim)] [font-size:var(--text-xs)]">{hint}</p>
      )}
    </div>
  );
}

/** 并排。tabler 的 `row g-3` + `col-md` —— 一个手机号跟一个 email 不该各占一整行。 */
export function FieldRow({ children }: { children: ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2">{children}</div>;
}

/** 一行「名字 · 值」。本来长在 account 里面，搬出来因为 console 也在手写它。 */
export function DataRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b py-2.5 last:border-b-0 [border-color:var(--color-ink-850)]">
      <span className="[color:var(--color-paper-dim)] [font-size:var(--text-sm)]">{label}</span>
      <span className="text-right [color:var(--color-paper)] [font-size:var(--text-sm)]">
        {value}
      </span>
    </div>
  );
}

/* 一个控件长什么样，只写一次。整个 portal 现在手写了 36 次。
   ⚠️ 高度 40px 不是随便定的：手机上拇指按得稳的下限是 44，
   而输入框有 label 在上面撑着，按钮才是那个要够高的东西（见 `btn`）。 */
export const control =
  "w-full rounded-[var(--radius-md)] border px-3 py-2.5 [font-size:var(--text-sm)] outline-none [background-color:var(--color-ink-850)] [border-color:var(--color-ink-800)] [color:var(--color-paper)] transition-colors focus-visible:[border-color:var(--color-brand)]";

/** 三种按钮，够用了 —— 主要 / 安静 / 危险。 */
export function btn(kind: "primary" | "quiet" | "danger" = "quiet") {
  const base =
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-[var(--radius-md)] px-4 [font-size:var(--text-sm)] transition-colors disabled:opacity-50";
  if (kind === "primary")
    return `${base} [background-color:var(--color-primary)] [color:var(--color-on-primary)] [font-weight:var(--fw-semibold)] enabled:hover:[background-color:var(--color-primary-deep)]`;
  if (kind === "danger")
    return `${base} border [border-color:var(--color-clay)] [color:var(--color-clay-bright)] enabled:hover:[background-color:var(--color-ink-850)]`;
  return `${base} border [border-color:var(--color-ink-800)] [color:var(--color-paper)] enabled:hover:[border-color:var(--color-brand)]`;
}

/**
 * 什么都还没有的时候。
 *
 * ⚠️ tabler 把「空」跟「404」做成**版型**（`ErrorLayout`），不是每一页现写一次 ——
 * 因为一个空画面是产品说话最要紧的时候，它要讲清楚三件：
 * 这里本来会有什么 · 为什么现在没有 · 你可以做什么。
 * 我们现在是一句灰字加一个虚线框。
 */
export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-[var(--radius-lg)] border border-dashed px-6 py-12 text-center [border-color:var(--color-ink-800)]">
      <p className="[color:var(--color-paper)] [font-size:var(--text-sm)] [font-weight:var(--fw-semibold)]">
        {title}
      </p>
      {body && (
        <p className="max-w-[46ch] [color:var(--color-paper-dim)] [font-size:var(--text-sm)] [line-height:var(--leading-body)]">
          {body}
        </p>
      )}
      {action}
    </div>
  );
}


/**
 * 一张卡装整页，左边一列小导航，右边才是内容。
 *
 * ── 为什么（2026-09-02，逐像素量出来的）────────────────────────────────────
 * 老板：`就是感觉我的平台 没有别人的有专业感`。
 * 把我们的画面跟一个真的后台（next-shadcn-admin · 45k★）并排，逐像素量：
 *
 *              最大一块单色     亮暗跨度
 *   别人 CRM    白 46%          0.97
 *   别人 单据    白 33%          1.00
 *   **我们 账号  黑 70%          0.74**   ← 最低
 *
 * **七成画面是一片什么都没有的地。** 别人那 46% 的白是**纸**——上面压着卡片、
 * 表格、图表；我们那 70% 的黑是**空的**。内容挤在 `max-w-3xl` 的一条里，
 * 右边四成留白。这就是「不专业」量出来的样子，跟深色不深色无关。
 *
 * ── 抄的是 tabler 的设定页（MIT · 41.5k★），而且只抄它那一张卡 ───────────
 * 它是 `card > row > [3/12 小导航 | 9/12 内容]`。
 * ⚠️ 我 9-01 抄错过一次：看到「卡」漏了「一」，把这一页做成**八张叠起来的卡**。
 * Refero 那份 `anti-ai-slop.md`（MIT）当天就点名这件事：
 * 「默认不要卡片；拿掉边框阴影底色圆角之后不影响操作跟理解的，就不是卡片」。
 * 八张里没有一张是「要操作的容器」，它们只是在分组 —— 那是装饰。
 * **现在回到一张。**
 */
export function SplitCard({
  nav,
  children,
}: {
  nav: ReactNode;
  children: ReactNode;
}) {
  return (
    <Card pad={false} className="grid md:grid-cols-[13.5rem_1fr]">
      {/* 小导航。窄萤幕上它变成横着滑的一排 —— 手机上一列 13.5rem 的导航
          是一个 13.5rem 的洞（`Section` 那份档头讲过同一件事）。 */}
      <nav className="flex gap-1 overflow-x-auto border-b p-3 md:flex-col md:overflow-visible md:border-r md:border-b-0 [border-color:var(--color-ink-800)]">
        {nav}
      </nav>
      <div className="min-w-0 p-6">{children}</div>
    </Card>
  );
}

/** 小导航里的一格。选中的那一格用品牌色，跟侧栏同一个语言。 */
export function SplitTab({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={`shrink-0 whitespace-nowrap rounded-[var(--radius-md)] px-3 py-2 text-left [font-size:var(--text-sm)] transition-colors ${
        active
          ? "[background-color:var(--color-nav-active)] [color:var(--color-paper)] [font-weight:var(--fw-semibold)]"
          : "[color:var(--color-paper-dim)] hover:[background-color:var(--color-ink-850)] hover:[color:var(--color-paper)]"
      }`}
    >
      {children}
    </button>
  );
}
