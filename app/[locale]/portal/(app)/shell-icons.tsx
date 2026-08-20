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
