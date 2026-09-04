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
/** 第二笔，让总额不等於任何单独一笔 —— 收据那一半才验得到。 */
const MATE = `对帐测试乙-${Date.now().toString().slice(-6)}`;
const MATE_AMOUNT = 1234;
const TOTAL = AMOUNT + MATE_AMOUNT;

/* ── 谁欠他钱 ────────────────────────────────────────────────────────────
   两个欠款人，**故意一个欠得多、一个欠得久**：

     大的  RM 9,800，五天前的单
     旧的  RM   350，两百天前的单

   一个只会照金额排的助手，会把「谁欠我最久」答成大的那一个。
   这两笔的存在就是为了让那一题有一个会错的答案。 */
const DEBT_BIG = { mark: `欠款测试甲-${Date.now().toString().slice(-6)}`, rm: 9800, daysAgo: 5 };
const DEBT_OLD = { mark: `欠款测试乙-${Date.now().toString().slice(-6)}`, rm: 350, daysAgo: 200 };
/** 建过的对象跟单据，清理的时候按 id 删 —— 有单指着的客户删不掉，所以单先走。 */
const madeParties = [];
const madeDocs = [];

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
  /* TWO receipts, not one. With a single row the total IS that row, so an
     assistant that never names the rows still looks right -- and the receipt
     under the total, which is the whole point of listing them, goes untested. */
  const seeded = await fetch(`${DB}/rest/v1/ledger_entries`, {
    method: "POST",
    headers: { ...head, Prefer: "return=representation" },
    body: JSON.stringify([
      {
        project_id: pid, module_key: "payments",
        doc_no: `CHK-${Date.now().toString().slice(-8)}`,
        party: MARK, direction: "in", amount_cents: AMOUNT * 100, entry_on: myt,
      },
      {
        project_id: pid, module_key: "payments",
        doc_no: `CHK-${(Date.now() + 1).toString().slice(-8)}`,
        party: MATE, direction: "in", amount_cents: MATE_AMOUNT * 100, entry_on: myt,
      },
    ]),
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
    await p.goto(`${BASE}/zh/portal/dashboard?design=1`, { waitUntil: "networkidle", timeout: 180000 });
    const money = await ask(p, "这个月收了多少", "dashboard");
    console.log(`\n问：这个月收了多少\n答：${money.said}`);

    /* 5555 会被格式化成 5,555。两种写法都收 —— 千分位插在倒数第三位。 */
    const digits = String(TOTAL);
    const want = new RegExp(`${digits.slice(0, -3)},?${digits.slice(-3)}`);
    if (want.test(money.said)) pass("答得出这个月收了多少", `引到了 ${TOTAL}`);
    else fail("答得出这个月收了多少", `没有引到那个总额：「${money.said}」`);

    /*
      收据那一半，而这一条我先写错过一次，值得写下来。

      第一版硬性要求「问总额的时候一定要顺便列出那几笔」，跑起来红了 ——
      而去探了之后，那几笔**明明有送到模型面前**：问「分别是谁付的」，它答
      「探针甲付 RM 3,000，探针乙付 RM 1,000」，一个不漏。

      所以红的不是产品，是我把自己的偏好写成了正确答案。「这个月收了多少」
      问的就是一个数字，回一个数字是对的；这个仓库另一条规矩还写着
      「改动一看就懂就不要解释」。

      改成量真正的那件事：**他要得到明细的时候，要得到。**
      硬性守的是能力；顺不顺便列出来只印出来看，不判它对错。
    */
    const detail = await ask(p, "这个月收了多少，分别是谁付的", "dashboard");
    console.log(`\n问：这个月收了多少，分别是谁付的\n答：${detail.said}`);
    const named = detail.said.includes(MARK) || detail.said.includes(MATE);
    if (named) pass("要得到明细的时候，要得到");
    else fail("要得到明细的时候，要得到", `没有点到任何一笔：「${detail.said}」`);

    const volunteered = money.said.includes(MARK) || money.said.includes(MATE);
    console.log(`   （只问总额的时候有没有顺便列：${volunteered ? "有" : "没有"} —— 这一栏只看，不判）`);

    if (money.applied > 0) fail("问问题不准动页面", `动了 ${money.applied} 处`);
    else pass("问问题不准动页面");
  }

  /* ── 二点五 · 谁欠他钱，谁欠最久 ───────────────────────────────────
     `party_debts` 从 20260904060000 起就算得出来，而它到 2026-09-05 只被
     **开单那一页**用来讲一句「他已经欠你 RM X」。整家的那一份没有任何地方
     问得出来 —— 这一段就是那条线接上之后的证据。 */
  const dayBefore = (n) =>
    new Date(Date.now() + 8 * 3600 * 1000 - n * 86400 * 1000).toISOString().slice(0, 10);

  for (const d of [DEBT_BIG, DEBT_OLD]) {
    const [party] = await fetch(`${DB}/rest/v1/directory_entries`, {
      method: "POST",
      headers: { ...head, Prefer: "return=representation" },
      body: JSON.stringify([{ project_id: pid, module_key: "customers", name: d.mark }]),
    }).then((r) => r.json());
    if (!party?.id) { fail("种得起一个欠钱的客户", `${d.mark} 建不起来`); break; }
    madeParties.push(party.id);
    const [doc] = await fetch(`${DB}/rest/v1/pipeline_records`, {
      method: "POST",
      headers: { ...head, Prefer: "return=representation" },
      body: JSON.stringify([{
        project_id: pid, module_key: "quotations",
        doc_no: `DBT-${Date.now().toString().slice(-8)}-${d.rm}`,
        title: `${d.mark} 的单`, party: d.mark, party_id: party.id,
        amount_cents: d.rm * 100, issued_on: dayBefore(d.daysAgo),
      }]),
    }).then((r) => r.json());
    if (doc?.id) madeDocs.push(doc.id);
  }

  if (madeDocs.length === 2) {
    pass("种得起两笔欠款", `${DEBT_BIG.rm} · ${DEBT_OLD.rm}`);

    const who = await ask(p, "谁欠我钱", "dashboard");
    console.log(`
问：谁欠我钱
答：${who.said}`);
    const bigMoney = /9,?800/.test(who.said);
    if (who.said.includes(DEBT_BIG.mark) && bigMoney)
      pass("答得出谁欠他钱", `点到了 ${DEBT_BIG.mark} 跟 RM 9,800`);
    else fail("答得出谁欠他钱", `「${who.said}」`);

    /* 🔴 这一条才是这一段真正在守的东西：欠最久的那一个**欠得最少**。
       一个照金额排的答案会答错，而那正是他要打电话的那个人。 */
    const oldest = await ask(p, "谁欠我最久", "dashboard");
    console.log(`
问：谁欠我最久
答：${oldest.said}`);
    if (oldest.said.includes(DEBT_OLD.mark))
      pass("欠最久的那一个不是欠最多的那一个", `点到了 ${DEBT_OLD.mark}`);
    else fail("欠最久的那一个不是欠最多的那一个", `「${oldest.said}」`);

    if (who.applied > 0) fail("问欠款不准动页面", `动了 ${who.applied} 处`);
    else pass("问欠款不准动页面");
  }

  /* ── 三 · 答不了的，要讲原因，而且不准编一个数字 ─────────────────── */
  /*
    ⚠️ 「不准给数字」是我第一版写的，而它是错的，而且是同一个毛病的第二次：
    拿一个代理指标去量真正要守的性质。

    实测它答的是「算不了利润，因为费用还不能挂到工作单上；**目前只能确认本月
    收款是 RM 5,555，不是利润**」—— 那是这一题最好的答案：拒绝了它不知道的，
    讲了原因，再给一个它确实知道的，而且**明写那不是利润**。判它红等於教产品
    在答不了的时候闭嘴。

    要守的从来不是「没有数字」，是「**没有编出来的数字**」。所以改成：
    答案里出现的每一个金额，都必须是我们真的给过它的那几个。
  */
  const known = [String(TOTAL), String(AMOUNT), String(MATE_AMOUNT)].map((d) =>
    d.length > 3 ? `${d.slice(0, -3)},?${d.slice(-3)}` : d,
  );
  for (const q of ["这个月赚多少", "库存还剩多少"]) {
    const r = await ask(p, q, "dashboard");
    console.log(`\n问：${q}\n答：${r.said}`);
    const amounts = r.said.match(/RM\s*[\d,]+/g) ?? [];
    const invented = amounts.filter(
      (a) => !known.some((k) => new RegExp(k).test(a.replace(/\s/g, ""))),
    );
    if (invented.length) fail(`答不了的不准编数字（${q}）`, `编了 ${invented.join(" · ")}`);
    else pass(`答不了的不准编数字（${q}）`, amounts.length ? `引了 ${amounts.join(" · ")}，都是真的` : "没给数字");
    if (r.said.length < 6) fail(`答不了的要讲原因（${q}）`, "太短，等於没讲");
    else pass(`答不了的要讲原因（${q}）`);
  }
} finally {
  /* 建过的一律删掉。留一笔在他自己的预览帐上，等於我们改了他的数字。 */
  /* 🔴 顺序：单先删，客户才删得掉 —— 有帐的客户是 on delete restrict，
     那条规矩 8-31 就立了，而这里正好是它第一次挡到我们自己。 */
  for (const id of madeDocs) {
    await fetch(`${DB}/rest/v1/pipeline_records?id=eq.${id}`, {
      method: "DELETE", headers: head,
    }).catch(() => {});
  }
  for (const id of madeParties) {
    await fetch(`${DB}/rest/v1/directory_entries?id=eq.${id}`, {
      method: "DELETE", headers: head,
    }).catch(() => {});
  }
  console.log(`清掉 ${madeDocs.length} 张单 · ${madeParties.length} 个客户`);

  const gone = await fetch(
    `${DB}/rest/v1/ledger_entries?or=(party.eq.${encodeURIComponent(MARK)},party.eq.${encodeURIComponent(MATE)})`,
    { method: "DELETE", headers: { ...head, Prefer: "return=representation" } },
  ).then((r) => r.json()).catch(() => []);
  console.log(`\n清掉 ${Array.isArray(gone) ? gone.length : 0} 笔测试资料`);
  await b.close();
}

const bad = rows.filter((r) => !r.ok).length;
console.log(`\n判：${rows.length - bad} 过 · ${bad} 没过`);
process.exit(bad ? 1 : 0);
