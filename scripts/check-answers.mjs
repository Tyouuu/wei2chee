/**
 * 助手答得出他自己的数字吗 —— 用真的身分，问真的问题。
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * The unit tests around lib/portal/live-answers.ts prove the BLOCK renders.
 * They cannot prove the block reaches the model, and in this repository that
 * gap has swallowed sixteen features. It swallowed this one too, for about an
 * hour: the first version of the wiring selected a column that does not exist
 * (`projects.business_context`), PostgREST failed the whole query for it, and
 * the route went on answering 200 with the design brief silently gone.
 *
 * tsc was clean. 814 tests passed. What found it was this file.
 *
 * ── WHAT IT DOES ──────────────────────────────────────────────────────────
 *
 * Seeds one real receipt, asks what the month came to, and checks the answer
 * quotes that amount. Then asks two things the product cannot know yet and
 * checks it says so WITH THE REASON and without inventing a figure.
 *
 * ⚠️ The receipt is written DIRECTLY, not through the assistant. The first
 * version asked the assistant to add it, which reads better and is worse: a
 * broken write would then make a working read look broken too, and the write
 * path already has 118 assertions of its own in check:records.
 *
 * ⚠️ IT WRITES TO THE DEMO ACCOUNT'S REAL BOOKS, and deletes what it wrote in
 * the finally block. A checker that leaves rows behind quietly changes the
 * numbers on the founder's own preview.
 */
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const DB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const head = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };
const BASE = process.env.BASE ?? "http://localhost:3000";

/** 一个不会跟他真的记录撞名的对方。清理的时候就靠它认。 */
const MARK = `对帐测试-${Date.now().toString().slice(-6)}`;
const AMOUNT = 4321;

const rows = [];
const fail = (name, why) => { rows.push({ name, ok: false, why }); console.log(`FAIL  ${name} — ${why}`); };
const pass = (name, note) => { rows.push({ name, ok: true, why: note }); console.log(`PASS  ${name}${note ? " — " + note : ""}`); };

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1500, height: 1000 } });

/** 问助手一句，回它讲的原话。走的是真的路由、真的 cookie。 */
async function ask(page, instruction, pageKey) {
  return page.evaluate(async ({ instruction, pageKey }) => {
    const r = await fetch("/api/portal/edit", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        instruction,
        pageKey,
        layout: { content: [], root: {} },
        pages: [
          { key: "dashboard", label: "总览" },
          { key: "payments", label: "收款" },
          { key: "customers", label: "客户" },
          { key: "quotations", label: "报价单" },
        ],
      }),
    });
    const j = await r.json().catch(() => null);
    return {
      status: r.status,
      said: j?.explanation ?? j?.error ?? "",
      applied: j?.applied ?? 0,
    };
  }, { instruction, pageKey });
}

try {
  await p.goto(`${BASE}/zh/login`, { waitUntil: "networkidle", timeout: 180000 });
  await p.fill('input[type="email"]', "tianyou.demo@formae.test");
  await p.fill('input[type="password"]', "FormaeDemo2026!");
  await p.click('button[type="submit"]');
  await p.waitForURL(/portal/, { timeout: 180000 });

  /* ── 一 · 种一笔真的收款 ───────────────────────────────────────────
     ⚠️ 直接写，不走助手。这一支验的是「答」，而「写」那一条
     check:records 已经有 118 条在守 —— 让这里也依赖写那条路，等於一个
     坏掉的写会让一个好的读看起来也坏了。 */
  const project = await fetch(
    `${DB}/rest/v1/projects?select=id,account_id&limit=50`,
    { headers: head },
  ).then((r) => r.json());
  const account = await fetch(
    `${DB}/rest/v1/accounts?email=eq.tianyou.demo@formae.test&select=id`,
    { headers: head },
  ).then((r) => r.json());
  const pid = project.find((x) => x.account_id === account[0]?.id)?.id;
  if (!pid) throw new Error("找不到 demo 帐号的专案");

  /* 马来西亚的今天，不是伺服器的。伺服器跑 UTC，而这一笔要落在他的这个月。 */
  const myt = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  const seeded = await fetch(`${DB}/rest/v1/ledger_entries`, {
    method: "POST",
    headers: { ...head, Prefer: "return=representation" },
    body: JSON.stringify({
      project_id: pid,
      module_key: "payments",
      doc_no: `CHK-${Date.now().toString().slice(-8)}`,
      party: MARK,
      direction: "in",
      amount_cents: AMOUNT * 100,
      entry_on: myt,
    }),
  }).then((r) => r.json());
  console.log(`\n种了一笔：${Array.isArray(seeded) ? seeded.length : 0} 笔 · ${JSON.stringify(seeded).slice(0, 160)}`);

  const check = await fetch(
    `${DB}/rest/v1/ledger_entries?party=eq.${encodeURIComponent(MARK)}&select=id,amount_cents`,
    { headers: head },
  ).then((r) => r.json());

  if (!Array.isArray(check) || !check.length) {
    fail("种得起一笔真的收款", "资料库里找不到那一笔 —— 后面每一条都不用问了");
  } else {
    pass("种得起一笔真的收款", `${check.length} 笔 · ${check[0].amount_cents} 分`);

    /* ── 二 · 问这个月收了多少，答案里要有那个数字 ─────────────────── */
    await p.goto(`${BASE}/zh/portal/dashboard`, { waitUntil: "networkidle", timeout: 180000 });
    const money = await ask(p, "这个月收了多少", "dashboard");
    console.log(`\n问：这个月收了多少\n答：${money.said}`);

    /* 4321 会被格式化成 4,321。两种写法都收。 */
    const shows = /4,?321/.test(money.said);
    if (shows) pass("答得出这个月收了多少", "引到了 4,321");
    else fail("答得出这个月收了多少", `没有引到那个数字：「${money.said}」`);

    if (money.applied > 0) fail("问问题不准动页面", `动了 ${money.applied} 处`);
    else pass("问问题不准动页面");
  }

  /* ── 三 · 答不了的，要讲原因，而且不准编一个数字 ─────────────────── */
  for (const q of ["这个月赚多少", "库存还剩多少"]) {
    const r = await ask(p, q, "dashboard");
    console.log(`\n问：${q}\n答：${r.said}`);
    if (/RM\s*[\d,]+/.test(r.said)) fail(`答不了的不准给数字（${q}）`, r.said);
    else pass(`答不了的不准给数字（${q}）`);
    if (r.said.length < 6) fail(`答不了的要讲原因（${q}）`, "太短，等於没讲");
    else pass(`答不了的要讲原因（${q}）`);
  }
} finally {
  /* 建过的一律删掉。留一笔在他自己的预览帐上，等於我们改了他的数字。 */
  const gone = await fetch(
    `${DB}/rest/v1/ledger_entries?party=eq.${encodeURIComponent(MARK)}`,
    { method: "DELETE", headers: { ...head, Prefer: "return=representation" } },
  ).then((r) => r.json()).catch(() => []);
  console.log(`\n清掉 ${Array.isArray(gone) ? gone.length : 0} 笔测试资料`);
  await b.close();
}

const bad = rows.filter((r) => !r.ok).length;
console.log(`\n判：${rows.length - bad} 过 · ${bad} 没过`);
process.exit(bad ? 1 : 0);
