import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import manifest from "../manifest";

/**
 * 桌面图标那一格，会不会静静变回一片灰。
 *
 * [重点 24](../../docs/founder-points.md)：**眼睛判像不像，尺子判有没有再犯。**
 * 2026-09-04 做这一件的时候，`/apple-icon.png` 已经 404 了不知道多久 ——
 * 而**没有任何东西会讲**：页面照样渲染、每一项检查照样绿，
 * 只有真的拿手机去加到主画面的人才看得到那一片灰。
 *
 * 所以这一份守的是四件当天真的坏掉、或者当天差一点坏掉的事。
 */

const read = (p: string) => readFileSync(join(process.cwd(), p), "utf8");

/** 把注解拿掉再比。
 *
 *  第一版没拿，然后它把**记录这个 bug 的那段注解**当成了 bug 本身
 *  —— 那段注解里就写着 `/apple-icon.png`。
 *  **一条不允许人把理由写下来的守卫，会逗下一个人把理由删掉。** */
const code = (p: string) =>
  read(p).replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("加到主画面那一格", () => {
  /**
   * 🔴 当天真的坏的那一个。
   *
   * `app/[locale]/layout.tsx` 里手写着 `apple: "/apple-icon.png"`，
   * 旁边的注解还写着它是为了防「iOS 找不到图标就去截一张网页的图」——
   * 而**那个网址从来不存在**（实测 404；真正服务的是 `/apple-icon`）。
   * 更糟的是手写那一行会**盖掉框架本来会自己写对的那一行**。
   *
   * 拿掉之后页面自己写出 `/apple-icon?<杂凑>`，而那个网址永远是对的。
   */
  it("🔴 图标网址不准手写在 metadata 里", () => {
    const layout = code("app/[locale]/layout.tsx");
    expect(layout).not.toMatch(/apple-icon\.png/);
    expect(layout).not.toMatch(/^\s*icons:\s*\{/m);
  });

  /**
   * `icon` / `apple-icon` / `manifest` 三条**没有副档名**，而语言中介层那条
   * 规则是「带点的才放行」（`favicon.ico` · `robots.txt` · `sitemap.xml`
   * 都是靠点逃掉的）。所以它们会被 307 到 `/en/apple-icon` —— 底下没有东西。
   */
  it("🔴 语言中介层不准把图标跟清单档抓走", () => {
    const proxy = code("proxy.ts");
    const m = proxy.match(/matcher:\s*\[([\s\S]+?)\]/)?.[1] ?? "";
    for (const route of ["icon", "apple-icon", "manifest"]) {
      expect(m, `${route} 会被 307 到 /en/${route}，那底下没有东西`).toContain(route);
    }
  });

  /** 清单档里写的每一张图都要真的在。一个指向不存在档案的图标，
   *  跟没有图标是同一件事，而它看起来像做完了。 */
  it("清单档里的每一张图都要真的在", () => {
    const icons = manifest().icons ?? [];
    expect(icons.length).toBeGreaterThan(0);
    for (const icon of icons) {
      const src = String(icon.src);
      expect(existsSync(join(process.cwd(), "public", src.replace(/^\//, ""))), `${src} 不在 public/`).toBe(true);
    }
  });

  /** 安卓要 192 跟 512 两张才算数，而且要一张 `maskable` ——
   *  它会把图标切成自己的形状，没有 maskable 那一张，「F」的角会被切掉。 */
  it("192 · 512 · maskable 三张都要有", () => {
    const icons = manifest().icons ?? [];
    const sizes = icons.map((i) => String(i.sizes));
    expect(sizes).toContain("192x192");
    expect(sizes).toContain("512x512");
    expect(icons.some((i) => String(i.purpose) === "maskable")).toBe(true);
  });

  /** 🔴 `browser` 就是一个书签 —— 网址列还在，看起来就不是一个 app，
   *  而这一整件事买到的东西就是那一条网址列不见。 */
  it("🔴 display 必须是 standalone，不是 browser", () => {
    expect(manifest().display).toBe("standalone");
  });

  /** 开在他的系统，不是官网。而且不准写死语言前缀 ——
   *  `/en/portal` 等於替每一个客户选了一种语言。 */
  it("开在他的系统，而且不写死语言", () => {
    const start = String(manifest().start_url);
    expect(start).toBe("/portal");
  });
});
