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

  it.each(Object.entries(REGISTER_REFERENCES))("%s 写了许可", (reg, ref) => {
    /* 后台这一边可以直接拿代码，所以许可不是装饰。 */
    expect(ref.source, `${reg} 的来源没写许可`).toMatch(/MIT|Apache|BSD/);
  });
});
