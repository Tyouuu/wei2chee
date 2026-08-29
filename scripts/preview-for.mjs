/**
 * 给一个行业跟一段生意描述，生出一套可以带去见客户的系统。
 *
 * WHY THIS EXISTS. The founder's pitch is 「老板讲两分钟自己的生意，当场看到他自己的
 * 系统」, and before a sales meeting the useful thing is to have already run that for
 * the business he is about to walk into. Doing it by hand means clicking through the
 * landing page, the trade picker, the questionnaire and the signup form every time.
 *
 * This drives the SAME path the product uses -- POST /api/analyze (a real model
 * call, recorded in ai_usage like any other), then a signup carrying `lead_id`,
 * which is what the provisioning trigger reads to decide the page set. Nothing
 * here is a mock: the account it leaves behind is indistinguishable from one a
 * customer made, which is the entire point of showing it to somebody.
 *
 *   npm run preview -- beauty "I run a hair salon in KL with 3 stylists…"
 *   npm run preview -- renovation "我做装修，八个师傅…" --zh
 *
 * It prints the login it created. Delete it from the console when the meeting is
 * over -- it is a real customer row and it counts in every number there.
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => [
      l.slice(0, l.indexOf("=")).trim(),
      l.slice(l.indexOf("=") + 1).trim().replace(/^["']|["']$/g, ""),
    ]),
);

const BASE = process.env.BASE_URL ?? "http://localhost:3000";
const args = process.argv.slice(2);
const zh = args.includes("--zh");
const rest = args.filter((a) => a !== "--zh");
const slug = rest[0];
const brief = rest.slice(1).join(" ");

if (!slug || !brief) {
  console.log('usage: npm run preview -- <trade-slug> "<what the business does>" [--zh]');
  console.log("trades: beauty · wholesale · renovation · services · retail · fnb · education · other");
  process.exit(1);
}

const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const { data: industry } = await db
  .from("industries")
  .select("id, slug, name_en")
  .eq("slug", slug)
  .maybeSingle();
if (!industry) {
  console.log(`no trade called "${slug}"`);
  process.exit(1);
}

/*
  The questionnaire's own keys. `new_customer_flow` is the one the hero fills in
  when somebody types into the box on the landing page, so a description given
  here arrives exactly where a visitor's would.
*/
const answers = {
  new_customer_flow: brief,
  tracking_today: zh ? "WhatsApp 跟本子" : "WhatsApp and a notebook",
  biggest_time_sink: zh ? "来回确认时间跟追钱" : "back-and-forth on times, and chasing payment",
};

console.log(`\n  trade    ${industry.name_en} (${industry.slug})`);
console.log(`  brief    ${brief.slice(0, 88)}${brief.length > 88 ? "…" : ""}`);
process.stdout.write("  analyse  … ");

const res = await fetch(`${BASE}/api/analyze`, {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ industryId: industry.id, language: zh ? "zh" : "en", answers }),
});
if (!res.ok) {
  console.log(`failed ${res.status}: ${(await res.text()).slice(0, 160)}`);
  process.exit(1);
}
const { leadId, analysis, usedFallback } = await res.json();
console.log(usedFallback ? "done (fallback — the model did not answer)" : "done");
console.log(`  summary  ${String(analysis?.summary ?? "").slice(0, 110)}`);
if (Array.isArray(analysis?.modules)) {
  console.log(`  modules  ${analysis.modules.map((m) => m.key).join(" · ")}`);
}

const stamp = Date.now();
const email = `preview.${slug}.${stamp}@formae.test`;
const password = `Preview${stamp}!`;

/* `lead_id` in user metadata is what the signup form sends and what the
   provisioning trigger reads to pick this trade's page set. */
const { data: created, error } = await db.auth.admin.createUser({
  email,
  password,
  email_confirm: true,
  user_metadata: { lead_id: leadId },
});
if (error) {
  console.log(`  signup   failed: ${error.message}`);
  process.exit(1);
}

await new Promise((r) => setTimeout(r, 1500));
const { data: project } = await db
  .from("projects")
  .select("id, style, site_slug")
  .eq("account_id", created.user.id)
  .maybeSingle();
const { data: pages } = await db
  .from("project_pages")
  .select("page_key")
  .eq("project_id", project?.id ?? "");

console.log(`  pages    ${(pages ?? []).map((p) => p.page_key).join(" · ") || "(none — trigger did not fire)"}`);
console.log(`  register ${project?.style ?? "(not chosen yet)"}`);
console.log(`\n  open ${BASE}/en/login`);
console.log(`  email    ${email}`);
console.log(`  password ${password}`);
console.log(`\n  It is a real account. Delete it from the console when you are done.\n`);
