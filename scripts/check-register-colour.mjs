/* 一套后台风格，画面上有几成面积是**有颜色的**。
 *
 * 老板 2026-09-02：「我觉得之前的风格有很多不是很需要的配色 你懂吗
 * 就跟着白色跟黑色做 配色你就自己看」
 *
 * ── 为什么要这一把尺 ──────────────────────────────────────────────────────
 * 「不要花哨」是一句判断，而判断没办法在下一轮被推翻。这一把把它变成一个数字：
 * **整页每一个像素，有几成落在「看得出是有颜色的」那一边。**
 *
 * ⚠️ **用 OKLab 的彩度，不用 RGB 的饱和度。** 第一版用 RGB，而
 * `#001529`（中台跟 Ant Design Pro 共用的那个深藏青）在 RGB 里最大分量是 41 ——
 * 正好压在我为了排除近黑而设的 40 那条线上，**同一块颜色在两张图里一边算一边不算**。
 * OKLab 的彩度问的是「眼睛看不看得出它有颜色」，不会在近黑那里翻脸。
 *
 * ⚠️ **只量画布，不量 Formae 自己的编辑器外壳**（顶栏、底栏、那颗绿色的
 * 「确认设计」、dev overlay 的红点）。量到那些等於在量我们自己的产品，
 * 不是在量那一套风格 —— 这跟这个仓库一直在犯的「量到的东西不是画面上的东西」
 * 是同一类。
 *
 * ⚠️ **这是否决线，不是目标线**（[重点 24](../docs/founder-points.md)）。
 * 0% 也可以很难看。过线只能用眼睛，看 `.screenshots/index.html` 那张对照图。
 *
 *   node scripts/check-register-colour.mjs            # 量 .screenshots/reg-*.png
 *   node scripts/check-register-colour.mjs --refs     # 连别人的后台一起量
 */
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const sharp = require("sharp");

/** 门槛：现代那几个后台量出来全部在 7% 以下，过时的在 18–41%。 */
const LIMIT = 7;
/** 眼睛看不看得出有颜色。OKLab 的 C，不是 RGB 的 S。 */
const CHROMA = 0.035;

/** 编辑器外壳的边框。画布之外的东西不算这一套风格的颜色。 */
const CANVAS = { left: 30, top: 132, right: 25, bottom: 6 };

function srgbToOklabC(r8, g8, b8) {
  const f = (v) => {
    const c = v / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const r = f(r8), g = f(g8), b = f(b8);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  const A = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  const B = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
  return Math.hypot(A, B);
}

async function colouredArea(file, crop) {
  let img = sharp(file);
  if (crop) {
    const meta = await img.metadata();
    img = img.extract({
      left: crop.left,
      top: crop.top,
      width: Math.max(1, meta.width - crop.left - crop.right),
      height: Math.max(1, meta.height - crop.top - crop.bottom),
    });
  }
  const { data, info } = await img
    .resize({ width: 360, fit: "inside" })
    .raw()
    .toBuffer({ resolveWithObject: true });
  const ch = info.channels;
  let hit = 0;
  const total = info.width * info.height;
  for (let i = 0; i < data.length; i += ch)
    if (srgbToOklabC(data[i], data[i + 1], data[i + 2]) > CHROMA) hit++;
  return (100 * hit) / total;
}

/* 🔴 名单是**读**出来的，不是写死的。
   `.screenshots/` 里躺着 17 套时代的旧图（Pop · Glass · Lacquer · Stamp…），
   那些风格已经砍掉了。第一版直接扫资料夹，於是它对着六套不存在的风格喊超标。
   `shoot-registers.mjs` 上面那段注解讲的就是同一件事，我又踩了一次。 */
const LIVE = (() => {
  const src = readFileSync("app/[locale]/style-picker/style-column.tsx", "utf8");
  const block = src.match(/export const STYLE_ORDER[^=]*=\s*\[([^\]]*)\]/);
  if (!block) throw new Error("STYLE_ORDER 找不到了 —— style-column.tsx 搬家了？");
  return [...block[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1][0].toUpperCase() + m[1].slice(1));
})();

const rows = [];
for (const name of LIVE) {
  const f = `.screenshots/reg-${name}.png`;
  if (!existsSync(f)) {
    console.log(`  ${name.padEnd(22)}  没有图 —— 先跑 npm run shoot:registers`);
    continue;
  }
  rows.push([name, f, CANVAS]);
}

if (process.argv.includes("--refs") && existsSync(".screenshots/admins"))
  for (const [f, label] of [
    ["arham-crm", "别人 · Studio Admin"],
    ["shadcn-tasks", "别人 · shadcn Tasks"],
    ["tailadmin", "别人 · TailAdmin"],
    ["tabler", "别人 · Tabler"],
    ["antd-pro", "别人 · Ant Design Pro"],
    ["adminlte", "别人 · AdminLTE 2014"],
    ["notus", "别人 · Notus 2020"],
  ])
    if (existsSync(`.screenshots/admins/${f}.jpg`))
      rows.push([label, `.screenshots/admins/${f}.jpg`, null]);

const out = [];
for (const [name, file, crop] of rows) out.push([name, await colouredArea(file, crop)]);
out.sort((a, b) => a[1] - b[1]);

console.log(`\n有颜色的面积（OKLab 彩度 > ${CHROMA}）· 门槛 ${LIMIT}%\n`);
let bad = 0;
for (const [name, v] of out) {
  const ours = !name.startsWith("别人");
  const over = ours && v > LIMIT;
  if (over) bad++;
  console.log(`  ${name.padEnd(22)} ${v.toFixed(1).padStart(5)}%  ${over ? "🔴 超标" : ""}`);
}
console.log(
  bad
    ? `\n🔴 ${bad} 套超标。⚠️ 数字过关不等於眼睛过关 —— 看 .screenshots/index.html`
    : "\n全部在门槛内。⚠️ 这只是没有超标，好不好看要用眼睛看。",
);
process.exit(bad ? 1 : 0);
