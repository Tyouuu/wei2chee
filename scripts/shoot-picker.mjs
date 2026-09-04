/**
 * 他一点进「换照片」看到的那一格 —— 拍下来。
 *
 * The founder, 2026-08-28: 「客户要换照片的话 然后他点击进去照片 我们是不是提供足够
 * 类似的照片」. The answer to that is a picture of the grid, not a count of
 * results, so this drives the real controls in the real editor and photographs
 * what a renovation contractor sees.
 *
 * IT PUTS THE PAGE BACK. The editor autosaves 2.5 seconds after any change on
 * a page the customer has saved once, so a script that touches the panel is
 * writing to the demo account's live public website. The layout is backed up
 * before anything is touched and restored in a `finally` — the same guard
 * eval:browser had to grow after an earlier run left 「二十年装修经验」 on the
 * founder's own published page.
 *
 *   npm run shoot:picker -- [before|after]
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

const TAG = process.argv[2] || "after";
const OUT = ".screenshots/picker";
const RESTORE = `${OUT}/restore.json`;
const SLUG = "xingfa-reno";
mkdirSync(OUT, { recursive: true });

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i < 1) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const { data: project } = await db.from("projects").select("id").eq("site_slug", SLUG).single();
const { data: page } = await db
  .from("project_pages").select("id,layout_json")
  .eq("project_id", project.id).eq("page_key", "website").single();
if (!existsSync(RESTORE)) {
  writeFileSync(RESTORE, JSON.stringify({ pageId: page.id, layout_json: page.layout_json }, null, 1));
}

const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });
  await p.goto("http://localhost:3000/en/login", { waitUntil: "networkidle", timeout: 120000 });
  await p.fill('input[type="email"]', "tianyou.demo@formae.test");
  await p.fill('input[type="password"]', "FormaeDemo2026!");
  await p.click('button[type="submit"]');
  await p.waitForURL(/portal/, { timeout: 90000 });
  await p.goto("http://localhost:3000/en/portal/website?design=1", { waitUntil: "networkidle", timeout: 240000 });
  await p.waitForTimeout(9000);

  const hero = p.locator("[data-puck-component]").filter({ has: p.locator("h1") }).first();
  await hero.click({ force: true });
  await p.waitForTimeout(1500);
  for (const label of ["Edit text", "Content", "改文字", "内容"]) {
    const btn = p.getByRole("button", { name: label }).first();
    if (await btn.count()) { await btn.click().catch(() => {}); break; }
  }
  await p.waitForTimeout(2000);

  for (const label of ["From the library", "从图库找"]) {
    const t = p.getByRole("button", { name: label }).first();
    if (await t.count()) {
      await t.scrollIntoViewIfNeeded().catch(() => {});
      await t.click({ force: true, timeout: 8000 });
      break;
    }
  }
  /* Wait for the GRID, not for a clock. The first run of this waited six
     seconds, screenshotted an empty picker and reported success — a ruler that
     passes by measuring nothing, which is the failure this repo keeps finding. */
  await p.locator("[data-photo-picker] img").first().waitFor({ timeout: 45000 }).catch(() => {});
  await p.waitForTimeout(3500);

  /* The panel, not the whole window: the grid is the thing being judged and a
     1500px screenshot of a 1500px editor makes it 40 pixels tall. */
  const all = p.locator("[data-photo-picker]");
  const many = await all.count();
  /* More than one photo field can be on a block (a gallery has three), and the
     first one is not necessarily the one that was opened. Take the tallest —
     the one with the grid in it. */
  let shot = p, best = 0;
  for (let i = 0; i < many; i++) {
    const box = await all.nth(i).boundingBox();
    if (box && box.height > best) { best = box.height; shot = all.nth(i); }
  }
  console.log(`     ${many} 个选图器，最高的 ${Math.round(best)}px`);
  const n = await p.locator("[data-photo-picker] img").count();
  await shot.screenshot({ path: `${OUT}/${TAG}-library.png` });
  console.log("ok  ", `${TAG}-library.png`, `· ${n} 张`);
  if (!n) throw new Error("图库一张都没画出来 —— 这张截图不能算数");

  /* 「像这张」 only exists after 2026-08-28; before that this is a no-op and the
     script still produces its one screenshot rather than failing. */
  const like = p.locator("[data-similar]").nth(2);
  if (await like.count()) {
    await like.click({ force: true });
    await p.waitForTimeout(6000);
    await shot.screenshot({ path: `${OUT}/${TAG}-similar.png` });
    console.log("ok  ", `${TAG}-similar.png`);
  }
} finally {
  const saved = JSON.parse(readFileSync(RESTORE, "utf8"));
  await db.from("project_pages").update({ layout_json: saved.layout_json }).eq("id", saved.pageId);
  console.log("restored the saved layout");
  await b.close();
}
