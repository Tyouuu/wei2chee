/**
 * `/login?next=/en/salon-preview/overview` —— 登入之后落在哪一页。
 *
 * ── 为什么有这一支（任务 421，2026-09-25）─────────────────────────────────
 *
 * 新的沙龙界面（`/salon-preview/*` 那 14 页）跟平台首页（`/portal`，深色的
 * Formae）是两棵路由树，而登入永远落在 `/portal`。老板照我给的帐号登入，
 * 看到的是旧的深色首页，问「我们不是换了一种风格吗」。
 *
 * 该怎么把新界面接成产品的正门，是一个还没决定的产品判断（见任务 421）。
 * 在那之前，先给他一个**点开就落在新界面**的链接。
 *
 * ── 🔴 只收本站的路径 ─────────────────────────────────────────────────────
 *
 * `next` 是任何人都能塞进链接的东西。收 `https://evil.example` 就是一个开放式
 * 转址：一封看起来来自我们的登入信，登入完把人送去别人的网站。所以只认
 * `/` 开头的本站路径，`//host`（协议相对网址）、`/\host`（浏览器会把反斜线当
 * 斜线）、带控制字元的，一律当没有。
 */
export function safeNext(raw: string | string[] | undefined | null): string | null {
  const v = Array.isArray(raw) ? raw[0] : raw;
  if (!v || v.length > 300) return null;
  if (!v.startsWith("/")) return null;
  if (v.startsWith("//") || v.includes("\\")) return null;
  if (/[\u0000-\u001f\u007f]/.test(v)) return null;
  return v;
}
