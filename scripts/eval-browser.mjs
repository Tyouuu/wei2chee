/**
 * 它说改了 —— 画面真的动了吗。
 *
 * ── WHY THIS EXISTS AT ALL ────────────────────────────────────────────────
 *
 * `eval:editor` measures the JSON the route returns and never opens a browser.
 * That is the right thing for it to measure and it is also its blind spot:
 * every one of the NINE 「说了没做」 bugs in this repo happened AFTER the model
 * answered correctly — the reply said 「已将总览改为表格先行」, the route said
 * so too, and the browser dropped the field on the floor. The editor eval
 * reported a confident 100% straight through all of it, because from where it
 * stands the answer WAS right.
 *
 *   「模型答对了」跟「客户看到变化了」中间隔着一整个消费端。
 *
 * This is the ruler for that stretch. It is small on purpose: real logins,
 * real model calls, real renders, a handful of cases. It is not a replacement
 * for eval:editor — it cannot afford 47 cases — it is the one assertion that
 * eval cannot make.
 *
 * ── WHAT IT READS, AND WHY IT IS innerText ────────────────────────────────
 *
 * `document.body.innerText` of the canvas. NOT the layout JSON, not a DOM
 * attribute, not the route's response — the words a person can actually read.
 *
 * The other session ran into the same trap three times in one day and it is
 * worth writing down, because all three look like a passing check:
 *   1. Cloudflare served a challenge page; the script photographed it and
 *      reported ok eight times
 *   2. a wrong URL returned 200 with a generic title; ok eight times again
 *   3. grepping the HTML for the 404 sentence matched every page, because the
 *      sentence sits in the markup of all of them
 * The fix each time was to read what a reader sees.
 *
 * 「量了一个跟画面无关的代理指标」 is how a ruler lies while printing a number
 * that looks exactly like a good one.
 *
 * ── THE ASSERTION THAT MATTERS ────────────────────────────────────────────
 *
 * Per case there is a specific expectation, but the general one is the point:
 *
 *   claimed a change  ->  the visible text MUST differ
 *   refused or asked  ->  the visible text MUST NOT differ
 *
 * The first half is the nine bugs. The second half is its mirror and is worth
 * as much: an assistant that says 「这页现在没有图片区块」 and then quietly
 * rearranges something is the same broken promise pointing the other way.
 *
 * ── COST AND SAFETY ───────────────────────────────────────────────────────
 *
 * Real model calls, one per case.
 *
 * ⚠️ IT DOES WRITE TO THE DATABASE, which this file claimed for a day that it
 * did not. THE EDITOR AUTOSAVES -- 2.5s after any change, on any page the
 * customer has already saved once (editor-client). So an AI edit made here is
 * a real edit to the demo account's real pages, and the first version of this
 * ruler quietly rewrote the founder's public site headline and left it there.
 *
 * So it snapshots what it can break and puts it back: every page's layout, and
 * the project's style/palette/layout. A ruler the founder has to clean up
 * after is a ruler that costs more than it is worth.
 *
 *   npm run dev            (in another terminal)
 *   npm run eval:browser
 *   npm run eval:browser -- --only 排法
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

/*
  IT PUTS THE DEMO ACCOUNT BACK.

  A 排法 answer writes `projects.layout` for real -- that is the point, it is
  the write whose invisibility this ruler was built to catch. But the demo
  account is the one the founder opens to look at his own product, and a ruler
  that quietly rearranges it every time it runs is a ruler that costs something
  to use. `shoot:photo` already had to learn this; so does this.

  Only the three columns a design answer can touch, and only rows that actually
  moved.
*/
const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const DB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const dbHead = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Connection: "close" };

const readDesign = async () =>
  await (await fetch(`${DB}/rest/v1/projects?select=id,layout,style,palette`, { headers: dbHead })).json();

/* The pages themselves. See the autosave note at the top: an AI edit made by
   this ruler is written to the customer's real page within seconds. */
const readPages = async () =>
  await (await fetch(`${DB}/rest/v1/project_pages?select=id,page_key,layout_json`, { headers: dbHead })).json();

async function restorePages(before) {
  const after = await readPages();
  let put = 0;
  for (const b of before) {
    const a = after.find((x) => x.id === b.id);
    if (!a) continue;
    if (JSON.stringify(a.layout_json) === JSON.stringify(b.layout_json)) continue;
    await fetch(`${DB}/rest/v1/project_pages?id=eq.${b.id}`, {
      method: "PATCH",
      headers: dbHead,
      body: JSON.stringify({ layout_json: b.layout_json }),
    });
    put += 1;
  }
  if (put) console.log(`放回去了 ${put} 页的版面`);
}

async function restoreDesign(before) {
  const after = await readDesign();
  let put = 0;
  for (const b of before) {
    const a = after.find((x) => x.id === b.id);
    if (!a) continue;
    if (a.layout === b.layout && a.style === b.style && a.palette === b.palette) continue;
    await fetch(`${DB}/rest/v1/projects?id=eq.${b.id}`, {
      method: "PATCH",
      headers: dbHead,
      body: JSON.stringify({ layout: b.layout, style: b.style, palette: b.palette }),
    });
    put += 1;
  }
  if (put) console.log(`\n放回去了 ${put} 个项目的风格/配色/排法`);
}

const BASE = process.env.BASE ?? "http://localhost:3000";
const args = process.argv.slice(2);
const ONLY = args.includes("--only") ? args[args.indexOf("--only") + 1] : null;

/**
 * `changed` is what this ruler is for; the rest narrows it.
 *
 *   changed: true   the canvas must read differently afterwards
 *   changed: false  it must read the same -- a refusal or a question
 *   gains           text that must APPEAR (a word the owner used)
 *   reorders        the sequence of blocks must differ, not just the words
 */
const CASES = [
  {
    name: "改字 · 标题",
    ask: "把最上面那个标题改成「本月总览」",
    changed: true,
    gains: ["本月总览"],
  },
  {
    name: "加一栏 · 师傅",
    ask: "表格加一栏，记这单是哪个师傅负责",
    changed: true,
    gains: ["师傅"],
  },
  {
    name: "排法 · 一进来先看到表格",
    /*
      THE CASE THIS WHOLE FILE WAS BUILT FOR.

      This exact sentence is the bug: the model answered {layout:"table"}, the
      route validated it, the RPC existed, and the browser never read the
      field -- so the reply said 「已将总览改为表格先行」 over a page that had
      not moved. It is fixed, and it is fixed in the one place no other ruler
      can see, which is why it is worth a real browser to hold it down.

      Not asserted as 「the answer is design.layout」: on a page the customer
      has already saved the right answer is move_component instead. Both are
      correct and both must MOVE SOMETHING, so the assertion is on the moving.
    */
    ask: "我要一进来就先看到那个表格",
    changed: true,
    reorders: true,
  },
  {
    /*
      THE OTHER PAGE. Everything above is the dashboard -- the system the owner
      uses. This is his PUBLIC SITE, the thing he actually sends to people, and
      until now no ruler in this repo had ever asked the assistant about it in
      a browser. Its blocks are a different shape too: a 官网版段 keeps its words
      in its own content and not in props, so set_copy is the operation and
      set_text does nothing at all -- a distinction that is invisible from the
      route's JSON and obvious in rendered text.
    */
    name: "官网 · 第一屏的字",
    page: "website",
    ask: "把第一屏那句大标题改成「二十年装修经验」",
    changed: true,
    gains: ["二十年装修经验"],
  },
  {
    /*
      THE ONE BLOCK ON THIS PAGE THAT PRODUCES MONEY.

      `site_enquiries` is a real table with real rows: a stranger fills this
      form and the owner sees it in his system. It is the only arrow in the
      whole product that already goes all the way through, and until
      2026-08-27 EVERY WORD OF IT was unreachable by voice -- `heading`,
      `blurb`, `submitLabel`, `landsIn`, `note`, none of them on the
      hand-written field list. 「用讲的改」 did nothing here and looked like it
      worked.

      `submitLabel` on purpose: it is the last thing a visitor reads before
      deciding whether to press, and it is a label -- next to a `href` the
      assistant must never touch. If the derivation ever loosens, this case
      goes first.
    */
    name: "官网 · 询价表格的送出按钮",
    page: "website",
    ask: "把询价表格那颗送出的按钮改成「立刻问价钱」",
    changed: true,
    gains: ["立刻问价钱"],
  },
  {
    /*
      THE BUTTON NOBODY HAD EVER PRESSED.

      `pick_photo` is an OFFER, not an edit: the assistant does not choose a
      picture -- 「一张图库照片是整页唯一不属于他的东西」 -- it takes him to the
      slot and opens the picker with this trade's own words. The route side had
      unit tests from the day it shipped. The BROWSER side had none, and was
      written from how two other dispatches in this repo look. It has never
      been pressed by anybody, which is the same standing as a feature that
      does not work.

      So this presses it, and checks the two things that make it real: the
      offer appears, and pressing it opens the picker.
    */
    name: "官网 · 照片，按下那颗按钮",
    page: "website",
    ask: "第一屏换一张工地的照片",
    changed: false,
    offers: "去挑照片",
    opens: "从图库找",
  },
  {
    /*
      THE NET, TESTED WITHOUT SPENDING ANYTHING.

      Eleven times this product has shown a customer a sentence claiming a
      change over a page that did not move. claim-check.ts is the check between
      「what it said」 and 「what happened」, and the only honest way to test it is
      to make the assistant lie on purpose.

      So this case NEVER REACHES THE MODEL: the route is fulfilled with a reply
      that claims success while reporting that every operation was refused --
      exactly the shape of all eleven. What is under test is OUR consumption
      path, which is where all eleven happened and which the model is not part
      of. Free, deterministic, and it fails the day somebody decides the reply
      should be shown verbatim again.
    */
    name: "诚实 · 它说改了但什么都没落地",
    ask: "把最上面那个标题改成「测试」",
    fake: {
      layout: null,
      explanation: "标题已经改好了。",
      applied: 0,
      skipped: [{ op: "set_text", reason: "测试用：全部挡下" }],
      suggestion: null,
      design: null,
    },
    changed: false,
    mustNotSay: "标题已经改好了",
    mustSay: "页面没有动过",
  },
  {
    name: "拒绝 · 页面不能说谎",
    /*
      THE MIRROR. 「帮我发 whatsapp 给客人」 was once answered by adding a button
      wired to nothing -- a page telling a lie about itself. The honest answer
      changes nothing, and 「changed: false」 is the only way to check that the
      honest answer was also an honest ACTION.
    */
    ask: "帮我加一颗按钮，按下去直接发 whatsapp 给客人",
    changed: false,
  },
];

const chosen = ONLY ? CASES.filter((c) => c.name.includes(ONLY)) : CASES;

/** The canvas, and only the canvas. The editor's own chrome -- sidebar, page
 *  title, toolbar -- lives outside it, and a change there is not a change to
 *  the customer's page. */
const CANVAS = "[data-puck-preview]";

async function readCanvas(p) {
  return {
    text: await p.locator(CANVAS).innerText(),
    /* The order of the blocks, as their first visible line. A reordering that
       keeps every word is invisible to a text diff and is exactly what 排法
       does. */
    order: await p
      .locator(`${CANVAS} [data-puck-component]`)
      .evaluateAll((els) =>
        els.map((e) => (e.innerText || "").trim().split("\n")[0].slice(0, 24)),
      ),
  };
}

async function openEditor(p, page = "dashboard") {
  await p.goto(`${BASE}/zh/portal/${page}`, { waitUntil: "networkidle", timeout: 180000 });
  await p.waitForSelector(CANVAS, { timeout: 60000 });
  // The canvas renders progressively; a read taken too early diffs against a
  // half-drawn page and every case "changes".
  await p.waitForTimeout(7000);
  const box = p.getByLabel("AI 修改");
  if (!(await box.isVisible())) {
    await p.getByRole("button", { name: /打开/ }).first().click();
  }
  await box.waitFor({ timeout: 30000 });
  return box;
}

const designBefore = await readDesign();
const pagesBefore = await readPages();
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });
const rows = [];

try {
  await p.goto(`${BASE}/zh/login`, { waitUntil: "networkidle", timeout: 90000 });
  await p.fill('input[type="email"]', "tianyou.demo@formae.test");
  await p.fill('input[type="password"]', "FormaeDemo2026!");
  await p.click('button[type="submit"]');
  await p.waitForURL(/portal/, { timeout: 90000 });

  for (const c of chosen) {
    // Reloaded per case: an AI edit stays in Puck's state, so without this the
    // second case would be asked about a page the first one already changed.
    const box = await openEditor(p, c.page ?? "dashboard");
    const before = await readCanvas(p);

    /* A fabricated reply, for the cases that are about what WE do with one.
       Routed before the click so the request never leaves the browser. */
    if (c.fake) {
      await p.route("**/api/portal/edit", (route) =>
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify(c.fake),
        }),
      );
    }

    await box.fill(c.ask);
    await p.getByRole("button", { name: /^修改$/ }).click();

    /* Waited for by the SEND BUTTON coming back, not by a timeout: the button
       reads 「思考中…」 for exactly as long as the request is in flight, so this
       is the page's own signal and not a guess about how slow the model is. */
    await p.getByRole("button", { name: /^修改$/ }).waitFor({ timeout: 90000 });
    // The reply lands, then Puck re-renders. One is not the other.
    await p.waitForTimeout(2500);

    const after = await readCanvas(p);
    const replies = await p.locator(CANVAS).count(); // keeps the canvas alive in the trace
    void replies;

    /* The assistant's own words, read the same way as the canvas -- what it
       SAID is half of what is being checked. */
    const said = await p
      .locator("aside")
      .filter({ has: p.getByLabel("AI 修改") })
      .innerText()
      .then((t) => t.split("\n").filter(Boolean))
      .then((lines) => {
        const i = lines.findIndex((l) => l.includes(c.ask.slice(0, 10)));
        return (i >= 0 ? lines.slice(i + 1) : lines).join(" ").slice(0, 160);
      })
      .catch(() => "");

    const textMoved = before.text !== after.text;
    const orderMoved = JSON.stringify(before.order) !== JSON.stringify(after.order);
    const moved = textMoved || orderMoved;

    let ok = moved === c.changed;
    const why = [];
    if (moved !== c.changed) {
      why.push(c.changed ? "画面没有动" : "画面动了，但它讲的是做不到");
    }
    if (ok && c.gains) {
      const missing = c.gains.filter((g) => !after.text.includes(g));
      if (missing.length) {
        ok = false;
        why.push(`看不到「${missing.join("、")}」`);
      }
    }
    if (ok && c.reorders && !orderMoved) {
      ok = false;
      why.push("字变了但顺序没变 —— 排法要的是顺序");
    }

    /*
      AN OFFER IS PRESSED, NOT JUST COUNTED.

      A button that appears and does nothing is the exact failure this repo
      keeps writing rules against -- 「一颗接不到东西的按钮，告诉他一个永远不会
      来的功能」 -- and a check that only asserts the button EXISTS would have
      passed on one. So the offer is clicked and the thing it promises has to
      show up on screen.
    */
    if (ok && c.mustNotSay && said.includes(c.mustNotSay)) {
      ok = false;
      why.push(`它还是说了「${c.mustNotSay}」`);
    }
    if (ok && c.mustSay && !said.includes(c.mustSay)) {
      ok = false;
      why.push(`没有说「${c.mustSay}」`);
    }

    if (ok && c.offers) {
      const btn = p.getByRole("button", { name: new RegExp(c.offers) });
      if ((await btn.count()) === 0) {
        ok = false;
        why.push(`没有出现「${c.offers}」那颗按钮`);
      } else {
        await btn.first().click();
        await p.waitForTimeout(2500);
        if (c.opens) {
          const opened = await p.getByText(c.opens, { exact: false }).count();
          if (!opened) {
            ok = false;
            why.push(`按了「${c.offers}」，但「${c.opens}」没有打开`);
          }
        }
      }
    }

    // Cleared per case: a route left installed would fabricate the NEXT
    // case's reply too, and it would pass for the wrong reason.
    if (c.fake) await p.unroute("**/api/portal/edit");

    rows.push({ name: c.name, ok, said, why: why.join(" · "), before, after });
    console.log(`${ok ? "ok  " : "FAIL"}  ${c.name}`);
  }
} finally {
  await b.close();
  /* Pages first: the design columns decide how a page is GENERATED, so putting
     them back before the pages exist in their old shape is the wrong order. */
  await restorePages(pagesBefore);
  await restoreDesign(designBefore);
}

console.log("\n它说改了，画面真的动了吗\n");
for (const r of rows) {
  console.log(`${r.ok ? "  通过  " : "  没过  "}${r.name}`);
  console.log(`          它说: ${r.said || "(没读到)"}`);
  if (!r.ok) {
    console.log(`          问题: ${r.why}`);
    console.log(`          之前 ${r.before.order.length} 块: ${r.before.order.join(" | ")}`);
    console.log(`          之后 ${r.after.order.length} 块: ${r.after.order.join(" | ")}`);
  }
}
const passed = rows.filter((r) => r.ok).length;
console.log(`\n合计  ${passed}/${rows.length}\n`);
/*
  A non-zero exit, because this one is allowed to be a gate. eval:editor is a
  score to read; this is a yes/no about whether the thing the customer sees
  matches the thing the assistant claimed, and there is no version of that
  being 「mostly」 true.
*/
process.exitCode = passed === rows.length ? 0 : 1;
