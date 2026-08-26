import { chromium } from "playwright";
const B = "http://localhost:3101";
const SHOTS = [
  ["default", "/dashboard/default"],
  ["crm", "/dashboard/crm"],
  ["finance", "/dashboard/finance"],
  ["analytics", "/dashboard/analytics"],
  ["productivity", "/dashboard/productivity"],
  ["kanban", "/dashboard/kanban"],
  ["invoice", "/dashboard/invoice"],
  ["file-manager", "/dashboard/file-manager"],
  ["patient", "/dashboard/patient-monitoring"],
  ["logistics", "/dashboard/logistics"],
  ["academy", "/dashboard/academy"],
  ["tasks", "/dashboard/tasks"],
  ["infrastructure", "/dashboard/infrastructure"],
  ["ecommerce", "/dashboard/ecommerce"],
  ["users", "/dashboard/users"],
];
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1400, height: 950 } });
for (const [name, path] of SHOTS) {
  try {
    await p.goto(B + path, { waitUntil: "networkidle", timeout: 90000 });
    await p.waitForTimeout(3500);
    await p.screenshot({ path: `.screenshots/upstream/up-${name}.png` });
    console.log("ok  ", name);
  } catch (e) { console.log("FAIL", name, String(e).slice(0, 80)); }
}
// The three shell geometries, on one page, so the difference is visible.
for (const v of ["sidebar", "inset", "floating"]) {
  await p.context().addCookies([{ name: "sidebar_variant", value: v, url: B }]);
  await p.goto(B + "/dashboard/default", { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `.screenshots/upstream/shell-${v}.png` });
  console.log("ok   shell", v);
}
await p.context().addCookies([{ name: "sidebar_variant", value: "sidebar", url: B }]);
for (const c of ["centered", "full-width"]) {
  await p.context().addCookies([{ name: "content_layout", value: c, url: B }]);
  await p.goto(B + "/dashboard/default", { waitUntil: "networkidle", timeout: 90000 });
  await p.waitForTimeout(3000);
  await p.screenshot({ path: `.screenshots/upstream/width-${c}.png` });
  console.log("ok   width", c);
}
await b.close();
