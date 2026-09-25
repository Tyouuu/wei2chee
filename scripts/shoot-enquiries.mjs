/**
 * 疗程记录那一页，用眼睛看一次 —— 种真的资料，三个宽度各拍一张。
 *
 * ── 为什么（[重点 7l](../docs/founder-points.md)）──────────────────────────
 *
 * 那一页的底下那一层十一节全绿（`walk:medispa`），而**没有人看过它长什么样**。
 * 数字全绿而画面是坏的，这个仓库发生过十几次。
 *
 * 它种的是一个真的 medi spa：一个客人、一份同意书发出去、两笔疗程 ——
 * 因为一页空的画面证明不了它排得对不对（[任务 142](../docs/founder-tasks.md) 那一条）。
 *
 *     node scripts/shoot-enquiries.mjs
 */
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { readFileSync, mkdirSync, existsSync } from "node:fs";
import { dropThrowaway, dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { openAllPages } from "./lib/seed-demo.mjs";

const env = Object.fromEntries(
  readFileSync(".env.local", "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
const OUT = ".screenshots/enquiries";
mkdirSync(OUT, { recursive: true });
const EMAIL = `enq-${Date.now()}@formae.test`;
const PASSWORD = `Enq-${Date.now()}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

const ping = await fetch(`${BASE}/en/login`).catch(() => null);
if (!ping || ping.status >= 400) {
  console.error(`\n🔴 ${BASE} 没有回应 —— 先开 npm run dev。这一支不猜。`);
  process.exit(2);
}

const WIDTHS = [
  [1400, 1000, "desktop"],
  [820, 1180, "ipad"],
  [390, 844, "phone"],
];

let userId = null;
let leadId = null;
dropThrowawayOnExit(admin, () => userId);
let browser;

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL, password: PASSWORD, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);
  const { data: proj } = await api.from("projects").select("id").single();
  const P = proj?.id;
  if (!P) throw new Error("注册没有开出一个 project");

  /* 行业在问卷上，不在 projects 上 —— 少了它整个帐号落在通用示例上
     （`shoot-trade.mjs` 那一支的注解写过这一条）。 */
  const { data: ind } = await admin.from("industries").select("id").eq("slug", "beauty").single();
  const { data: lead } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: { note: "shoot-enquiries" } })
    .select("id")
    .single();
  leadId = lead.id;
  await admin.from("accounts").update({ lead_id: leadId }).eq("id", userId);
  await api.rpc("update_business_identity", {
    new_business_name: "Wei Hair Studio", new_owner_name: "Owner",
  });
  await api.rpc("set_project_style", { new_style: "ledger" });
  await openAllPages(api, { quiet: true });

  /* 三封询价 —— 一封刚进来的、两封读过的。
     🔴 用管理钥匙直接写那一张表：公开那一支要先设门牌 ＋ 上线，
     而这一支要量的是**那一页长什么样**，不是那条公开的路通不通
     （那一条 `check:records` 自己在守）。 */
  const ASK = [
    ["Ms Lim", "0123456789", { "What do you need?": "Rebonding for medium length hair, how much and how long does it take?" }, "new"],
    ["Mrs Chan", "0198887766", { "What do you need?": "Colour touch-up this Saturday afternoon if there is a slot." }, "read"],
    ["Ms Devi", "0175554433", { "What do you need?": "Do you do bridal packages? Wedding is in November." }, "read"],
  ];
  for (const [name, contact, answers, status] of ASK) {
    const r = await admin.from("site_enquiries").insert({
      project_id: P, name, contact, answers, status, lands_in: "customers",
    });
    if (r.error) throw new Error(`site_enquiries: ${r.error.message}`);
  }
  browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 180000 });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal|salon-preview/, { timeout: 180000 });

  const hide = "nextjs-portal, #__next-build-watcher, [data-nextjs-toast] { display: none !important; }";
  for (const [w, h, tag] of WIDTHS) {
    await page.setViewportSize({ width: w, height: h });
    await page.goto(`${BASE}/en/portal/enquiries`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: hide });
    /* 挑一封、打一句回覆 —— 一页没有挑过、没有打过字的画面
       只证明得了左半边。 */
    const one = page.locator("button", { hasText: "Mrs Chan" }).first();
    if (await one.count()) {
      await one.click().catch(() => {});
      await page.waitForTimeout(700);
    }
    const box = page.locator("textarea").first();
    if (await box.count()) {
      await box.fill("Hi Mrs Chan, Saturday 3pm is open with Jasmine. Shall I hold it for you?").catch(() => {});
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: `${OUT}/${tag}.png`, fullPage: true });
    console.log(`  ${tag.padEnd(8)} 拍到`);
  }

  /* 三格并排，一眼看得完。 */
  const H = 940;
  const parts = [];
  for (const [, , tag] of WIDTHS) {
    const f = `${OUT}/${tag}.png`;
    if (!existsSync(f)) continue;
    const meta = await sharp(f).metadata();
    const crop = Math.min(meta.height, 1800);
    const iw = Math.round(meta.width * (H / crop));
    parts.push({
      img: await sharp(f)
        .extract({ left: 0, top: 0, width: meta.width, height: crop })
        .resize({ width: iw, height: H, fit: "fill" })
        .toBuffer(),
      w: iw,
      label: tag,
    });
  }
  const GAP = 12;
  const LABEL = 26;
  const total = parts.reduce((n, p) => n + p.w + GAP, GAP);
  const svg = Buffer.from(
    `<svg width="${total}" height="${LABEL}" xmlns="http://www.w3.org/2000/svg">` +
      `<rect width="100%" height="100%" fill="#0b0b0c"/>` +
      parts
        .map((p, i) => {
          const x = GAP + parts.slice(0, i).reduce((n, q) => n + q.w + GAP, 0);
          return `<text x="${x}" y="18" font-family="monospace" font-size="14" fill="#f2f2f0">${p.label}</text>`;
        })
        .join("") +
      `</svg>`,
  );
  await sharp({
    create: { width: total, height: H + LABEL + GAP, channels: 3, background: { r: 11, g: 11, b: 12 } },
  })
    .composite([
      { input: svg, top: 0, left: 0 },
      ...parts.map((p, i) => ({
        input: p.img,
        top: LABEL,
        left: GAP + parts.slice(0, i).reduce((n, q) => n + q.w + GAP, 0),
      })),
    ])
    .jpeg({ quality: 86 })
    .toFile(`${OUT}/sheet.jpg`);
  console.log(`\n  ${OUT}/sheet.jpg\n`);
} finally {
  if (browser) await browser.close();
  await dropThrowaway(admin, userId);
  if (leadId) await admin.from("leads").delete().eq("id", leadId);
}
