/**
 * WHAT A STRANGER READS ON THE GENERATED WEBSITE.
 *
 * 编辑器负责催，公开的页面永远不出现「催」 -- task 19 -- and the machinery for
 * it is a `placeholder: true` flag that publish-projection strips. On
 * 2026-09-08 the eight trades were rendered side by side for the first time and
 * TWO CLASSES OF THING were reaching strangers anyway (task 293):
 *
 *   1. 「主要服务 · 改成你做的第一件事」 -- the 其他 trade's service rows are
 *      instructions to the owner, and they were unflagged. Flagging them fixed
 *      one of SIX places they reach: the labels are also read by the headline,
 *      the first-screen chips, the statement sentence, the price rows and the
 *      drawn figure, and every one of those reads `label`, not the row.
 *
 *   2. 「吉隆坡 · 八打灵再也 · 梳邦 / USJ · 莎阿南」 -- a hardcoded Klang Valley
 *      list on EVERY trade, while the questionnaire never asks where he is. The
 *      prospect list is 1,225 businesses in Ipoh. A wrong place is worse than a
 *      missing one: it tells the owner the page was built for someone else.
 *
 * This test walks the generated page in BOTH directions, because either half
 * alone passes for the wrong reason: a page that prompts nowhere is not fixed,
 * it is just quiet, and a page that publishes everything is the original bug.
 */
import { describe, it, expect } from "vitest";
import { buildPageLayout, type BusinessContext } from "@/lib/templates/industry-template";
import { forPublication } from "@/lib/portal/publish-projection";

/** Every string the owner is being TOLD TO DO SOMETHING with, plus the places
 *  nobody asked him about. None of these may reach a stranger. */
const NEVER_PUBLISHED = [
  "主要服务", "第二项", "第三项",
  "改成你做的第一件事", "改成第二件", "改成第三件",
  "Change this to the first thing you do", "Change this to the second",
  "吉隆坡", "八打灵再也", "梳邦", "莎阿南",
  "Kuala Lumpur", "Petaling Jaya", "Shah Alam",
  /* 🔴 第三处，而它躲过了第一轮：那条证据带上的「服务范围 · 巴生谷」在八个
     行业上都有，而我第一次只搜了那四个市镇名。看实拍才看到的。 */
  "巴生谷", "Klang Valley",
];

const TRADES = ["renovation", "beauty", "fnb", "retail", "wholesale", "education", "services", "other"];

const build = (slug: string, lang: "zh" | "en") => {
  const ctx = {
    lang,
    identity: { business_name: lang === "zh" ? "永盛铁花" : "Wing Seng Ironworks" },
    industry: {
      slug,
      name_zh: slug,
      labels: { customer: "客户", order: "订单", staff: "师傅" },
      default_workflow: ["Customer", "Order", "Payment"],
      suggested_modules: ["Customer", "Order", "Payment"],
    },
  } as unknown as BusinessContext;
  return buildPageLayout("website", ctx, "永盛铁花", "zh", undefined, "blueprint") as never;
};

/** Every string anywhere in the tree, however deeply nested -- the last two
 *  leaks were inside an object prop, where publish-projection does not reach. */
const words = (layout: unknown): string => JSON.stringify((layout as { content?: unknown })?.content ?? []);

describe("生成出来的官网", () => {
  for (const lang of ["zh", "en"] as const) {
    for (const slug of TRADES) {
      it(`${slug} · ${lang} — 上线的页面上没有一句是催他的，也没有一个他没讲过的地名`, () => {
        const said = words(forPublication(build(slug, lang) as never) as never);
        expect(NEVER_PUBLISHED.filter((w) => said.includes(w))).toEqual([]);
      });
    }
  }

  it("🔴 而编辑器还是会催 —— 少了这一条，上面那八条只要把提示删光就全绿", () => {
    const draft = words(build("other", "zh"));
    expect(NEVER_PUBLISHED.some((w) => draft.includes(w))).toBe(true);
  });

  it("大标题永远不是一个字 —— 拿掉地名之后 tradeNoun.retail 只剩「店」", () => {
    for (const slug of TRADES) {
      const hero = (build(slug, "zh") as unknown as { content: { type: string; props: { headline?: string } }[] })
        .content.find((n) => n.type === "SiteHero");
      expect((hero?.props.headline ?? "").length).toBeGreaterThan(1);
    }
  });
});
