/* 每一套后台风格都要讲得出它在抄哪一页，而且那句话要在代码里。
 *
 * 老板 2026-09-02：`用心去做每一套风格 然后注明起来是什么风格
 * 代码那边就不会排错了`。
 *
 * ── 这条守卫在守哪一件 ────────────────────────────────────────────────────
 * 「台账抄 shadcn 的 Tasks」在这之前只写在任务档的一张表里。一份写在文件里、
 * 一份活在我脑袋里的配对，就是这个仓库栽过五次的那个形状：**同一份名单的
 * 第二份手抄本，活得比它描述的东西久**。
 *
 * 所以：名单只有一份（`register-references.ts`），而这里逐条问它 ——
 *   · 每一套风格都要有参考，没有多的也没有少的
 *   · 参考的那张实拍要真的在
 *   · 两套风格不准指同一页（那等於两套在抄同一个设计）
 *   · 「拿什么」要写得出一句话
 *
 * ⚠️ 这四条**判不了好不好看**（[重点 24](../../docs/founder-points.md)）。
 * 它们判的是「有没有排错」——「像不像」只有眼睛判得了，工具是
 * `npm run align:admin` 出的那张并排图。
 */
import { describe, expect, it } from "vitest";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { REGISTER_REFERENCES, referenceFor } from "../register-references";
import { STYLE_ORDER } from "@/app/[locale]/style-picker/style-column";

const SHOTS = resolve(".screenshots/admins");

describe("每一套风格抄谁", () => {
  it("读得到两份名单 —— 读到空的话下面全部会假装通过", () => {
    expect(STYLE_ORDER.length).toBeGreaterThan(3);
    expect(Object.keys(REGISTER_REFERENCES).length).toBeGreaterThan(3);
  });

  it.each([...STYLE_ORDER])("%s 有声明参考", (reg) => {
    expect(referenceFor(reg), `${reg} 没有写它在抄哪一页`).not.toBeNull();
  });

  it("没有替一套已经不存在的风格留着参考", () => {
    const live = new Set<string>([...STYLE_ORDER]);
    const orphans = Object.keys(REGISTER_REFERENCES).filter((k) => !live.has(k));
    expect(orphans, `这几套已经不在 STYLE_ORDER 里了: ${orphans.join(", ")}`).toEqual([]);
  });

  it.each(Object.entries(REGISTER_REFERENCES))("%s 的那张实拍在", (reg, ref) => {
    /* 一张不在的实拍，跟一张拍错的实拍，在报告里长得一模一样。
       没有的话去跑 `npm run shoot:admins`。 */
    expect(
      existsSync(resolve(SHOTS, ref.shot)),
      `${reg} 指着 .screenshots/admins/${ref.shot}，那个档案不在`,
    ).toBe(true);
  });

  it("两套风格不准抄同一页", () => {
    /* 同一个 repo 可以被两套用（Tabler 的仪表盘跟单据是两个设计），
       同一个**网址**不行 —— 那就是两套在抄同一张图。 */
    const seen = new Map<string, string>();
    for (const [reg, ref] of Object.entries(REGISTER_REFERENCES)) {
      const twin = seen.get(ref.url);
      expect(twin, `${reg} 跟 ${twin} 指着同一页 ${ref.url}`).toBeUndefined();
      seen.set(ref.url, reg);
    }
  });

  it.each(Object.entries(REGISTER_REFERENCES))("%s 讲得出从它那里拿什么", (reg, ref) => {
    /* 「参考它的风格」这种句子过不了这一条，而那正是它存在的理由：
       拿不出一句具体的，就代表这一对配得没有理由。 */
    expect(ref.takes.length, `${reg} 的「拿什么」太短，写不出一句就是配错了`).toBeGreaterThan(20);
    expect(ref.takes, `${reg} 的「拿什么」是一句空话`).not.toMatch(/参考它的风格|好看|现代感$/);
  });

  it.each(Object.entries(REGISTER_REFERENCES))("%s 说了拿我们哪一页去对", (reg, ref) => {
    /* 不写这一栏，尺子就会拿总览去对一张只有表格的页，然后报一个
       「一屏几块 2 对 5」的假差异。**那不是我们做错，是我拿错了页。** */
    expect(ref.ourPage, `${reg} 没说拿我们哪一页去对`).toMatch(/^\/en\/portal\//);
  });

  /* 尺子会报的项目名。**打错一个字就等於偷偷把一项关掉**，
     所以这份名单跟 `align-admin.mjs` 里那几行必须对得上。 */
  const ITEMS = [
    "图上几块", "一行几块", "块宽", "图几张", "表几张", "数字块几个", "名单几个", "组成",
    "外框", "侧栏宽", "一屏几块", "第一块是", "最大的字", "最大的是数字", "字级阶梯",
    "有颜色", "圆角", "卡片内距", "带阴影", "带细边", "块间的缝", "表格行高", "栏能不能排",
    "表格页尾", "工具条几件", "一屏字数", "孤单的按钮", "底下的空",
  ];

  it.each(Object.entries(REGISTER_REFERENCES))("%s 故意不跟的每一项都指着真的项目、而且写了理由", (reg, ref) => {
    for (const k of ref.keeps ?? []) {
      expect(ITEMS, `${reg} 的「${k.item}」不是尺子会报的项目 —— 打错字等於偷偷关掉一项`)
        .toContain(k.item);
      /* 一句「设计如此」过不了这一条，而那正是它存在的理由：
         留下来是一个**判断**，判断要讲得出理由。 */
      expect(k.why.length, `${reg} 的「${k.item}」没写清楚为什么故意不跟`).toBeGreaterThan(15);
    }
  });

  it("故意不跟的总数有上限 —— 它不是消音钮", () => {
    /* 上限逼着下一个人拿理由来加，而不是把红的一项一项关掉。
       今天是 7：台账 1 · 图纸 2 · 中台 2 · 招牌 2，全部是外框跟侧栏宽。 */
    const n = Object.values(REGISTER_REFERENCES).reduce((a, r) => a + (r.keeps?.length ?? 0), 0);
    expect(n, "故意不跟的项目变多了 —— 先问是不是在拿它盖住没做的事").toBeLessThanOrEqual(8);
  });

  it.each(Object.entries(REGISTER_REFERENCES))("%s 写了许可", (reg, ref) => {
    /* 后台这一边可以直接拿代码，所以许可不是装饰。 */
    expect(ref.source, `${reg} 的来源没写许可`).toMatch(/MIT|Apache|BSD/);
  });
});
