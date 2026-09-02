import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { STYLE_BRIEFS } from "./design-doc";
import { VARIANTS } from "@/design-system/editor/variants";
import { STYLE_ORDER } from "@/app/[locale]/style-picker/style-column";
import { puckConfig } from "@/design-system/editor/puck-config";

/**
 * A register's preference has to name a variant that EXISTS.
 *
 * WHY THIS TEST IS HERE. This is the third time this exact class of failure has
 * cost this product real work. 315 register preferences reached no component at
 * all until 2026-08-23 because nothing called the hook. Puck's defaultProps then
 * made "never chosen" indistinguishable from "chosen", so the register could
 * never win. Both were invisible: no type error, no thrown render, every test
 * green, and sixteen registers drawing one page.
 *
 * The third form is a preference that names a variant nobody wrote --
 * `ShelfList: "row"` when the ids are boxed / boxed-sm / ruled / ruled-sm. It
 * was written on 2026-08-25 while adding 中台 and would have shipped as one more
 * silently-ignored line, indistinguishable from the register having no opinion.
 *
 * `prefer` is a Record<string, string>, so TypeScript cannot catch any of this.
 * A test can.
 */
describe("every register's preferences point at something real", () => {
  it("names a component that has variants", () => {
    for (const [style, brief] of Object.entries(STYLE_BRIEFS)) {
      for (const component of Object.keys(brief.prefer)) {
        expect(
          VARIANTS[component],
          `${style} prefers a variant of ${component}, which has none`,
        ).toBeDefined();
      }
    }
  });

  /*
    THE FOURTH FORM, AND IT SHIPPED ON 2026-08-27.

    A preference can name a component that exists and a variant that exists and
    STILL reach nothing, because precedence in this system is: the customer's
    own prop > the register's preference > the component's default. A prop Puck
    filled in from `defaultProps` is PRESENT, and present is indistinguishable
    from "the customer chose this".

    SiteGallery, SiteStory and SiteCreds all shipped with their `shape` in
    defaultProps. Fourteen registers each declared a shape; all fourteen pages
    drew the identical object, and every test above passed. The component's own
    parameter default is where a fallback belongs -- `shape = "grid"` in the
    function signature -- because that one only applies when nothing else did.
  */
  it("names a prop no defaultProps has already filled in", () => {
    const components = (puckConfig as unknown as {
      components: Record<string, { defaultProps?: Record<string, unknown> }>;
    }).components;

    for (const [style, brief] of Object.entries(STYLE_BRIEFS)) {
      for (const [component, id] of Object.entries(brief.prefer)) {
        const variant = (VARIANTS[component] ?? []).find((v) => v.id === id);
        if (!variant) continue;
        const defaults = components[component]?.defaultProps ?? {};
        for (const key of Object.keys(variant.props)) {
          expect(
            Object.prototype.hasOwnProperty.call(defaults, key),
            `${component}.defaultProps sets "${key}", so ${style}'s preference "${id}" can never apply`,
          ).toBe(false);
        }
      }
    }
  });

  it("names a variant that component actually has", () => {
    for (const [style, brief] of Object.entries(STYLE_BRIEFS)) {
      for (const [component, id] of Object.entries(brief.prefer)) {
        const ids = (VARIANTS[component] ?? []).map((v) => v.id);
        expect(ids, `${style} wants ${component}="${id}"`).toContain(id);
      }
    }
  });

  // A register with a token file and no brief renders in the right colours and
  // the wrong SHAPE -- it silently falls back to every component's default,
  // which is the 「每一版都是一样的」 the whole variant layer exists to fix.
  it("gives every pickable register a brief", () => {
    for (const style of STYLE_ORDER) {
      expect(STYLE_BRIEFS[style], `${style} has no brief`).toBeDefined();
    }
  });

  /**
   * NO TWO REGISTERS MAY BE THE SAME DESIGN IN TWO COLOURS.
   *
   * The founder's own test, 2026-08-25: 「你那些什么牛皮 什么啊 什么啊 只是你再调
   * 那个颜色而已？那为什么不要放在配色？」 and 「就是至少是没有重复性的」. It is the
   * right test. A register that survives a repaint is a register; one that does
   * not should have been a 配色.
   *
   * The ten axes below are exactly the ones a palette CANNOT touch -- a palette
   * gives the rail its hue, never its value, and it cannot turn a ranking into
   * a row of faces or a table's status into a filled pill. Sharing all ten
   * means two registers differ only in colour and typeface, which is the defect
   * this measures.
   *
   * WHY SIX AND NOT THREE. This is a VETO, not a design tool, and the
   * difference is not academic: a solver run against a threshold of three on
   * 2026-08-25 reached zero violations by putting 瑞士 on a dark top bar, giving
   * 墨 a grid table and taking the cards away from 仪表盘 -- a perfect number and
   * three broken registers. The same failure as check:registers wearing a new
   * coat. So the bar is set where it catches genuine twins (瑞士/墨 shared
   * EIGHT, five of them locked) and leaves the judgement to the eye, which is
   * the only thing that can pass a design.
   *
   * A register's dashboard COMPOSITION is a further difference this does not
   * count, so two registers at six here are still further apart than the number
   * suggests.
   */
  /* 🔴 这一条守的是**尺子本身**。
     它被窄化过一次：十一根轴，而每一套实际宣告三十八个偏好，于是一对
     12/20 的双胞胎被报成 4/11 并且放行。一把量错子集的尺，比没有尺更糟 ——
     它会发绿灯。 */
  it("the ruler itself does not get narrower", () => {
    const src = readFileSync(resolve("lib/portal/design-doc.test.ts"), "utf8");
    const block = src.match(/const AXES = \[([\s\S]*?)\] as const;/);
    expect(block, "AXES 不见了 —— 这条守卫读不到它要守的东西").toBeTruthy();
    const count = (block?.[1].match(/"/g)?.length ?? 0) / 2;
    expect(count, "结构轴的数量变少了。要拿掉一根，先在这里写下为什么").toBeGreaterThanOrEqual(20);
  });

  it("has no two registers that are one design in two colours", () => {
    /* 🔴 十一根变二十根（2026-09-02），而这不是把尺放宽，是把尺**修准**。
       老板：「你没有帮我去加轴的吗 怪不得你一直复刻不到」。

       这份清单本来只数十一根，而每一套风格实际上宣告了三十八个偏好。
       没被数到的那几根不是装饰 —— `WorkflowStrip`（一条流程是一行、一条时间线
       还是一串编号）、`ShelfList`、`HeroCard`、`PriceTable`、`DaySchedule`
       全部是**画面上看得见的不同物件**。

       量出来的后果很具体：把它们数进来之后，**台账 跟 中台 共用 12/20** ——
       六成一样。而旧的尺子说它们是 4/11，还给了绿灯。
       两套都是暗侧栏、都最密、都表格先行、都有搜索工具条，而尺子看不到。

       ⚠️ 只有**结构**的轴进这份清单。`Tag` `ActionButton` `Divider` 那几个是
       漆，而这条守卫存在的意义就是「换个配色它还是不是另一个设计」—— 把漆
       数进来会让这个数字自己回答自己。 */
    const AXES = [
      "SystemShell",
      "RailNav",
      "RecordTable",
      "RecordTableRow",
      "RecordTableTools",
      "StatRow",
      "Panel",
      "TrendChart",
      "ShareChart",
      "RankList",
      "PageHeader",
      "WorkflowStrip",
      "ShelfList",
      "HeroCard",
      "PriceTable",
      "DaySchedule",
      "InfoRows",
      "SmallStat",
      "MarkList",
      "TabbedPanel",
    ] as const;
    /* 6/20。⚠️ **这个数字只准往下走，永远不准往上。**

       8 → 6（2026-09-02）。降下来的方式不是把尺放宽，是**把三根最浅的轴加深**，
       每一根的每一个新形状都有实拍出处（`.screenshots/objects/`，`npm run shoot:objects`）：

         WorkflowStrip  3 → 5   ruled ← Gentelella v4 的 Tasks 卡
                                track ← arhamkhnz Logistics 的运单卡
         DaySchedule    2 → 4   rail  ← FullCalendar timeGrid · AdminLTE timeline
                                ruled ← Gentelella v4 的清单
         PriceTable     2 → 4   rows  ← [任务 26](../../docs/founder-tasks.md)
                                        实测的十九家马来西亚同行
                                stack ← Tabler invoice 的逐行明细

       量出来的效果：最像的一对从 8/20 掉到 6/20，而 PriceTable 一根就从
       五对里退了出去 —— **一根只有两种的轴，六套风格里必然有三套共用同一个值**，
       所以浅轴不是设计懒，是没有东西可以选。

       ⚠️ 还剩的浅轴，下一轮照同一个做法：`RecordTableRow`（3 种，出现在五对里）·
       `SmallStat`（3）· `MarkList`（3）· `TabbedPanel`（4）· `RankList`（3）。
       **每加深一根轴，这里就该少一分。** */
    const MAX_SHARED = 6;

    const styles = [...STYLE_ORDER];
    for (let i = 0; i < styles.length; i++) {
      for (let j = i + 1; j < styles.length; j++) {
        const a = STYLE_BRIEFS[styles[i]]?.prefer ?? {};
        const b = STYLE_BRIEFS[styles[j]]?.prefer ?? {};
        const same = AXES.filter((ax) => a[ax] !== undefined && a[ax] === b[ax]);
        expect(
          same.length,
          `${styles[i]} and ${styles[j]} share ${same.length} of ${AXES.length} axes ` +
            `(${same.join(", ")}). Give one of them a different OBJECT, not a different colour.`,
        ).toBeLessThanOrEqual(MAX_SHARED);
      }
    }
  });

  /**
   * Every register must have an opinion on every axis.
   *
   * An axis a register says nothing about falls back to the component default,
   * so the register that added the axis is the only one it changes anything
   * for -- which is how RailNav and Panel sat unreachable for months.
   */
  it("gives every register an opinion on every axis", () => {
    const AXES = ["RecordTableRow", "RecordTableTools", "ShareChart", "RankList"];
    for (const style of STYLE_ORDER) {
      for (const ax of AXES) {
        expect(
          STYLE_BRIEFS[style]?.prefer?.[ax],
          `${style} has no preference for ${ax}`,
        ).toBeDefined();
      }
    }
  });
});
