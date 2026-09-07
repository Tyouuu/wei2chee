/**
 * Icons for Formae's OWN navigation.
 *
 * Deliberately not `design-system/components/rail-icons.tsx`. Those name the
 * CUSTOMER's pages (客户, 报价单, 收款) and belong to the systems this product
 * generates. These name Formae's own areas, and the two sets must not drift
 * into each other — a product whose chrome is indistinguishable from the thing
 * it builds has no identity of its own, which is the mistake this whole round
 * of work exists to correct.
 *
 * 20×20 viewBox, 1.7 stroke, `currentColor` throughout so each one inherits the
 * nav row's colour and the active state recolours the icon for free.
 */
type IconProps = { className?: string };

const base = {
  viewBox: "0 0 20 20",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: "1.7",
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export function IconHome({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 8.2 10 3l7 5.2V16a1 1 0 0 1-1 1h-3.5v-4.5h-5V17H4a1 1 0 0 1-1-1Z" />
    </svg>
  );
}

/** The customer's system — a stack of pages. */
export function IconPages({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.6" y="2.6" width="10" height="10" rx="1.6" />
      <path d="M7.4 17.4h8a2 2 0 0 0 2-2v-8" />
    </svg>
  );
}

/** The component library — blocks you pick from. */
export function IconBlocks({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.6" y="2.6" width="6.2" height="6.2" rx="1.4" />
      <rect x="11.2" y="2.6" width="6.2" height="6.2" rx="1.4" />
      <rect x="2.6" y="11.2" width="6.2" height="6.2" rx="1.4" />
      <rect x="11.2" y="11.2" width="6.2" height="6.2" rx="1.4" />
    </svg>
  );
}

/** Whole-page templates — a page with a page behind it. */
export function IconTemplates({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <rect x="2.6" y="4.6" width="11" height="12.8" rx="1.6" />
      <path d="M6.4 4.6V4a1.4 1.4 0 0 1 1.4-1.4h8.2A1.4 1.4 0 0 1 17.4 4v9.4" />
      <path d="M5.6 8.4h5M5.6 11.6h5M5.6 14.4h3" />
    </svg>
  );
}

/** Styles — a palette. */
export function IconStyles({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 2.6a7.4 7.4 0 1 0 0 14.8c1 0 1.6-.7 1.6-1.5 0-.5-.2-.8-.5-1.1-.3-.3-.4-.6-.4-1 0-.8.6-1.4 1.4-1.4h1.3a3.6 3.6 0 0 0 3.6-3.6c0-3.4-3.2-6.2-7-6.2Z" />
      <circle cx="6.6" cy="9.4" r="1" fill="currentColor" stroke="none" />
      <circle cx="9.4" cy="6.2" r="1" fill="currentColor" stroke="none" />
      <circle cx="13.2" cy="7.4" r="1" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** The specification document. */
export function IconSpec({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M4.6 2.6h6.6l4.2 4.2v10.6H4.6Z" />
      <path d="M11.2 2.6v4.2h4.2" />
      <path d="M7.4 11h5.2M7.4 14h3.4" />
    </svg>
  );
}

/** Hand it over to be built. */
export function IconHandoff({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M17.4 2.6 9.2 10.8" />
      <path d="M17.4 2.6 12.2 17.4l-3-6.6-6.6-3Z" />
    </svg>
  );
}

export function IconSettings({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="2.6" />
      <path d="M10 2.6v1.8M10 15.6v1.8M17.4 10h-1.8M4.4 10H2.6M15.2 4.8l-1.3 1.3M6.1 13.9l-1.3 1.3M15.2 15.2l-1.3-1.3M6.1 6.1 4.8 4.8" />
    </svg>
  );
}

/** The founder's console. A dial, because it reads the business rather than
 *  editing it. */
export function IconConsole({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3 14.4a7.6 7.6 0 1 1 14 0" />
      <path d="M10 14.4 13.4 8" />
      <circle cx="10" cy="14.4" r="1.2" />
    </svg>
  );
}

export function IconPlus({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 4.4v11.2M4.4 10h11.2" />
    </svg>
  );
}

/* ── 他自己的工具（2026-09-06）────────────────────────────────────────────
   六件事，六个形状。⚠️ 全部照上面那一套：20×20 · 1.7 · currentColor ——
   一个粗细不一样的图标，在一排十七像素的行里一眼就看得出来。 */

/** 要跟的事 —— 一个钟。 */
export function IconClock({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6v4.2l2.8 1.7" />
    </svg>
  );
}

/** 序号 —— 一个井字号。**不是一台车**：车牌那一行已经是一台车了，
 *  而这一条讲的是「一台一台的号码」，冰箱跟手机也在里面。 */
export function IconHash({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M7.4 3.5 5.9 16.5M14.1 3.5l-1.5 13M3.4 7.6h13.2M2.8 12.4H16" />
    </svg>
  );
}

/** 谁欠我钱 —— 一个硬币。 */
export function IconCoin({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <circle cx="10" cy="10" r="7" />
      <path d="M10 6.4v7.2M12.1 8.1a2.2 2.2 0 0 0-2.1-1.2c-1.2 0-2.1.7-2.1 1.7s.9 1.5 2.1 1.5 2.1.5 2.1 1.5-.9 1.7-2.1 1.7a2.2 2.2 0 0 1-2.1-1.2" />
    </svg>
  );
}

/** 保养合约 —— 一把扳手。 */
export function IconWrench({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M13.4 3.4a3.9 3.9 0 0 0-4.6 5.2L3.6 13.8a1.6 1.6 0 0 0 2.3 2.3l5.2-5.2a3.9 3.9 0 0 0 5.2-4.6l-2.3 2.3-2.1-.6-.6-2.1Z" />
    </svg>
  );
}

/** 车牌 —— 一辆车。 */
export function IconCar({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.4 12.2h13.2M4.6 12.2l1.3-4a1.6 1.6 0 0 1 1.5-1.1h5.2a1.6 1.6 0 0 1 1.5 1.1l1.3 4v3.1h-2.2v-1.4H6.8v1.4H4.6Z" />
      <path d="M6.9 13.6h.01M13.1 13.6h.01" />
    </svg>
  );
}

/** 薪水 —— 一个钱包。 */
export function IconWallet({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M3.4 6.6a1.4 1.4 0 0 1 1.4-1.4h9.1v2.6M3.4 6.6v7.4a1.4 1.4 0 0 0 1.4 1.4h10.4a1.2 1.2 0 0 0 1.2-1.2v-1.5M3.4 6.6a1.4 1.4 0 0 0 1.4 1.4h10.6a1.2 1.2 0 0 1 1.2 1.2v1.6" />
      <path d="M13.6 10.8h3v2.1h-3a1.05 1.05 0 0 1 0-2.1Z" />
    </svg>
  );
}

/** 帐 —— 一本摊开的簿子。 */
export function IconBook({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10 5.6C8.7 4.5 6.9 4 4.4 4.2v9.6c2.5-.2 4.3.3 5.6 1.4 1.3-1.1 3.1-1.6 5.6-1.4V4.2c-2.5-.2-4.3.3-5.6 1.4Z" />
      <path d="M10 5.6v9.6" />
    </svg>
  );
}

/** 税 —— 一个百分比。 */
export function IconPercent({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M14.6 5.4 5.4 14.6" />
      <circle cx="7" cy="7" r="1.9" />
      <circle cx="13" cy="13" r="1.9" />
    </svg>
  );
}

/** 快过期的 —— 一个沙漏。 */
export function IconHourglass({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M6 3.4h8M6 16.6h8M6.6 3.4v2.3L10 9l3.4-3.3V3.4M6.6 16.6v-2.3L10 11l3.4 3.3v2.3" />
    </svg>
  );
}

/** 借出去的 —— 一个盒子带一支向外的箭。 */
export function IconOut({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="M10.4 3.4H4.6a1.2 1.2 0 0 0-1.2 1.2v10.8a1.2 1.2 0 0 0 1.2 1.2h10.8a1.2 1.2 0 0 0 1.2-1.2V9.6" />
      <path d="M12.4 3.4h4.2v4.2M16.6 3.4 10 10" />
    </svg>
  );
}

/** 一辆送货的车 —— 买的那一边（我欠人家的 · 哪几张对不上）。 */
export function IconTruck({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M2 5.5h9v8H2z" />
      <path d="M11 8.5h3.2l2.3 2.6v2.4H11z" />
      <circle cx="5.5" cy="15.5" r="1.6" />
      <circle cx="14" cy="15.5" r="1.6" />
    </svg>
  );
}

/** 一张月历 —— 出勤（谁哪一天在工地）。 */
export function IconCalendar({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.6" y="4" width="14.8" height="13.4" rx="2" />
      <path d="M2.6 8.2h14.8M6.8 2.6v2.8M13.2 2.6v2.8" />
      <path d="M6.4 11.6h1.2M9.4 11.6h1.2M12.4 11.6h1.2M6.4 14.4h1.2M9.4 14.4h1.2" />
    </svg>
  );
}

/** 一个钟面 —— 谁有空（几点到几点，谁在）。 */
export function IconClockFace({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="7.4" />
      <path d="M10 5.8V10l2.8 1.8" />
    </svg>
  );
}

/** 两个箱子中间一支箭 —— 搬货（从一间店到另一间）。 */
export function IconMove({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.2" y="3.4" width="5" height="5" rx="1" />
      <rect x="12.8" y="11.6" width="5" height="5" rx="1" />
      <path d="M8.4 5.9h5.4a2 2 0 0 1 2 2v2.1" />
      <path d="M13.6 8.4 15.8 10l2.2-1.6" />
    </svg>
  );
}

/** 一个讲台 —— 班（一个老师，一屋子学生）。 */
export function IconClass({ className = "h-[17px] w-[17px]" }: IconProps) {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <rect x="2.6" y="3" width="14.8" height="9.6" rx="1.6" />
      <path d="M10 12.6v3M6.4 15.6h7.2" />
      <path d="M6 6.4h5M6 9h3.4" />
    </svg>
  );
}

/** 一支会转的箭 —— 一页底下还有几件事。 */
export function IconChevron({ open }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`h-[13px] w-[13px] transition-transform duration-150 ${open ? "rotate-90" : ""}`}
      aria-hidden="true"
    >
      <path d="M6 3.5 10.5 8 6 12.5" />
    </svg>
  );
}
