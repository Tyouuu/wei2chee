/**
 * 第一屏放一张照片 —— 从图库挑一张，一路走到上线的页面。
 *
 * The founder gave the Pixabay key on 2026-08-27 and the question that follows
 * is not 「does the endpoint answer」 but 「does a photograph actually reach a
 * stranger's screen」. Every failure this repo has had in the last month lived
 * in the gap between those two: a capability built, a wire never connected,
 * and a ruler that passed by measuring nothing.
 *
 * So this drives the real controls -- the picker in the block panel, the
 * library tab, one photograph, the save button -- and then photographs the
 * PUBLIC page, which is the only screen that counts.
 *
 * IT PUTS THE PAGE BACK. The saved layout is backed up before anything is
 * touched and restored in a `finally`, exactly like shoot:skeletons.
 *
 *   npm run shoot:photo
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

const OUT = ".screenshots/photo";
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

const { data: project } = await db.from("projects").select("id,site_slug").eq("site_slug", SLUG).single();
const { data: page } = await db
  .from("project_pages")
  .select("id,layout_json")
  .eq("project_id", project.id)
  .eq("page_key", "website")
  .single();

if (!existsSync(RESTORE)) {
  writeFileSync(RESTORE, JSON.stringify({ pageId: page.id, layout_json: page.layout_json }, null, 1));
  console.log("backed up ->", RESTORE);
}

const b = await chromium.launch();
try {
  const p = await b.newPage({ viewport: { width: 1500, height: 1100 } });

  // BEFORE: the published page as it stands.
  await p.goto(`http://localhost:3000/s/${SLUG}`, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/public-before.png` });
  console.log("ok   public before");

  await p.goto("http://localhost:3000/zh/login", { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', "tianyou.demo@formae.test");
  await p.fill('input[type="password"]', "FormaeDemo2026!");
  await p.click('button[type="submit"]');
  await p.waitForURL(/portal/, { timeout: 60000 });

  await p.goto("http://localhost:3000/zh/portal/website", { waitUntil: "networkidle", timeout: 180000 });
  await p.waitForTimeout(8000);

  // Select the hero, then open its panel. The toolbar button is the owner's
  // own route to it, so it is the one driven here.
  /* THE HERO, NOT WHATEVER IS FIRST. `[data-puck-component]` first is the top
     bar, and the first run of this selected it, opened its panel and then
     waited eight seconds for a photo picker that bar has never had. Reach for
     the block that owns the <h1> instead -- that is the hero by definition. */
  const hero = p.locator("[data-puck-component]").filter({ has: p.locator("h1") }).first();
  await hero.click({ force: true });
  await p.waitForTimeout(1200);
  for (const label of ["改文字", "内容", "Edit text", "Content"]) {
    const btn = p.getByRole("button", { name: label }).first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      break;
    }
  }
  await p.waitForTimeout(1800);
  await p.screenshot({ path: `${OUT}/panel.png` });

  // The library tab, and one photograph out of it.
  /* `force`, because the panel's own scroll container reports itself as
     intercepting the pointer for anything below the fold of the sheet. The
     button is visible, enabled and stable -- Playwright's own log says so --
     and this is a screenshot script, not an accessibility audit. */
  const libTab = p.getByRole("button", { name: "从图库找" }).first();
  await libTab.scrollIntoViewIfNeeded().catch(() => {});
  await libTab.click({ timeout: 8000, force: true });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${OUT}/library.png` });
  console.log("ok   library tab");

  const shot = p.locator('button[title^="Pixabay"]').first();
  await shot.scrollIntoViewIfNeeded().catch(() => {});
  await shot.click({ timeout: 12000, force: true });
  // Adoption is a server round trip: fetch the file, write it to our bucket.
  await p.waitForTimeout(9000);
  await p.screenshot({ path: `${OUT}/adopted.png` });
  console.log("ok   adopted one");

  for (const label of ["保存设计", "Save design", "保存"]) {
    const btn = p.getByRole("button", { name: label }).first();
    if (await btn.count()) {
      await btn.click().catch(() => {});
      break;
    }
  }
  await p.waitForTimeout(7000);
  await p.screenshot({ path: `${OUT}/editor-after.png` });

  await p.goto(`http://localhost:3000/s/${SLUG}`, { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `${OUT}/public-after.png` });
  const phone = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
  await phone.goto(`http://localhost:3000/s/${SLUG}`, { waitUntil: "networkidle", timeout: 90000 });
  await phone.waitForTimeout(2500);
  await phone.screenshot({ path: `${OUT}/public-after-phone.png` });
  console.log("ok   public after");
} finally {
  const saved = JSON.parse(readFileSync(RESTORE, "utf8"));
  await db.from("project_pages").update({ layout_json: saved.layout_json }).eq("id", saved.pageId);
  console.log("restored the saved layout");
  await b.close();
}
