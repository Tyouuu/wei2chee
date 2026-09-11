/**
 * 一次跑完所有的关，把结果并成一张表。
 *
 * WHY THIS EXISTS. On 2026-08-28 the one-time style choice was found broken —
 * for a week. The screen a customer lands on straight after signing up returned
 * an error, and `npm run check:isolation` had been PRINTING that error the
 * whole time. Nothing read it, because not one of the eight check:* scripts is
 * called by any other command. Eight gates, each perfectly capable, none of
 * them on a path anyone walks.
 *
 * A gate nobody runs is not a gate. This is the path.
 *
 *   npm run check            # everything that does not need a browser session
 *   npm run check -- --all   # add the slow browser walks too
 *
 * WHY THE SPLIT. Some of these drive a real Chromium through a real login and
 * take minutes; some are seconds. Putting the slow ones behind a flag is what
 * keeps the fast set something you actually run, and a fast set that gets run
 * beats a complete set that does not — which is the whole lesson above.
 *
 * WHY IT KEEPS GOING AFTER A FAILURE. A stop-on-first-error run tells you about
 * one broken gate and hides the rest, and today's example was four failures in
 * one script at once. Everything runs; the summary is the point.
 */
import { spawnSync } from "node:child_process";

const GATES = [
  // ── fast, no browser ────────────────────────────────────────────────────
  { name: "types", cmd: "npx", args: ["tsc", "--noEmit"], slow: false },
  { name: "test", cmd: "npx", args: ["vitest", "run"], slow: false },
  { name: "lint", cmd: "npx", args: ["eslint", "."], slow: false },
  { name: "registers", cmd: "npm", args: ["run", "check:registers"], slow: false },
  { name: "upstream", cmd: "npm", args: ["run", "check:upstream"], slow: false },

  /* Not a defect list — the things the founder has to supply before anyone is
     invited in. Exits 0 on purpose (see the script) so it reports without
     blocking a business that does not exist yet. */
  { name: "launch", cmd: "npm", args: ["run", "check:launch"], slow: false },

  /* Talks to the database with the service role and creates two throwaway
     accounts. Not slow, and it is the one that caught the style choice. */
  { name: "isolation", cmd: "npm", args: ["run", "check:isolation"], slow: false },

  /* ── 2026-09-11: the other 95 gates ──────────────────────────────────────
     Same lesson as 2026-08-28, one order of magnitude bigger: 103 check:*
     scripts existed in package.json and only 8 were ever run by this file.
     Every one of these is a real ruler — real login, real RPC calls, a
     throwaway account cleaned up at the end — built and pushed green at the
     time, then never wired to the one command anyone actually runs before
     calling something done. Found by diffing package.json's "check:*" keys
     against this file's own source text, not by memory. */
  { name: "account-deletion", cmd: "npm", args: ["run", "check:account-deletion"], slow: false },
  { name: "accounts", cmd: "npm", args: ["run", "check:accounts"], slow: false },
  { name: "address", cmd: "npm", args: ["run", "check:address"], slow: false },
  { name: "ai-cost", cmd: "npm", args: ["run", "check:ai-cost"], slow: false },
  { name: "alerts", cmd: "npm", args: ["run", "check:alerts"], slow: false },
  { name: "analyze", cmd: "npm", args: ["run", "check:analyze"], slow: false },
  { name: "appointment-audit", cmd: "npm", args: ["run", "check:appointment-audit"], slow: false },
  { name: "arrival", cmd: "npm", args: ["run", "check:arrival"], slow: false },
  { name: "audit-actor", cmd: "npm", args: ["run", "check:audit-actor"], slow: false },
  { name: "backbar", cmd: "npm", args: ["run", "check:backbar"], slow: false },
  { name: "batches", cmd: "npm", args: ["run", "check:batches"], slow: false },
  { name: "bookings", cmd: "npm", args: ["run", "check:bookings"], slow: false },
  { name: "branch-stock", cmd: "npm", args: ["run", "check:branch-stock"], slow: false },
  { name: "claims", cmd: "npm", args: ["run", "check:claims"], slow: false },
  { name: "class-clashes", cmd: "npm", args: ["run", "check:class-clashes"], slow: false },
  { name: "class-fees", cmd: "npm", args: ["run", "check:class-fees"], slow: false },
  { name: "classes", cmd: "npm", args: ["run", "check:classes"], slow: false },
  { name: "clockin", cmd: "npm", args: ["run", "check:clockin"], slow: false },
  { name: "closable", cmd: "npm", args: ["run", "check:closable"], slow: false },
  { name: "commission-history", cmd: "npm", args: ["run", "check:commission-history"], slow: false },
  { name: "consent", cmd: "npm", args: ["run", "check:consent"], slow: false },
  { name: "console", cmd: "npm", args: ["run", "check:console"], slow: false },
  { name: "contracts", cmd: "npm", args: ["run", "check:contracts"], slow: false },
  { name: "counter", cmd: "npm", args: ["run", "check:counter"], slow: false },
  { name: "delivery", cmd: "npm", args: ["run", "check:delivery"], slow: false },
  { name: "delivery-note", cmd: "npm", args: ["run", "check:delivery-note"], slow: false },
  { name: "deposits", cmd: "npm", args: ["run", "check:deposits"], slow: false },
  { name: "export", cmd: "npm", args: ["run", "check:export"], slow: false },
  { name: "family", cmd: "npm", args: ["run", "check:family"], slow: false },
  { name: "follow-ups", cmd: "npm", args: ["run", "check:follow-ups"], slow: false },
  { name: "handoff", cmd: "npm", args: ["run", "check:handoff"], slow: false },
  { name: "kitchen", cmd: "npm", args: ["run", "check:kitchen"], slow: false },
  { name: "less-typing", cmd: "npm", args: ["run", "check:less-typing"], slow: false },
  { name: "loyalty", cmd: "npm", args: ["run", "check:loyalty"], slow: false },
  { name: "makeup", cmd: "npm", args: ["run", "check:makeup"], slow: false },
  { name: "memory", cmd: "npm", args: ["run", "check:memory"], slow: false },
  { name: "messages", cmd: "npm", args: ["run", "check:messages"], slow: false },
  { name: "naming", cmd: "npm", args: ["run", "check:naming"], slow: false },
  { name: "nudges", cmd: "npm", args: ["run", "check:nudges"], slow: false },
  { name: "page-deps", cmd: "npm", args: ["run", "check:page-deps"], slow: false },
  { name: "party-portal", cmd: "npm", args: ["run", "check:party-portal"], slow: false },
  { name: "party-value", cmd: "npm", args: ["run", "check:party-value"], slow: false },
  { name: "payables", cmd: "npm", args: ["run", "check:payables"], slow: false },
  { name: "payment", cmd: "npm", args: ["run", "check:payment"], slow: false },
  { name: "payroll", cmd: "npm", args: ["run", "check:payroll"], slow: false },
  { name: "period-lock", cmd: "npm", args: ["run", "check:period-lock"], slow: false },
  { name: "product-performance", cmd: "npm", args: ["run", "check:product-performance"], slow: false },
  { name: "public-booking", cmd: "npm", args: ["run", "check:public-booking"], slow: false },
  { name: "purchase-match", cmd: "npm", args: ["run", "check:purchase-match"], slow: false },
  { name: "recall", cmd: "npm", args: ["run", "check:recall"], slow: false },
  { name: "reconcile", cmd: "npm", args: ["run", "check:reconcile"], slow: false },
  { name: "records", cmd: "npm", args: ["run", "check:records"], slow: false },
  { name: "security-grants", cmd: "npm", args: ["run", "check:security-grants"], slow: false },
  { name: "complete-visit", cmd: "npm", args: ["run", "check:complete-visit"], slow: false },
  { name: "till", cmd: "npm", args: ["run", "check:till"], slow: false },
  { name: "recurring", cmd: "npm", args: ["run", "check:recurring"], slow: false },
  { name: "referrals", cmd: "npm", args: ["run", "check:referrals"], slow: false },
  { name: "regulars", cmd: "npm", args: ["run", "check:regulars"], slow: false },
  { name: "rentals", cmd: "npm", args: ["run", "check:rentals"], slow: false },
  { name: "returns", cmd: "npm", args: ["run", "check:returns"], slow: false },
  { name: "reviews", cmd: "npm", args: ["run", "check:reviews"], slow: false },
  { name: "rooms", cmd: "npm", args: ["run", "check:rooms"], slow: false },
  { name: "rota", cmd: "npm", args: ["run", "check:rota"], slow: false },
  { name: "self-cancel", cmd: "npm", args: ["run", "check:self-cancel"], slow: false },
  { name: "serials", cmd: "npm", args: ["run", "check:serials"], slow: false },
  { name: "service-performance", cmd: "npm", args: ["run", "check:service-performance"], slow: false },
  { name: "shared-record", cmd: "npm", args: ["run", "check:shared-record"], slow: false },
  { name: "signoff", cmd: "npm", args: ["run", "check:signoff"], slow: false },
  { name: "site-identity", cmd: "npm", args: ["run", "check:site-identity"], slow: false },
  { name: "staff", cmd: "npm", args: ["run", "check:staff"], slow: false },
  { name: "staff-prices", cmd: "npm", args: ["run", "check:staff-prices"], slow: false },
  { name: "statement", cmd: "npm", args: ["run", "check:statement"], slow: false },
  { name: "supplier-returns", cmd: "npm", args: ["run", "check:supplier-returns"], slow: false },
  { name: "tables", cmd: "npm", args: ["run", "check:tables"], slow: false },
  { name: "tax", cmd: "npm", args: ["run", "check:tax"], slow: false },
  { name: "term", cmd: "npm", args: ["run", "check:term"], slow: false },
  { name: "timetable", cmd: "npm", args: ["run", "check:timetable"], slow: false },
  { name: "tips", cmd: "npm", args: ["run", "check:tips"], slow: false },
  { name: "transfer", cmd: "npm", args: ["run", "check:transfer"], slow: false },
  { name: "treatments", cmd: "npm", args: ["run", "check:treatments"], slow: false },
  { name: "vehicles", cmd: "npm", args: ["run", "check:vehicles"], slow: false },
  { name: "visit", cmd: "npm", args: ["run", "check:visit"], slow: false },
  { name: "visit-lines", cmd: "npm", args: ["run", "check:visit-lines"], slow: false },
  { name: "visit-photos", cmd: "npm", args: ["run", "check:visit-photos"], slow: false },
  { name: "walkin", cmd: "npm", args: ["run", "check:walkin"], slow: false },
  { name: "workdays", cmd: "npm", args: ["run", "check:workdays"], slow: false },

  // ── needs `npm run dev` on :3000 ────────────────────────────────────────
  { name: "english", cmd: "npm", args: ["run", "check:en"], slow: true },
  { name: "reachable", cmd: "npm", args: ["run", "check:reachable"], slow: true },
  { name: "contrast", cmd: "npm", args: ["run", "check:contrast"], slow: true },
  { name: "print", cmd: "npm", args: ["run", "check:print"], slow: true },
  { name: "ambient", cmd: "npm", args: ["run", "check:ambient"], slow: true },
  { name: "anchors", cmd: "npm", args: ["run", "check:anchors"], slow: true },
  { name: "answers", cmd: "npm", args: ["run", "check:answers"], slow: true },
  { name: "ask-photo", cmd: "npm", args: ["run", "check:ask-photo"], slow: true },
  { name: "consistency", cmd: "npm", args: ["run", "check:consistency"], slow: true },
  { name: "from-photo", cmd: "npm", args: ["run", "check:from-photo"], slow: true },
  { name: "front-door", cmd: "npm", args: ["run", "check:front-door"], slow: true },
  { name: "motion", cmd: "npm", args: ["run", "check:motion"], slow: true },
  { name: "receipt", cmd: "npm", args: ["run", "check:receipt"], slow: true },
  { name: "sticky", cmd: "npm", args: ["run", "check:sticky"], slow: true },
  { name: "table-search", cmd: "npm", args: ["run", "check:table-search"], slow: true },
  { name: "tell", cmd: "npm", args: ["run", "check:tell"], slow: true },
  { name: "work-ai", cmd: "npm", args: ["run", "check:work-ai"], slow: true },
];

const all = process.argv.includes("--all");
const wanted = GATES.filter((g) => all || !g.slow);

const rows = [];
for (const g of wanted) {
  process.stdout.write(`  ${g.name.padEnd(11)} … `);
  const started = Date.now();
  const r = spawnSync(g.cmd, g.args, { encoding: "utf8", shell: true });
  const secs = ((Date.now() - started) / 1000).toFixed(0);
  const ok = r.status === 0;
  /* The last non-empty line, because that is where every one of these scripts
     puts its verdict — "23 passed, 0 failed", "0 Chinese strings", and so on. */
  const out = `${r.stdout ?? ""}${r.stderr ?? ""}`.trim().split("\n");
  const last = [...out].reverse().find((l) => l.trim()) ?? "";
  rows.push({ name: g.name, ok, secs, last: last.trim().slice(0, 88) });
  console.log(`${ok ? "ok  " : "FAIL"}  ${secs}s`);
}

console.log("");
for (const r of rows) {
  console.log(`${r.ok ? "  ok  " : "  FAIL"} ${r.name.padEnd(11)} ${r.secs.padStart(4)}s  ${r.last}`);
}

const failed = rows.filter((r) => !r.ok);
console.log(
  `\n${rows.length - failed.length} of ${rows.length} gates pass` +
    (all ? "" : "  ·  add --all for the browser walks (english, reachable, contrast, print)"),
);
if (failed.length) {
  console.log(`\nRun these on their own to read the detail:`);
  for (const f of failed) console.log(`  npm run check:${f.name === "types" ? "…tsc" : f.name}`);
}
process.exit(failed.length ? 1 : 0);
