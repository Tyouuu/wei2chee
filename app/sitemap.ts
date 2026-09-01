import type { MetadataRoute } from "next";
import { SITE_URL, PUBLIC_LOCALES, PUBLIC_LEGAL_DOCS } from "@/lib/site-url";

/**
 * 网站地图。**2026-09-01 之前这个站根本没有。**
 *
 * ── 怎么发现的 ──────────────────────────────────────────────────────────────
 * 老板发了 Vercel 的 `is-agentic` 那支工具，叫我跑一次看它怎么评我们。
 * 实跑（`npx is-agentic wei2chee.vercel.app`）：**71 分 · Ready with a few
 * material gaps**，而没过的那几项里有一条就是 **「No sitemap found」**。
 *
 * ⚠️ 那支工具卖点是「给 AI agent 看的 SEO」，但**它 118 项里发现跟可及那 50 分
 * 基本上就是传统 SEO**（网站地图 · 结构化资料 · robots · 404）。
 * 所以这不是「拜拜传统 SEO」，是同一件事上面多加了一层 —— 这一条要讲清楚，
 * 免得下一轮有人以为旧的那套不用做了。
 *
 * ── 里面放什么、不放什么 ────────────────────────────────────────────────────
 * 放：官网（两个语言）· 法律页（两个语言 × 两份）。
 * 不放：登入 / 注册（对陌生人没有意义，而且它们会稀释首页的权重）·
 *      portal / console / api / auth（登入后的东西，robots.ts 也挡掉）。
 *
 * 🔴 **少了一样，而且那一样才是最值钱的**：客户自己发布的官网（`/s/<slug>`）。
 * 那正好是我们卖的东西 ——「客人 Google 你的店会找到你」。
 * 今天列不出来，因为资料库只有 `get_public_site(slug)`（拿一个），
 * **没有「列出所有已发布的」**，而那要一支新的资料库函式。
 * ⚠️ 没有动手的理由是另一个 session 手上有还没提交的迁移
 * （[重点 20](../docs/founder-points.md)：不要动别人正在改的东西）。
 * 记在 [任务](../docs/founder-tasks.md) 里了。
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const entries: MetadataRoute.Sitemap = [];

  for (const locale of PUBLIC_LOCALES) {
    entries.push({
      url: `${SITE_URL}/${locale}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
      /* 两个语言互相指认。一个人分享中文那条连结，Google 也知道有英文版。 */
      alternates: {
        languages: Object.fromEntries(
          PUBLIC_LOCALES.map((l) => [l, `${SITE_URL}/${l}`]),
        ),
      },
    });
  }

  for (const locale of PUBLIC_LOCALES) {
    for (const doc of PUBLIC_LEGAL_DOCS) {
      entries.push({
        url: `${SITE_URL}/${locale}/legal/${doc}`,
        lastModified: now,
        changeFrequency: "yearly",
        priority: 0.3,
      });
    }
  }

  return entries;
}
