/**
 * 这个站对外的网址，只有一个来源。
 *
 * ── 为什么抽出来 ────────────────────────────────────────────────────────────
 * 它本来写在 `app/[locale]/layout.tsx` 里面，而 2026-09-01 加 sitemap 跟
 * robots 的时候，那两个档也要同一个网址。**再抄一份就是第二份手写的拷贝**，
 * 而这个仓库因为「一个事实住在两个地方，只有走得到的那个被更新」栽过五次
 * （最近一次是品牌色，改完 CSS 画面纹丝不动，查了四轮）。
 *
 * ⚠️ sitemap 里印错网址不会报错，它只会让 Google 去抓一个不存在的站，
 * 而**没有人会发现**，因为我们自己永远不会去读那个档。
 *
 * 顺序（跟 layout.tsx 原本一模一样，只是搬了地方）：
 *   1. `NEXT_PUBLIC_SITE_URL` —— 以后买了网域就设这个
 *   2. Vercel build 时给的正式网域
 *   3. localhost —— 让 `next build` 在平台外面也跑得起来，
 *      而不是安静地吐出爬虫跟不到的相对网址
 */
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL
  ? `https://${process.env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "")}`
  : process.env.VERCEL_PROJECT_PRODUCTION_URL
    ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
    : "http://localhost:3000";

/** 会被索引的公开页面。portal / console / api / auth 不在里面 —— 那些是登入后的。 */
export const PUBLIC_LOCALES = ["zh", "en"] as const;
export const PUBLIC_LEGAL_DOCS = ["privacy", "terms"] as const;
