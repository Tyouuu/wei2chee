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
 *   npm run check:ai-cost
 *   npm run check:ai-cost -- --days 7
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
if (!URL_ || !SERVICE) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}

const argv = process.argv.slice(2);
const DAYS = Number(argv[argv.indexOf("--days") + 1]) || 30;

/* USD per million tokens, as of the date in the name. See the note above:
 * this is a stand-in to correct in one place, not a figure to quote. */
const PRICE_2026_08_27 = { "gpt-5.6-luna": { in: 1.25, out: 10 } };
const USD_TO_MYR_2026_08_27 = 4.2;

const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const since = new Date(Date.now() - DAYS * 86400_000).toISOString();
const { data, error } = await admin
  .from("ai_usage")
  .select("surface, model, prompt_tokens, completion_tokens, reasoning_tokens, account_id, created_at")
  .gte("created_at", since);

if (error) {
  // The table not existing is the likeliest failure and deserves its own
  // sentence -- the migration ships in the same change as this script.
  console.error(
    error.message.includes("does not exist")
      ? "ai_usage 这张表还没有建。先跑 npm run db:push。"
      : `读不到 ai_usage: ${error.message}`,
  );
  process.exit(1);
}

if (!data.length) {
  console.log(`\n最近 ${DAYS} 天没有任何 AI 呼叫。\n`);
  process.exit(0);
}

const bySurface = new Map();
const accounts = new Set();
for (const row of data) {
  accounts.add(row.account_id);
  const k = `${row.surface}·${row.model}`;
  const acc = bySurface.get(k) ?? { calls: 0, in: 0, out: 0, reasoning: 0, model: row.model };
  acc.calls += 1;
  acc.in += row.prompt_tokens ?? 0;
  // Reasoning tokens are billed as output and are NOT included in
  // completion_tokens by every provider build -- counted separately here and
  // added to the output side, so the estimate does not quietly under-report
  // the setting both callers actually run at.
  acc.out += row.completion_tokens ?? 0;
  acc.reasoning += row.reasoning_tokens ?? 0;
  bySurface.set(k, acc);
}

const money = (usd) => `US$${usd.toFixed(2)} ≈ RM${(usd * USD_TO_MYR_2026_08_27).toFixed(2)}`;

let totalUsd = 0;
const rows = [];
for (const [k, v] of bySurface) {
  const price = PRICE_2026_08_27[v.model];
  const usd = price
    ? (v.in / 1e6) * price.in + ((v.out + v.reasoning) / 1e6) * price.out
    : NaN;
  if (!Number.isNaN(usd)) totalUsd += usd;
  rows.push([
    k,
    String(v.calls),
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
  `⚠️ 价格是 2026-08-27 的（US$${PRICE_2026_08_27["gpt-5.6-luna"].in}/${PRICE_2026_08_27["gpt-5.6-luna"].out} 每百万 token，` +
    `US$1 = RM${USD_TO_MYR_2026_08_27}）。token 数是真的，钱是算出来的 —— 对帐单请以 OpenAI 为准。`,
);
console.log("");
