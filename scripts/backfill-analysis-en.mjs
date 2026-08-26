/**
 * Fills in the ENGLISH SIDE of analyses written before it existed.
 *
 * Two fields, added on two different dates and for the same reason: the system
 * we build speaks English by default while the owner answers the questionnaire
 * in Chinese, so anything the analysis writes that ends up ON THE CUSTOMER'S
 * OWN SCREEN needs both languages.
 *
 *   summary_en             the one-line summary under the dashboard heading
 *   bottlenecks[].title_en the problem named as the projects page's subtitle
 *
 * The second was found on 2026-08-26 by walking the live English portal: the
 * page read 「Watch this: 报价追不动」, an English prefix welded to a Chinese
 * phrase. The builder now refuses that pairing and falls back to a generic
 * line, which is correct and is also a loss -- the generic line is the one
 * sentence on that page that is not about this business. This is how the row
 * gets its own words back.
 *
 * WHY IT IS A SCRIPT AND NOT A MIGRATION. A migration is SQL and this needs a
 * model: the value is one sentence of business English about a specific
 * business, and there is no SQL expression that produces it. It is also a write
 * over customers' generated content, which is not the kind of thing that should
 * happen automatically on a deploy — it runs when somebody decides to run it,
 * and it says what it is about to do first.
 *
 * WHY IT TRANSLATES RATHER THAN RE-ANALYSES. Re-running the questionnaire would
 * produce a NEW analysis: different modules, a different workflow, possibly a
 * different enquiry destination — and the customer's system was built from the
 * old one. The Chinese sentence they already have is the sentence they agreed
 * with; this is the same sentence in the other language, and nothing else in
 * the row is touched.
 *
 *   npm run backfill:analysis-en             # says what it would do
 *   npm run backfill:analysis-en -- --write  # does it
 *
 * Needs SUPABASE_SERVICE_ROLE_KEY and OPENAI_API_KEY in .env.local. The service
 * key because this crosses every account, which is exactly why it is a script a
 * person runs and not an endpoint anything can call.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";

// .env.local rather than a shell export, and read by hand rather than through
// dotenv: it is where this project's keys live and it is what every other
// script here reads (see eval-analysis.mjs). An existing environment variable
// always wins, so CI can override without editing a file.
for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const WRITE = process.argv.includes("--write");

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
);

const { data: rows, error } = await supabase
  .from("analysis_results")
  .select("id, summary, summary_en, bottlenecks, generated_at")
  .order("generated_at", { ascending: true });

if (error) {
  console.error("could not read analyses:", error.message);
  process.exit(1);
}

/** A bottleneck list is stale when any entry is missing its English name. */
const bottlenecksNeedEn = (bs) =>
  Array.isArray(bs) && bs.some((b) => b && b.title && !String(b.title_en ?? "").trim());

const todo = rows.filter(
  (r) => (r.summary && !r.summary_en) || bottlenecksNeedEn(r.bottlenecks),
);

if (!todo.length) {
  console.log("Nothing to do — every analysis already has its English side.");
  process.exit(0);
}

console.log(`${todo.length} of ${rows.length} analyses are missing part of their English side.`);
for (const r of todo.slice(0, 10)) {
  const want = [
    r.summary && !r.summary_en ? "summary" : null,
    bottlenecksNeedEn(r.bottlenecks) ? `${r.bottlenecks.length} bottleneck title(s)` : null,
  ].filter(Boolean);
  console.log(`  ${r.generated_at.slice(0, 10)}  ${want.join(" + ")}  ${r.summary ?? ""}`);
}
if (todo.length > 10) console.log(`  … and ${todo.length - 10} more`);

if (!WRITE) {
  console.log("\nDry run. Pass --write to fill them in.");
  process.exit(0);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// The same voice the analysis prompt asks for, stated again here because these
// calls do not go through it: plain business English for a Malaysian SME owner,
// nothing added.
const say = async (system, user) => {
  const res = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    temperature: 0,
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
  });
  const out = res.choices[0]?.message?.content?.trim();
  if (!out) throw new Error("empty reply");
  return out;
};

const SUMMARY_VOICE =
  "You translate one sentence of Chinese business analysis into plain English " +
  "for a Malaysian small-business owner. Keep it to one sentence, under 90 " +
  "characters. No marketing language, no exclamation marks, no added advice. " +
  "Reply with the sentence only.";

// A bottleneck title is a LABEL, not a sentence. It is printed as a page
// subtitle after the words "Watch this:", so a translated clause would read as
// a paragraph fragment on the customer's screen.
const TITLE_VOICE =
  "You translate a short Chinese label naming a business problem into English. " +
  "2 to 5 words, no full stop, no quotes. It appears as a heading in business " +
  "software. Reply with the label only.";

let done = 0;
let failed = 0;
for (const r of todo) {
  try {
    const patch = {};

    if (r.summary && !r.summary_en) {
      patch.summary_en = await say(SUMMARY_VOICE, r.summary);
    }

    if (bottlenecksNeedEn(r.bottlenecks)) {
      // Rewritten as a whole array rather than element-wise: `bottlenecks` is
      // one jsonb value, and every entry keeps everything it already had.
      patch.bottlenecks = [];
      for (const b of r.bottlenecks) {
        patch.bottlenecks.push(
          b && b.title && !String(b.title_en ?? "").trim()
            ? { ...b, title_en: await say(TITLE_VOICE, b.title) }
            : b,
        );
      }
    }

    const { error: upErr } = await supabase
      .from("analysis_results")
      .update(patch)
      .eq("id", r.id);
    if (upErr) throw new Error(upErr.message);

    done += 1;
    if (patch.summary_en) console.log(`  ✓ ${r.summary}\n    ${patch.summary_en}`);
    for (const b of patch.bottlenecks ?? []) console.log(`  ✓ ${b.title} → ${b.title_en}`);
  } catch (e) {
    failed += 1;
    // Keep going. One row that will not translate is not a reason to leave the
    // rest of the table half-filled.
    console.log(`  ✗ ${r.id}: ${String(e).slice(0, 120)}`);
  }
}

console.log(`\n${done} filled in, ${failed} failed.`);
