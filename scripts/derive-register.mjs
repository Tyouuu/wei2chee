/* 反推 —— 量参考那一页，直接吐出「这一套该改哪几个值」，还能替你改。
 *
 *   npm run derive -- counter          # 只讲，不动
 *   npm run derive -- counter --write  # 真的改进 token 档跟镜像档
 *   npm run derive                     # 六套一起讲
 *
 * ── 为什么要有它 ──────────────────────────────────────────────────────────
 * 老板 2026-09-03：`尺子用尺子 我们是不是很有必要造多一把复刻尺子…现在进度太慢了`。
 *
 * **慢的不是量。** `align:admin` 已经会逐项报「参考 49 · 我们 26」了；
 * 慢的是量完之后我要自己想「49 对应哪一个 token」、手改、再跑一次、再看。
 * 一套 28 项，六套就是这个动作做几十次。
 *
 * 这一支把那一段砍掉：它知道**每一项差异对应哪一个值**，所以它讲的是
 * 「`--row-h` 44 → 49」，而不是「表格行高差 5」。
 *
 * ── 它不准做的事 ──────────────────────────────────────────────────────────
 * ⚠️ **不碰「故意不跟」的那几项**（`register-references.ts` 的 `keeps`）——
 * 台账的窄侧栏、中台的暗侧栏那种，是判过的决定，不是没做完的事。
 * ⚠️ **不碰颜色。** 颜色那一层老板 2026-09-03 拍板全部走白，
 * 而每一套的主色是它剩下的身份 —— 一支照参考自动改色的脚本会把它抹掉。
 * ⚠️ **`--write` 之后一定要用眼睛看**（[重点 24](../docs/founder-points.md)）：
 * 它改的是数字，而数字过关不等於画面过关。
 */
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const MIRROR = "app/[locale]/style-picker/style-scope.module.css";

/**
 * 每一项差异对应哪一个值。
 *
 * `read` 从参考那一页量出来的数字里挑一个；`token` 是我们这边该改的那个变数。
 * **只放「一个数字对一个变数」那种**：像「一行几块」那种要改组成的，
 * 不在这里 —— 那不是一个值，那是一个决定。
 */
const RULES = [
  { item: "表格行高", token: "--row-h", read: (r) => r.rowH,
    note: "一行多高。紧凑那一种会再乘 0.9，所以这里放的是没打折的值。" },
  { item: "卡片内距", token: "--pad-card", read: (r) => r.cardPad,
    note: "卡片里面留多少白。" },
  { item: "圆角", token: "--radius-lg", read: (r) => r.cardRadius,
    note: "卡片的圆角。药丸那种 999px 不在这里，那是形状不是圆角。" },
  { item: "块间的缝", token: "--gap-section", read: (r) => r.gap,
    note: "块跟块之间的缝，不是块里面的。" },
];

/** 一支跟 align-admin 同源的探针 —— 只留反推用得到的那几项。 */
const PROBE = () => {
  const R = document.body.getBoundingClientRect();
  const vis = (e) => {
    const c = getComputedStyle(e);
    if (c.display === "none" || c.visibility === "hidden" || Number(c.opacity) === 0) return false;
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0;
  };
  const all = [...document.querySelectorAll("*")].filter(vis);
  const med = (xs) => {
    if (!xs.length) return null;
    const s = [...xs].sort((a, b) => a - b);
    return Math.round(s[Math.floor(s.length / 2)]);
  };

  const cards = all
    .map((e) => ({ e, r: e.getBoundingClientRect(), c: getComputedStyle(e) }))
    .filter(({ r, c }) =>
      r.width > 140 && r.height > 60 && parseFloat(c.borderRadius) > 2 &&
      (c.boxShadow !== "none" || parseFloat(c.borderTopWidth) > 0));
  /* 框跟内距常常不在同一个元素上（外面画边、里面留白），自己是 0 就问第一个子元素。 */
  const padOf = ({ e, c }) => {
    const own = parseFloat(c.paddingTop) || 0;
    if (own > 0) return own;
    const kid = e.firstElementChild;
    return kid ? parseFloat(getComputedStyle(kid).paddingTop) || 0 : 0;
  };

  const table = document.querySelector("table");
  let rowH = null;
  if (table) {
    const hs = [...table.querySelectorAll("tbody tr")].filter(vis).slice(0, 12)
      .map((t) => t.getBoundingClientRect().height).filter((h) => h > 8);
    rowH = hs.length ? Math.round(hs.reduce((a, c) => a + c, 0) / hs.length) : null;
  }

  /* 块跟块之间的缝：取最外面那一层里，上下相邻两块的距离。 */
  const wide = all
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(({ e, r }) => r.width >= R.width * 0.3 && r.height >= 60 && !e.closest("table"));
  let holder = null, best = 0;
  for (const e of all) {
    if (e.closest("table")) continue;
    const kids = [...e.children].filter((k) => wide.some((w) => w.e === k));
    if (kids.length > best) { best = kids.length; holder = e; }
  }
  const rows = holder ? [...holder.children].map((k) => k.getBoundingClientRect()) : [];
  const gaps = [];
  for (let i = 1; i < rows.length; i++) {
    const g = rows[i].top - rows[i - 1].bottom;
    if (g > 0 && g < 200) gaps.push(g);
  }

  return {
    rowH,
    cardPad: med(cards.map(padOf)),
    cardRadius: med(cards.map(({ c }) => parseFloat(c.borderRadius))),
    gap: med(gaps),
  };
};

/** 读一个 token 现在的值。 */
function current(css, token) {
  const m = css.match(new RegExp(`${token}:\\s*(\\d+)px;`));
  return m ? Number(m[1]) : null;
}

/** 只在这一套自己的区块里换值 —— 镜像档一个档案装着六套。 */
function setInBlock(css, register, token, value, scoped) {
  if (!scoped) return css.replace(new RegExp(`(${token}:\\s*)\\d+px;`), `$1${value}px;`);
  const starts = [...css.matchAll(/^\.([a-z]+)[\s,{]/gm)].map((m) => [m[1], m.index]);
  let out = "", prev = 0;
  for (let i = 0; i < starts.length; i++) {
    const [name, at] = starts[i];
    const end = i + 1 < starts.length ? starts[i + 1][1] : css.length;
    out += css.slice(prev, at);
    let blk = css.slice(at, end);
    if (name === register) blk = blk.replace(new RegExp(`(${token}:\\s*)\\d+px;`), `$1${value}px;`);
    out += blk;
    prev = end;
  }
  return out + css.slice(prev);
}

async function main() {
  const args = process.argv.slice(2);
  const write = args.includes("--write");
  const want = args.filter((a) => !a.startsWith("--"));
  const { REGISTER_REFERENCES } = await import("../design-system/register-references.ts");
  const regs = want.length ? want : Object.keys(REGISTER_REFERENCES);

  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
  let changed = 0, failed = 0;

  for (const reg of regs) {
    const ref = REGISTER_REFERENCES[reg];
    if (!ref) { console.log(`${reg}: 没有声明参考`); failed++; continue; }
    let read = null;
    try {
      await p.goto(ref.url, { waitUntil: "domcontentloaded", timeout: 60000 });
      await p.waitForTimeout(6500);
      read = await p.evaluate(PROBE);
    } catch (e) {
      /* 读不到就是失败，不是通过 —— 一把量不到却沉默的尺，跟一把说没问题的尺一样。 */
      console.log(`\n${ref.zh} ${reg}: 🔴 参考页读不到 ${String(e).slice(0, 50)}`);
      failed++;
      continue;
    }

    const file = `design-system/tokens/${reg}.css`;
    let css = readFileSync(file, "utf8");
    let mirror = readFileSync(MIRROR, "utf8");
    const kept = new Set((ref.keeps ?? []).map((k) => k.item));

    console.log(`\n${ref.zh} ${reg}  ←  ${ref.reference}`);
    const plan = [];
    for (const rule of RULES) {
      if (kept.has(rule.item)) {
        console.log(`  ${rule.item.padEnd(8)} 留 —— 故意不跟`);
        continue;
      }
      const target = rule.read(read);
      const now = current(css, rule.token);
      if (target == null) { console.log(`  ${rule.item.padEnd(8)} 参考页量不到，跳过`); continue; }
      if (now == null) { console.log(`  ${rule.item.padEnd(8)} 我们没有宣告 ${rule.token}，跳过`); continue; }
      /* ── 三道护栏。第一次跑就挡下三个会把风格毁掉的建议 ──────────────────
         · 参考量出来 0 就照抄 → 台账跟炉的 `--pad-card` 会变成 0，
           每一张卡的字直接贴着边。**0 通常是我量错了，不是他们真的没有留白。**
         · 我们现在是 0 的不要动 → 瑞士跟招牌的 `--radius-lg: 0` 是它们的身份
           （不装饰、直角），照参考改成 14 就把那个身份抹掉了。
           **0 是一句话，不是一个还没填的空。**
         · 一次跳太远的不要动 → Tabler 的单据卡内距 64px，那是**一张纸**，
           照搬到仪表盘上会变成一张空卡。超过一倍的差要人来判。 */
      if (target <= 0) { console.log(`  ${rule.item.padEnd(8)} 参考量出来是 0 —— 多半是量错了，不动`); continue; }
      if (now === 0) { console.log(`  ${rule.item.padEnd(8)} 我们是 0，那是这一套的身份，不动`); continue; }
      const gap = Math.abs(now - target);
      if (gap > Math.max(24, now)) {
        console.log(`  ${rule.item.padEnd(8)} ${rule.token} ${now} → ${target} 跳太远，留给人判`);
        continue;
      }
      if (gap <= 3) { console.log(`  ${rule.item.padEnd(8)} ${rule.token} ${now} ≈ ${target}  ok`); continue; }
      console.log(`  ${rule.item.padEnd(8)} ${rule.token}  ${now} → ${target}   ${rule.note}`);
      plan.push([rule.token, target]);
    }

    if (write && plan.length) {
      for (const [token, value] of plan) {
        css = setInBlock(css, reg, token, value, false);
        mirror = setInBlock(mirror, reg, token, value, true);
      }
      writeFileSync(file, css);
      writeFileSync(MIRROR, mirror);
      changed += plan.length;
      console.log(`  ✎ 改了 ${plan.length} 个值`);
    } else if (plan.length) {
      console.log(`  （${plan.length} 个值要改。加 --write 才会真的动。）`);
    }
  }

  await b.close();
  if (write) {
    console.log(`\n改了 ${changed} 个值。`);
    console.log("⚠️ 现在跑 `npm run align:admin`，然后**用眼睛看那张 1:1 的图** —— 数字过关不等於画面过关。");
  }
  if (failed) process.exit(1);
}

await main();
