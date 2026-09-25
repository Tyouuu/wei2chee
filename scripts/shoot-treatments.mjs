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
 *     node scripts/shoot-treatments.mjs
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
const OUT = ".screenshots/treatments";
mkdirSync(OUT, { recursive: true });
const EMAIL = `treat-${Date.now()}@formae.test`;
const PASSWORD = `Treat-${Date.now()}-x!`;

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
    .insert({ industry_id: ind.id, language: "en", answers: { note: "shoot-treatments" } })
    .select("id")
    .single();
  leadId = lead.id;
  await admin.from("accounts").update({ lead_id: leadId }).eq("id", userId);
  await api.rpc("update_business_identity", {
    new_business_name: "Radiance Medi Spa", new_owner_name: "Owner",
  });
  await api.rpc("set_project_style", { new_style: "ledger" });
  await openAllPages(api, { quiet: true });

  /* 一个客人、一个理疗师。走的是人按的那一支（`add_directory_entry`）。 */
  const { data: guestRow } = await api.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ms Tan",
  });
  const { data: crewRow } = await api.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Nurul",
  });
  const one = (x) => (Array.isArray(x) ? x[0] : x);
  const her = one(guestRow)?.id ?? null;
  const crew = one(crewRow)?.id ?? null;
  if (!her) throw new Error("没有客人 —— 这一页拍出来会是空的，不拍");

  /* 一份同意书，发出去但**还没签** —— 那正是这一页要讲的那一句。 */
  /* 🔴 **每一支都要看回传的 error。** 第一版我漏了 `in_project_id`，
     那一支静静失败，而画面上印的是「还没发给她」—— 一个种失败的道具
     跟一个真的产品毛病，在图上长得一模一样（[重点 31] 最后那一段：
     红的时候先问是不是我量错了）。 */
  const formRes = await api.rpc("add_consent_form", {
    in_project_id: P,
    in_name: "Botulinum toxin consent",
    in_body: "I understand the treatment, its effects and its risks.",
  });
  if (formRes.error) throw new Error(`add_consent_form: ${formRes.error.message}`);
  const formId = one(formRes.data)?.id ?? null;
  if (!formId) throw new Error("同意书范本没建出来 —— 这一页的上半段会是空的，不拍");
  const askRes = await api.rpc("request_consent", { in_party_id: her, in_form_id: formId });
  if (askRes.error) throw new Error(`request_consent: ${askRes.error.message}`);

  /* 两笔疗程。 */
  for (const [what, area, note] of [
    ["HydraFacial", "Full face", "Mild redness after, settled in an hour."],
    ["Chemical peel", "Cheeks", "Second session. Told her to stay out of the sun."],
  ]) {
    const r = await api.rpc("add_treatment_note", {
      in_party_id: her, in_what: what, in_area: area, in_note: note,
      ...(crew ? { in_staff_id: crew } : {}),
    });
    if (r.error) throw new Error(`add_treatment_note: ${r.error.message}`);
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
    await page.goto(`${BASE}/en/portal/treatments`, { waitUntil: "networkidle", timeout: 120000 });
    await page.waitForTimeout(1200);
    await page.addStyleTag({ content: hide });
    /* 挑一个客人 —— 一页没有挑人的画面只证明得了左半边。 */
    const first = page.locator("button", { hasText: "Ms Tan" }).first();
    if (await first.count()) {
      await first.click().catch(() => {});
      await page.waitForTimeout(1400);
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
