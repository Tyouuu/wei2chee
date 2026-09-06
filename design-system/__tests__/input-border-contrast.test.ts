import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 他要打字的那个框，边看不看得见。
 *
 * ── 为什么这一条要存在（2026-09-07）─────────────────────────────────────
 *
 * 六套 register 的输入框边全部是 `--color-ink-800` —— 也就是**卡片那条边**。
 * 对着框自己的底量出来是 **1.17 到 1.48 比 1**，而 WCAG 1.4.11
 * 给「使用者介面元件的边界」的门槛是 **3 比 1**。六套没有一套过得了。
 *
 * 那不是六个地方，是**一个设定**：`--input` 那个位子六套里都有，
 * 而它一直在 `var(--color-ink-800)` 上，**而且一个读它的地方都没有**
 * —— 第二十二次「能力有、线没接」。
 *
 * ⚠️ **这一条只量他要打字的那个框。** 卡片的边跟表格的线不在里面：
 * 那两样不是控件，标准也不管它们，而把它们一起压暗会让整张表变吵。
 *
 * ⚠️ 门槛写 3.0 不是 4.5 —— **4.5 是给字的**（1.4.3），
 * 而一条边不是字。我第一版写了 4.5，是去读标准原文才改回来的。
 */

const ROOT = process.cwd();
const TOKENS = join(ROOT, "design-system", "tokens");

/** WCAG 那一支：相对亮度。 */
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

/** 那一套 token 档里某一个变数的**字面值**。指到别的变数就回 null ——
 *  这一条要问的正是「它有没有自己的值」。 */
function literal(css: string, name: string): string | null {
  const hit = new RegExp(`^\\s*--${name}:\\s*([^;]+);`, "m").exec(css);
  const v = hit?.[1]?.trim();
  return v && v.startsWith("#") ? v : null;
}

const files = readdirSync(TOKENS).filter((f) => f.endsWith(".css"));

describe("他要打字的那个框，边看不看得见", () => {
  it("真的读到了六套（读不到的话下面每一条都是空过）", () => {
    expect(files.length).toBeGreaterThanOrEqual(6);
  });

  it.each(files)("%s 的输入框边有自己的值，不是卡片那一条", (f) => {
    const css = readFileSync(join(TOKENS, f), "utf8");
    const input = literal(css, "input");
    expect(
      input,
      `${f}：--input 还指着别的变数（多半是 --color-ink-800，也就是卡片的边）`,
    ).not.toBeNull();
  });

  it.each(files)("%s 的输入框边对着它自己的底 ≥ 3:1", (f) => {
    const css = readFileSync(join(TOKENS, f), "utf8");
    const input = literal(css, "input");
    const bg = literal(css, "color-ink-900");
    expect(bg, `${f}：读不到输入框的底色`).not.toBeNull();
    if (!input || !bg) return;
    const r = contrast(input, bg);
    expect(
      Number(r.toFixed(2)),
      `${f}：${input} 对 ${bg} 只有 ${r.toFixed(2)} 比 1`,
    ).toBeGreaterThanOrEqual(3);
  });

  /* 🔴 一条只管 token 的守卫，挡不住「有人把画面上那一行改回卡片那条边」。
     所以也问画面：那三个共用的地方要读 `--input`，不要读 `--color-ink-800`。 */
  it.each([
    /* ⚠️ 三个都是 `var(--input)`，**不可以是 `var(--color-input)`** ——
       那一行住在 `@theme` 里，吐在 `:root` 上，所以它跟着 register 走不了。
       实测改错之后浏览器算出来是白色 14%，白底上的白框。 */
    ["app/globals.css", ".ds-control", "var(--input)"],
    ["app/[locale]/portal/(app)/desk-kit.tsx", "deskField", "var(--input)"],
    ["design-system/components/record-table.tsx", "搜寻框", "var(--input)"],
    ["app/[locale]/style-picker/style-scope.module.css", "产生出来那一份", "--input: #"],
  ])("%s 的 %s 读的是那个位子", (file, _what, want) => {
    const src = readFileSync(join(ROOT, file), "utf8");
    expect(src, `${file} 没有读 ${want}`).toContain(want);
  });
});
