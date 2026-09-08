import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

/**
 * 🔴 他要打字的框，边一定要用 `--input`，不可以用卡片那条边。
 *
 * ── 为什么有这一条（2026-09-08）─────────────────────────────────────────
 *
 * 2026-09-07（`9eace1a`）把 `--input` 从 `--border` **分出来**，六套风格各自
 * 给了它一个 4.61:1 的值 —— 因为国际标准对**他要动手的那几个东西**要求
 * **3:1**（WCAG 1.4.11），而当时量到的是 **1.48:1**。
 *
 * 🔴 **而隔天 `audit:platform` / `audit:product` 又量到同一个数字。**
 * 根因不是那个修没做，是**有几个框手写了卡片那条边**：
 *
 *     排班的「哪一天 · 几点到几点」三个 · 车牌那个搜寻框
 *     className="… [border:var(--hairline)_solid_var(--color-ink-800)] …"
 *                                          ^^^^^^^^^^^^^^^^ 那是**卡片的边**
 *
 * 卡片的边不归 1.4.11 管（它不传达「这里可以操作」），所以它本来就淡；
 * 而一个框借它来当自己的边，就是**把一个不用过关的值，用在一个要过关的地方**。
 *
 * ── 这一条守什么 · 不守什么 ────────────────────────────────────────────
 *
 * ✅ 守：`<input>` `<select>` `<textarea>` 自己那一段 className 里，
 *    如果写了边的颜色，那个颜色只能是 `--input`（或者 focus 时的主色）。
 * ❌ 不守**按钮**：一颗按钮由它的**字跟底色**认出来，边只是装饰 ——
 *    而这个仓库到处用 `--color-ink-800` 画按钮的边，把它们一起判红
 *    只会逼下一个人去关掉这条守卫。
 * ❌ 不守**勾选框**：原生的勾选框边框由浏览器画，改不到。
 *
 * ⚠️ 它是**读原始码**的，所以看不到一个从变数拼出来的 className ——
 * 那种要靠 `audit:product` 在真的浏览器里量。**两把一起才守得住。**
 *
 * 🔴 而那个盲点有一个实例，2026-09-08 当场撞到：`editor/table-field.tsx`
 * 的边写在一个 **`const inputClass`** 里，不在 `<input …/>` 那一段里 ——
 * 故意把它改回卡片那条边，**这一条照样绿**。
 * 那一个是 `audit:platform` 在浏览器里量到的（官网编辑器，1.35:1）。
 *
 * 🔴 **第二个盲点，同一天同一支尺抓到的**：一条边写在**包着那个框的
 * `<div>`** 上（`publish-site.tsx` 那个网址框，里面的 `<input>` 是
 * `bg-transparent`）。这一条读的是 `<input …/>` 那一段，看不到外面那一层。
 * ⚠️ 而它**不可以**改成往外找 —— 2026-09-08 逐个看过十九个用了
 * `--color-ink-800` 而里面装着框的 `<div>`，**十八个是分隔线跟一行的框**
 * （`border-t` 那一条 · 一张明细卡的外框）。往外找就是把那十八条一起判红。
 */
/* 🔴 两棵树都要走 —— 2026-09-08 `audit:platform` 在**官网编辑器**上量到
   一个 1.35:1 的框，而这一条当时只走 `app/[locale]/portal`。
   编辑器那几个框住在 `design-system/editor/`，它一个都看不到。 */
const ROOTS = [
  join(process.cwd(), "app", "[locale]", "portal"),
  join(process.cwd(), "design-system"),
];

function walk(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((d) =>
    d.isDirectory()
      ? d.name === "__tests__"
        ? []
        : walk(join(dir, d.name))
      : d.name.endsWith(".tsx")
        ? [join(dir, d.name)]
        : [],
  );
}

/** 一段 `<input …/>` 里，边的颜色写的是什么。 */
function borderColours(tag: string): string[] {
  const found: string[] = [];
  /* `[border:… solid var(--x)]` 跟 `[border-color:var(--x)]` 两种写法都要抓。 */
  /* ⚠️ 一段 `[border:var(--hairline)_solid_var(--input)]` 里有**两个** var ——
     前面那个是**宽度**。第一版只抓第一个，於是把四个刚修好的框判成红的。
     所以整段里只要出现 `--input`，这一段就算对。 */
  for (const m of tag.matchAll(/\[border(?:-color)?:[^\]]*\]/g)) {
    const decl = m[0];
    if (decl.includes("var(--input)")) continue;
    const colour = [...decl.matchAll(/var\(--([a-z0-9-]+)\)/g)].map((v) => v[1]).pop();
    if (!colour || colour === "hairline") continue;
    /* focus 时换成主色是对的 —— 那是「你正在这一格」，不是它平常的边。 */
    const before = tag.slice(Math.max(0, m.index! - 24), m.index!);
    if (/focus(-visible)?:$/.test(before) || /focus(-visible)?:\[?$/.test(before)) continue;
    found.push(colour);
  }
  return found;
}

describe("他要打字的框", () => {
  it("边用的是 --input，不是卡片那条边", () => {
    const guilty: string[] = [];
    for (const f of ROOTS.flatMap(walk)) {
      /* 🔴 先把注解拿掉 —— 2026-09-08 它把 `assembled.tsx` 判红，
         而那里的 `<input>` **写在一句注解里**：
         「A drawn field rather than a live input … a real <input> in a
         preview invites a click that goes nowhere」。
         它接着一路扫到下一个 `/>`，把底下那个 `<div>` 的边算成那个框的边。
         **这个仓库栽过同一条**（[任务 141f]：一条守卫把记录那个 bug 的注解
         当成 bug 本身）—— 一条不允许人把理由写下来的守卫，
         会逗下一个人去删掉那句理由。 */
      const src = readFileSync(f, "utf8")
        .replace(/\{\/\*[\s\S]*?\*\/\}/g, "")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/^[ \t]*\/\/.*$/gm, "");
      for (const m of src.matchAll(/<(input|select|textarea)\b/g)) {
        const start = m.index!;
        const end = src.indexOf("/>", start);
        const tag = src.slice(start, end < 0 ? start + 1200 : end);
        /* 勾选框跟单选钮的边是浏览器画的，改不到。 */
        if (/type=["'](checkbox|radio|hidden|submit|button)["']/.test(tag)) continue;
        for (const colour of borderColours(tag)) {
          if (colour === "input") continue;
          /* 🔴 主色不是借来的 —— `pages-sheet` 那个改名的框，平常的边就是
             主色，而那是「你正在改这一个」的讯号，在两层外壳上都比 3:1 亮得多。
             ⚠️ 它放过的那一种：有人拿主色去画一个静止的框，而那一层的主色
             刚好是近白。**那一种要靠 `audit:platform` 在真的浏览器里量**
             —— 这两把尺本来就是配着用的（见档头最后一段）。 */
          if (colour === "color-primary" || colour === "primary" || colour === "ring") continue;
          const line = src.slice(0, start).split("\n").length;
          guilty.push(`${f.replace(process.cwd(), "")}:${line} → --${colour}`);
        }
      }
    }
    expect(guilty, "这几个框的边不归它自己那个 token 管").toEqual([]);
  });
});
