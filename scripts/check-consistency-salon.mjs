/* 新版沙龙十四页是不是同一个产品？—— 量得出来的那几件。
 *
 *   node scripts/check-consistency-salon.mjs
 *
 * ── 为什么要这一把尺 ────────────────────────────────────────────────────────
 * `check-consistency.mjs` 量的是旧版 `/en/portal/*` 那十一页——老版面。
 * 新版十四页（`salon-preview/`）**从来没有被这把尺量过**：2026-10-25
 * 他亲口问「你怎么没有做其他测试」，这一支补的就是这个洞。
 *
 * `PROBE`（浏览器里跑的那段量测逻辑）整段照抄原档，一个字不改——那是
 * 撞过「缩略图被当成按钮」「侧栏推到画面外还被算成按钮太小」「正则反斜线
 * 逃两层」「总数吓人但九成不属於他」这几个坑，一步步修出来的，不重新造轮子。
 * 换的只有：PAGES 清单（十一页 → 十四页）、示范帐号（旧版那个装修/电话卡
 * 帐号 → 真的沙龙帐号，salon.demo@formae.test，十四页都有真资料）。
 *
 * ⚠️ 跟原档一样：**不假装知道门槛**。先印出真数字，用眼睛看过再决定
 * 要不要收紧（[重点24](../docs/founder-points.md)）。第一次跑，故意不 exit 1。
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";

config({ path: ".env.local", quiet: true });
const BASE = process.env.ALIGN_BASE || "http://localhost:3000";
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const email = "salon.demo@formae.test";

const PAGES = [
  ["overview", "/en/salon-preview/overview"],
  ["schedule", "/en/salon-preview/schedule"],
  ["register", "/en/salon-preview/register"],
  ["clients", "/en/salon-preview/clients"],
  ["lookbook", "/en/salon-preview/lookbook"],
  ["packages", "/en/salon-preview/packages"],
  ["memberships", "/en/salon-preview/memberships"],
  ["stock", "/en/salon-preview/stock"],
  ["stylists", "/en/salon-preview/stylists"],
  ["reports", "/en/salon-preview/reports"],
  ["eod-cash", "/en/salon-preview/eod-cash"],
  ["invoices", "/en/salon-preview/invoices"],
  ["settings", "/en/salon-preview/settings"],
  ["audit-log", "/en/salon-preview/audit-log"],
];

/* 原档逐字照抄——见档头。 */
const PROBE = () => {
  const inChrome = (el) => {
    for (let n = el.parentElement; n; n = n.parentElement) {
      const t = getComputedStyle(n).transform;
      if (t && t !== "none") {
        const m = t.match(/matrix\(([-0-9.]+)/);
        if (m && parseFloat(m[1]) < 0.9) return true;
      }
      if (/mount|exhibit/i.test(String(n.className))) return true;
    }
    return false;
  };

  const seen = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return false;
    if (r.right <= 0 || r.left >= innerWidth || r.bottom <= -2) return false;
    const c = getComputedStyle(el);
    if (c.visibility === "hidden" || c.display === "none" || Number(c.opacity) < 0.05) return false;
    return el.checkVisibility ? el.checkVisibility({ opacityProperty: true, visibilityProperty: true }) : true;
  };

  const rail = [...document.querySelectorAll("nav, aside")]
    .filter(seen)
    .map((e) => e.getBoundingClientRect())
    .filter((r) => r.left < 8 && r.height > innerHeight * 0.5)
    .sort((a, b) => b.width - a.width)[0];
  const railW = rail ? Math.round(rail.right) : 0;

  const bar = [...document.querySelectorAll("div,header")].filter((e) => {
    if (!seen(e) || inChrome(e)) return false;
    const c = getComputedStyle(e);
    if (c.position !== "sticky" && c.position !== "fixed") return false;
    const r = e.getBoundingClientRect();
    return r.top <= 96 && r.top >= 0 && r.width > (innerWidth - railW) * 0.6 && r.height < 120;
  })[0];
  const barBottom = bar ? bar.getBoundingClientRect().bottom : 0;

  const wrap = [...document.querySelectorAll("div,main,section")]
    .filter((e) => seen(e) && !inChrome(e))
    .map((e) => ({ e, r: e.getBoundingClientRect() }))
    .filter(
      (o) =>
        o.r.top >= barBottom - 1 &&
        o.r.left >= railW - 1 &&
        o.r.width > (innerWidth - railW) * 0.4,
    )
    .sort((a, b) => a.r.top - b.r.top || b.r.width - a.r.width)[0];
  const first = wrap
    ? {
        r: {
          left: wrap.r.left + parseFloat(getComputedStyle(wrap.e).paddingLeft || "0"),
        },
      }
    : null;

  const head = [...document.querySelectorAll("h1,h2")]
    .filter((e) => seen(e) && !inChrome(e))
    .map((e) => ({ e, s: parseFloat(getComputedStyle(e).fontSize) }))
    .sort((a, b) => b.s - a.s)[0];
  const hc = head ? getComputedStyle(head.e) : null;

  const shrunk = (e) => e.offsetHeight > 0 && e.getBoundingClientRect().height / e.offsetHeight < 0.9;

  const taps = [...document.querySelectorAll("button, a[href], [role=button]")]
    .filter((e) => seen(e) && !inChrome(e) && !shrunk(e))
    .filter((e) => {
      const c = getComputedStyle(e);
      const painted = !/rgba?\(0, 0, 0, 0\)|transparent/.test(c.backgroundColor);
      if (painted || parseFloat(c.borderTopWidth) > 0) return true;
      const par = e.parentElement;
      const around = par ? (par.textContent || "").trim().length : 0;
      const own = (e.textContent || "").trim().length;
      return !(around > own + 2);
    })
    .map((e) => ({
      h: Math.round(e.getBoundingClientRect().height),
      what: (e.textContent || e.getAttribute("aria-label") || e.tagName).trim().slice(0, 28),
    }));

  return {
    hasBar: Boolean(bar),
    contentX: first ? Math.round(first.r.left) : null,
    headPx: head ? Math.round(head.s) : null,
    headWeight: hc ? hc.fontWeight : null,
    headFamily: hc ? hc.fontFamily.split(",")[0].replace(/["']/g, "") : null,
    overflowX: document.documentElement.scrollWidth - innerWidth,
    tapsUnder44: taps.filter((t) => t.h < 44).length,
    tapsTotal: taps.length,
    tapsSmall: taps
      .filter((t) => t.h < 44)
      .map((t) => `${t.h}px ${t.what}`)
      .slice(0, 6),
  };
};

const rows = { 1440: [], 390: [] };
let bad = 0;
const b = await chromium.launch();
for (const W of [1440, 390]) {
  const ctx = await b.newContext({ viewport: { width: W, height: W < 500 ? 844 : 950 } });
  const p = await ctx.newPage();
  const { data: link } = await db.auth.admin.generateLink({ type: "magiclink", email });
  await p
    .goto(`${BASE}/auth/confirm?token_hash=${link.properties.hashed_token}&type=magiclink&next=/en/salon-preview/overview`, {
      waitUntil: "networkidle",
      timeout: 180000,
    })
    .catch(() => {});
  for (const [name, path] of PAGES) {
    try {
      await p.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 180000 });
      await p.waitForTimeout(1400);
      await p.addStyleTag({ content: "nextjs-portal,[data-nextjs-toast]{display:none!important}" });
      if (/\/login/.test(p.url())) {
        rows[W].push({ name, failed: "落在登入页" });
        bad++;
        continue;
      }
      rows[W].push({ name, ...(await p.evaluate(PROBE)) });
    } catch (e) {
      rows[W].push({ name, failed: String(e).slice(0, 50) });
      bad++;
    }
  }
  await ctx.close();
}
await b.close();

const pad = (v, n) => String(v ?? "—").padStart(n);
for (const W of [1440, 390]) {
  console.log(`\n══ ${W}px ══`);
  console.log("  页面          顶栏  正文左缘   标题 px/字重/字体          横滚   按钮<44px");
  for (const r of rows[W]) {
    if (r.failed) {
      console.log(`  ${r.name.padEnd(12)} 🔴 ${r.failed}`);
      continue;
    }
    const face = `${pad(r.headPx, 3)} ${pad(r.headWeight, 3)} ${(r.headFamily ?? "—").slice(0, 17).padEnd(17)}`;
    console.log(
      `  ${r.name.padEnd(12)} ${r.hasBar ? " 有 " : " 无 "} ${pad(r.contentX, 8)}   ${face} ${pad(r.overflowX > 1 ? "+" + r.overflowX : "", 5)}  ${pad(W === 390 ? `${r.tapsUnder44}/${r.tapsTotal}` : "", 9)}`,
    );
  }
}

const ok = rows[1440].filter((r) => !r.failed);
const xs = [...new Set(ok.map((r) => r.contentX))].sort((a, c) => a - c);
const heads = [...new Set(ok.map((r) => `${r.headPx}/${r.headWeight}`))];
const bars = ok.filter((r) => r.hasBar).length;
const over = rows[390].filter((r) => !r.failed && r.overflowX > 1);
const live390 = rows[390].filter((r) => !r.failed);
const thumbs = live390.reduce((a, r) => a + r.tapsUnder44, 0);

console.log("\n── 一个产品，还是十四个 ──");
console.log(`  正文左缘   ${xs.length} 种   ${xs.join(" · ")}`);
console.log(`  标题       ${heads.length} 种   ${heads.join(" · ")}`);
console.log(`  顶栏       ${bars}/${ok.length} 页有`);
console.log(`  手机横滚   ${over.length} 页   ${over.map((r) => `${r.name}+${r.overflowX}`).join(" ") || "—"}`);
console.log(`  手机上拇指按不稳的按钮  ${thumbs} 个`);
for (const r of rows[390]) {
  if (!r.failed && r.tapsSmall?.length) {
    console.log(`    ${r.name.padEnd(11)} ${r.tapsSmall.join(" · ")}`);
  }
}
console.log(`\n  （第一次跑，先看真数字，不假装知道门槛该订多少——重点24）`);

if (bad) {
  console.log(`\n🔴 ${bad} 页量不到——尺子坏了或者页面坏了，不是"产品好"。`);
  process.exit(1);
}
