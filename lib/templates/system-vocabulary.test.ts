/* 没有模版的那一页，怎么保证它还是同一个设计。
 *
 * 老板 2026-09-04：
 *   `如果面对没有模版的情况下呢 就是不可能每一个功能 他那边都有模版啊`
 *
 * ── 他讲对了，而答案不是「那就自己发挥」 ─────────────────────────────────
 * 参考那 15 页（`.screenshots/admins/arham-*.jpg`，其中 e-commerce 是死页）
 * 逐张看过：**我们十四个模块里，十个找得到问同一个问题的那一页**
 * （总览←default · 单据←invoice · 看板←kanban · 名册←users ·
 *  左清单右详情←logistics · 钱←finance · 报表←analytics · 货架←file-manager ·
 *  排程←productivity 的月历 · 分组表←infrastructure），
 * **四个没有**（对帐 · 排行 · 搬旧资料 · 分店）。
 *
 * 但那四页缺的是「刚好那一页」，**不是零件** —— 十五页参考里零件是重复的：
 * 卡片头 · 表格工具条 · 数字卡 · 分组表 · 看板栏 · 月历 · 左清单右详情。
 * 一页没有模版的功能页，是**用已经有出处的零件回答一个新问题**。
 *
 * ── 所以这条守卫守的就是那一句 ───────────────────────────────────────────
 * **每一个会被画到客户系统上的零件，都必须有一个「系统那一套」替它挑过的样子。**
 *
 * 一个没有人替它挑过样子的零件，画出来是它自己的预设 —— 而预设不属于任何一套
 * 设计语言。那正是这个仓库犯过的那件事的形状：
 * 2026-08-25 之前十一套风格宣告了偏好而 builder 照样吐预设，
 * 而 2026-08-28 有 45 条偏好因为 `defaultProps` 赢过它们而从来没生效过。
 *
 * ⚠️ **两种零件可以没有偏好，而且第二种是这条守卫第一次跑就抓到的：**
 *   ① 它只有一个样子 —— 没得挑就没有「挑错」。
 *   ② **每一个实例都自己讲了要哪个样子。** `Columns` 就是这一种：
 *      「这两块并排、左边宽」是关於**这两块**的决定，不是关於风格的决定，
 *      所以排法表自己写 `@wide-left`，而写进 props 的东西排在风格前面。
 *
 * ⚠️ ②**不是一份可以随手加名字的白名单** —— 它是量出来的：
 * 那个零件在**每一页的每一个实例**上都要真的带着样子那个属性。
 * 漏一个，那一个就画出没有人挑过的预设，而这条守卫会指着它。
 */
import { describe, expect, it } from "vitest";
import {
  PAGES_FOR_INDUSTRY,
  buildPageLayout,
  type BusinessContext,
  type PageKey,
} from "./industry-template";
import { walkNodes, type PuckNode } from "@/lib/portal/layout-ops";
import { VARIANTS } from "@/design-system/editor/variants";
import { preferredVariants } from "@/lib/portal/design-doc";
import { SYSTEM_REGISTER, SITE_PAGE_KEY } from "@/lib/portal/system-register";

const prefer = preferredVariants(SYSTEM_REGISTER);

/** 每一个行业的每一页，画出来用到哪些零件。 */
const instances = new Map<string, PuckNode[]>();

function componentsOnEveryPage(): Map<string, string[]> {
  const seen = new Map<string, string[]>();
  for (const [slug, keys] of Object.entries(PAGES_FOR_INDUSTRY)) {
    const ctx: BusinessContext = { industry: { slug, name_zh: slug, labels: { customer: "客户", order: "单", staff: "师傅" }, default_workflow: [], suggested_modules: [] } };
    const refs = keys.map((k) => ({ key: k }));
    for (const key of keys) {
      /* 官网不算 —— 那一页的样子还跟着客户挑的风格走，而这条守卫问的是
         「工作台那一套」。见 lib/portal/system-register.ts。 */
      if (key === SITE_PAGE_KEY) continue;
      const layout = buildPageLayout(key as PageKey, ctx, "兴发", "zh", refs) as unknown as { content: PuckNode[] };
      for (const n of walkNodes(layout.content)) {
        const t = n.type;
        if (!t) continue;
        const where = seen.get(t) ?? [];
        if (!where.includes(`${slug}/${key}`)) where.push(`${slug}/${key}`);
        seen.set(t, where);
        instances.set(t, [...(instances.get(t) ?? []), n]);
      }
    }
  }
  return seen;
}

describe("没有模版的页，也只能用有出处的零件", () => {
  const used = componentsOnEveryPage();

  it("八个行业的每一页，加起来真的画出东西了 —— 空的话下面全部假装通过", () => {
    expect(used.size).toBeGreaterThan(10);
  });

  it("每一个画在客户系统上的零件，系统那一套都替它挑过样子", () => {
    const naked: string[] = [];
    for (const [type, where] of used) {
      const shapes = VARIANTS[type];
      /* 只有一个样子的零件不用挑 —— 没得挑就没有挑错。 */
      if (!shapes || shapes.length < 2) continue;
      if (prefer[type]) continue;
      /* ② 每一个实例都自己讲了要哪个样子。**推出来的，不是白名单** ——
         那几个属性的名字从这个零件自己的样子清单里取，所以新增一个样子、
         或者换一个属性名，这里跟着变。 */
      const shapeProps = new Set(shapes.flatMap((v) => Object.keys(v.props ?? {})));
      const nodes = instances.get(type) ?? [];
      const bare = nodes.filter((n) => ![...shapeProps].some((k) => n.props?.[k] !== undefined));
      if (!bare.length && nodes.length) continue;
      naked.push(
        `${type}（画在 ${where.slice(0, 2).join(" · ")}，它有 ${shapes.length} 个样子，` +
          `其中 ${bare.length}/${nodes.length} 个实例什么都没讲）`,
      );
    }
    expect(
      naked,
      `这几个零件有好几个样子，而系统那一套一个都没挑 —— 画出来是它自己的预设，\n` +
        `而预设不属于任何一套设计语言：\n  ${naked.join("\n  ")}\n` +
        `→ 去 lib/portal/design-doc.ts 的 ${SYSTEM_REGISTER}.prefer 里替它挑一个，` +
        `挑之前先去 .screenshots/admins/arham-*.jpg 找同一个零件长什么样。`,
    ).toEqual([]);
  });

  it("挑过的样子都真的存在 —— 打错一个字等於没挑，而 TypeScript 看不到", () => {
    const ghosts: string[] = [];
    for (const [type, id] of Object.entries(prefer)) {
      const shapes = VARIANTS[type];
      if (!shapes) continue;
      if (!shapes.some((v) => v.id === id)) ghosts.push(`${type}: "${id}"`);
    }
    expect(ghosts, `这几条偏好指着不存在的样子：\n  ${ghosts.join("\n  ")}`).toEqual([]);
  });
});
