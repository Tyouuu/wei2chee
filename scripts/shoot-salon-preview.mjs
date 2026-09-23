/**
 * Real-browser look at the two literal-ported Stitch pages (Task 405).
 * Public routes, no login needed -- these are sales-demo pages, not a real
 * account's system.
 *
 *   npm run dev   # in another terminal
 *   node scripts/shoot-salon-preview.mjs
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const OUT = ".screenshots/salon-preview";
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
for (const [name, path, width, height] of [
  ["overview-1440", "overview", 1440, 1000],
  ["schedule-1440", "schedule", 1440, 1000],
  ["register-1440", "register", 1440, 1000],
  ["clients-1440", "clients", 1440, 1300],
  ["stock-1440", "stock", 1440, 1100],
  ["lookbook-1440", "lookbook", 1440, 1500],
  ["stylists-1440", "stylists", 1440, 1500],
  ["eod-cash-1440", "eod-cash", 1440, 1600],
  ["invoices-1440", "invoices", 1440, 1500],
  ["audit-log-1440", "audit-log", 1440, 1600],
]) {
  const page = await b.newPage({ viewport: { width, height } });
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  await page.goto(`${BASE}/en/salon-preview/${path}`, { waitUntil: "networkidle", timeout: 60000 });
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: true });
  console.log(`${name}: shot ok${errors.length ? ` -- ${errors.length} console errors: ${errors.slice(0, 3).join(" | ")}` : ""}`);
  await page.close();
}
await b.close();
console.log("done");
