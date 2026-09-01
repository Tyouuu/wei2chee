/* 询价收件匣，改前改后各拍一张。
 *
 * ⚠️ 拍之前先把这一批标回「新的」——**开页面那一刻就会标已读**，
 * 所以不这样做，那条绿色的「新」永远拍不到，
 * 而「拍不到」跟「没做到」在一张截图上长得一模一样。
 *
 * ⚠️ 一条 magic link 只能用一次：两个宽度各产生一条。
 * 第一版共用一条，390 那张拍回来是登入页 —— 而它看起来就是一张正常的截图。
 * 同一个错在 `shoot-journey.mjs` 里躺了更久：那一支的**整个手机半边**都是登入页。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
config({ path: ".env.local", quiet: true });
const BASE = "http://localhost:3000";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const PROJECT = process.env.DEMO_PROJECT_ID || "37f2b188-5899-48ab-8650-11cefa5f98d2";
const { data: proj } = await db.from("projects").select("account_id").eq("id", PROJECT).single();
const { data: acct } = await db.from("accounts").select("email").eq("id", proj.account_id).single();
/* 把这一批标回「新的」再拍 —— 不然「新」那条竖线永远拍不到，
   而拍不到跟没做到长得一模一样。拍完不用还原：开页面本来就会标已读。 */
await db.from("site_enquiries").update({ status: "new" }).eq("project_id", PROJECT);
const b = await chromium.launch();
for (const W of [1440, 390]) {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 500 ? 844 : 950 } });
  const p = await ctx.newPage();
  /* ⚠️ 一条 magic link 只能用一次。第一版在回圈外面产生一条，两个宽度共用 ——
     390 那张拍回来是登入页，而它看起来就是一张正常的截图。 */
  const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email: acct.email });
  await p.goto(`${BASE}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/en/portal`, { waitUntil: "networkidle", timeout: 180000 }).catch(() => {});
  await db.from("site_enquiries").update({ status: "new" }).eq("project_id", PROJECT);
  await p.goto(`${BASE}/en/portal/enquiries`, { waitUntil: "networkidle", timeout: 180000 });
  await p.waitForTimeout(2200);
  await p.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" });
  await p.screenshot({ path: `.screenshots/inbox/after-${W}.jpg`, fullPage: W === 1440, type: "jpeg", quality: 78 });
  const m = await p.evaluate(() => ({ words: (document.body.innerText.match(/\S+/g)||[]).length, h: document.body.scrollHeight }));
  console.log(W, JSON.stringify(m));
  await ctx.close();
}
await b.close();
