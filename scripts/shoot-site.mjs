/**
 * The customer's public website, and the same page inside the editor.
 *
 * TWO SHOTS OF ONE PAGE, ON PURPose. This module's whole rule is that the
 * editor prompts and the published page never does -- 编辑器负责催，公开的页面
 * 永远不出现「催」 -- and the only way to see whether that holds is to look at
 * both. The founder found the last failure this way, on his own phone: three
 * grey 「Add a photo」 boxes and a WhatsApp number nobody owns.
 *
 *   npm run shoot:site
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const SLUG = process.argv[2] || "xingfa-reno";
mkdirSync(".screenshots/site", { recursive: true });

const b = await chromium.launch();

// The public page, as a stranger sees it, on a phone -- which is where a
// Malaysian SME's visitors actually are.
const phone = await b.newPage({ viewport: { width: 390, height: 844 }, isMobile: true });
await phone.goto(`http://localhost:3000/s/${SLUG}`, { waitUntil: "networkidle", timeout: 90000 });
await phone.waitForTimeout(3000);
await phone.screenshot({ path: ".screenshots/site/public-phone.png" });
console.log("ok   public (390px)");

const wide = await b.newPage({ viewport: { width: 1400, height: 950 } });
await wide.goto(`http://localhost:3000/s/${SLUG}`, { waitUntil: "networkidle", timeout: 90000 });
await wide.waitForTimeout(3000);
await wide.screenshot({ path: ".screenshots/site/public-wide.png" });
console.log("ok   public (1400px)");

// The same page in the editor, where the prompts are allowed to be.
await wide.goto("http://localhost:3000/zh/login", { waitUntil: "networkidle" });
await wide.fill('input[type="email"]', "tianyou.demo@formae.test");
await wide.fill('input[type="password"]', "FormaeDemo2026!");
await wide.click('button[type="submit"]');
await wide.waitForURL(/portal/, { timeout: 60000 });
await wide.goto("http://localhost:3000/zh/portal/website?design=1", { waitUntil: "networkidle", timeout: 120000 });
await wide.waitForTimeout(6000);
await wide.screenshot({ path: ".screenshots/site/editor.png" });
console.log("ok   editor");

await b.close();
