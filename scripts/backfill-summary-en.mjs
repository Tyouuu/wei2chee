/**
 * Fills in `analysis_results.summary_en` for the analyses written before the
 * column existed.
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
 *   node scripts/backfill-summary-en.mjs           # says what it would do
 *   node scripts/backfill-summary-en.mjs --write   # does it
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
  .select("id, summary, summary_en, generated_at")
  .is("summary_en", null)
  .not("summary", "is", null)
  .order("generated_at", { ascending: true });

if (error) {
  console.error("could not read analyses:", error.message);
  process.exit(1);
}

if (!rows.length) {
  console.log("Nothing to do — every analysis already has an English summary.");
  process.exit(0);
}

console.log(`${rows.length} analyses have no English summary.`);
if (!WRITE) {
  for (const r of rows.slice(0, 10)) {
    console.log(`  ${r.generated_at.slice(0, 10)}  ${r.summary}`);
  }
  if (rows.length > 10) console.log(`  … and ${rows.length - 10} more`);
  console.log("\nDry run. Pass --write to fill them in.");
  process.exit(0);
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

let done = 0;
let failed = 0;
for (const r of rows) {
  try {
    const res = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            // The same voice the analysis prompt asks for, stated again here
            // because this call does not go through it: plain business English
            // for a Malaysian SME owner, one sentence, no marketing.
            "You translate one sentence of Chinese business analysis into plain " +
            "English for a Malaysian small-business owner. Keep it to one " +
            "sentence, under 90 characters. No marketing language, no " +
            "exclamation marks, no added advice. Reply with the sentence only.",
        },
        { role: "user", content: r.summary },
      ],
    });
    const summaryEn = res.choices[0]?.message?.content?.trim();
    if (!summaryEn) throw new Error("empty reply");

    const { error: upErr } = await supabase
      .from("analysis_results")
      .update({ summary_en: summaryEn })
      .eq("id", r.id);
    if (upErr) throw new Error(upErr.message);

    done += 1;
    console.log(`  ✓ ${r.summary}\n    ${summaryEn}`);
  } catch (e) {
    failed += 1;
    // Keep going. One row that will not translate is not a reason to leave the
    // rest of the table half-filled.
    console.log(`  ✗ ${r.id}: ${String(e).slice(0, 120)}`);
  }
}

console.log(`\n${done} filled in, ${failed} failed.`);
