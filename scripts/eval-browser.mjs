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
    touches: ["dashboard-header"],
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
    /*
      NOT EVERY BUSINESS'S SITE HAS ONE.

      SITE_COMPOSITION gives each register its own set of sections, and the demo
      account is regenerated as different trades. On a run where its website had
      no enquiry form this case reported 「画面没有动」 -- and the assistant had
      answered correctly: 「这页看不到询价表格或「送出」按钮；是要改首页的
      「Ask on WhatsApp」按钮吗？」. A ruler that marks an honest answer wrong is
      worse than no ruler, so the case declares the block it is about.
    */
    needs: "website-form",
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
      THE SHORTEST SENTENCE THERE IS, AND THE WHOLE POINT IS THE WIRE.

      2026-08-31: 「我要你能在客户给很少资讯的情况下 都能判断出客人在讲什么」.
      A contractor on a phone taps a block and types 「短一点」. As text that
      carries nothing; on screen it is unambiguous, because the object is the
      thing he just opened. eval:editor proves the model handles it when it is
      TOLD which block -- this proves the browser actually tells it, which is
      the half this repo keeps failing to connect (thirteen times and counting).

      Clicked, not passed as a parameter: whether `selected` survives the trip
      from Puck's state into the request body is exactly what is under test.
    */
    name: "很少字 · 点着标题说短一点",
    click: "dashboard-header",
    ask: "短一点",
    changed: true,
    touches: ["dashboard-header"],
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
    /*
      THE SAME DEFECT, ON THE SHAPE THAT HAS HAD IT LONGEST.

      pipeline_records has been real since 2026-08-30, and for a day and a half
      「加一单」 wrote a genuine quotation into a table the owner could not see
      until he reloaded. It is one bug in one place -- the route returned a tree
      the rows were not in -- so it was never a directory problem; directory is
      only where it was finally noticed.

      Kept as its own case because 「fixed for one shape」 and 「fixed」 are
      different claims, and this repo has shipped the first while saying the
      second.
    */
    name: "报价单 · 加一单，画面要跟着动",
    page: "quotations",
    ask: "加一单：Taman Desa 三房翻新，陈先生，RM 48,500",
    changed: true,
    gains: ["Taman Desa"],
    writes: { table: "pipeline_records", column: "title", value: "Taman Desa 三房翻新" },
  },
  {
    /*
      A BUSINESS RECORD, NOT A DRAWING -- AND THE PAGE HAS TO MOVE.

      客户 became a real table on 2026-08-31. So 「加一个客户」 no longer edits
      the page: `add_table_row` is pulled out of the layout operations and
      written through add_directory_entry, and the row comes back on the NEXT
      SERVER RENDER through the live-rows projection.

      That is the whole reason this case is worth a browser. Everything the
      assistant does elsewhere lands in the tree it returns; this one lands in
      the database, and the only thing that puts it on screen is the
      `refetch` -> router.refresh() path -- which is a claim nobody had
      checked. If Puck keeps its own client state through that refresh, the
      owner reads 「加了陈先生」 over a table that has not changed, which is the
      eleven-times defect wearing a new hat.

      `writes` is asserted separately from `changed`, because they can fail
      independently and they mean different things: one is whether his books
      have the customer in them, the other is whether he can see it.
    */
    name: "客户 · 加一个真的客户",
    page: "customers",
    ask: "加一个客户：陈先生，013-234 5678",
    changed: true,
    gains: ["陈先生"],
    writes: { table: "directory_entries", column: "name", value: "陈先生" },
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
    /* WHICH BLOCKS ARE ON THIS PAGE AT ALL. Puck puts the block id in
       data-puck-component -- `website-form`, `website-hero` -- and a case about
       a block the page does not have is not a product failure, it is a question
       nobody asked. See `needs` on the enquiry case. */
    ids: await p
      .locator(`${CANVAS} [data-puck-component]`)
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-puck-component") || "")),
    /*
      EVERY BLOCK'S OWN WORDS, WHICH IS HOW 「动得对不对」 GETS CHECKED.

      Until now this ruler could only say the page MOVED. That catches the
      thirteen 「说了没做」 and nothing else -- an assistant that is asked to
      shorten one heading and quietly rewrites four other blocks passes every
      check here, and the SYSTEM_PROMPT's central rule (「做最小的那个改动」) had
      nothing measuring it at all.

      Keyed by block id, so a case can name the blocks it is allowed to touch
      and the diff of everything else has to be empty.
    */
    blocks: Object.fromEntries(
      await p
        .locator(`${CANVAS} [data-puck-component]`)
        .evaluateAll((els) =>
          els.map((e) => [e.getAttribute("data-puck-component") || "", (e.innerText || "").trim()]),
        ),
    ),
    /*
      WHO CONTAINS WHOM, ASKED OF THE DOM RATHER THAN GUESSED FROM THE TEXT.

      A generated page is one shell whose slots hold everything, so changing a
      heading changes the shell's innerText too. A first version excluded
      ancestors by substring-matching their text, which is right until two
      blocks say the same words. `el.contains` is the actual question.
    */
    holds: await p
      .locator(`${CANVAS} [data-puck-component]`)
      .evaluateAll((els) =>
        Object.fromEntries(
          els.map((e) => [
            e.getAttribute("data-puck-component") || "",
            els
              .filter((o) => o !== e && e.contains(o))
              .map((o) => o.getAttribute("data-puck-component") || ""),
          ]),
        ),
      ),
  };
}

/** Which blocks' words are not the same as they were. */
function movedBlocks(before, after) {
  const names = new Set([...Object.keys(before.blocks), ...Object.keys(after.blocks)]);
  return [...names].filter((k) => before.blocks[k] !== after.blocks[k]).sort();
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
/** Business records this run created, so the finally block can take them out
 *  again. Layouts are snapshotted; rows have to be deleted, because there was
 *  no row to snapshot. */
const wroteRows = [];

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

    /* Reported, never silently passed: a skip that looks like a pass is how a
       ruler stops noticing the thing it was built for. */
    if (c.needs && !before.ids.includes(c.needs)) {
      rows.push({ name: c.name, skipped: `这个项目的页面上没有「${c.needs}」这一块`, before, after: before, said: "" });
      console.log(`skip  ${c.name}`);
      continue;
    }

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

    /* Click the block first when the case is about a selection, and put the
       composer back in reach: selecting a block opens its own sheet. */
    if (c.click) {
      await p.locator(`[data-puck-component="${c.click}"]`).first().click({ force: true });
      await p.waitForTimeout(1800);
      if (!(await box.isVisible())) {
        await p.getByRole("button", { name: /打开/ }).first().click();
        await box.waitFor({ timeout: 15000 });
      }
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
    /*
      THE SMALLEST CHANGE, CHECKED.

      「做最小的那个改动」 is the rule the prompt leans on hardest and the one
      nothing could see. A case names the blocks its sentence is about; anything
      else that moved is the assistant improving something nobody asked about,
      which the founder has called out by name (「不要乱换」).

      Nested blocks make a parent's text change when a child's does, so an
      ancestor of a named block is not a violation -- the shell contains
      everything, and it would fail every case.
    */
    if (ok && c.touches) {
      const strayed = movedBlocks(before, after).filter(
        (id) =>
          !c.touches.includes(id) &&
          !c.touches.some((t) => (after.holds[id] ?? []).includes(t)),
      );
      if (strayed.length) {
        ok = false;
        why.push(`还动了没人叫它动的：${strayed.join("、")}`);
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

    /*
       DID HIS BOOKS ACTUALLY GET THE ROW.

       Read straight from the table, not from the canvas: a page can show a
       name that only exists in a tree, and a tree is not a business record.
       The row is removed in the finally block -- this ruler writes to the
       founder's own demo account (see the autosave note at the top). */
    if (ok && c.writes) {
      const found = await fetch(
        `${DB}/rest/v1/${c.writes.table}?select=id&${c.writes.column}=eq.${encodeURIComponent(c.writes.value)}`,
        { headers: dbHead },
      ).then((r) => r.json()).catch(() => []);
      if (!Array.isArray(found) || !found.length) {
        ok = false;
        why.push(`${c.writes.table} 里没有这一行 —— 它说加了，书上没有`);
      } else {
        for (const r of found) wroteRows.push([c.writes.table, r.id]);
      }
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
  for (const [table, id] of wroteRows) {
    await fetch(`${DB}/rest/v1/${table}?id=eq.${id}`, { method: "DELETE", headers: dbHead });
  }
  if (wroteRows.length) console.log(`放回去了 ${wroteRows.length} 行真的记录`);
}

console.log("\n它说改了，画面真的动了吗\n");
for (const r of rows) {
  if (r.skipped) {
    console.log(`  跳过  ${r.name}`);
    console.log(`          ${r.skipped}`);
    continue;
  }
  console.log(`${r.ok ? "  通过  " : "  没过  "}${r.name}`);
  console.log(`          它说: ${r.said || "(没读到)"}`);
  if (!r.ok) {
    console.log(`          问题: ${r.why}`);
    console.log(`          之前 ${r.before.order.length} 块: ${r.before.order.join(" | ")}`);
    console.log(`          之后 ${r.after.order.length} 块: ${r.after.order.join(" | ")}`);
  }
}
const ran = rows.filter((r) => !r.skipped);
const passed = ran.filter((r) => r.ok).length;
const skipped = rows.length - ran.length;
console.log(`\n合计  ${passed}/${ran.length}${skipped ? ` · 跳过 ${skipped}` : ""}\n`);
/*
  A non-zero exit, because this one is allowed to be a gate. eval:editor is a
  score to read; this is a yes/no about whether the thing the customer sees
  matches the thing the assistant claimed, and there is no version of that
  being 「mostly」 true.
*/
process.exitCode = passed === ran.length ? 0 : 1;
