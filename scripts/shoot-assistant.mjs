/**
 * 等待的时候，画面上会发生什么。
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * 「全部都做demo给我知道」. Three of this session's changes are things a
 * customer only ever meets when something goes wrong -- a request that stalls,
 * a route that 500s, a wait he wants out of -- and none of them can be seen by
 * reading the diff or by running the eval, which never opens a browser.
 *
 * So this drives the real editor with the real assistant, and forces the two
 * failures on purpose by intercepting the route. What it captures:
 *
 *   1-idle     the panel at rest
 *   2-waiting  「思考中…」 beside 「不等了」  -- the way out that did not exist
 *   3-broke    a 500, and the sentence he reads for it
 *
 * Frame 3 is the one that matters. Every failure used to read 「这次没听懂，
 * 换个说法再试一次」 -- our route falling over, and the contractor being told to
 * rewrite a sentence that was fine.
 *
 *   npm run shoot:assistant        (needs `npm run dev` already up)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/assistant";
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });

try {
  await p.goto(`${BASE}/zh/login`, { waitUntil: "networkidle", timeout: 90000 });
  await p.fill('input[type="email"]', "tianyou.demo@formae.test");
  await p.fill('input[type="password"]', "FormaeDemo2026!");
  await p.click('button[type="submit"]');
  await p.waitForURL(/portal/, { timeout: 90000 });

  await p.goto(`${BASE}/zh/portal/dashboard`, { waitUntil: "networkidle", timeout: 180000 });
  await p.waitForTimeout(8000);

  /*
    BY ITS OWN LABEL, NOT BY 「the last textarea」.

    The first run reached for the last textarea on the page and found a hidden
    shadcn one inside a sample block on the CANVAS -- the customer's own page
    has form controls in it, and the editor is a page containing a page. The
    assistant's box is the one that says what it is.
  */
  const box = p.getByLabel("AI 修改");
  /*
    THE PANEL STARTS CLOSED, which the first two runs of this did not know: the
    textarea was found every time and was never visible. Opened the way the
    owner opens it, by its own button.
  */
  if (!(await box.isVisible())) {
    await p.getByRole("button", { name: /打开/ }).first().click();
  }
  await box.waitFor({ timeout: 30000 });
  const panel = p.locator("aside").filter({ has: box }).first();

  await panel.screenshot({ path: `${OUT}/1-idle.png` });
  console.log("ok   1-idle");

  /*
    HELD OPEN, NOT ANSWERED. The wait is the subject, so the route is stalled
    rather than allowed to reply -- and stalled without spending a model call,
    because a screenshot is not worth the founder's OpenAI credit.
  */
  let release;
  const held = new Promise((r) => (release = r));
  await p.route("**/api/portal/edit", async (route) => {
    await held;
    await route.fulfill({ status: 500, body: "{}" });
  });

  await box.fill("帮我把表格搬到上面");
  await p.getByRole("button", { name: /修改/ }).click();
  await p.waitForTimeout(1200);
  await panel.screenshot({ path: `${OUT}/2-waiting.png` });
  console.log("ok   2-waiting");

  release();
  await p.waitForTimeout(2000);
  await panel.screenshot({ path: `${OUT}/3-broke.png` });
  console.log("ok   3-broke");
} finally {
  await b.close();
}
