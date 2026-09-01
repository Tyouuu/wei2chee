/* FORMAE 自己的八页，拍下来摆在一起看。
 *
 * 老板 2026-09-02:「如果很多页的话 就好像会一直重复的问题
 * 所以才要你去学习去复刻 更多不同后台的页面 看看其他人是什么去做的」
 *
 * ⚠️ 客户系统那 17 个模块的重复我 9-02 已经量过（[任务 95b]）,而那些页面
 * 现在在另一个 session 手上（`lib/templates/industry-template.ts` 有 328 行
 * 未提交的改动，正在加左清单右详情 / 单据 / 看板）。**不要动。**
 *
 * 这一支量的是**我自己这一边** —— Formae 的外壳那八页，看它们是不是也在
 * 重复同一张骨架。判的方法只有一个：拍下来摆在一起，用眼睛看
 * （[重点 3](../docs/founder-points.md)）。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import fs from "node:fs";

config({ path: ".env.local", quiet: true });
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } });

const PROJECT = process.env.DEMO_PROJECT_ID || "37f2b188-5899-48ab-8650-11cefa5f98d2";
const { data: proj } = await db.from("projects").select("account_id").eq("id", PROJECT).single();
const { data: acct } = await db.from("accounts").select("email").eq("id", proj.account_id).single();

const OUT = ".screenshots/ours";
fs.mkdirSync(OUT, { recursive: true });

const PAGES = [
  ["1-home",      "/en/portal"],
  ["2-enquiries", "/en/portal/enquiries"],
  ["3-spec",      "/en/portal/spec"],
  ["4-account",   "/en/portal/account"],
  ["5-library",   "/en/portal/library"],
  ["6-sections",  "/en/portal/sections"],
  ["7-styles",    "/en/portal/styles"],
  ["8-templates", "/en/portal/templates"],
];

/* 一页的**骨架**：从上往下，看得见的大块各是什么形状。
   不数 DOM，数画面上宽度过半、高度过 40 的那几块。 */
const SKELETON = () => {
  const main = document.querySelector("main") || document.body;
  const W = main.getBoundingClientRect().width;
  const out = [];
  const walk = (el, depth) => {
    if (depth > 6) return;
    for (const kid of el.children) {
      const r = kid.getBoundingClientRect();
      const c = getComputedStyle(kid);
      if (c.display === "none" || c.visibility === "hidden") continue;
      if (r.height < 40 || r.width < W * 0.45) continue;
      const grid = c.display.includes("grid");
      const cols = grid ? c.gridTemplateColumns.split(" ").filter(Boolean).length : 0;
      const tag = kid.tagName.toLowerCase();
      const cards = [...kid.children].filter((k) => k.getBoundingClientRect().height > 60).length;
      const kind =
        tag === "table" || kid.querySelector(":scope > table") ? "表格"
        : grid && cols >= 3 ? `网格 ${cols} 栏`
        : grid && cols === 2 ? "并排两栏"
        : cards >= 4 ? `一叠 ${cards} 块`
        : null;
      if (kind) { out.push({ kind, h: Math.round(r.height), cards }); continue; }
      walk(kid, depth + 1);
    }
  };
  walk(main, 0);
  return {
    h: Math.round(document.body.scrollHeight),
    h1: (document.querySelector("h1")?.innerText || "").slice(0, 40),
    blocks: out.slice(0, 6),
    words: (main.innerText.match(/\S+/g) || []).length,
  };
};

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1440, height: 950 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email: acct.email });
await p.goto(`${BASE}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/en/portal`,
  { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});

const rows = [];
for (const [name, path] of PAGES) {
  await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(1800);
  await p.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" });
  if (/\/login/.test(p.url())) { console.log(`  ${name}  ⚠️ 落在登入页 —— 没有拍到`); continue; }
  const m = await p.evaluate(SKELETON);
  await p.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 72, fullPage: true });
  rows.push([name, m]);
  console.log(
    `  ${name.padEnd(12)} ${String(m.h).padStart(5)}px  ${String(m.words).padStart(4)} 字  ` +
    (m.blocks.map((x) => `${x.kind}(${x.h})`).join(" · ") || "—"),
  );
}
await b.close();

/* 一句读数：几页在用同一张骨架 */
const sig = rows.map(([n, m]) => [n, m.blocks.map((x) => x.kind).join(" → ") || "—"]);
const tally = {};
for (const [, s] of sig) tally[s] = (tally[s] || 0) + 1;
console.log("\n骨架：");
for (const [s, n] of Object.entries(tally).sort((a, b) => b[1] - a[1]))
  console.log(`  ${String(n).padStart(2)} 页  ${s}`);
fs.writeFileSync(`${OUT}/read.json`, JSON.stringify(Object.fromEntries(rows), null, 2));
