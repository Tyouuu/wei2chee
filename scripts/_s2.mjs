import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1440, height: 1000 } });
await p.goto("http://localhost:3000/en/login", { waitUntil: "domcontentloaded" });
await p.fill('input[type="email"]', "preview.beauty.1788003888325@formae.test");
await p.fill('input[type="password"]', "Preview1788003888325!");
await p.click('button[type="submit"]');
await p.waitForTimeout(9000);
await p.goto("http://localhost:3000/en/portal", { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(4000);
const names = await p.evaluate(() =>
  [...document.querySelectorAll("h3, .font-semibold")].map(e=>e.textContent.trim())
    .filter(t=>t && t.length<24));
console.log("card names:", [...new Set(names)].slice(0,14).join(" | "));
await p.screenshot({ path: ".screenshots/salon/home.png", fullPage: true });
await b.close();
