import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site-url";

/**
 * robots.txt。跟 `app/sitemap.ts` 同一天加的，理由写在那个档里。
 *
 * ⚠️ **挡起来的都是登入之后的东西**，不是「不想被看到的东西」：
 * `/portal` 是老板自己的工作台、`/console` 是我们的后台、`/api` 跟 `/auth`
 * 是机器在打的。它们本来就要登入才进得去（权限在资料库那一层），
 * 这里挡只是**别让爬虫浪费时间去撞一整排登入转址** ——
 * robots.txt 是礼貌，不是安全。**任何靠它挡住的东西都不算挡住。**
 *
 * 🔴 `/s/<slug>`（客户自己发布的官网）**故意不挡** —— 那正好是我们卖的东西：
 * 「客人 Google 你的店会找到你」。挡掉它等於把产品的卖点关掉。
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/portal", "/console", "/api", "/auth"],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
