/* 产生出来的页面，不可以让组件自己补一个「跟上个月比」的数字。
 *
 * ── 抓到它的那一天 ────────────────────────────────────────────────────────
 * 老板 2026-09-03：`每一套都是要每一页放大来看 你复刻的仔细一点`。
 * 放大两倍看中台的总览，第二排三张小卡底下**三张都写着
 * 「↑ +800% vs last month」** —— 三个一模一样的 800%。
 *
 * 根因不是算错，是**产生器根本没算**：`tiles` 那一段只传了 label 跟 value，
 * 而 Puck 会拿 `SmallStat` 的 `defaultProps` 把 `delta: 8` 补上，
 * `StatCard` 又把它当倍数，於是 8 变成 800%。
 *
 * ⚠️ **这一类抓不到，因为它不在版面 JSON 里** —— 版面里那个键根本不存在，
 * 是渲染的时候才被补进去的。所以这条守卫问的不是「值对不对」，是
 * **「产生器有没有替这个键表过态」**：
 * 算得出来就传数字，算不出来就传 null。**沉默会被 defaultProps 说成 800%。**
 *
 * ── 为什么只管这几个键 ────────────────────────────────────────────────────
 * 它们全部是**对过去的宣称** —— 涨了多少、跟哪一段比、上一次是多少。
 * 一个示例的名字（「本月新客户」）看得出来是示例；
 * 一个「+800%」看起来就是他自己的生意。
 */
import { describe, expect, it } from "vitest";
import { puckConfig } from "@/design-system/editor/puck-config";
import { walkNodes, type PuckLayout } from "@/lib/portal/layout-ops";
import { buildPageLayout } from "@/lib/templates/industry-template";
import { STYLE_ORDER } from "@/app/[locale]/style-picker/style-column";
import { MODULE_KEYS } from "@/lib/portal/module-catalog";

/** 对过去的宣称。组件的 `defaultProps` 只要有这几个键，产生器就必须表态。 */
const CLAIMS_ABOUT_THE_PAST = ["delta", "period", "previous", "deltaLabel", "spark"] as const;

const components = puckConfig.components as Record<
  string,
  { defaultProps?: Record<string, unknown> }
>;

function pages() {
  const out: { where: string; layout: PuckLayout }[] = [];
  for (const reg of STYLE_ORDER) {
    for (const key of ["dashboard", ...MODULE_KEYS.slice(0, 6)]) {
      out.push({
        where: `${reg} · ${key}`,
        layout: buildPageLayout(key, {}, "兴发", "en", [{ key }], reg, null) as unknown as PuckLayout,
      });
    }
  }
  return out;
}

describe("产生出来的页面不准让组件自己补一个跟上个月比的数字", () => {
  it("读得到页面 —— 读到零页的话下面会假装通过", () => {
    const all = pages();
    expect(all.length).toBeGreaterThan(10);
    expect(all.flatMap((p) => walkNodes(p.layout.content)).length).toBeGreaterThan(50);
  });

  it("每一个会被补数字的块，产生器都表过态", () => {
    const bad: string[] = [];
    for (const { where, layout } of pages()) {
      for (const n of walkNodes(layout.content)) {
        const def = components[n.type]?.defaultProps ?? {};
        for (const k of CLAIMS_ABOUT_THE_PAST) {
          if (k in def && !(k in n.props)) {
            bad.push(`${where} → ${n.type}#${String(n.props.id)} 没有交代 ${k}（会被补成 ${JSON.stringify(def[k])}）`);
          }
        }
      }
    }
    expect(bad, bad.join("\n")).toEqual([]);
  });
});
