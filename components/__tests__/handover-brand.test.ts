/* 品牌色只有一个真相 —— 现在用「不准有第二份」来守，不是用「两份要对得上」。
 *
 * 2026-08-31：老板要把主色从蓝换成青。globals.css 改完，服务出去的 CSS 是
 * `--blueprint: #00bdb6`，**而画面一点都没变** —— 因为 handover.tsx 里有
 * 第二份拷贝（`{ c: 0.17, h: 262 }`），它每一帧写成 <html> 的 inline style，
 * 而 inline 赢过所有样式表。查了四轮才找到。
 * **一份手写的拷贝活得比它描述的东西久** —— 这个仓库第五次。
 *
 * 2026-09-01：那份拷贝**整个拿掉了**（老板：「白色 你觉得要留吗」→ 量完七个站
 * → 整页留黑）。所以这条守卫从「两份要一致」升级成
 * **「handover.tsx 里不准出现任何颜色」** —— 一致性守卫只挡漂移，
 * 这一条挡的是**再长出第二份**，而那才是那个 bug 的形状。
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const tsx = () => readFileSync(resolve("components/handover.tsx"), "utf8");
/* 注解里会讲颜色（上面那段就在讲），所以先把注解剥掉再查。 */
const code = () => tsx().replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("品牌色只有一个真相", () => {
  it("handover.tsx 一个颜色值都不准写", () => {
    const c = code();
    for (const re of [/oklch\(/i, /#[0-9a-f]{3,8}\b/i, /\brgba?\(/i, /\bhsla?\(/i]) {
      expect(c, `handover.tsx 又长出颜色了：${re}`).not.toMatch(re);
    }
  });

  it("handover.tsx 不准再去写颜色 token", () => {
    const c = code();
    for (const token of ["--background", "--foreground", "--ink", "--card", "--border", "--blueprint", "--muted"]) {
      expect(c, `handover.tsx 又在写 ${token} —— 它只能发布 --handover-t`).not.toContain(`"${token}"`);
    }
  });

  it("但它还是要发布 --handover-t：那一层 WebGL 靠它卸载", () => {
    /* 任务 80 实测：手机上那层 shader 在不透明度已经是 0 的地方还在跑
       62 draws/s。ambient-backdrop.tsx 读这个值把它卸掉，check:ambient 守着。 */
    expect(code()).toContain("--handover-t");
  });
});
