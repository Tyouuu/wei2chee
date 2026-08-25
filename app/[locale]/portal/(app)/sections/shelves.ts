/**
 * The 7Ovr shelves, named in Chinese and put in the order a small business
 * would meet them.
 *
 * TWO DECISIONS ARE ENCODED HERE, not one.
 *
 * The NAMES: the registry ships English category slugs (logo-cloud, how-it-
 * works). The owner reading this page is being spoken to in Chinese
 * everywhere else in the product, and 「合作标志」 is not a translation
 * exercise, it is the difference between a shelf he opens and one he skips.
 *
 * The ORDER: website shelves first, app shelves after. The registry's own
 * order is alphabetical, which puts 「动态」 and 「仪表板」 above 「大标题」 --
 * fine for a developer browsing a catalogue, wrong for a contractor who came
 * here to build a page people will visit. What SITE_FIRST lists is the order
 * a page is actually assembled in: the first screen, then what you sell, then
 * the price, then the objections, then the ask.
 */

/** Shelf slug -> what the owner reads. */
export const SECTION_SHELVES: Record<string, string> = {
  "hero": "大标题",
  "features": "卖点",
  "pricing": "价目",
  "faqs": "常见问题",
  "cta": "行动号召",
  "testimonials": "客户评价",
  "stats": "数字",
  "footer": "页尾",
  "header": "页首",
  "logo-cloud": "合作标志",
  "how-it-works": "流程",
  "gallery": "作品",
  "about": "关于我们",
  "team": "团队",
  "contact": "联络",
  "newsletter": "订阅",
  "integrations": "整合",
  "comparison": "对比",
  "bento": "格子墙",
  "blog": "文章",
  "article": "文章内页",
  "careers": "招聘",
  "changelog": "更新记录",
  "coming-soon": "即将推出",
  "cookie-consent": "Cookie 提示",
  "dashboard": "仪表板",
  "charts": "图表",
  "kanban": "看板",
  "calendar": "日历",
  "timeline": "时间线",
  "roadmap": "路线图",
  "activity": "动态",
  "notifications": "通知",
  "onboarding": "新手引导",
  "billing": "账单",
  "profile": "个人档案",
  "settings": "设定",
  "search": "搜索",
  "table": "表格",
  "steps": "步骤",
  "status": "状态",
  "error": "错误页",
  "page-header": "页面标题",
  "file-upload": "上传",
  "auth": "登入",
  "empty-states": "空状态",
  "survey": "问卷",
  "announcement": "公告",
  "app-shell": "应用框架",
  "sidebar": "侧栏",
  "chat": "聊天",
  "ai-chat": "AI 对话",
  "command-palette": "命令面板"
};

/**
 * The same shelves, for the English portal.
 *
 * 「不是這個英文 是我的平台裡面用英文」 -- 2026-08-26. Measured on /en/portal, this
 * page carried 58 Chinese strings, second only to 组件库, and most of them were
 * the shelf rail above.
 *
 * NOT the registry's own slugs, which is the lazy answer available for free:
 * they read logo-cloud, how-it-works, cookie-consent, empty-states. Those are
 * developer keys, and the note above this file explains why they were not used
 * in Chinese either -- the shelf name is the difference between a shelf an
 * owner opens and one he skips.
 */
export const SECTION_SHELVES_EN: Record<string, string> = {
  "hero": "Hero",
  "features": "Features",
  "pricing": "Pricing",
  "faqs": "FAQs",
  "cta": "Call to action",
  "testimonials": "Testimonials",
  "stats": "Numbers",
  "footer": "Footer",
  "header": "Header",
  "logo-cloud": "Logos",
  "how-it-works": "How it works",
  "gallery": "Work",
  "about": "About us",
  "team": "Team",
  "contact": "Contact",
  "newsletter": "Subscribe",
  "integrations": "Integrations",
  "comparison": "Comparison",
  "bento": "Bento",
  "blog": "Blog",
  "article": "Article",
  "careers": "Careers",
  "changelog": "Changelog",
  "coming-soon": "Coming soon",
  "cookie-consent": "Cookie notice",
  "dashboard": "Dashboard",
  "charts": "Charts",
  "kanban": "Board",
  "calendar": "Calendar",
  "timeline": "Timeline",
  "roadmap": "Roadmap",
  "activity": "Activity",
  "notifications": "Notifications",
  "onboarding": "Onboarding",
  "billing": "Billing",
  "profile": "Profile",
  "settings": "Settings",
  "search": "Search",
  "table": "Table",
  "steps": "Steps",
  "status": "Status",
  "error": "Error page",
  "page-header": "Page header",
  "file-upload": "Upload",
  "auth": "Sign in",
  "empty-states": "Empty states",
  "survey": "Survey",
  "announcement": "Announcement",
  "app-shell": "App shell",
  "sidebar": "Sidebar",
  "chat": "Chat",
  "ai-chat": "AI chat",
  "command-palette": "Command palette",
};

/** Whichever the interface is speaking. */
export function shelfNames(locale: string): Record<string, string> {
  return locale === "zh" ? SECTION_SHELVES : SECTION_SHELVES_EN;
}

/** Website shelves, in assembly order. Everything not listed follows, in the
 *  registry's own order. */
export const SITE_SHELF_ORDER: string[] = [
  "hero",
  "features",
  "pricing",
  "faqs",
  "cta",
  "testimonials",
  "stats",
  "logo-cloud",
  "how-it-works",
  "gallery",
  "about",
  "team",
  "contact",
  "newsletter",
  "comparison",
  "bento",
  "blog",
  "article",
  "footer",
  "header",
  "page-header",
  "careers",
  "integrations"
];

/** Sorts shelf slugs: the website ones in assembly order, then the rest. */
export function orderShelves(keys: string[]): string[] {
  const rank = (k: string) => {
    const i = SITE_SHELF_ORDER.indexOf(k);
    return i < 0 ? SITE_SHELF_ORDER.length : i;
  };
  return [...keys].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
}
