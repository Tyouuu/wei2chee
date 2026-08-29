import { chromium } from "playwright";
const BRIEF = "I run a hair salon in Kuala Lumpur with 3 stylists. We do cuts, colouring, treatments and bridal styling. Most customers book through WhatsApp or Instagram and it takes a lot of back-and-forth. Some buy a package and pay upfront, then use it visit by visit. Each stylist earns commission on what they do.";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1100 } });
p.on("pageerror", e => console.log("  page error:", String(e.message).slice(0, 90)));
await p.goto("http://localhost:3000/en", { waitUntil: "networkidle" });
await p.waitForTimeout(1200);
await p.locator("textarea").first().fill(BRIEF);
await p.locator('button[type="submit"]').first().click();
await p.waitForTimeout(1000);
await p.locator("#industry-select button").first().click();     // 01 Beauty / Salon
await p.waitForTimeout(2000);
console.log("after trade:", await p.locator("#industry-select button").first().getAttribute("aria-pressed").catch(()=>"?"));
// the Start button that opens the questionnaire
const start = p.getByRole("button", { name: /start/i }).last();
await start.scrollIntoViewIfNeeded();
await start.click();
await p.waitForTimeout(2500);
const inputs = await p.locator("input, textarea, select").count();
console.log("inputs now:", inputs, "| url:", p.url());
await p.screenshot({ path: ".screenshots/salon/03-questions.png", fullPage: true });
console.log((await p.locator("body").innerText()).split("\n").map(s=>s.trim()).filter(Boolean).slice(-24).join("\n"));
await b.close();
