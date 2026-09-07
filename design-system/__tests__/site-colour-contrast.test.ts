import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 客人打开那一页，字读不读得到。
 *
 * ── 为什么这一条要存在（2026-09-07）─────────────────────────────────────
 *
 * 用陌生人的身分在真的浏览器里走了一次官网，逐段量对比度：**13 段读不到**，
 * 而最糟的两段正好是**整页唯一两颗会带客人给他的按钮**：
 *
 *   「Ask price」        3.78:1（要 4.5）
 *   「Ask on WhatsApp」  **1.19:1**
 *
 * 在阳光下、五十岁、手机上，那两颗按钮上的字不存在。
 * 而 [重点 11](../../docs/founder-points.md) 说：那一屏不是产品的一部分，
 * **那一屏就是产品**。
 *
 * ── 两个不一样的毛病，两条守卫 ─────────────────────────────────────────
 *
 * **① 主要按钮那一对。** 图纸 抄的是模版自己的橘 `#dc5a32`，
 * 而压在上面的字是白的 —— 3.78:1。橘一个字都不动（[重点 7j](../../docs/founder-points.md)：
 * 颜色照抄，那是这一套的身份），换掉的是字。
 *
 * **② 🔴 第一屏自己又兑了一次地，而它跟官网真正的地分家了。**
 * `.ds-ground[data-ground="ink"]` 早就算过官网的地跟字，
 * 而且会先看这一套风格自己替官网宣告的那一对（`--site-ink-bg` /
 * `--site-ink-fg`）。第一屏那一段**没有去问它**，自己从**侧栏**的颜色
 * 兑了一个 —— 而侧栏是工作台的东西：
 *
 *   图纸 的侧栏是白底深蓝字 → 兑出来是「深蓝的字压在一块深灰上」＝ 1.19:1
 *   图纸 自己宣告的官网地是 #f0f0f0 配 #1b1b17 ＝ 15.16:1
 *
 * **答案一直都在，只是那一段没有去问。**
 * 六套逐一量过，六套宣告的都是 9.58–19.51:1。
 *
 * ⚠️ 门槛 4.5 —— 这三条量的都是**字**（1.4.3）。
 * 那条边的 3:1（1.4.11）在 `input-border-contrast.test.ts`，是另一件事。
 */

const ROOT = process.cwd();
const TOKENS = join(ROOT, "design-system", "tokens");

function lum(hex: string): number {
  const m = hex.replace("#", "").match(/../g);
  if (!m || m.length < 3) throw new Error(`读不懂这个颜色：${hex}`);
  const [r, g, b] = m.map((h) => {
    const c = parseInt(h, 16) / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const x = lum(a);
  const y = lum(b);
  return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);
}

/** 那一套 token 档里某一个变数的**字面值**。指到别的变数就回 null。 */
function literal(css: string, name: string): string | null {
  const hit = new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m").exec(css);
  const v = hit?.[1]?.trim();
  return v && v.startsWith("#") ? v : null;
}

const files = readdirSync(TOKENS).filter((f) => f.endsWith(".css"));

describe("客人打开那一页，字读不读得到", () => {
  /* 🔴 读不到不是过。这一条第一次写的时候，六套全部回 null（壳把反斜线
     吃掉了，正则变成 `^s*--…`），而每一条都会「安静地过」——
     一把量不到就闭嘴的尺，跟一把量过了的尺长得一模一样。 */
  it("真的读到了六套，而且读得出颜色", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
    const withGround = files.filter((f) =>
      literal(readFileSync(join(TOKENS, f), "utf8"), "site-ink-bg"),
    );
    expect(
      withGround.length,
      "一套都读不到 --site-ink-bg —— 下面每一条都是空过",
    ).toBeGreaterThanOrEqual(6);
  });

  it.each(files)("%s 官网的字压官网的地 ≥ 4.5:1", (f) => {
    const css = readFileSync(join(TOKENS, f), "utf8");
    const bg = literal(css, "site-ink-bg");
    const fg = literal(css, "site-ink-fg");
    if (!bg || !fg) return; // 没宣告的走旧行为，那一条由下面那两条守
    const r = contrast(fg, bg);
    expect(
      Number(r.toFixed(2)),
      `${f}：${fg} 压 ${bg} 只有 ${r.toFixed(2)} 比 1`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it.each(files)("%s 主要按钮上的字压那颗按钮 ≥ 4.5:1", (f) => {
    const css = readFileSync(join(TOKENS, f), "utf8");
    const bg = literal(css, "site-primary");
    const fg = literal(css, "site-on-primary");
    if (!bg) return; // 没宣告官网主色的，用配色那一层的
    expect(
      fg,
      `${f}：宣告了 --site-primary 而没有宣告 --site-on-primary —— 那颗按钮的字会留着配色那一层的，而那是替另一个底挑的`,
    ).not.toBeNull();
    if (!fg) return;
    const r = contrast(fg, bg);
    expect(
      Number(r.toFixed(2)),
      `${f}：${fg} 压 ${bg} 只有 ${r.toFixed(2)} 比 1 —— 那是「Ask price」跟「Ask on WhatsApp」`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  /* 页脚有自己的一对颜色（`--site-foot-bg` / `--site-foot-fg`），
     而它上面那几行小字是把那个字色**淡进它自己的地**。
     淡到什么程度以前没有人量过 —— 62% 在 图纸 上剩 4.13:1。 */
  it.each(files)("%s 页脚那几行淡字 ≥ 4.5:1", (f) => {
    const css = readFileSync(join(TOKENS, f), "utf8");
    const bg = literal(css, "site-foot-bg") ?? literal(css, "site-ink-bg");
    const fg = literal(css, "site-foot-fg") ?? literal(css, "site-ink-fg");
    if (!bg || !fg) return;
    /* globals.css 那一行的 72%。⚠️ 两个地方一个数字 ——
       改了那边不改这边，这一条就在量一个已经不存在的行为。 */
    const FADE = 0.72;
    const hex = (h: string) =>
      h
        .replace("#", "")
        .match(/../g)!
        .map((x) => parseInt(x, 16));
    const faded = hex(fg)
      .map((v, i) => Math.round(v * FADE + hex(bg)[i] * (1 - FADE)))
      .map((v) => v.toString(16).padStart(2, "0"))
      .join("");
    const r = contrast(`#${faded}`, bg);
    expect(
      Number(r.toFixed(2)),
      `${f}：${fg} 淡到 ${FADE * 100}% 压 ${bg} 只有 ${r.toFixed(2)} 比 1`,
    ).toBeGreaterThanOrEqual(4.5);
  });

  it("globals 里那个淡的程度，跟上面那一条用的是同一个数字", () => {
    const css = readFileSync(join(ROOT, "app", "globals.css"), "utf8");
    /* ⚠️ 要指名那一条规则。`[data-chrome-foot]` 在这个档案里出现好几次，
       而第一次是别的东西 —— 第一版就配到了那一个，当场红。
       一个配到别处的锚点，跟一个真的在守的锚点长得一模一样。 */
    const at = css.indexOf('.ds-ground[data-ground="ink"] [data-chrome-foot]');
    expect(at, "找不到页脚那一段").toBeGreaterThan(0);
    const block = css.slice(at, at + 900);
    /* 🔴 **把注解先拿掉。** 第一版写的是「这一段里要出现 72%」，
       而我自己在旁边的注解里就写着「62% → 72%（2026-09-07）」——
       所以把值改回 62%，那一条**照样绿**。
       一条读起来像在保护什么、而什么都没保护的守卫，这个 session 第三次。
       现在读的是 `--color-nav-fg-dim` 那一句里真正的那个数字。 */
    const bare = block.replace(/\/\*[\s\S]*?\*\//g, "");
    const dim = /--color-nav-fg-dim:\s*color-mix\([^;]*?(\d+)%/.exec(bare);
    expect(dim, "读不到页脚那几行淡字的百分比").not.toBeNull();
    expect(
      Number(dim?.[1]),
      "页脚那几行淡字的百分比改过了，而上面那一条还在按 72% 算 —— 一条在量一个已经不存在的行为的守卫，比没有那一条糟",
    ).toBe(72);
  });

  /* 🔴 `design-system/tokens/*.css` **不是 app 读的那一份**。
     app 读的是 `npm run build:tokens` 产生出来的那一张
     （[任务 264](../../docs/founder-tasks.md#264) 记过一次，
     而我 2026-09-07 在同一个 session 里又踩了一次：
     改完那几块板的字色、尺子照样回报 3.64:1，
     因为**产生出来那一份还是旧的**）。

     所以上面每一条都要再问一次：那个值有没有真的走到画面读的那一份里。
     少了这一条，一次没有重新产生的改动会**在原始档上过关，然后照样出货**。 */
  it.each(files)("%s 改过的颜色真的走到画面读的那一份里", (f) => {
    const css = readFileSync(join(TOKENS, f), "utf8");
    const built = readFileSync(
      join(ROOT, "app", "[locale]", "style-picker", "style-scope.module.css"),
      "utf8",
    );
    for (const name of [
      "site-ink-bg",
      "site-ink-fg",
      "site-primary",
      "site-on-primary",
      "site-plate-1-fg",
      "site-plate-2-fg",
      "site-plate-3-fg",
      "site-plate-4-fg",
    ]) {
      const v = literal(css, name);
      if (!v) continue;
      expect(
        built,
        `${f} 宣告了 --${name}: ${v}，而产生出来那一份里没有 —— 跑一次 npm run build:tokens`,
      ).toContain(`--${name}: ${v}`);
    }
  });

  /* 🔴 上面几条只管 token。它们挡不住「第一屏自己再兑一次地」——
     而那正是那颗按钮 2.3:1 的来源。所以也问那一段源码。 */
  it("第一屏的地是问来的，不是自己从侧栏兑的", () => {
    const src = readFileSync(
      join(ROOT, "design-system", "components", "site-hero.tsx"),
      "utf8",
    );
    const at = src.indexOf('ground === "ink"');
    expect(at, "site-hero 里找不到那一段").toBeGreaterThan(0);
    const block = src.slice(at, at + 1800);
    expect(
      block,
      "第一屏那一段没有读 --ink-bg —— 它又在自己兑一次地了",
    ).toContain("var(--ink-bg)");
    expect(
      block,
      "第一屏那一段读了 --color-nav-bg：侧栏是工作台的颜色，跟官网那一层没有关系（图纸 兑出来是 1.19:1）",
    ).not.toContain("--color-nav-bg");
  });
});
