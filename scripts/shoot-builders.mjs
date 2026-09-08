/**
 * 平台那一边的参考 —— **建造工具长什么样**。
 *
 *   npm run shoot:builders
 *
 * 老板 2026-09-08：`你还要帮我去找如何把平台的UI设计跟产品的UI设计
 * 设计更好用也好看 最好是要有模板的 要研究的啦`。
 *
 * ── 为什么它跟 shoot:admins 是两批 ──────────────────────────────────────
 * `shoot:admins` 拍的是**后台**（他一年三百天打开的那几十页）。
 * 这一支拍的是**建造工具**（他一辈子走一次的那条路）：
 * 拖拉版面 · 挑一块 · 改一段字 · 一步一步问完 —— **那是另一种画面**，
 * 而这个仓库从来没有替它找过一批参考。
 *
 * ⚠️ [重点 7m](../docs/founder-points.md) 分过边：**客户的官网整套抄，
 * 我们自己的平台自己设计，研究只当证据。** 所以这一批拿的是
 * **读数跟做法**（工具条摆哪 · 选中怎么显示 · 一次问几件），
 * 不是一张要照着排的图。
 *
 * ⚠️ 每一个网址 2026-09-08 都 curl 过一次；回 402 的（horizon）不在里面。
 * 而**回 200 不等於拍到东西** —— 三条自检在 `lib/shoot-sheet.mjs` 里。
 */
import { shootSheet } from "./lib/shoot-sheet.mjs";

const SITES = [
  // ── 拖拉版面：跟我们的编辑器同一类 ────────────────────────────────────
  /* 🔴 Puck 就是我们自己在用的那一个 —— 它自己的编辑器外壳是最直接的参考，
     而我们从来没有把它跟我们的摆在一起看过。 */
  ["puck",         "https://demo.puckeditor.com/edit",            "puckeditor · MIT · 我们用的就是它"],
  ["grapesjs",     "https://grapesjs.com/demo.html",              "GrapesJS · BSD-3 · 24k"],
  ["craftjs",      "https://craft.js.org/examples/basic",         "Craft.js · MIT · 7k"],
  ["blocksui",     "https://blocks-ui.com/",                      "Blocks UI · MIT"],
  ["easyblocks",   "https://easyblocks.io/",                      "Easyblocks · 开源"],
  ["builderio",    "https://www.builder.io/m/react",              "Builder.io · 商用 · 只看"],
  ["plasmic",      "https://www.plasmic.app/",                    "Plasmic · 商用 · 只看"],
  ["framer",       "https://www.framer.com/",                     "Framer · 商用 · 只看"],

  // ── 一步一步问完：概念 28「平台是一次访谈，不是一张表单」的参考 ────────
  ["typeform",     "https://www.typeform.com/",                   "Typeform · 商用 · 只看 · 一次问一题"],
  ["tally",        "https://tally.so/",                           "Tally · 商用 · 只看"],
];

const bad = await shootSheet(SITES, ".screenshots/builders");
if (bad) process.exit(1);
