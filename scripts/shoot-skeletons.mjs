/**
 * 一套风格一个官网骨架 —— 拍出来看。
 *
 * check:registers can prove the fourteen dashboards are structurally
 * different. Nothing could say the same about the fourteen WEBSITES, because
 * until 2026-08-27 they were not: every template hard-coded its own section
 * order and its own first screen, so a register reached a customer's website as
 * paint. SITE_COMPOSITION changed that, and this is the picture that shows it
 * -- 重点 3, 用看的 不是量的.
 *
 * ── WHY IT TOUCHES THE DATABASE, AND WHAT IT PUTS BACK ────────────────────
 *
 * A website page is GENERATED ON READ until the owner first saves it, and the
 * demo project saved its own months ago -- correctly, because a published page
 * must not re-skeleton itself under a visitor. So the only way to photograph
 * what a business would get from each register is to hand the page back its
 * ungenerated state for the length of the run.
 *
 * Everything it changes is written to .screenshots/skeletons/restore.json
 * BEFORE the first change and put back in a `finally`, byte for byte:
 *   · project_pages.layout_json for the website page
 *   · projects.style
 *
 * While it runs, /s/<slug> answers 404 -- the public route reads the SAVED
 * layout and there is deliberately no fallback to a generated one. That is the
 * cost of the picture and it is stated here rather than discovered.
 *
 *   npm run shoot:skeletons                    # six representative registers
 *   npm run shoot:skeletons -- ledger tile     # just these
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync, readFileSync, existsSync } from "node:fs";

/* THE LIST IS READ, NOT KEPT -- style-order.test.ts fails the build over a
   second hand-written copy of it, and it is right to: shoot:registers once held
   its own array, kept naming a register that had been cut, and photographed
   fifteen things while reporting sixteen. Six is a default SAMPLE of that list,
   not a list of its own. */
const ALL = (() => {
  const src = readFileSync("app/[locale]/style-picker/style-column.tsx", "utf8");
  const block = src.match(/export const STYLE_ORDER[^=]*=\s*\[([^\]]*)\]/);
  if (!block) throw new Error("STYLE_ORDER not found -- did style-column.tsx move?");
  return [...block[1].matchAll(/"([a-z]+)"/g)].map((m) => m[1]);
})();
/* Every third one, so the sample spreads across the library rather than
   photographing whichever six happen to sit at the front of it. */
const WANTED = process.argv.slice(2).length
  ? process.argv.slice(2)
  : ALL.filter((_, i) => i % Math.max(1, Math.round(ALL.length / 6)) === 0).slice(0, 6);
const OUT = ".screenshots/skeletons";
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

const { data: project } = await db
  .from("projects")
  .select("id,style,site_slug")
  .eq("site_slug", SLUG)
  .single();
if (!project) throw new Error(`no project for ${SLUG}`);

const { data: page } = await db
  .from("project_pages")
  .select("id,layout_json")
  .eq("project_id", project.id)
  .eq("page_key", "website")
  .single();
if (!page) throw new Error("no website page");

/* THE BACKUP IS WRITTEN BEFORE ANYTHING CHANGES, and left on disk after a
   successful restore too. A crashed run that never reached its `finally` is
   exactly when somebody needs this file, and that is the run that cannot
   write it. */
if (!existsSync(RESTORE)) {
  writeFileSync(RESTORE, JSON.stringify({ pageId: page.id, projectId: project.id, style: project.style, layout_json: page.layout_json }, null, 1));
  console.log("backed up ->", RESTORE);
} else {
  console.log("restore.json already exists -- leaving the earlier backup alone");
}

const restore = async () => {
  const saved = JSON.parse(readFileSync(RESTORE, "utf8"));
  await db.from("project_pages").update({ layout_json: saved.layout_json }).eq("id", saved.pageId);
  await db.from("projects").update({ style: saved.style }).eq("id", saved.projectId);
  console.log("restored: style", saved.style, "+ saved layout");
};

const b = await chromium.launch();
try {
  // Hand the page back its ungenerated state so every read re-skeletons it.
  await db.from("project_pages").update({ layout_json: {} }).eq("id", page.id);

  const p = await b.newPage({ viewport: { width: 1500, height: 1750 } });
  await p.goto("http://localhost:3000/zh/login", { waitUntil: "networkidle" });
  await p.fill('input[type="email"]', "tianyou.demo@formae.test");
  await p.fill('input[type="password"]', "FormaeDemo2026!");
  await p.click('button[type="submit"]');
  await p.waitForURL(/portal/, { timeout: 60000 });

  for (const style of WANTED) {
    await db.from("projects").update({ style }).eq("id", project.id);
    await p.goto("http://localhost:3000/zh/portal/website?design=1", { waitUntil: "networkidle", timeout: 180000 });
    await p.waitForTimeout(7000);
    /* CLIP, DO NOT ASK THE ELEMENT FOR ITS OWN PICTURE.

       `locator.screenshot()` on the canvas came back cut off down the left --
       the canvas sits to the right of the editor's rail and is wider than the
       viewport, and an element shot of something wider than the page clips
       rather than scrolls. Taking the PAGE and cropping to the element's box,
       intersected with the viewport, is the version that cannot silently lose
       a third of the picture. */
    const box = await p.locator(".ds-site").first().boundingBox();
    const vp = p.viewportSize();
    const clip = box
      ? {
          x: Math.max(0, box.x),
          y: Math.max(0, box.y),
          width: Math.min(box.width, vp.width - Math.max(0, box.x)),
          height: Math.min(box.height, vp.height - Math.max(0, box.y)),
        }
      : undefined;
    await p.screenshot({ path: `${OUT}/${style}.png`, clip });
    console.log("ok  ", style);
  }
} finally {
  await restore();
  await b.close();
}
