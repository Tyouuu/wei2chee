/**
 * 真的产品长什么样 —— 不是后台模板。
 *
 *   npm run shoot:products
 *   GROUP=crm,money npm run shoot:products
 *   ONLY=twenty-demo npm run shoot:products
 *
 * 老板 2026-09-08：`我需要的是新概念得設計 … 我要知道外面的人都是怎麼去做
 * 怎麼去提升的 有沒有可能CRM system有人做到很好看 很方便商家去看`。
 *
 * 🔴 **这跟 `shoot:pagerefs` 是两件事，不要合成一支。**
 * 那一支拍的是**后台模板**（shadcn / Tailwind 那一族），而 [任务 296](../docs/founder-tasks.md)
 * 量过：那一族已经收敛成同一张脸 —— 白地 · 灰卡 · 一样的侧栏。
 * **一个模板的作者要的是「装得下任何生意」，所以它必然是通用的。**
 * 这一支拍的是**真的产品**：它们只服务一种人，所以敢做决定 ——
 * 而「敢做决定」正是他讲的那个「新概念」。
 *
 * ⚠️ **它们的内页在登入后面。** 拿得到的是**行销页上那几张产品图** ——
 * 那是它们自己挑出来给人看的那一屏，也就是它们认为最能代表自己的那一屏。
 * [任务 267](../docs/founder-tasks.md) 判过同一件：真的画面公开只拿得到这一种。
 * `shootSheet` 那三条自检（像登入页 · 几乎没有字 · 跟别人一模一样）照旧跑。
 *
 * ⚠️ 拿的是**做法**（一屏答几句话 · 什么当主角 · 密度 · 状态怎么编码），
 * 不是代码也不是内容 —— [任务 135](../docs/founder-tasks.md) 逐层判过这条线。
 */
import { shootSheet } from "./lib/shoot-sheet.mjs";

const GROUPS = {
  /* 🔴 他问的那一句：有没有人把 CRM 做到好看、而且商家读得懂。 */
  crm: [
    ["twenty-demo", "https://demo.twenty.com", "Twenty · 开源 CRM"],
    ["attio", "https://attio.com", "Attio"],
    ["folk", "https://www.folk.app", "folk"],
    ["pipedrive", "https://www.pipedrive.com", "Pipedrive"],
  ],

  /* 钱那一层做得最好看的一批 —— 我们收款 · 开销 · 对帐要看的就是它们。 */
  money: [
    ["ramp", "https://ramp.com", "Ramp"],
    ["mercury", "https://mercury.com", "Mercury"],
    ["qonto", "https://qonto.com/en", "Qonto"], /* 根目录 301 到语言页 */
    /* ⚠️ Pennylane 换成 Shopify —— `pennylane.com` 302、`.com/en` 404、
       `pennylane.tech` 301，三条都不是一张拿得到的页。 */
    ["shopify", "https://www.shopify.com", "Shopify"],
  ],

  /* 🔴 我们的市场 —— 上门服务跟沙龙。它们的使用者跟我们的一模一样。 */
  trade: [
    ["housecall", "https://www.housecallpro.com", "Housecall Pro"],
    ["fresha", "https://www.fresha.com", "Fresha"],
    ["servicetitan", "https://www.servicetitan.com", "ServiceTitan"],
    /* ⚠️ Simpro 403（挡爬虫），换成 Loyverse —— 它是这个市场真的在用的收银。 */
    ["loyverse", "https://loyverse.com", "Loyverse"],
  ],

  /* 「好看」这件事今天的标竿。⚠️ 它们的使用者不是装修承包商 ——
     拿的是做工，不是内容形状（[任务 92](../docs/founder-tasks.md) 立过这条边界）。 */
  craft: [
    ["linear", "https://linear.app", "Linear"],
    ["notion", "https://www.notion.com", "Notion"],
    /* ⚠️ Height 连不上（000），换成 Stripe —— 它的后台是这一栏公认的标竿。 */
    ["stripe", "https://stripe.com", "Stripe"],
    ["vercel", "https://vercel.com", "Vercel"],
  ],
};

const pick = process.env.GROUP?.split(",").map((x) => x.trim()).filter(Boolean);
const groups = Object.entries(GROUPS).filter(([k]) => !pick?.length || pick.includes(k));

let bad = 0;
/* 查重跨整轮 —— 见 `shoot-pagerefs.mjs` 那一段：一组呼叫一次的话，
   同一张行销页分在两组里就撞不到。 */
const seen = new Map();
for (const [name, sites] of groups) {
  console.log(`\n== ${name} · ${sites.length} 张 ==`);
  bad += await shootSheet(sites, `.screenshots/products/${name}`, { perRow: 4, width: 660, seen });
}

console.log(`\n判：${groups.length} 组 · ${groups.reduce((n, [, s]) => n + s.length, 0)} 张 · 没拍到 ${bad} 张`);
console.log(`⚠️ 行销页是它们自己挑的那一屏，不是他们每天用的那一页 —— 读的时候要记得这一条。`);
