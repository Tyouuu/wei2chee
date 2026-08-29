/**
 * 这个 AI 花了多少钱。
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * Every model call in this product spends the founder's own OpenAI key: the
 * questionnaire analysis at signup, and every sentence typed into the editor.
 * Both sit behind auth, the editor is rate limited -- and nothing recorded what
 * any of it cost, so 「这个功能花我多少钱」 had no answer anybody here could
 * produce. `ai_usage` records it now; this reads it back.
 *
 * ── WHAT IT CANNOT TELL YOU ───────────────────────────────────────────────
 *
 * The real invoice. Prices change, and a price written next to code outlives
 * the code -- this repo was bitten by that five times in one day. So the rate
 * carries its date, the date is printed beside every figure, and the money is
 * clearly a calculation rather than a bill. Trust the token counts; treat the
 * ringgit as an estimate to sanity-check the invoice against.
 *
 * ── WHY PLAIN FETCH, AND WHY NO process.exit() ────────────────────────────
 *
 * Node 24 on Windows asserts inside libuv when a socket is still open at exit:
 * the numbers print correctly and the process then dies with code 127. A
 * checker that always reports failure teaches whoever runs it to ignore its
 * exit code, and then the day it fails for a real reason nobody notices. So
 * this asks PostgREST to hang up (Connection: close) and lets the process end
 * on its own.
 *
 *   npm run check:ai-cost
 *   npm run check:ai-cost -- --days 7
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;

const argv = process.argv.slice(2);
const DAYS = Number(argv[argv.indexOf("--days") + 1]) || 30;

/*
  READ OUT OF THE SOURCE, NOT COPIED.

  This script has no bundler and cannot import a .ts file, and a second copy of
  the model name is exactly the drift this repo keeps paying for: the day
  somebody changes the model, a copy here would silently price every call at
  the old model's rate while printing a confident total.
*/
const AI_MODEL = readFileSync(new URL("../lib/portal/ai-model.ts", import.meta.url), "utf8")
  .match(/export const AI_MODEL = "([^"]+)"/)[1];

/* USD per million tokens, as of the date in the name. See the note above:
 * this is a stand-in to correct in one place, not a figure to quote. */
const PRICE_2026_08_27 = { [AI_MODEL]: { in: 1.25, out: 10 } };
const USD_TO_MYR_2026_08_27 = 4.2;

const money = (usd) => `US$${usd.toFixed(2)} ≈ RM${(usd * USD_TO_MYR_2026_08_27).toFixed(2)}`;

async function main() {
  if (!URL_ || !SERVICE) {
    console.error("Missing Supabase env vars in .env.local");
    return 1;
  }

  const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
  const BASE_COLS = "surface,model,prompt_tokens,completion_tokens,reasoning_tokens,account_id,created_at";
  const HEALTH_COLS = ",outcome,took_ms";

  const pull = (cols) =>
    fetch(
      `${URL_}/rest/v1/ai_usage?select=${cols}&created_at=gte.${encodeURIComponent(since)}`,
      { headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Connection: "close" } },
    );

  let res = await pull(BASE_COLS + HEALTH_COLS);
  let degraded = false;

  if (!res.ok) {
    const body = await res.text();
    /*
      READ THE CODE, NOT THE SENTENCE.

      Postgres says 42P01 for a missing TABLE and 42703 for a missing COLUMN,
      and both render as 「... does not exist」. Matching on the words told
      somebody to run db:push for a table that was already there, on the day
      the health columns were added and not yet pushed -- a diagnostic tool
      giving a confidently wrong instruction, which is worse than one that
      gives none.
    */
    const code = (() => {
      try { return JSON.parse(body).code; } catch { return null; }
    })();

    if (code === "42703") {
      // The health columns are pending. Fall back to what the table DOES have
      // rather than refusing: a checker that stops working because a migration
      // has not been pushed yet is a checker nobody runs again.
      degraded = true;
      res = await pull(BASE_COLS);
    }

    if (!res.ok) {
      const b2 = degraded ? await res.text() : body;
      console.error(
        code === "42P01" || res.status === 404
          ? "ai_usage 这张表还没有建。先跑 npm run db:push。"
          : `读不到 ai_usage (${res.status}): ${b2.slice(0, 200)}`,
      );
      return 1;
    }
  }

  const data = await res.json();
  if (degraded) {
    console.log(
      "\n⚠️  失败率跟延迟还读不到：20260827050000 还没推。先跑 npm run db:push。",
    );
  }
  if (!data.length) {
    /*
      AN EMPTY LEDGER IS TWO DIFFERENT FACTS AND THIS USED TO PRINT ONE.

      「最近 N 天没有任何 AI 呼叫」 was returned as a success for three days
      while every questionnaire on the landing page ran, spent the founder's
      key, and wrote nothing -- because `record_ai_usage` returns early when
      there is no session and the visitor has not signed up yet (fixed in
      20260830010000). The instrument built to answer 「AI 坏了我们怎么知道」
      reported a quiet week.

      So before calling it quiet, ask something that MUST have produced a call.
      Every lead row is a questionnaire that reached the model. Leads in the
      window with no rows beside them is not silence, it is a severed wire, and
      it is the exact shape of the bug this check missed.
    */
    const leadRes = await fetch(
      `${URL_}/rest/v1/leads?select=id&created_at=gte.${encodeURIComponent(since)}`,
      {
        headers: {
          apikey: SERVICE,
          Authorization: `Bearer ${SERVICE}`,
          Connection: "close",
          Prefer: "count=exact",
          Range: "0-0",
        },
      },
    );
    const leads = leadRes.ok
      ? Number((leadRes.headers.get("content-range") ?? "").split("/")[1]) || 0
      : 0;

    if (leads > 0) {
      console.log(
        `\n🔴 最近 ${DAYS} 天有 ${leads} 份问卷，帐本里却一行都没有。\n` +
          `   问卷每一份都呼叫过模型，所以这不是「很安静」，是记帐那条线断了。\n` +
          `   先查 recordAiUsage 有没有把 leadId 传下去（app/api/analyze/route.ts）。\n`,
      );
      return 1;
    }
    console.log(`\n最近 ${DAYS} 天没有任何 AI 呼叫，也没有任何问卷 —— 是真的安静。\n`);
    return 0;
  }

  const bySurface = new Map();
  const accounts = new Set();
  for (const row of data) {
    accounts.add(row.account_id);
    const k = `${row.surface}·${row.model}`;
    const acc = bySurface.get(k) ?? {
      calls: 0, failed: 0, in: 0, out: 0, reasoning: 0, model: row.model, times: [],
    };
    acc.calls += 1;
    /* `outcome` arrives undefined against a database that has not taken the
       migration yet, and undefined must not read as a failure -- a checker
       that invents an outage is worse than one that reports none. */
    if (row.outcome === "failed") acc.failed += 1;
    if (typeof row.took_ms === "number") acc.times.push(row.took_ms);
    acc.in += row.prompt_tokens ?? 0;
    acc.out += row.completion_tokens ?? 0;
    /* Reasoning tokens are billed as output and never appear in the reply, so
     * leaving them out under-reports precisely the setting both callers run at
     * (reasoning_effort "high"). Kept in their own column so the split stays
     * visible, and added to the output side when costing. */
    acc.reasoning += row.reasoning_tokens ?? 0;
    bySurface.set(k, acc);
  }

  /*
    IS IT STILL WORKING -- printed FIRST, and above the money.

    The money is a monthly question. This is the one asked when something feels
    wrong, and until 2026-08-27 the only way to answer it was a customer
    saying so: failures wrote no row at all, so a table full of successes
    reported a healthy 100% while every call was falling over. Both AI routes
    now record what happened, so this can be read instead of guessed.

    A failure rate over a handful of calls is noise, so the count is printed
    beside it -- 「1 次里坏了 1 次」 is not 100% broken, and a bare percentage
    would say it was.
  */
  const allTimes = data.map((r) => r.took_ms).filter((t) => typeof t === "number").sort((a, b) => a - b);
  // Not 「0 failures」 when the column simply is not there. A checker reporting
  // health it cannot see is the failure mode this whole section exists to fix.
  const failed = degraded ? null : data.filter((r) => r.outcome === "failed").length;
  const sec = (ms) => `${(ms / 1000).toFixed(1)}s`;
  console.log(`
AI 还在正常吗 — 最近 ${DAYS} 天`);
  console.log(
    failed === null
      ? `  失败  读不到（欄位还没建）`
      : `  失败  ${data.length} 次里坏了 ${failed} 次` +
        (failed ? `  ← 看一下` : ""),
  );
  if (allTimes.length) {
    const at = (q) => allTimes[Math.min(allTimes.length - 1, Math.floor(allTimes.length * q))];
    console.log(
      `  他等了多久  中位 ${sec(at(0.5))} · p95 ${sec(at(0.95))} · 最慢 ${sec(allTimes[allTimes.length - 1])}`,
    );
  } else {
    console.log(
      `  他等了多久  还没有数据（这些行是计时上线之前写的）`,
    );
  }

  let totalUsd = 0;
  const rows = [];
  for (const [k, v] of bySurface) {
    const price = PRICE_2026_08_27[v.model];
    const usd = price ? (v.in / 1e6) * price.in + ((v.out + v.reasoning) / 1e6) * price.out : NaN;
    if (!Number.isNaN(usd)) totalUsd += usd;
    rows.push([
      k,
      v.failed ? `${v.calls} (坏 ${v.failed})` : String(v.calls),
      v.in.toLocaleString(),
      v.out.toLocaleString(),
      v.reasoning.toLocaleString(),
      Number.isNaN(usd) ? "价格未知" : money(usd),
    ]);
  }

  const head = ["", "次数", "输入", "输出", "其中推理", "估算"];
  const widths = head.map((h, i) =>
    Math.max([...h].length + 2, ...rows.map((r) => [...r[i]].length + 2)),
  );
  const line = (cells) => cells.map((c, i) => String(c).padEnd(widths[i])).join("");

  console.log(`\nAI 花了多少 — 最近 ${DAYS} 天 · ${accounts.size} 个账号\n`);
  console.log(line(head));
  for (const r of rows) console.log(line(r));
  console.log("");
  console.log(`合计估算  ${money(totalUsd)}`);
  console.log(`每个账号  ${money(totalUsd / accounts.size)}`);
  console.log("");
  console.log(
    `⚠️ 价格是 2026-08-27 的（US$${PRICE_2026_08_27[AI_MODEL].in}/${PRICE_2026_08_27[AI_MODEL].out} 每百万 token，` +
      `US$1 = RM${USD_TO_MYR_2026_08_27}）。token 数是真的，钱是算出来的 —— 对帐单请以 OpenAI 为准。`,
  );
  console.log("");
  return 0;
}

process.exitCode = await main();
