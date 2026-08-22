import { BLOCKS, BLOCK_META } from "@/components/blocks";

/**
 * ONE PUCK COMPONENT FOR ALL 216 PULLED BLOCKS.
 *
 * ── WHY ONE AND NOT A HUNDRED AND SIXTY-FOUR ──────────────────────────────
 *
 * The founder drew the line himself: 「模板是不可以改的 对不对 风格是可以改的」.
 * These blocks are the TEMPLATE side of that line. Their words live inside
 * their own files as plain arrays — `const tiers = [...]` at the top of
 * pricing-1.tsx — so turning each into a Puck component with editable fields
 * would be 216 field schemas to write and then keep matching 216 upstream
 * files. It would also make them editable, which is the thing he said they are
 * not.
 *
 * So the whole catalogue is one component with one decision in it: WHICH
 * SECTION. A landing template writes `{ type: "SiteBlock", props: { block:
 * "pricing-2" } }` and gets that section, whole, wearing whichever of the
 * registers the customer picked.
 *
 * ── THE STYLE IS STILL THE CUSTOMERS ──────────────────────────────────────
 *
 * Nothing here sets a colour. The blocks were chosen at 99% token purity
 * precisely so the register decides how they look — verified by rendering the
 * same five pricing sections in 墨 (Xuan paper, vermilion, serif, square
 * corners) and in Hearth (cream, teal, rounded, a different serif) and looking
 * at both. That is the whole reason @7ovr was picked over five other
 * registries.
 *
 * ── WHAT A CUSTOMER CAN STILL DO ──────────────────────────────────────────
 *
 * Delete it, move it, and swap it for a different section from the same list.
 * That is the freedom a template gives anywhere else: rearrange the furniture,
 * do not rewrite the room.
 *
 * The option list is GENERATED from components/blocks/index.ts. Re-run the
 * generator after pulling more blocks rather than adding lines by hand.
 */

/** Every pulled section, named in the language the owner is being spoken to
 *  in: shelf first, then 7Ovr's own title for the section. */
export const SITE_BLOCK_OPTIONS: { label: string; value: string }[] = [
  { label: "Cookie 提示 · Blocking Consent Dialog", value: "cookie-consent-4" },
  { label: "Cookie 提示 · Bottom Cookie Bar", value: "cookie-consent-1" },
  { label: "Cookie 提示 · Cookie Preferences Panel", value: "cookie-consent-3" },
  { label: "Cookie 提示 · Corner Consent Card", value: "cookie-consent-2" },
  { label: "Cookie 提示 · Expandable Consent Banner", value: "cookie-consent-5" },
  { label: "上传 · Avatar Photo Uploader", value: "file-upload-5" },
  { label: "上传 · Image Gallery Uploader", value: "file-upload-4" },
  { label: "个人档案 · Compact Profile Card", value: "profile-2" },
  { label: "个人档案 · Organization Profile Card", value: "profile-3" },
  { label: "个人档案 · Public Profile With Tabs", value: "profile-1" },
  { label: "仪表板 · Flush Six Metric Strip", value: "dashboard-3" },
  { label: "仪表板 · KPI Cards And Activity Feed", value: "dashboard-2" },
  { label: "仪表板 · Overview With Range Select", value: "dashboard-1" },
  { label: "仪表板 · Overview With Recent Orders", value: "dashboard-4" },
  { label: "价目 · Annual Savings Toggle", value: "pricing-4" },
  { label: "价目 · Plan Comparison Table", value: "pricing-5" },
  { label: "价目 · Single Plan Spotlight", value: "pricing-3" },
  { label: "价目 · Three Tier Plan Cards", value: "pricing-1" },
  { label: "价目 · Two Plan Split Panel", value: "pricing-2" },
  { label: "作品 · Filterable Photo Grid", value: "gallery-1" },
  { label: "作品 · Grayscale Mosaic With Lightbox", value: "gallery-4" },
  { label: "作品 · Masonry Column Gallery", value: "gallery-3" },
  { label: "作品 · Product Screenshot Showcase", value: "gallery-2" },
  { label: "侧栏 · Dashboard Rail With Stats", value: "sidebar-1" },
  { label: "侧栏 · Flat Nav With Task Table", value: "sidebar-2" },
  { label: "侧栏 · Icon Rail With Tooltips", value: "sidebar-3" },
  { label: "公告 · Dismissible Bar And Callout", value: "announcement-1" },
  { label: "公告 · Persisted Dismissible Banner", value: "announcement-3" },
  { label: "公告 · Product Update Card", value: "announcement-2" },
  { label: "公告 · Sale Countdown Promo Bar", value: "announcement-4" },
  { label: "关于我们 · Founder Story With Photo", value: "about-2" },
  { label: "关于我们 · Mission Statement With Stats", value: "about-1" },
  { label: "关于我们 · Mission Vision Values Columns", value: "about-4" },
  { label: "关于我们 · Values Card Grid", value: "about-3" },
  { label: "动态 · Activity Tabs With Unread", value: "activity-4" },
  { label: "动态 · Audit Log With Icon Tiles", value: "activity-3" },
  { label: "动态 · Recent Activity Card", value: "activity-1" },
  { label: "卖点 · Alternating Rows With Stats", value: "features-2" },
  { label: "卖点 · Everything Included Checklist", value: "features-3" },
  { label: "卖点 · Security Feature Spotlight", value: "features-5" },
  { label: "卖点 · Six Card Icon Grid", value: "features-1" },
  { label: "卖点 · Tabbed Feature Categories", value: "features-4" },
  { label: "即将推出 · Centered Waitlist Capture", value: "coming-soon-1" },
  { label: "即将推出 · Full-Bleed Gradient Launch", value: "coming-soon-4" },
  { label: "即将推出 · Launch Countdown Timer", value: "coming-soon-3" },
  { label: "即将推出 · Launch Progress Milestones", value: "coming-soon-5" },
  { label: "即将推出 · Split Waitlist With Preview", value: "coming-soon-2" },
  { label: "合作标志 · Auto-Scrolling Logo Marquee", value: "logo-cloud-3" },
  { label: "合作标志 · Integrations Logo Grid", value: "logo-cloud-2" },
  { label: "合作标志 · Logo Grid With Tooltips", value: "logo-cloud-4" },
  { label: "合作标志 · Minimal Trust Strip", value: "logo-cloud-5" },
  { label: "合作标志 · Trusted By Logo Grid", value: "logo-cloud-1" },
  { label: "命令面板 · Cmd+K Searchable Palette", value: "command-palette-3" },
  { label: "命令面板 · Command Dialog With Shortcuts", value: "command-palette-1" },
  { label: "命令面板 · Palette With Preview Pane", value: "command-palette-4" },
  { label: "命令面板 · Palette With Recent Items", value: "command-palette-2" },
  { label: "团队 · Department Badge Grid", value: "team-2" },
  { label: "团队 · Hover Reveal Bio Cards", value: "team-3" },
  { label: "团队 · Member Cards With Socials", value: "team-1" },
  { label: "图表 · Active Users Area Trend", value: "charts-2" },
  { label: "图表 · Monthly Visitors Line", value: "charts-4" },
  { label: "图表 · Revenue Bars With Year Select", value: "charts-1" },
  { label: "图表 · Traffic Range Switcher", value: "charts-3" },
  { label: "图表 · Traffic Source Donut", value: "charts-5" },
  { label: "大标题 · Centered Hero With Trust Logos", value: "hero-1" },
  { label: "大标题 · Grid Backdrop Email Capture", value: "hero-4" },
  { label: "大标题 · Hero With Avatar Social Proof", value: "hero-6" },
  { label: "大标题 · Hero With Demo Video Dialog", value: "hero-5" },
  { label: "大标题 · Left-Aligned Hero With Metrics", value: "hero-3" },
  { label: "大标题 · Split Hero With Dashboard Mockup", value: "hero-2" },
  { label: "客户评价 · Bordered Quote Trio", value: "testimonials-1" },
  { label: "客户评价 · Single Voice Spotlight", value: "testimonials-2" },
  { label: "客户评价 · Star Rated Review Cards", value: "testimonials-4" },
  { label: "客户评价 · Wall Of Love Grid", value: "testimonials-3" },
  { label: "对比 · Named Competitor Table", value: "comparison-4" },
  { label: "对比 · Three-Plan Feature Matrix", value: "comparison-3" },
  { label: "对比 · Two-Plan Table With Billing Toggle", value: "comparison-1" },
  { label: "对比 · Us Versus Them Cards", value: "comparison-2" },
  { label: "常见问题 · Centered FAQ Accordion", value: "faqs-1" },
  { label: "常见问题 · FAQ With Contact Support Card", value: "faqs-3" },
  { label: "常见问题 · FAQ With Sticky Support Sidebar", value: "faqs-4" },
  { label: "常见问题 · Searchable FAQ With Category Tabs", value: "faqs-5" },
  { label: "常见问题 · Two-Column FAQ Accordion", value: "faqs-2" },
  { label: "应用框架 · Icon Rail Dashboard Shell", value: "app-shell-3" },
  { label: "应用框架 · Sidebar Dashboard Shell", value: "app-shell-1" },
  { label: "应用框架 · Top Bar Only With Tabs", value: "app-shell-2" },
  { label: "招聘 · Culture And Benefits Page", value: "careers-3" },
  { label: "招聘 · Filterable Jobs Board", value: "careers-4" },
  { label: "招聘 · Job Posting Detail Page", value: "careers-2" },
  { label: "招聘 · Open Roles By Department", value: "careers-1" },
  { label: "搜索 · Autocomplete Search Input", value: "search-4" },
  { label: "搜索 · Faceted Docs Search Panel", value: "search-1" },
  { label: "搜索 · Grouped Command Palette", value: "search-3" },
  { label: "搜索 · Search Results Page", value: "search-2" },
  { label: "数字 · Bordered Four-Up Stat Band", value: "stats-1" },
  { label: "数字 · Count-Up Stats On Scroll", value: "stats-4" },
  { label: "数字 · Inverted Stats Panel", value: "stats-5" },
  { label: "数字 · Minimal Numbers Band", value: "stats-2" },
  { label: "数字 · Stat Cards With Trend Arrows", value: "stats-3" },
  { label: "整合 · Compact Logo Tile Grid", value: "integrations-2" },
  { label: "整合 · Connect Cards With Dialog", value: "integrations-1" },
  { label: "整合 · Connection Toggle Settings", value: "integrations-4" },
  { label: "整合 · Searchable App Directory", value: "integrations-3" },
  { label: "整合 · Split Logo Grid With CTA", value: "integrations-5" },
  { label: "文章 · Blog With Sticky Sidebar", value: "blog-5" },
  { label: "文章 · Divider Separated Post List", value: "blog-2" },
  { label: "文章 · Filterable Blog Index", value: "blog-3" },
  { label: "文章 · Horizontal Media Cards", value: "blog-4" },
  { label: "文章 · Three Card Post Grid", value: "blog-1" },
  { label: "文章内页 · Article With Author Sidebar", value: "article-5" },
  { label: "文章内页 · Article With Scroll-Spy Contents", value: "article-2" },
  { label: "文章内页 · Centered Blog Post", value: "article-1" },
  { label: "文章内页 · Magazine Feature With Drop Cap", value: "article-4" },
  { label: "新手引导 · Dismissible Getting Started Widget", value: "onboarding-6" },
  { label: "新手引导 · First-Run Welcome Screen", value: "onboarding-4" },
  { label: "新手引导 · Invite Your Team Step", value: "onboarding-5" },
  { label: "新手引导 · Multi-Step Setup Wizard", value: "onboarding-3" },
  { label: "新手引导 · Three-Card Setup Steps", value: "onboarding-2" },
  { label: "新手引导 · Welcome Checklist Card", value: "onboarding-1" },
  { label: "日历 · Month And Week Toggle", value: "calendar-3" },
  { label: "日历 · Month Grid With Day Detail", value: "calendar-1" },
  { label: "日历 · Weekly Agenda View", value: "calendar-2" },
  { label: "时间线 · Alternating Spine Story", value: "timeline-2" },
  { label: "时间线 · Milestone Rail With Status", value: "timeline-1" },
  { label: "更新记录 · In-App What's New Card", value: "changelog-3" },
  { label: "更新记录 · Sticky Version Jump Sidebar", value: "changelog-5" },
  { label: "更新记录 · Tabbed Change Filter", value: "changelog-2" },
  { label: "更新记录 · Version Rail Release Notes", value: "changelog-1" },
  { label: "更新记录 · Vertical Release Timeline", value: "changelog-4" },
  { label: "格子墙 · Bento With Static Chart Visuals", value: "bento-4" },
  { label: "格子墙 · Divided Bento With Terminal Snippet", value: "bento-3" },
  { label: "格子墙 · Equal Four-Tile Bento", value: "bento-2" },
  { label: "格子墙 · Icon Bento With Hero Tile", value: "bento-1" },
  { label: "步骤 · Horizontal Numbered Stepper", value: "steps-1" },
  { label: "步骤 · Vertical Stepper With Descriptions", value: "steps-2" },
  { label: "步骤 · Wizard Progress Bar Header", value: "steps-3" },
  { label: "流程 · Clickable Horizontal Stepper", value: "how-it-works-3" },
  { label: "流程 · Three Step Icon Cards", value: "how-it-works-1" },
  { label: "流程 · Vertical Numbered Timeline", value: "how-it-works-2" },
  { label: "流程 · Zig-Zag Steps With Mockups", value: "how-it-works-4" },
  { label: "状态 · 90 Day Uptime Bars", value: "status-3" },
  { label: "状态 · All Systems Operational Summary", value: "status-1" },
  { label: "登入 · Centered Sign-In Card", value: "auth-1" },
  { label: "登入 · Centered Sign-Up Card", value: "auth-8" },
  { label: "登入 · Forgot Password Request", value: "auth-6" },
  { label: "登入 · Full-Height Split Sign-In", value: "auth-4" },
  { label: "登入 · Set New Password With Rules", value: "auth-7" },
  { label: "登入 · Sign-Up With Plan Sidebar", value: "auth-3" },
  { label: "登入 · Split Sign-In With Brand Panel", value: "auth-2" },
  { label: "登入 · Tabbed Sign-In And Sign-Up", value: "auth-5" },
  { label: "看板 · Four Column Project Board", value: "kanban-3" },
  { label: "看板 · Personal Task Lanes", value: "kanban-4" },
  { label: "看板 · Single In Progress Column", value: "kanban-2" },
  { label: "看板 · Three Column Task Board", value: "kanban-1" },
  { label: "空状态 · Failed Load Error", value: "empty-states-4" },
  { label: "空状态 · First Project Prompt", value: "empty-states-5" },
  { label: "空状态 · Illustrated Inbox Panel", value: "empty-states-2" },
  { label: "空状态 · Inbox Zero Notifications", value: "empty-states-1" },
  { label: "空状态 · No Search Results", value: "empty-states-3" },
  { label: "联络 · Contact Details And Form", value: "contact-1" },
  { label: "联络 · Contact With Office Locations", value: "contact-3" },
  { label: "联络 · Single Card Contact Form", value: "contact-2" },
  { label: "行动号召 · App Download CTA", value: "cta-6" },
  { label: "行动号召 · Centered CTA Band", value: "cta-1" },
  { label: "行动号召 · Compact CTA Card", value: "cta-2" },
  { label: "行动号召 · Email Capture CTA", value: "cta-4" },
  { label: "行动号召 · Inverted Banner CTA", value: "cta-3" },
  { label: "行动号召 · Split CTA With App Preview", value: "cta-5" },
  { label: "表格 · Filterable Invoices Table", value: "table-2" },
  { label: "表格 · Invoice Line Items Summary", value: "table-3" },
  { label: "表格 · Team Members Data Table", value: "table-1" },
  { label: "订阅 · Centered Signup With Consent", value: "newsletter-1" },
  { label: "订阅 · Horizontal Newsletter Band", value: "newsletter-2" },
  { label: "订阅 · Newsletter Signup With Social Proof", value: "newsletter-5" },
  { label: "订阅 · Signup Card With Form States", value: "newsletter-3" },
  { label: "订阅 · Topic Picker Double Opt-In", value: "newsletter-4" },
  { label: "设定 · Compact Profile Card", value: "settings-2" },
  { label: "设定 · Profile And Notification Cards", value: "settings-1" },
  { label: "设定 · Section Nav Settings Layout", value: "settings-4" },
  { label: "设定 · Tabbed Account Billing Team", value: "settings-3" },
  { label: "账单 · Add Card Form", value: "billing-6" },
  { label: "账单 · Current Plan Summary Card", value: "billing-1" },
  { label: "账单 · Full Billing Dashboard", value: "billing-3" },
  { label: "账单 · Invoice History Table", value: "billing-2" },
  { label: "账单 · Saved Payment Methods", value: "billing-5" },
  { label: "账单 · Usage Metering Card", value: "billing-4" },
  { label: "路线图 · Now Next Later Phases", value: "roadmap-2" },
  { label: "路线图 · Quarterly Roadmap Columns", value: "roadmap-4" },
  { label: "路线图 · Status Kanban Board", value: "roadmap-1" },
  { label: "路线图 · Upvotable Feature Requests", value: "roadmap-3" },
  { label: "通知 · Bell Popover With Badge", value: "notifications-2" },
  { label: "通知 · Dismissible Alert Stack", value: "notifications-5" },
  { label: "通知 · Notification Center Tabs", value: "notifications-3" },
  { label: "通知 · Notification Preferences Toggles", value: "notifications-4" },
  { label: "通知 · Notifications Sheet Panel", value: "notifications-1" },
  { label: "错误页 · 403 Access Denied", value: "error-4" },
  { label: "错误页 · 404 Not Found With Actions", value: "error-1" },
  { label: "错误页 · 404 With Search And Links", value: "error-2" },
  { label: "错误页 · 500 Server Error With Retry", value: "error-3" },
  { label: "错误页 · Oversized 404 Numeral", value: "error-6" },
  { label: "错误页 · Scheduled Maintenance Page", value: "error-5" },
  { label: "页尾 · Brand Blurb With Link Columns", value: "footer-1" },
  { label: "页尾 · Call To Action Footer", value: "footer-5" },
  { label: "页尾 · Newsletter Signup Footer", value: "footer-3" },
  { label: "页尾 · Slim Single Bar", value: "footer-2" },
  { label: "页面标题 · Breadcrumb Header With Status", value: "page-header-2" },
  { label: "页面标题 · Detail Header With Back Link", value: "page-header-4" },
  { label: "页面标题 · Header With Metrics Strip", value: "page-header-6" },
  { label: "页面标题 · Header With Search Toolbar", value: "page-header-5" },
  { label: "页面标题 · Header With Section Tabs", value: "page-header-3" },
  { label: "页面标题 · Title With Export Actions", value: "page-header-1" },
  { label: "页首 · Capsule Nav Header Without A CTA", value: "header-14" },
  { label: "页首 · Centered Nav Three Column", value: "header-2" },
  { label: "页首 · Full Width Bar With CTA", value: "header-1" },
  { label: "页首 · Product Dropdown Menu", value: "header-4" },
  { label: "页首 · Sticky Header With Sign In", value: "header-3" },
];

export function SiteBlock({
  block,
  copy,
}: {
  block?: string;
  /** The customer's own words for this section, written by the editor's AI
   *  through `set_copy`. Absent, the section shows the words it was pulled
   *  with -- which is the right default for a gallery and the wrong one for a
   *  page somebody publishes. */
  copy?: Record<string, unknown>;
}) {
  const Block = block ? BLOCKS[block] : undefined;
  if (!Block) {
    // A layout can outlive the block it names — a section pulled today can be
    // dropped from a later batch. Saying so is better than an empty gap the
    // owner cannot see, and far better than a thrown render on a page a
    // stranger is reading.
    return (
      <div className="[padding:var(--pad-card)] [color:var(--color-paper-dim)] [font-size:var(--text-sm)]">
        这一段找不到了（{block ?? "未选"}）。换一段吧。
      </div>
    );
  }
  // THE SECTION SITS ON THE PAGE'S CONTENT SURFACE, NOT ON WHATEVER IS BEHIND IT.
  //
  // Most pulled sections paint no background of their own -- a logo wall, a
  // stats band, a FAQ list are all transparent, because upstream they sit on a
  // page body that is already `bg-background`. Here they sat on whatever the
  // editor canvas or the published page happened to paint.
  //
  // Invisible for seventeen registers, where the ground and the content
  // surface are the same colour. 漆 puts an oxblood ground under ivory panels,
  // and `npm run check:contrast` found 86 text nodes below 4.5:1 on the
  // customer's own website page -- near-black type on oxblood, on the one page
  // strangers read.
  return (
    <div className="bg-background text-foreground">
      <Block copy={copy} />
    </div>
  );
}

/** What the gallery and the sheet title print above a chosen section. */
export function siteBlockLabel(block?: string): string {
  if (!block) return "官网版段";
  return BLOCK_META[block]?.title ?? block;
}
