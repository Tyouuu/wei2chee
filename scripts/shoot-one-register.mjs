/**
 * 一套样子 —— 证明工作台不再跟着客户挑的风格走，而官网还跟着。
 *
 * 老板 2026-09-04：`其他风格不是不用了吗 我现在只需要你一个UI风格for 我的system only`
 * · `做好一套就可以了`。
 *
 * ── 它量什么 ──────────────────────────────────────────────────────────────
 * 同一个帐号，把 `projects.style` 轮流换成六套，每一套拍两张：
 *   工作台（`/portal`）—— **六张必须一模一样**，不然这件事没有做到
 *   官网（`/portal/website`）—— **六张必须不一样**，不然是把该留的也砍掉了
 *
 * ⚠️ **比的不是像素，而这一条是第一版栽出来的。** 第一版拿整张图的 sha1 比，
 * 六张全部不同 —— 而裁出来两张摆在一起，除了走势图的**进场动画停在不同一帧**
 * 之外一个像素都没差。图表一挂载就自己画一次，所以两张截图永远不会同一个雜凑。
 * **一把每次都说「不一样」的尺，跟一把真的抓到差异的尺，在报告里长得一模一样。**
 * 改成读画面上真正决定「这是不是同一个设计」的那几件：侧栏多宽什么底色 ·
 * 地什么色 · 卡片的圆角内距底色 · 哪几块以什么顺序排 · 最大的字多大。
 * 截图照拍，那是给眼睛的（[重点 24](../docs/founder-points.md)：眼睛判像不像）。
 *
 * ⚠️ 跑完把风格放回原本那一套 —— 一把每跑一次就悄悄改老板自己预览帐号的尺，
 * 是有代价的尺。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/one-register";
mkdirSync(OUT, { recursive: true });

const EMAIL = "tianyou.demo@formae.test";
const PASSWORD = "FormaeDemo2026!";
const REGISTERS = ["ledger", "hearth", "blueprint", "swiss", "signboard", "counter"];

const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let browser, original = null, projectId = null;
try {
  const { error } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (error) throw new Error(`signIn: ${error.message}`);
  const { data: proj } = await api.from("projects").select("id, style").single();
  projectId = proj.id;
  original = proj.style;
  console.log(`原本那一套：${original}\n`);

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 180000 });

  const hashes = { desk: {}, site: {} };
  for (const reg of REGISTERS) {
    const { error: sErr } = await api.rpc("set_project_style", { new_style: reg });
    if (sErr) throw new Error(`set_project_style ${reg}: ${sErr.message}`);

    for (const [what, path] of [["desk", "/en/portal/dashboard"], ["site", "/en/portal/website"]]) {
      await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 180000 });
      await page.waitForTimeout(2500);
      await page.addStyleTag({ content: "nextjs-portal{display:none!important}" }).catch(() => {});
      /* 只拍画布，不拍我们自己的编辑器外壳 —— 外壳永远是同一套，
         把它拍进去会让两张图看起来比实际更像。 */
      const canvas = page.locator("[data-editor-canvas]").first();
      const target = (await canvas.count()) ? canvas : page;
      await target.screenshot({ path: `${OUT}/${what}-${reg}.png` });

      const print = await page.evaluate(() => {
        const root = document.querySelector("[data-editor-canvas]") ?? document.body;
        const px = (el, ...props) => {
          if (!el) return "none";
          const cs = getComputedStyle(el);
          return props.map((p) => cs.getPropertyValue(p)).join("|");
        };
        const ground = root.querySelector("[data-register]") ?? root;
        const rail = root.querySelector("nav, aside") ;
        const cards = [...root.querySelectorAll("*")].filter((el) => {
          const cs = getComputedStyle(el);
          return parseFloat(cs.borderTopLeftRadius) > 0 && el.clientWidth > 180 && el.clientHeight > 90;
        });
        const biggest = [...root.querySelectorAll("*")]
          .filter((el) => (el.textContent ?? "").trim().length && el.children.length === 0)
          .map((el) => parseFloat(getComputedStyle(el).fontSize))
          .sort((a, b) => b - a)[0];
        /* 哪几块、什么顺序 —— 换个配色拿不走的那一根轴（重点 7c）。 */
        const order = [...root.querySelectorAll("[data-puck-component], [data-rfd-draggable-id]")]
          .map((el) => el.getAttribute("data-puck-component") ?? "")
          .filter(Boolean)
          .join(">");
        return [
          "ground:" + px(ground, "background-color"),
          "rail:" + (rail ? rail.clientWidth : 0) + "/" + px(rail, "background-color"),
          "card:" + px(cards[0], "border-top-left-radius", "padding-top", "background-color", "box-shadow"),
          "cards:" + cards.length,
          "biggest:" + biggest,
          "order:" + order,
        ].join("  ");
      });
      hashes[what][reg] = print;
      console.log(`  ${what}  ${reg.padEnd(10)} ${createHash("sha1").update(print).digest("hex").slice(0, 8)}`);
    }
  }

  const deskSet = new Set(Object.values(hashes.desk));
  const siteSet = new Set(Object.values(hashes.site));
  console.log(`\n工作台：六套画出 ${deskSet.size} 种`);
  console.log(`官网：  六套画出 ${siteSet.size} 种`);

  const bad = [];
  if (deskSet.size !== 1) bad.push(`工作台还有 ${deskSet.size} 种样子 —— 应该只有一种`);
  if (siteSet.size < 4) bad.push(`官网只剩 ${siteSet.size} 种 —— 那一层的差异是我们卖的东西`);
  writeFileSync(`${OUT}/hashes.json`, JSON.stringify(hashes, null, 2));

  if (bad.length) {
    for (const b of bad) console.log(`🔴 ${b}`);
    process.exitCode = 1;
  } else {
    console.log(`\n判：工作台一套 · 官网 ${siteSet.size} 套。⚠️ 数字只能否决 —— 去看 ${OUT}/`);
  }
} finally {
  if (projectId && original) {
    try { await api.rpc("set_project_style", { new_style: original }); } catch {}
    console.log(`\n放回 ${original}`);
  }
  await browser?.close();
}
