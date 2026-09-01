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

const bad = [];
const b = await chromium.launch();
for (const W of [1440, 390]) {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 500 ? 844 : 950 } });
  const p = await ctx.newPage();
  /* 🔴 一条 magic link 只能用一次，而这一支本来在回圈**外面**只产生一条 ——
     所以 1440 那一轮用掉之后，390 那一轮全部落在登入页上。
     十一张手机截图有八张是同一张登入页，而这支脚本只印 1440 的读数，
     所以它三天来一次都没有喊过。
     ⚠️ [重点 24](../docs/founder-points.md)：判这一页的是那个陌生人，而他在手机上 ——
     **手机那一半的稽核等於从来没有做过。**
     下面 `landed` 那一条现在会把这件事变成失败，不是沉默。 */
  const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email: acct.email });
  await p.goto(`${BASE}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/en/portal`,
    { waitUntil: "networkidle", timeout: 60000 }).catch(() => {});
  for (const [name, path, needsAuth] of SCREENS) {
    try {
      await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 60000 });
      await p.waitForTimeout(1600);
      await p.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" });
      const m = await p.evaluate(() => ({
        h: document.body.scrollHeight,
        pics: [...document.querySelectorAll("img,video")].filter(e => e.getBoundingClientRect().width > 120).length,
        /* ⚠️ 只数**看得见**的。
           第一版数了 `querySelectorAll` 的全部，编辑器那几页报 460–497 个，
           而裁图一看画面上只有三十来个 —— 其余是 Puck 的组件面板、抽屉、
           还没打开的弹层，全部在 DOM 里但人看不到。
           **数一个看不见的控件，跟今天修了一整天的那类错是同一个**：
           量到的东西不是画面上的东西。 */
        btns: [...document.querySelectorAll("button,a[href],input,select,textarea")]
          .filter((e) => {
            const r = e.getBoundingClientRect();
            if (r.width < 4 || r.height < 4) return false;
            const c = getComputedStyle(e);
            if (c.visibility === "hidden" || c.display === "none" || Number(c.opacity) < 0.05) return false;
            return e.checkVisibility ? e.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
          }).length,
        btnsAll: document.querySelectorAll("button,a[href],input,select,textarea").length,
        words: (document.body.innerText.match(/\S+/g) || []).length,
        dead: /does not exist|404/i.test(document.body.innerText.slice(0, 300)),
      }));
      /* 要登入才看得到的画面，落在登入页上就是**没有拍到**，不是拍到了一张登入页。 */
      const landed = p.url();
      if (needsAuth && /\/login/.test(landed)) {
        bad.push(`${name} @${W} 落在登入页 —— 这一张不算数`);
      }
      await p.screenshot({ path: `${OUT}/${name}-${W}.jpg`, fullPage: W === 1440, type: "jpeg", quality: 64 });
      if (W === 1440) console.log(`${name.padEnd(14)} ${String(m.h).padStart(6)}px  ${String(m.pics).padStart(2)}图  ${String(m.btns).padStart(3)}个可按（DOM 里 ${String(m.btnsAll).padStart(3)}）  ${String(m.words).padStart(4)}字${m.dead ? "  ← 404" : ""}`);
    } catch (e) { console.log(`${name.padEnd(14)} 读不到 ${String(e).slice(0, 60)}`); }
  }
  await ctx.close();
}
await b.close();
console.log(`\n→ ${OUT}/  两个宽度各 ${SCREENS.length} 张`);
