/**
 * 一个上线的官网，印的必须是这家公司的名字。
 *
 * ── WHY ───────────────────────────────────────────────────────────────────
 *
 * Found by eye on 2026-09-03, on the demo account, in the one place a stranger
 * can reach:
 *
 *   projects.business_name   兴发装修工程        (a renovation contractor)
 *   the published site       「My Trading Co.」  「WHOLESALE IN KUALA LUMPUR」
 *
 * The page had been saved the evening before -- by a checker, a test run, or a
 * regeneration into a different trade -- and published. Nothing noticed. The
 * portal kept saying 兴发装修工程 on every screen while the address he would
 * put on a name card said he was a wholesaler.
 *
 * This has happened before. On 2026-08-27 an eval rewrote the demo's public
 * headline to 「二十年装修经验」 and left it there; the fix that day was to make
 * that ONE ruler snapshot and restore. This is the other half: a guard that
 * notices afterwards, whoever did it and however they did it.
 *
 * ── WHAT IT CHECKS ────────────────────────────────────────────────────────
 *
 * For every project that is PUBLISHED and has an address, every `brand` on its
 * saved website page must equal `projects.business_name`.
 *
 * ⚠️ Only published projects. A draft wearing template copy is the normal
 * state of a page nobody has finished -- failing on that would make this
 * shout on every account that has not got round to its website yet, and a
 * ruler that cries wolf every run is a ruler nobody reads.
 *
 * ⚠️ Only when business_name is set. A project that has never told us who it
 * is cannot disagree with itself.
 *
 * ⚠️ WHAT HAS AND HAS NOT BEEN SEEN. It was seen RED, on real data, on the
 * defect it was written for. It has not been seen GREEN, because exactly one
 * site is published today and that is the broken one. So the PASS branch is
 * reasoned, not observed -- and this note stays until a second published site
 * exercises it. A guard whose passing half has never run can be a guard that
 * only ever fails.
 */
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
const U = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const head = { apikey: KEY, Authorization: `Bearer ${KEY}` };

/** Every `brand` value anywhere in a saved layout, however deep. Walked rather
 *  than pattern-matched on the JSON text: a company name containing a quote
 *  would slip a regex, and this is the one field the check is about. */
function brandsIn(node, found = new Set()) {
  if (!node || typeof node !== "object") return found;
  if (Array.isArray(node)) {
    for (const x of node) brandsIn(x, found);
    return found;
  }
  for (const [k, v] of Object.entries(node)) {
    if (k === "brand" && typeof v === "string" && v.trim()) found.add(v.trim());
    else brandsIn(v, found);
  }
  return found;
}

const projects = await fetch(
  `${U}/rest/v1/projects?select=id,business_name,site_slug,site_published`,
  { headers: head },
).then((r) => r.json());

let checked = 0;
const bad = [];

for (const p of projects) {
  if (!p.site_published || !p.site_slug) continue;
  if (!p.business_name || !p.business_name.trim()) continue;

  const pages = await fetch(
    `${U}/rest/v1/project_pages?project_id=eq.${p.id}&page_key=eq.website&select=layout_json`,
    { headers: head },
  ).then((r) => r.json());

  const layout = pages?.[0]?.layout_json;
  /* Never saved means it renders from his business context every time, which
     cannot disagree with itself. Nothing to check. */
  if (!layout) continue;

  checked += 1;
  const brands = [...brandsIn(layout)];
  const wrong = brands.filter((b) => b !== p.business_name.trim());

  if (wrong.length) {
    bad.push({ slug: p.site_slug, is: p.business_name.trim(), says: wrong });
    console.log(
      `FAIL  /s/${p.site_slug} — 系统里是「${p.business_name.trim()}」，` +
        `上线的官网印着「${wrong.join("」「")}」`,
    );
  } else {
    console.log(`PASS  /s/${p.site_slug} — ${p.business_name.trim()}`);
  }
}

console.log(`\n判：查了 ${checked} 个上线的官网 · ${bad.length} 个印着别家的名字`);
if (bad.length) {
  console.log(
    "\n那是陌生人唯一看得到的一页。修法不是改这支检查 —— 是把那一页存回这家公司的内容，\n" +
      "或者清掉存档让它从他的生意资料重新长出来。",
  );
}
process.exit(bad.length ? 1 : 0);
