/**
 * 那层 shader，看不到的时候有没有停下来。
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * <AmbientBackdrop> is a full-viewport three.js canvas behind the whole landing
 * page. Measured 2026-08-31 at 390x844 with the CPU throttled 4x (Lighthouse's
 * mobile default; this market's visitor is a mid-range Android on 4G):
 *
 *   top of the page      12 draws/s   effective opacity 1.000
 *   the white half       55 draws/s   effective opacity 0.000
 *   bottom of the page   62 draws/s   effective opacity 0.000
 *
 * It ran FASTEST where nobody could see it. Two thirds of the page sits past
 * the handover, where that layer is faded to nothing, and every one of those
 * frames was a phone heating up to composite something invisible.
 *
 * 重点 24: 眼睛看到的每一个错，当场变成一条会红的守卫. This is that guard. It
 * checks the thing the eye can check -- whether the canvas is in the document
 * -- because a canvas that is not there cannot draw.
 *
 * ⚠️ It has been SEEN RED: drop the `!lit` condition in ambient-backdrop.tsx
 * and step 2 fails.
 *
 *   npm run check:ambient      (needs `npm run dev` already up)
 */
import { chromium } from "playwright";

const BASE = process.env.BASE ?? "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
const p = await ctx.newPage();
let bad = 0;

const state = () =>
  p.evaluate(() => ({
    canvases: document.querySelectorAll("canvas").length,
    t: Number(document.documentElement.style.getPropertyValue("--handover-t")) || 0,
  }));

function check(label, got, want) {
  const ok = got.canvases === want;
  if (!ok) bad++;
  console.log(
    `  ${ok ? "ok  " : "BAD "} ${label.padEnd(30)} canvas=${got.canvases} (want ${want})  handover-t=${got.t.toFixed(3)}`,
  );
}

try {
  await p.goto(`${BASE}/zh`, { waitUntil: "domcontentloaded", timeout: 180000 });
  await p.waitForTimeout(8000);
  const H = await p.evaluate(() => document.body.scrollHeight);

  // 1. Lit where it is the design. The whole dark half is this surface.
  check("top of the page", await state(), 1);

  // 2. Gone once the page has turned white and it is at opacity zero.
  await p.evaluate((y) => window.scrollTo(0, y), Math.round(H * 0.6));
  await p.waitForTimeout(2500);
  check("past the handover", await state(), 0);

  // 3. AND IT COMES BACK. The first version of the fix read --handover-t one
  //    frame too early, so once the shader went away it never returned -- the
  //    top of the page silently lost its atmosphere for anyone who scrolled
  //    down and back. That is a worse bug than the one being fixed, and this
  //    is the step that catches it.
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(3000);
  check("scrolled back to the top", await state(), 1);
} finally {
  await b.close();
}

console.log(bad ? `\n${bad} wrong` : "\nall three");
process.exitCode = bad ? 1 : 0;
