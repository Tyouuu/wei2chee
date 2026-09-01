import { BRAND_NAME } from "@/lib/brand";
import { SITE_URL } from "@/lib/site-url";

/**
 * 结构化资料 —— 讲给机器听的「这家公司是谁」。
 *
 * ── 怎么发现缺这个 ──────────────────────────────────────────────────────────
 * 老板 2026-09-01 发了 Vercel 的 `is-agentic`，叫我跑一次。实跑 **71 分**，
 * 没过的里面有两条讲的是同一件事：
 *   · No JSON-LD structured data found on homepage
 *   · No JSON-LD found - Organization schema missing
 *
 * ⚠️ **这不是「给 agent 用」的新东西**。同一段结构化资料，Google 拿它画那张
 * 公司卡片已经十几年了。那支工具的 118 项里，「发现」跟「可及」那 50 分
 * 基本上就是传统 SEO —— 讲成「拜拜传统 SEO」是那个帖子的说法，不是量出来的。
 *
 * ── 三条规矩 ────────────────────────────────────────────────────────────────
 * 1. **只写真的。**（[任务 19](../docs/founder-tasks.md)：假的不上线。）
 *    所以这里**没有** `address`、没有 `telephone`、没有 `foundingDate`、
 *    没有评分 —— 公司还没注册，电话还是占位符（[任务 11](../docs/founder-tasks.md)）。
 *    结构化资料里编一个地址，是**对机器**说谎，而且它会被引用到别的地方去。
 * 2. **`areaServed` 写马来西亚** —— 那是真的，而且它正好是我们唯一的市场。
 * 3. **有了真东西就补上**：拿到号码 → 加 `telephone`；注册好公司 →
 *    加 `legalName` 跟 `address`。**在那之前留白，不是留一个假的。**
 */
export function OrganizationSchema({ locale }: { locale: string }) {
  const zh = locale !== "en";
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: BRAND_NAME,
    url: `${SITE_URL}/${zh ? "zh" : "en"}`,
    /* ⚠️ **这里故意没有 `logo`。** 第一版写 `/icon.png` —— 404；
       改成 `/apple-icon` —— **也是 404**（`app/apple-icon.tsx` 存在，
       而那个网址 404，那是另一个洞，已经记进任务）。
       一个指向 404 的 logo，是对机器讲一句**查得出来是假的话**，比不写更糟。
       `image` 指的是分享卡那张图，那一张是真的会回 200 的。 */
    image: `${SITE_URL}/${zh ? "zh" : "en"}/opengraph-image`,
    description: zh
      ? "给马来西亚中小企业做的系统与官网：讲两分钟你的生意，当场看到一套照你流程做的系统。"
      : "Business systems and websites for Malaysian SMEs: describe your business in two minutes and see a system built around your own workflow.",
    areaServed: { "@type": "Country", name: "Malaysia" },
    knowsLanguage: ["zh-Hans", "en"],
  };

  return (
    <script
      type="application/ld+json"
      /* `<` 要转义 —— 一段 JSON 里出现 `</script>` 会把这个标签提前关掉。
         这一行是 Next 自己文件里的写法，不是我发明的。 */
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c") }}
    />
  );
}
