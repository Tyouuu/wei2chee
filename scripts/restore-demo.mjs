/**
 * 把 demo 站放回去。
 *
 * ── WHY THIS EXISTS ───────────────────────────────────────────────────────
 *
 * `shoot:skeletons` and `shoot:photo` both hand the demo project's website
 * page back its ungenerated state for the length of a run, and both put it
 * back in a `finally`. A `finally` does not run if the process is killed --
 * Ctrl+C at the wrong second, a closed terminal, a machine that sleeps -- and
 * the page it would have restored is the one the founder opens to show people.
 * Left alone it reads as broken software rather than as an interrupted script.
 *
 * Both scripts already write the original values to disk BEFORE touching
 * anything, and neither overwrites an existing backup, precisely so that the
 * run which cannot reach its `finally` is the run whose backup survives. What
 * was missing was a command to put it back without hand-writing a query.
 *
 *   npm run restore:demo            # report what is on disk vs what is live
 *   npm run restore:demo -- --write # put it back
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, existsSync } from "node:fs";

const WRITE = process.argv.includes("--write");
const BACKUPS = [".screenshots/skeletons/restore.json", ".screenshots/photo/restore.json"];

const env = {};
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i < 1) continue;
  env[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
}
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const found = BACKUPS.filter(existsSync);
if (!found.length) {
  console.log("no backup on disk -- nothing to restore");
  process.exit(0);
}

/* THE NEWEST BACKUP WINS, not the first one found. Both scripts can leave a
   file behind; the one written last is the one describing the state before the
   most recent interruption. */
const saved = found
  .map((f) => ({ f, ...JSON.parse(readFileSync(f, "utf8")) }))
  .sort((a, b) => (a.f < b.f ? 1 : -1))[0];

const { data: page } = await db
  .from("project_pages")
  .select("id,layout_json")
  .eq("id", saved.pageId)
  .single();

const liveBlocks = Object.keys(page?.layout_json ?? {}).length;
const savedBlocks = Object.keys(saved.layout_json ?? {}).length;
console.log("backup      :", saved.f);
console.log("saved layout:", savedBlocks ? `${savedBlocks} keys` : "EMPTY");
console.log("live layout :", liveBlocks ? `${liveBlocks} keys` : "EMPTY  <- the demo site is 404ing");
if (saved.style) console.log("saved style :", saved.style);

if (!WRITE) {
  console.log("\n(dry run -- pass --write to put it back)");
  process.exit(0);
}

await db.from("project_pages").update({ layout_json: saved.layout_json }).eq("id", saved.pageId);
if (saved.projectId && saved.style) {
  await db.from("projects").update({ style: saved.style }).eq("id", saved.projectId);
}
console.log("\nrestored.");
