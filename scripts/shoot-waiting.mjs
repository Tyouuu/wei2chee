/**
 * 他等的那 29 秒，画面上到底在动什么。
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * The questionnaire's analysis takes a MEASURED median of 28.6s (eval:analysis,
 * and the first row the usage ledger ever wrote said took_ms=28742). The screen
 * he watches during it had three lines on a 1900ms timer -- 5.7 seconds of
 * movement -- and then `Math.min` pinned the last one. So a stranger who had
 * just typed two minutes about his business, on the landing page, before he has
 * an account, read ONE UNCHANGING SENTENCE FOR TWENTY-THREE SECONDS.
 *
 * That fix shipped in a1df3cd with a line in its own commit message admitting
 * NOBODY HAD WATCHED IT. 重点 3: 审美这种东西都是用看的. A change to what a
 * customer looks at, verified only by `tsc` and a unit test, is not verified.
 *
 * ── HOW IT AVOIDS PAYING OPENAI, AND WHY THAT IS NOT A CHEAT ──────────────
 *
 * `/api/analyze` is intercepted and fulfilled AFTER A DELAY -- the delay is the
 * measured wait, so the browser sits in exactly the state a real visitor sits
 * in. The thing under test is the waiting screen's pacing, and the pacing does
 * not know or care where the answer comes from.
 *
 *   ⚠️ DELAYED FULFIL, NEVER A HANDLER THAT NEVER RESOLVES. An earlier attempt
 *   at this hung Playwright for 6m40s, because a route that is never fulfilled
 *   also never lets the page reach `networkidle`.
 *
 * ── WHAT IT PROVES, AND WHAT IT DOES NOT ──────────────────────────────────
 *
 * It proves the six lines actually advance on a real page, in both languages,
 * and that the screen resolves into the findings at the end. It does NOT prove
 * the sentences are the right sentences -- that is his call, off the frames.
 *
 *   node scripts/shoot-waiting.mjs [--tag after] [--locale zh]
 *   (needs `npm run dev` already up)
 */
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = process.env.BASE ?? "http://localhost:3000";
const arg = (f, d) => {
  const i = process.argv.indexOf(f);
  return i > -1 ? process.argv[i + 1] : d;
};
const TAG = arg("--tag", "after");
const LOCALE = arg("--locale", "zh");
const OUT = ".screenshots/waiting";
mkdirSync(OUT, { recursive: true });

/** The measured wait, held in one place. 30s ≈ median 28.6 / p95 34.1. */
const WAIT_MS = 30_000;
/** Grabbed a beat INTO each 5s slot rather than on its boundary, so a frame is
 *  never caught mid-crossfade and read as a blank screen. */
const SHOTS = [2, 7, 12, 17, 22, 27];

/* A believable answer, so the last frame shows the screen RESOLVING rather
   than erroring. Shape copied from types/database AnalysisResult. */
const CANNED = {
  leadId: "00000000-0000-0000-0000-000000000000",
  analysis: {
    summary:
      LOCALE === "zh"
        ? "你的报价都在 WhatsApp 里，追不动"
        : "Your quotes live in WhatsApp, and nothing chases them",
    bottlenecks: [
      { title: LOCALE === "zh" ? "报价没人追" : "Quotes go cold", description: "x" },
      { title: LOCALE === "zh" ? "订金对不上" : "Deposits do not reconcile", description: "x" },
    ],
    before_workflow: ["WhatsApp", "Excel", "Notebook"],
    after_workflow: ["Enquiry", "Quote", "Deposit", "Work", "Payment"],
    modules: [{ key: "quotations", label: LOCALE === "zh" ? "报价单" : "Quotations", why: "x" }],
  },
};

/*
  ANIMATIONS DISABLED, AND THAT IS NOT A COMPROMISE HERE.

  The spinner is `repeat: Infinity`, and a plain screenshot against it timed out
  after 30s every time -- the capture waits on a compositor layer that never
  settles. Playwright's `animations: "disabled"` FINISHES finite animations and
  freezes infinite ones, which is exactly the split this page needs: the
  paragraph's 0.35s crossfade lands on its end state (so the sentence is fully
  legible, which is the thing being judged) while the compass stops turning.
*/
async function shoot(p, path) {
  await p.screenshot({ path, animations: "disabled", caret: "initial", timeout: 20000 });
}

const b = await chromium.launch();

async function run(width, height, suffix) {
  const p = await b.newPage({ viewport: { width, height } });

  await p.route("**/api/analyze", async (route) => {
    await new Promise((r) => setTimeout(r, WAIT_MS + 4000));
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify(CANNED),
    });
  });

  await p.goto(`${BASE}/${LOCALE}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await p.waitForTimeout(4000);

  /* The Hero's textarea feeds q3, so the stepper's last question arrives
     already filled -- same path a real visitor takes. */
  const brief = p.locator("main textarea").first();
  await brief.fill(
    LOCALE === "zh"
      ? "我做装修，五个师傅，报价都用 WhatsApp 发，客人问进度我要翻聊天记录"
      : "I run a renovation firm with five workers, quotes go out on WhatsApp",
  );
  await p.keyboard.press("Enter");
  await p.waitForTimeout(2500);

  // 01 SECTOR: take the first trade card rather than naming one, so a change
  // to the trade list does not silently break the shoot.
  await p.locator("#industry-select button").first().click();
  await p.waitForTimeout(2500);

  await p.getByRole("button", { name: /(开始分析我的生意|Analyze my business)/ }).click();
  await p.waitForTimeout(1500);

  /*
    SCOPED TO THE STEPPER, NOT TO THE PAGE. The trade cards in 01 SECTOR also
    carry aria-pressed, and they are still in the document underneath this
    fixed overlay -- an unscoped locator picks one of them and then waits
    thirty seconds for a click Playwright can already see is blocked.
  */
  const sheet = p.locator("section.fixed");

  // Three questions: option, option, then the text one the Hero pre-filled.
  for (let step = 0; step < 3; step++) {
    const options = sheet.locator("button[aria-pressed]");
    if (await options.count()) await options.first().click();
    await p.waitForTimeout(400);
    await sheet
      .getByRole("button", { name: /(下一题|开始分析|Next|Start my analysis)/ })
      .click();
    await p.waitForTimeout(700);
  }

  await p.getByText("SYS.ANALYSIS").waitFor({ timeout: 30000 });
  const t0 = Date.now();
  const seen = [];

  for (const at of SHOTS) {
    const wait = t0 + at * 1000 - Date.now();
    if (wait > 0) await p.waitForTimeout(wait);
    const line = (await p.locator("section p.font-serif").first().innerText()).trim();
    seen.push(`${String(at).padStart(2)}s  ${line}`);
    await shoot(p, `${OUT}/${TAG}-${LOCALE}${suffix}-${String(at).padStart(2, "0")}s.png`);
  }

  // And that it actually resolves into the findings.
  await p.getByText("FINDINGS").waitFor({ timeout: 30000 });
  await shoot(p, `${OUT}/${TAG}-${LOCALE}${suffix}-done.png`);
  seen.push("     -> FINDINGS");

  await p.close();
  return seen;
}

try {
  const wide = await run(1440, 900, "");
  console.log(`\n${TAG} · ${LOCALE} · 1440px`);
  for (const l of wide) console.log("  " + l);

  const distinct = new Set(wide.filter((l) => l.includes("s  ")).map((l) => l.slice(5))).size;
  console.log(`  distinct sentences: ${distinct} / ${SHOTS.length}`);

  // 重点 24: the person judging this is on a phone.
  const narrow = await run(390, 844, "-390");
  console.log(`\n${TAG} · ${LOCALE} · 390px`);
  for (const l of narrow) console.log("  " + l);
} finally {
  await b.close();
}
