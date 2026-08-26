import { chromium } from "playwright";
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
await p.goto("http://localhost:3000/zh/login", { waitUntil: "networkidle" });
await p.fill('input[type="email"]', "tianyou.demo@formae.test");
await p.fill('input[type="password"]', "FormaeDemo2026!");
await p.click('button[type="submit"]');
await p.waitForURL(/portal/, { timeout: 60000 });
await p.goto("http://localhost:3000/zh/portal/styles", { waitUntil: "networkidle", timeout: 120000 });
await p.waitForTimeout(6000);
const out = await p.evaluate(() => {
  const lis = [...document.querySelectorAll("li")];
  return {
    liCount: lis.length,
    texts: lis.slice(0, 24).map((l) => (l.textContent || "").trim().replace(/\s+/g, " ").slice(0, 45)),
  };
});
console.log(JSON.stringify(out, null, 1));
await b.close();
