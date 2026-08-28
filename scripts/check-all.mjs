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

  // ── needs `npm run dev` on :3000 ────────────────────────────────────────
  { name: "english", cmd: "npm", args: ["run", "check:en"], slow: true },
  { name: "reachable", cmd: "npm", args: ["run", "check:reachable"], slow: true },
  { name: "contrast", cmd: "npm", args: ["run", "check:contrast"], slow: true },
  { name: "print", cmd: "npm", args: ["run", "check:print"], slow: true },
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
