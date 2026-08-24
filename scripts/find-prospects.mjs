/**
 * 找看得出「需要系统」的商家。
 *
 * ── WHY THIS IS NOT A SCRAPER ─────────────────────────────────────────────
 *
 * The founder asked for 「可以自动捉去潜在客户的开源项目」 and then sharpened it
 * in the next breath: 「就是要找那些需要定制system的潜在客户」. Those are two
 * different products. Scraping every business in Kuala Lumpur is a solved
 * problem with a dozen MIT repos behind it. Knowing WHICH of them would pay
 * RM 5,000 for a system is the part nobody sells, and it is the only part worth
 * building here.
 *
 * So the collection is deliberately the boring half -- OpenStreetMap's Overpass
 * API, open data under ODbL, no terms to break, no account, no rate-limit games
 * -- and everything interesting is in the SCORING.
 *
 * ── THE SIGNALS, AND WHY EACH ONE MEANS "NEEDS A SYSTEM" ──────────────────
 *
 *   NO WEBSITE AT ALL          The strongest signal there is. A business with a
 *                              phone, an address and opening hours but no site
 *                              is running on WhatsApp and a notebook. That is
 *                              exactly the customer Formae is built for, and
 *                              they need the 官网 as much as the 系统.
 *   WEBSITE IS A FACEBOOK PAGE Same business, one step further along: they
 *                              already know they need to be findable and the
 *                              only tool they had was Facebook. The easiest
 *                              conversation of the lot, because the gap is
 *                              something they have already felt.
 *   SITE DOES NOT ANSWER       Paid for something once, it lapsed. They have
 *                              already proven they will spend money on this.
 *   NO HTTPS / NO MOBILE META  A site built years ago by somebody who has gone
 *                              quiet. Every one of their customers is on a
 *                              phone.
 *   HAS A PHONE                Not a need signal -- a REACHABILITY signal. A
 *                              lead you cannot contact is not a lead, so this
 *                              scores too.
 *
 * A chain is subtracted, not added: 99 Speedmart and Watsons have head-office
 * IT and will never buy this.
 *
 * ── WHAT THIS DELIBERATELY DOES NOT COLLECT ───────────────────────────────
 *
 * Business name, business phone, business address, business website. All of it
 * is information a business publishes so that customers can reach it, and all
 * of it is already in an open dataset. No personal names, no personal mobiles
 * scraped off a page, no emails harvested from anywhere, no social profiles of
 * individuals. Malaysia's PDPA 2010 governs personal data; a shop's landline is
 * not that, and keeping the line there is cheaper than arguing about it later.
 *
 * ── VOLUME ────────────────────────────────────────────────────────────────
 *
 * OSM's Malaysian coverage is real but thinner than Google's. This is the free,
 * clean, run-it-today half. For volume the production path is
 * gosom/google-maps-scraper (MIT, Go, 5.6k stars, pushed this week) which
 * returns the same fields plus review counts; the scoring below takes its CSV
 * unchanged -- see --from-csv.
 *
 *   node scripts/find-prospects.mjs                     # KL, default trades
 *   node scripts/find-prospects.mjs --area johor --probe
 *   node scripts/find-prospects.mjs --from-csv gmaps.csv
 */
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";

const OUT = ".prospects";
mkdirSync(OUT, { recursive: true });

const args = process.argv.slice(2);
const flag = (n, d = null) => {
  const i = args.indexOf(`--${n}`);
  return i < 0 ? d : args[i + 1] ?? true;
};
const PROBE = args.includes("--probe");

/** Bounding boxes, south,west,north,east. Where Malaysian SMEs actually are. */
const AREAS = {
  kl: [3.02, 101.58, 3.25, 101.78],
  penang: [5.24, 100.24, 5.48, 100.53],
  johor: [1.42, 103.60, 1.60, 103.82],
  ipoh: [4.53, 101.03, 4.68, 101.16],
  kk: [5.90, 116.02, 6.05, 116.18],
};
const area = String(flag("area", "kl")).toLowerCase();
const bbox = AREAS[area];
if (!bbox) {
  console.error(`unknown --area. one of: ${Object.keys(AREAS).join(", ")}`);
  process.exit(1);
}

/**
 * The trades, chosen on who actually runs on paper AND bills enough to care
 * about the LHDN e-Invoice mandate. Renovation, hardware and car trades are the
 * three the product's own templates were built for; mobile-phone shops are the
 * SIM-dealer case that drove the module catalogue.
 */
const TRADES = [
  ['shop"="hardware', "五金建材"],
  ['shop"="doityourself', "建材"],
  ['shop"="trade', "建材批发"],
  ['shop"="car_repair', "车厂"],
  ['shop"="car_parts', "汽车配件"],
  ['shop"="car', "车行"],
  ['shop"="mobile_phone', "手机店"],
  ['shop"="furniture', "家具"],
  ['shop"="electronics', "电器"],
  ['craft"="carpenter', "木工"],
  ['craft"="electrician', "电工"],
  ['craft"="plumber', "水喉"],
  ['office"="estate_agent', "房产中介"],
  ['amenity"="dentist', "牙科"],
  ['amenity"="veterinary', "兽医"],
  ['shop"="beauty', "美容"],
];

const CHAINS =
  /99 ?speed|watsons|guardian|7-?eleven|kk ?super|mydin|tesco|lotus|aeon|giant|shell|petronas|petron|caltex|mcdonald|kfc|starbucks|zus |家乐福|celcom|maxis|digi|u ?mobile|unifi/i;

const q = TRADES.map(
  ([t]) => `node["${t}"](${bbox.join(",")});way["${t}"](${bbox.join(",")});`,
).join("");
const query = `[out:json][timeout:90];(${q});out center tags;`;

process.stdout.write(`查 ${area.toUpperCase()} · ${TRADES.length} 个行业 … `);
const res = await fetch("https://overpass-api.de/api/interpreter", {
  method: "POST",
  body: new URLSearchParams({ data: query }),
});
if (!res.ok) {
  console.error(`\nOverpass ${res.status}. 稍后再试（公用服务器会限流）。`);
  process.exit(1);
}
const { elements = [] } = await res.json();
console.log(`${elements.length} 个商家`);

const tradeOf = (tags) => {
  for (const [t, zh] of TRADES) {
    const [k, v] = t.split('"="');
    if (tags[k] === v) return zh;
  }
  return "其他";
};

let rows = elements
  .map((e) => {
    const t = e.tags ?? {};
    const site = t.website || t["contact:website"] || t.url || "";
    return {
      name: t.name || t["name:en"] || "",
      trade: tradeOf(t),
      phone: t.phone || t["contact:phone"] || t["contact:mobile"] || "",
      site,
      addr: [t["addr:housenumber"], t["addr:street"], t["addr:city"], t["addr:postcode"]]
        .filter(Boolean)
        .join(" "),
      hours: t.opening_hours || "",
      lat: e.lat ?? e.center?.lat ?? null,
      lon: e.lon ?? e.center?.lon ?? null,
    };
  })
  // A business with no name is a map artefact, not a lead.
  .filter((r) => r.name && !CHAINS.test(r.name));

if (flag("from-csv")) {
  // gosom/google-maps-scraper's CSV, scored by the same rules. Columns it emits:
  // input_id,link,title,category,address,...,website,phone,...
  const csv = readFileSync(String(flag("from-csv")), "utf8").split(/\r?\n/);
  const head = csv[0].split(",").map((h) => h.trim());
  const col = (n) => head.indexOf(n);
  rows = csv
    .slice(1)
    .filter(Boolean)
    .map((line) => {
      const c = line.split(",");
      return {
        name: c[col("title")] ?? "",
        trade: c[col("category")] ?? "",
        phone: c[col("phone")] ?? "",
        site: c[col("website")] ?? "",
        addr: c[col("address")] ?? "",
        hours: "",
        lat: null,
        lon: null,
      };
    })
    .filter((r) => r.name && !CHAINS.test(r.name));
  console.log(`从 CSV 读了 ${rows.length} 个`);
}

const SOCIAL = /facebook\.com|instagram\.com|wa\.me|linktr\.ee|business\.site|wixsite|blogspot/i;

/** One probe per site, capped, best-effort. A site that does not answer is a
 *  signal, not an error — so a failure here is data. */
async function probe(url) {
  try {
    const r = await fetch(url.startsWith("http") ? url : `https://${url}`, {
      redirect: "follow",
      signal: AbortSignal.timeout(9000),
      headers: { "user-agent": "Mozilla/5.0 (compatible; formae-prospect/1.0)" },
    });
    const html = (await r.text()).slice(0, 40000);
    return {
      ok: r.ok,
      status: r.status,
      https: r.url.startsWith("https://"),
      mobile: /<meta[^>]+name=["']viewport["']/i.test(html),
    };
  } catch {
    return { ok: false, status: 0, https: false, mobile: false };
  }
}

if (PROBE) {
  const withSite = rows.filter((r) => r.site && !SOCIAL.test(r.site));
  process.stdout.write(`探 ${withSite.length} 个网站 … `);
  const LIMIT = 12;
  for (let i = 0; i < withSite.length; i += LIMIT) {
    await Promise.all(
      withSite.slice(i, i + LIMIT).map(async (r) => {
        r.probe = await probe(r.site);
      }),
    );
    process.stdout.write(".");
  }
  console.log(" 完成");
}

for (const r of rows) {
  let s = 0;
  const why = [];
  if (!r.site) {
    s += 40;
    why.push("没有官网");
  } else if (SOCIAL.test(r.site)) {
    s += 30;
    why.push("官网就是一个社交页");
  }
  if (r.probe && !r.probe.ok) {
    s += 15;
    why.push(r.probe.status ? `网站回 ${r.probe.status}` : "网站打不开");
  }
  if (r.probe?.ok && !r.probe.https) {
    s += 10;
    why.push("没有 HTTPS");
  }
  if (r.probe?.ok && !r.probe.mobile) {
    s += 10;
    why.push("手机上是坏的");
  }
  if (r.phone) {
    s += 20;
    why.push("有电话，找得到人");
  }
  if (r.hours) {
    s += 5;
    why.push("有营业时间，是在做的");
  }
  if (r.addr) s += 5;
  r.score = s;
  r.why = why;
}

rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
writeFileSync(
  `${OUT}/${area}.csv`,
  [
    "分数,名称,行业,电话,官网,地址,为什么",
    ...rows.map((r) =>
      [r.score, r.name, r.trade, r.phone, r.site, r.addr, r.why.join(" · ")].map(esc).join(","),
    ),
  ].join("\n"),
  "utf8",
);

const top = rows.filter((r) => r.score >= 60);
writeFileSync(
  `${OUT}/${area}.html`,
  `<!doctype html><meta charset="utf-8"><title>${area.toUpperCase()} 潜在客户 · ${top.length}</title>
<style>
 body{margin:0;background:#0b0c0f;color:#eae7e0;font:14px/1.7 system-ui,"Microsoft YaHei",sans-serif;padding:28px}
 h1{font-size:20px;margin:0 0 4px}
 .sub{color:#8e939c;font-size:13px;margin:0 0 22px}
 table{border-collapse:collapse;width:100%;font-size:13px}
 th{text-align:left;font:11px/1.8 ui-monospace,monospace;letter-spacing:.12em;text-transform:uppercase;color:#6c717a;
    padding:10px 12px;border-bottom:1px solid #262a31;white-space:nowrap}
 td{padding:11px 12px;border-bottom:1px solid #1b1e24;vertical-align:top}
 tr:hover td{background:#14161a}
 .s{font:600 15px ui-monospace,monospace;color:#eae7e0}
 .s.hi{color:#5fae8c}
 .nm{color:#eae7e0;font-weight:500}
 .tr{color:#8e939c;font-size:12px}
 .why{color:#959ba5;font-size:12px}
 a{color:#8aa2ff}
</style>
<h1>${area.toUpperCase()} · ${top.length} 个值得打的电话</h1>
<p class="sub">共扫 ${rows.length} 家，${TRADES.length} 个行业，来源 OpenStreetMap（ODbL 开放资料）。
分数 ≥ 60 才列在这里。全部是商家公开的联络资料，没有个人资料。${PROBE ? "" : " 加 --probe 会去探每个网站活着没有。"}</p>
<table>
<thead><tr><th>分</th><th>名称</th><th>电话</th><th>官网</th><th>为什么是他</th><th>地址</th></tr></thead>
<tbody>
${top
    .map(
      (r) => `<tr>
  <td class="s${r.score >= 70 ? " hi" : ""}">${r.score}</td>
  <td><div class="nm">${r.name}</div><div class="tr">${r.trade}</div></td>
  <td>${r.phone ? `<a href="https://wa.me/${r.phone.replace(/[^0-9]/g, "")}">${r.phone}</a>` : "—"}</td>
  <td>${r.site ? `<a href="${r.site}" target="_blank" rel="noreferrer">${r.site.replace(/^https?:\/\//, "").slice(0, 34)}</a>` : "—"}</td>
  <td class="why">${r.why.join(" · ")}</td>
  <td class="why">${r.addr || "—"}</td>
</tr>`,
    )
    .join("\n")}
</tbody></table>`,
  "utf8",
);

const noSite = rows.filter((r) => !r.site).length;
const social = rows.filter((r) => r.site && SOCIAL.test(r.site)).length;
console.log(`
扫到 ${rows.length} 家（已剔除连锁）
  没有官网         ${noSite}
  官网是社交页     ${social}
  有电话找得到人   ${rows.filter((r) => r.phone).length}
  分数 ≥ 60        ${top.length}

→ ${OUT}/${area}.html   （用眼睛看这个）
→ ${OUT}/${area}.csv`);
