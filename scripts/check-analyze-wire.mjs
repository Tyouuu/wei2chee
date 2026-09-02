/**
 * 问卷那条线，从头到尾真的走一次。
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * `ai_usage` was built to answer one question -- 「它是不是坏了」 -- and for its
 * first three days it answered wrongly, because `record_ai_usage` returned
 * early when `auth.uid()` was null and the questionnaire runs on the landing
 * page BEFORE anybody has an account. Seventeen real questionnaires, zero rows,
 * and a report that read like a quiet week.
 *
 * That is fixed. What is not covered is the fix itself: `eval:analysis` calls
 * the model directly and never touches the route, so nothing in this repository
 * walks the line a stranger walks —
 *
 *   POST /api/analyze  →  a lead row  →  a model call  →  a LEDGER ROW
 *
 * — and that last arrow is the one that was broken. A wire proven once by hand
 * is a wire that will break again unnoticed.
 *
 * ── COST, AND WHY IT IS PAID ──────────────────────────────────────────────
 *
 * One real model call, about 30 seconds. A cheaper version could insert the
 * ledger row directly and prove nothing: what failed was not the table, it was
 * the ROUTE not reaching it. The only honest test of a wire is current.
 *
 * ⚠️ It cleans up after itself -- the lead and the row it created are deleted,
 * because a ruler that leaves fake customers in the founder's own numbers costs
 * more than it is worth. `eval:browser` had to learn this the hard way.
 *
 *   npm run dev             (in another terminal)
 *   npm run check:analyze
 */
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const BASE = process.env.BASE ?? "http://localhost:3000";
const DB = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const head = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json", Connection: "close" };

let bad = 0;
const check = (label, ok, detail = "") => {
  if (!ok) bad++;
  console.log(`  ${ok ? "ok  " : "BAD "} ${label}${detail ? `  ${detail}` : ""}`);
};

const rest = async (path, init) => {
  const r = await fetch(`${DB}/rest/v1/${path}`, { headers: head, ...init });
  const t = await r.text();
  return t ? JSON.parse(t) : null;
};

const industries = await rest("industries?select=id,slug&limit=1");
if (!industries?.length) {
  console.log("BAD  no industries in the database — nothing to ask about");
  process.exit(1);
}
const industry = industries[0];

const started = Date.now();
const res = await fetch(`${BASE}/api/analyze`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    industryId: industry.id,
    language: "en",
    answers: {
      current_tool: "WhatsApp",
      time_sink: "Chasing quotes",
      new_customer_flow:
        "Renovation contractor, five workers, quotes go out on WhatsApp and nobody chases them.",
    },
  }),
});
const took = Date.now() - started;
const body = await res.json().catch(() => null);

console.log(`\n问卷 → 分析 → 帐本   (${(took / 1000).toFixed(1)}s)\n`);
check("the route answered", res.ok, `status ${res.status}`);
check("it came back with a lead", Boolean(body?.leadId), body?.leadId ?? "");
check("and an analysis", Boolean(body?.analysis?.summary));

const leadId = body?.leadId;
let rows = [];
if (leadId) {
  // The row is written in a `finally`, after the response has been composed.
  await new Promise((r) => setTimeout(r, 2500));
  rows = (await rest(`ai_usage?select=surface,outcome,took_ms,account_id,lead_id&lead_id=eq.${leadId}`)) ?? [];
}
check("the ledger has a row for it", rows.length === 1, `${rows.length} row(s)`);

const row = rows[0];
if (row) {
  check("filed under the questionnaire", row.surface === "analyze", row.surface);
  check("marked as a success", row.outcome === "ok", String(row.outcome));
  /* THE FIELD THE OLD GUARD TRIPPED ON. A stranger on the landing page has no
     account, and the first version of record_ai_usage refused to write a row
     without one. Null here is the whole point. */
  check("with no account, which is correct", row.account_id === null, String(row.account_id));
  check("and a duration", typeof row.took_ms === "number" && row.took_ms > 0, `${row.took_ms}ms`);
}

/* Cleaned up in the order the foreign keys allow: the row points at the lead. */
if (leadId) {
  await fetch(`${DB}/rest/v1/ai_usage?lead_id=eq.${leadId}`, { method: "DELETE", headers: head });
  await fetch(`${DB}/rest/v1/leads?id=eq.${leadId}`, { method: "DELETE", headers: head });
  const left = (await rest(`leads?select=id&id=eq.${leadId}`)) ?? [];
  check("test data cleaned up", left.length === 0, `${left.length} left`);
}

console.log(bad ? `\n${bad} wrong` : "\nthe whole line works");
process.exitCode = bad ? 1 : 0;
