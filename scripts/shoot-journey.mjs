/**
 * 一个全新的客户，从零走到自己的系统。
 *
 * WHY THIS EXISTS. On 2026-08-28 the one-time style choice was found broken —
 * for a week — because /portal/style-select is reachable ONLY while
 * `projects.style` is null, and the two seeded demo accounts can never be in
 * that state again. Every screenshot, every walkthrough and every eval since
 * has started from an account that was already past it. The first screen a
 * paying stranger sees was the one screen nobody could look at.
 *
 * So this makes a real account, walks it, photographs each step, and deletes
 * it. The account is thrown away at the end precisely so the next run can be
 * the first time again.
 *
 *   npm run shoot:journey
 *
 * Needs `npm run dev` on :3000.
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
    ]),
);

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = ".screenshots/journey";
mkdirSync(OUT, { recursive: true });

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const stamp = Date.now();
const email = `journey.${stamp}@formae.test`;
const password = `Journey${stamp}!`;
let userId = null;
let browser = null;

const shots = [];
async function shot(page, name) {
  await page.waitForTimeout(1200);
  const path = `${OUT}/${String(shots.length + 1).padStart(2, "0")}-${name}.png`;
  await page.screenshot({ path, fullPage: true });
  shots.push(`${path}  ${page.url()}`);
  console.log(shots[shots.length - 1]);
}

try {
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  userId = data.user.id;

  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  // Errors the browser swallows are the ones that hide for a week. Anything
  // the page logs as an error is printed here, next to the step it happened on.
  page.on("console", (m) => {
    if (m.type() === "error") console.log("   ⚠ console:", m.text().slice(0, 160));
  });
  page.on("pageerror", (e) => console.log("   ⚠ pageerror:", String(e.message).slice(0, 160)));

  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle" });
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 60000 });
  await shot(page, "after-signin");

  // The screen that was broken. Pick the first style offered and watch what
  // happens -- an error here is the whole reason this script exists.
  if (/style-select/.test(page.url())) {
    const choice = page.locator("button, [role='button']").filter({ hasText: /choose|select|用这一套|选这套/i });
    if (await choice.count()) {
      await choice.first().click();
      await page.waitForTimeout(3000);
    }
    await shot(page, "after-choosing-style");
  }

  await page.goto(`${BASE}/en/portal`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(page, "their-system");

  await page.goto(`${BASE}/en/portal/dashboard`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(page, "editor");

  // What a stranger would see, if they published. Reached from the owner's own
  // slug so the URL is the real one.
  const { data: project } = await admin
    .from("projects")
    .select("site_slug")
    .eq("account_id", userId)
    .maybeSingle();
  if (project?.site_slug) {
    await page.goto(`${BASE}/s/${project.site_slug}`, { waitUntil: "networkidle", timeout: 120000 });
    await shot(page, "public-site");
  }

  // The same first screen on the phone every one of these owners actually
  // carries. 390px is an iPhone 15 in portrait.
  const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await phone.goto(`${BASE}/en/login`, { waitUntil: "networkidle" });
  await phone.fill('input[type="email"]', email);
  await phone.fill('input[type="password"]', password);
  await phone.click('button[type="submit"]');
  await phone.waitForURL(/portal/, { timeout: 60000 });
  await phone.goto(`${BASE}/en/portal`, { waitUntil: "networkidle", timeout: 120000 });
  await shot(phone, "their-system-390");
} finally {
  if (browser) await browser.close();
  if (userId) {
    await admin.auth.admin.deleteUser(userId).catch(() => {});
    console.log(`\ncleaned up ${email}`);
  }
}
