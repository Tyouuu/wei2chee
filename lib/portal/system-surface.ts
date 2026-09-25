/**
 * 一个帐号每天用的是哪一套「系统界面」—— 一个地方答，五个地方一起问。
 *
 * ── 为什么有这一支（任务 421，2026-09-25）─────────────────────────────────
 *
 * 老板讲：`你要去接好我们平台跟产品的通道`。
 *
 * 这个仓库有两样东西，两棵路由树：
 *
 *   平台   `/portal`            深色的 Formae：交付进度 · 一页页生成的草稿 · 官网 · 改设计
 *   产品   `/salon-preview/*`   浅色的沙龙系统：预约 · 客户 · 收银 · 库存 · 报表 …（14 页）
 *
 * 之前**没有任何东西连着它们**：登入永远 `/portal`，产品里没有一个连结通往平台，
 * 平台里没有一个连结通往产品。老板登入示范帐号，落在平台首页，问
 * 「我们不是换了一种风格吗」。
 *
 * 「哪一种帐号该落在哪一边」如果写在五个地方（登入 · OAuth 回来 · 平台首页 ·
 * 旧系统的侧栏 · 产品的侧栏），第二份迟早会漂 —— 这个仓库栽在这个形状上至少
 * 七次。所以只在这里答一次。
 *
 * ── 今天只有一套新界面 ────────────────────────────────────────────────────
 *
 * 沙龙（`beauty`：美发 · 美容 · medi spa 共用这一个行业代号，见任务 349）。
 * 其余行业没有新界面，照旧走 `/portal`。加第二套的那一天，只改这一支。
 */

export type SystemSurface = "salon" | "classic";

/** `get_my_business_context()` 回的东西里，这一支只看行业代号。 */
type ContextLike = { industry?: { slug?: string | null } | null } | null | undefined;

const SALON_INDUSTRIES = new Set(["beauty"]);

export function systemSurfaceOf(context: ContextLike): SystemSurface {
  const slug = context?.industry?.slug;
  return slug && SALON_INDUSTRIES.has(slug) ? "salon" : "classic";
}

/** 新界面的正门。带语言前缀（产品那 14 页自己的连结也都是 `/en/…`）。 */
export function productHome(locale: string): string {
  return `/${locale}/salon-preview/overview`;
}

/** 平台首页。 */
export function platformHome(locale: string): string {
  return `/${locale}/portal`;
}

/**
 * 登入之后落在哪里。
 *
 *   · 创办人 → 他自己的后台，不看这一支
 *   · 链接里带了 `next` → 尊重它（已经验过是本站路径，见 lib/auth/safe-next.ts）
 *   · 沙龙帐号 → 产品（他每天开的那一边）
 *   · 其余 → 平台首页
 *
 * 平台不会消失：产品里有连结通往它（「更多工具」那一页），
 * 而平台是建造期的地方，交付出去的系统才是运营期（重点 19）。
 */
export function landingAfterLogin({
  locale,
  surface,
  next,
}: {
  locale: string;
  surface: SystemSurface;
  next: string | null;
}): string {
  if (next) return next;
  return surface === "salon" ? productHome(locale) : "/portal";
}

/**
 * 平台那一边（旧系统的侧栏）里，哪一页在产品里已经有自己的新版。
 *
 * 一个沙龙帐号如果在旧系统的侧栏里点「客户」，落在旧样子的客户页，而产品里
 * 早就有新的客户页 —— 那就是老板看到的「还是这种风格」。所以旧侧栏里这几页，
 * 沙龙帐号点了直接去新版。没有新版的（开销 · 官网 …）照旧。
 *
 *   dashboard → 总览      bookings → 预约     customers → 客户
 *   payments  → 发票      staff    → 师傅     inventory → 库存
 *
 * ⚠️ 收款（payments）对应的是「发票」那一页（一笔一笔收款的清单），不是收银台 ——
 *    收银台是「开一笔新的」，产品侧栏里有它自己的一行。
 * ⚠️ 只管**侧栏的入口**。某一位客人 / 某一笔预约点进去的详情页（`/portal/customers/<id>`）
 *    产品里还没有新版，仍然是旧样子 —— 见任务 421「还没做」。
 */
const SALON_PAGE_ROUTES: Record<string, string> = {
  dashboard: "overview",
  bookings: "schedule",
  customers: "clients",
  payments: "invoices",
  staff: "stylists",
  inventory: "stock",
};

/** 产品里对应的新页；没有对应的回 null。 */
export function productPathFor(locale: string, pageKey: string): string | null {
  const slug = SALON_PAGE_ROUTES[pageKey];
  return slug ? `/${locale}/salon-preview/${slug}` : null;
}
