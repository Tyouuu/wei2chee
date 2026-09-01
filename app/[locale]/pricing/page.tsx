import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Pricing, Faq } from "@/components/sections/landing-explainer";
import { BRAND_NAME } from "@/lib/brand";

/**
 * 价钱，自己一个网址。
 *
 * ── 为什么加这一页 ──────────────────────────────────────────────────────────
 * 老板 2026-09-01 叫我跑 Vercel 的 `is-agentic`。重扫之后（⚠️ 那支 CLI 会回
 * 快取，要去它的报告页按 Rescan）分数 71 → 76，而它写了一句评语：
 *
 *     the agent could not complete the task … **pricing … remained inaccessible**
 *
 * 而 `RM 500` 跟 `RM 150` **都在服务出去的 HTML 里**（实测各一次）——
 * 所以不是渲染的问题。**它找的是一个网址，我们只有一个锚点 `#pricing`。**
 *
 * ⚠️ 而这一件**对人比对机器更重要**：官网自己写着「价钱写在这里，不用先问」，
 * 而在这个市场，「讲给别人听」的动作就是**把连结贴进 WhatsApp**
 * （[任务 26](../../../docs/founder-tasks.md) 实测 19 家马来西亚 SME，15 家第一屏就给 WhatsApp）。
 * 贴一个首页过去，对方要自己滚到 78% 才看得到价钱 —— 那句承诺就不成立。
 *
 * ── 一个价钱一个真相 ────────────────────────────────────────────────────────
 * 这一页**没有自己的价目**，它渲染的就是首页那个 `<Pricing />`。
 * 抄一份过来就是第二份手写的数字，而这个仓库上一次改价钱正好漏掉一个surface
 * （分享卡），`pricing-consistency.test.ts` 就是为那件事写的。
 *
 * `<Faq />` 跟着一起来：一个人点进价钱页，下一个念头是「跟找网页公司做有什么
 * 不同」「资料是不是我的」，而那几题本来就写在那里。
 */

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "explainer.price" });
  const steps = t.raw("steps") as { label: string; amount: string }[];

  return {
    title: t("title"),
    /* 描述里带真的数字 —— 这一段就是 WhatsApp 那张卡上的字。
       一句「查看我们的方案」在那个位置等於什么都没讲。
       ⚠️ 从 steps 拼出来，不是手写：改价钱只有一个地方要改。 */
    description: steps.map((s) => `${s.label}：${s.amount}`).join(" · "),
    alternates: {
      canonical: `/${locale}/pricing`,
      languages: { zh: "/zh/pricing", en: "/en/pricing" },
    },
    openGraph: { title: `${t("title")} · ${BRAND_NAME}` },
  };
}

export default function PricingPage() {
  return (
    <main>
      <SiteHeader />
      {/* 顶栏是固定的，所以要自己让出一屏的上缘 —— 首页有第一屏顶着，这一页没有。 */}
      <div className="pt-16">
        <Pricing standalone />
        <Faq />
      </div>
      <SiteFooter />
    </main>
  );
}
