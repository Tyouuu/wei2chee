/* 客户会经过的每一个画面，两个宽度各拍一张。
 *
 * 老板 2026-08-31:「就是每一个UI/UX都去上网深度研究 怎么才是最适配 最好看
 * 最user friendly的」。
 * ⚠️ 研究之前要先有**清单**：哪几个画面、每一个多高、有几张图、几个可以按的。
 * 凭印象列出来的清单会漏掉真正难看的那几页（[重点 3](../docs/founder-points.md)）。
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
const { data: proj } = await db.from("projects").select("account_id, site_slug").eq("id", PROJECT).single();
const { data: acct } = await db.from("accounts").select("email").eq("id", proj.account_id).single();
const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email: acct.email });

const OUT = ".screenshots/journey";
fs.mkdirSync(OUT, { recursive: true });

const SCREENS = [
  ["01-landing",   "/en",                    false],
  ["02-login",     "/en/login",              false],
  ["03-portal",    "/en/portal",             true],
  ["04-dashboard", "/en/portal/dashboard",   true],
  ["05-quotations","/en/portal/quotations",  true],
  ["06-website",   "/en/portal/website",     true],
  ["07-enquiries", "/en/portal/enquiries",   true],
  ["08-library",   "/en/portal/library",     true],
  ["09-account",   "/en/portal/account",     true],
  ["10-public",    `/s/${proj.site_slug}`,   false],
  ["11-404",       "/en/portal/nope",        true],
];

const b = await chromium.launch();
for (const W of [1440, 390]) {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 500 ? 844 : 950 } });
  const p = await ctx.newPage();
  await p.goto(`${BASE}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/en/portal`,
    { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  for (const [name, path] of SCREENS) {
    try {
      await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
      await p.waitForTimeout(1600);
      await p.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" });
      const m = await p.evaluate(() => ({
        h: document.body.scrollHeight,
        pics: [...document.querySelectorAll("img,video")].filter(e => e.getBoundingClientRect().width > 120).length,
        btns: document.querySelectorAll("button,a[href],input,select,textarea").length,
        words: (document.body.innerText.match(/\S+/g) || []).length,
        dead: /does not exist|404/i.test(document.body.innerText.slice(0, 300)),
      }));
      await p.screenshot({ path: `${OUT}/${name}-${W}.jpg`, fullPage: W === 1440, type: "jpeg", quality: 64 });
      if (W === 1440) console.log(`${name.padEnd(14)} ${String(m.h).padStart(6)}px  ${String(m.pics).padStart(2)}图  ${String(m.btns).padStart(3)}个可按  ${String(m.words).padStart(4)}字${m.dead ? "  ← 404" : ""}`);
    } catch (e) { console.log(`${name.padEnd(14)} 读不到 ${String(e).slice(0, 60)}`); }
  }
  await ctx.close();
}
await b.close();
console.log(`\n→ ${OUT}/  两个宽度各 ${SCREENS.length} 张`);
