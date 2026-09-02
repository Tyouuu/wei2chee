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
  WHY THIS RUNS UNDER `reducedMotion: "reduce"`, AND WHY THAT IS NOT CHEATING.

  Every capture against this page used to hang past 60s, always right after
  「fonts loaded」. The cause is not fonts and not the compass spinner: the
  landing page carries <AmbientBackdrop>, a full-viewport @shadergradient
  (three.js) canvas whose render loop never ends, and Chromium's
  Page.captureScreenshot waits for a compositor frame that a permanently
  animating GL surface does not hand over. Measured on this screen, with the
  analyze request held open:

    viewport             99ms once, then timed out on later runs
    fullPage             TIMES OUT
    animations:disabled  TIMES OUT   (it disables CSS animations; GL is not one)
    clip                 TIMES OUT
    raw CDP captureScreenshot        208s

  The published workaround for GL pages is `--use-angle=gl`, which trades the
  hang for a dependency on the machine's GPU -- fine on his Windows box, not
  fine anywhere else, and this shoot has to keep working. So the fix went into
  the PRODUCT instead: AmbientBackdrop now honours prefers-reduced-motion and
  paints a still frame, which it should have done for the visitor's sake
  anyway. Asking for that here is asking for a real state of the real page.

  ⚠️ It does mean this shoot cannot see the shader. Anything judging the
  ATMOSPHERE has to be shot separately, with motion on.
*/

const b = await chromium.launch();

/*
  A CLICK THAT REPORTS WHEN IT HAD TO BE FORCED.

  Playwright will not click an element whose box is still moving. Forcing the
  click gets the shoot moving, but the fact that it had to be forced is written
  into the log rather than swallowed -- 「量不到却印一个漂亮数字」 is how this
  repo has been fooled by its own rulers before.
*/
async function clickOrForce(loc, notes, what) {
  try {
    await loc.click({ timeout: 9000 });
  } catch {
    await loc.click({ force: true, timeout: 9000 });
    notes.push(`     !! had to force the click on ${what}`);
  }
}

async function run(width, height, suffix) {
  const ctx = await b.newContext({ viewport: { width, height }, reducedMotion: "reduce" });
  const p = await ctx.newPage();
  const notes = [];

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
  // Pays for the dev-server compile before a frame that matters is due.
  await p.screenshot({ path: `${OUT}/.warmup.png` });

  /*
    THE HERO IS OPTIONAL HERE, AND THE REASON IS ITSELF A FINDING.

    Its textarea feeds q3, so filling it is the path a real visitor takes. At
    390px it cannot be filled at all: 任务 55 measured that box sitting off the
    left edge with `overflow-x: hidden` on the document, so nothing can scroll
    it into reach -- Playwright waits for actionability and never gets it. That
    bug is still open, and this shoot must not die on it, so the hero is tried
    and its failure is reported rather than thrown.
  */
  const brief =
    LOCALE === "zh"
      ? "我做装修，五个师傅，报价都用 WhatsApp 发，客人问进度我要翻聊天记录"
      : "I run a renovation firm with five workers, quotes go out on WhatsApp";
  let heroTook = true;
  try {
    await p.locator("main textarea").first().fill(brief, { timeout: 8000 });
    await p.keyboard.press("Enter");
  } catch {
    heroTook = false;
    await p.locator("#industry-select").scrollIntoViewIfNeeded();
  }
  await p.waitForTimeout(2500);

  // 01 SECTOR: take the first trade card rather than naming one, so a change
  // to the trade list does not silently break the shoot.
  // 01 SECTOR: take the first trade card rather than naming one, so a change
  // to the trade list does not silently break the shoot.
  await clickOrForce(p.locator("#industry-select button").first(), notes, "the trade card");

  const startBtn = p.getByRole("button", {
    name: /(开始分析我的生意|Analyze my business)/,
  });
  await startBtn.waitFor({ timeout: 20000 });
  await clickOrForce(startBtn, notes, "「开始分析我的生意」");

  /*
    SCOPED TO THE STEPPER, NOT TO THE PAGE. The trade cards in 01 SECTOR also
    carry aria-pressed, and they are still in the document underneath this
    fixed overlay -- an unscoped locator picks one of them and then waits
    thirty seconds for a click Playwright can already see is blocked.
  */
  const sheet = p.locator("section.fixed");
  await sheet.waitFor({ timeout: 20000 });

  /*
    THREE QUESTIONS, AND EACH ONE IS WAITED FOR RATHER THAN TIMED.

    The Next button is `disabled` until the current question has an answer, and
    a click on a disabled button is not an error -- it is silently nothing. An
    earlier version slept 700ms and pressed on, and at 390px it walked the
    whole way to a loading screen that never came, because it had actually been
    parked on q3 the entire time. So the counter is read every step, and a step
    that does not advance stops the shoot with a sentence saying which one.
  */
  const counter = sheet.locator("span.annotation").first();
  for (let step = 0; step < 3; step++) {
    /*
      WAIT FOR THIS QUESTION TO BE THE ONE ON SCREEN.

      QuestionCard animates in and out under AnimatePresence mode="wait", so
      for a few hundred milliseconds after Next the OLD card is still in the
      DOM. Clicking 「the first option」 in that window answers the question
      that is leaving, and the one arriving is left blank -- which is exactly
      how this failed, at 1440 one run and at 390 the next. The step counter is
      the page's own statement of where it is, so it is what gets waited on.
    */
    await counter
      .filter({ hasText: new RegExp(`^0${step + 1} `) })
      .waitFor({ timeout: 20000 })
      .catch(async () => {
        await p.screenshot({ path: `${OUT}/.stuck-${width}.png` });
        const sheets = await p.locator("section.fixed").count();
        const ann = await sheet.locator("span.annotation").allInnerTexts();
        throw new Error(
          `never reached step ${step + 1} at ${width}px ` +
            `(section.fixed=${sheets} annotations=${JSON.stringify(ann)})`,
        );
      });

    // The counter flips the instant state changes; the outgoing card is still
    // sliding out for another ~400ms after that, and Playwright refuses to
    // click a box that is still moving. One settle beat, then the LAST option
    // in the sheet -- during the crossfade that is the incoming card's.
    await p.waitForTimeout(900);
    const options = sheet.locator("button[aria-pressed]");
    if (await options.count()) {
      await clickOrForce(options.last(), notes, `an option on step ${step + 1}`);
      // And the answer registered, not just got clicked at.
      await sheet.locator('button[aria-pressed="true"]').last().waitFor({ timeout: 10000 });
    }

    // q3 is the free-text one. The Hero normally pre-fills it; at 390px the
    // Hero could not be reached, so it is typed here instead.
    const box = sheet.locator("textarea");
    if ((await box.count()) === 1 && !(await box.inputValue())) await box.fill(brief);

    const next = sheet.getByRole("button", {
      name: /(下一题|开始分析|Next|Start my analysis)/,
    });
    if (await next.isDisabled()) {
      await p.screenshot({ path: `${OUT}/.stuck-${width}.png` });
      throw new Error(`step ${step + 1} never became answerable at ${width}px`);
    }
    await clickOrForce(next, notes, `step ${step + 1}`);
  }

  await p.getByText("SYS.ANALYSIS").waitFor({ timeout: 30000 });
  const t0 = Date.now();
  const seen = [];

  for (const at of SHOTS) {
    const wait = t0 + at * 1000 - Date.now();
    if (wait > 0) await p.waitForTimeout(wait);
    const el = p.locator("[data-analysis-step]");
    const step = await el.getAttribute("data-analysis-step");
    const line = (await el.innerText()).trim();
    seen.push(`${String(at).padStart(2)}s  ${step}  ${line}`);
    await p.screenshot({ path: `${OUT}/${TAG}-${LOCALE}${suffix}-${String(at).padStart(2, "0")}s.png` });
  }

  /*
    AND THAT IT RESOLVES. The text assertion is the proof; the frame is the
    evidence he actually looks at.
  */
  await p.getByText("FINDINGS").waitFor({ timeout: 40000 });
  seen.push("     -> FINDINGS (the screen resolves)");
  await p.waitForTimeout(2500);
  await p.screenshot({ path: `${OUT}/${TAG}-${LOCALE}${suffix}-done.png`, fullPage: true });

  if (!heroTook) seen.push("     !! hero textarea unreachable at this width (任务 55)");
  seen.push(...notes);
  await ctx.close();
  return seen;
}

try {
  const wide = await run(1440, 900, "");
  console.log(`\n${TAG} · ${LOCALE} · 1440px`);
  for (const l of wide) console.log("  " + l);

  /*
    THE NUMBER THAT MATTERS IS THE LONGEST HOLD, NOT HOW MANY LINES FIT.

    The bug was never 「too few sentences」, it was ONE SENTENCE FOR TWENTY-TWO
    SECONDS -- a progress display that stops changing does not read as slow, it
    reads as stuck. Since the pacing is set to the slow tail (42s, because a
    real call was measured at 47.5s), a fast analysis legitimately never reaches
    the last line, and counting lines would call that a regression.

    Sampled every 5s, so this is an upper bound of that resolution, which is all
    it needs to be: what has to be true is that the screen keeps moving.
  */
  const seen = wide.filter((l) => /^\s*\d+s /.test(l)).map((l) => l.slice(5));
  let streak = 1;
  let longest = 1;
  for (let i = 1; i < seen.length; i++) {
    streak = seen[i] === seen[i - 1] ? streak + 1 : 1;
    if (streak > longest) longest = streak;
  }
  const gap = (SHOTS[1] - SHOTS[0]) * longest;
  console.log(`  distinct lines: ${new Set(seen).size} / ${SHOTS.length} sampled`);
  console.log(`  longest anything sat still: <= ${gap}s   (before this was rebuilt: 22s)`);

  // 重点 24: the person judging this is on a phone.
  const narrow = await run(390, 844, "-390");
  console.log(`\n${TAG} · ${LOCALE} · 390px`);
  for (const l of narrow) console.log("  " + l);
} finally {
  await b.close();
}
