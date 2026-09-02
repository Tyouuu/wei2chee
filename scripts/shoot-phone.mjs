/* 他交付出去的那套系统，在手机上长什么样 —— 拿那四条去量它。
 *
 *   npm run shoot:phone      （要 dev server 开着）
 *
 * 老板 2026-09-02 拍板（[任务 107](../docs/founder-tasks.md)）：
 * `做一套，不是做一个库` —— app 不做十五套风格，做**一套「手机上怎么摆」**。
 *
 * 那一套的四条，是 2026-09-02 拍的 16 个专业老板端 app 上看出来的
 * （`.screenshots/appui/sheet.jpg`）：
 *   ① 底部一条分页列（3–5 格）   ② 一个大数字当主角
 *   ③ 圆图标格子当捷径           ④ 一单一张照片
 *
 * ⚠️ 量的是**交付出去的那套系统**，不是 Formae 这个平台。
 * [重点 19](../docs/founder-points.md)：平台是建造期，交付的那套才是运营期 ——
 * **在工地上掏出手机的是后者。**
 *
 *
 * ── 🔴 第一次跑出来的答案，比那四条都重要 ─────────────────────────────────
 *
 * **四条里三条 FAIL，而真正的原因是：今天根本没有「交付出去的系统在手机上」
 * 这个东西。** 390px 打开一个模块页，看到的是**编辑器** ——
 * 一个 1440px 的桌面版面缩在一个手机框里，配一句
 * 「On a phone you can read your system and change it by saying what you want」，
 * 底下是 AI 面板。那是**建造期**的画面，[重点 19](../docs/founder-points.md) 的
 * 平台那一半。
 *
 * 而在工地上掏出手机的那个人，要的是**运营期**那一半 —— 而它还不存在。
 * 所以这把尺现在量到的不是「我们做得不够好」，是「那一页还没有」。
 * ⚠️ 它照样留着：等那一页做出来，这四条就是它的验收。
 * ⚠️ 第一版没有登入就直接量，四页全部回了一整行读数，而四页都是**登入页**——
 * 是把 h1 印出来才看到的。所以这里每一次都印 h1，而且停在登入页要红。
 */
import { readFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = "http://localhost:3000";
const OUT = fileURLToPath(new URL("../.screenshots/phone/", import.meta.url));
mkdirSync(OUT, { recursive: true });

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const failed = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failed.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

/** The rows every business shares until its own first row exists. */
const SAMPLES = ["陈先生", "李太太", "王老板", "Mr Tan", "Mrs Lee", "Mr Wong"];

const stamp = Date.now();
const cred = { email: `phone-${stamp}@formae.test`, password: `Phone-${stamp}-x!` };
let userId = null;
let leadId = null;

const dayIn = (back) => {
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(new Date());
  const [y, m, d] = today.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d - back)).toISOString().slice(0, 10);
};

const browser = await chromium.launch();
try {
  const { data: ind } = await admin.from("industries").select("id").eq("slug", "renovation").single();
  const { data: lead } = await admin
    .from("leads")
    .insert({ industry_id: ind.id, language: "en", answers: { note: "page kinds" } })
    .select("id")
    .single();
  leadId = lead.id;

  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email,
    password: cred.password,
    email_confirm: true,
    user_metadata: { lead_id: leadId },
  });
  if (error) throw new Error(`createUser: ${error.message}`);
  userId = user.user.id;

  const { data: proj } = await admin.from("projects").select("id").eq("account_id", userId).single();
  /* ⚠️ The error is READ. A sibling script once passed a column that does not
     exist; PostgREST rejected the whole update, the style stayed null, /portal
     redirected to the style gate and it photographed the picker while reporting
     nine failures against correct code. */
  const { error: upErr } = await admin
    .from("projects")
    .update({ style: "ledger", palette: "clean-slate", system_language: "en", paid: true })
    .eq("id", proj.id);
  if (upErr) throw new Error(`could not provision: ${upErr.message}`);

  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: sErr } = await as.auth.signInWithPassword(cred);
  if (sErr) throw new Error(`sign-in: ${sErr.message}`);

  /* Through the same functions the 加一单 button calls, never an insert. */
  for (const key of ["projects", "customers", "suppliers"]) {
    const { error: e } = await as.rpc("add_project_page", { requested_key: key, new_title: null });
    if (e && !String(e.message).includes("exists")) throw new Error(`add_project_page(${key}): ${e.message}`);
  }

  const jobs = [
    ["Sunway Damansara kitchen", "Ang Chee Keong", 4850000],
    ["Puchong shoplot fitout", "Norhaslinda Binti Rahim", 9600000],
    ["Setapak bathroom", "Vimala Devi", 2280000],
  ];
  for (const [title, party, cents] of jobs) {
    const { error: e } = await as.rpc("add_pipeline_record", {
      in_project_id: proj.id,
      in_module_key: "projects",
      in_title: title,
      in_party: party,
      in_amount_cents: cents,
      in_issued_on: dayIn(5),
    });
    if (e) throw new Error(`add_pipeline_record: ${e.message}`);
  }
  for (const [name, phone] of [
    ["Ang Chee Keong", "012-337 8890"],
    ["Norhaslinda Binti Rahim", "017-882 4410"],
  ]) {
    const { error: e } = await as.rpc("add_directory_entry", {
      in_project_id: proj.id,
      in_module_key: "customers",
      in_name: name,
      in_phone: phone,
    });
    if (e) throw new Error(`add_directory_entry: ${e.message}`);
  }

  
  const ctx = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded", timeout: 60000 });
  await page.fill('input[type="email"]', cred.email);
  await page.fill('input[type="password"]', cred.password);
  await page.click('button[type="submit"]');
  await page.waitForURL(/portal/, { timeout: 60000 });

  const PAGES = [
    /* ⚠️ `/portal` 自己不在名单里：那是 Formae 的首页（「Your system is built」），
       是建造期，不是交付出去的那套。量错对象比量不到更糟。 */
    ["projects", "/en/portal/projects", "工程"],
    ["payments", "/en/portal/payments", "收款"],
    ["customers", "/en/portal/customers", "客户"],
  ];
  const rows = [];
  for (const [name, path, label] of PAGES) {
    await page.goto(`${BASE}${path}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(2500);
    const m = await page.evaluate(() => {
      const vw = innerWidth, vh = innerHeight;
      const els = [...document.querySelectorAll("*")];
      /* ① 一条贴底、满宽、矮、里面三个以上按得动的 */
      const bottomBar = els.some((e) => {
        const r = e.getBoundingClientRect(), c = getComputedStyle(e);
        return (c.position === "fixed" || c.position === "sticky") &&
          r.bottom > vh - 90 && r.width > vw * 0.8 && r.height > 36 && r.height < 110 &&
          e.querySelectorAll("a,button").length >= 3;
      });
      /* ② 整页最大的那个数字 */
      let big = null;
      for (const e of els) {
        if (e.children.length) continue;
        const t = (e.textContent || "").trim();
        if (!/^[A-Za-z$\s]*[0-9][0-9,.\s]*$/.test(t) || t.length > 18) continue;
        const px = parseFloat(getComputedStyle(e).fontSize);
        if (!big || px > big.px) big = { px, t };
      }
      /* ③ 圆的、手指按得到的图标 */
      const round = els.filter((e) => {
        const r = e.getBoundingClientRect(), c = getComputedStyle(e);
        return r.width > 28 && r.width < 72 && Math.abs(r.width - r.height) < 8 &&
          parseFloat(c.borderRadius) >= r.width / 2 - 2;
      }).length;
      /* ④ 画面上真的有照片 */
      const photos = [...document.querySelectorAll("img")]
        .filter((i) => i.getBoundingClientRect().width > 60).length;
      return {
        bottomBar, big, round, photos,
        h1: (document.querySelector("h1")?.innerText || "").trim().slice(0, 26),
        wide: document.documentElement.scrollWidth > vw + 1,
      };
    });
    await page.screenshot({ path: `${OUT}/${name}.png` });
    /* 停在登入页跟拍到一张好好的页，在报告里长得一模一样。 */
    const stuck = /log ?in|sign ?in/i.test(m.h1);
    if (stuck) failed.push(`${name} 停在登入页`);
    rows.push([label, m]);
    console.log(
      `${label.padEnd(4)} 底部列 ${m.bottomBar ? "有" : "无"}   ` +
      `最大数字 ${(m.big ? Math.round(m.big.px) + "px " + m.big.t : "没有").padEnd(15)} ` +
      `圆图标 ${String(m.round).padStart(2)}   照片 ${String(m.photos).padStart(2)}   ` +
      `横滑 ${m.wide ? "🔴" : "无"}   h1: ${m.h1}${stuck ? "  🔴" : ""}`,
    );
  }

  console.log("\n对那四条：");
  check("① 底部一条分页列", rows.every(([, m]) => m.bottomBar));
  /* ⚠️ ② 要过两关：够大，**而且那个数字是他自己的**。
     第一次跑三页都报 `RM 71,300` —— 那是每一家公司共用的那一个
     示例总数（[任务 94](../docs/founder-tasks.md) 已经记着：收款/开销/佣金
     三页的大数字还是示例）。**一把在假数字上打完分的尺，比不量更糟。** */
  const SAMPLE = /71,?300/;
  check("② 一个大数字当主角（≥ 28px）", rows.some(([, m]) => m.big && m.big.px >= 28),
    rows.map(([l, m]) => `${l} ${m.big ? Math.round(m.big.px) : 0}px`).join(" · "));
  check("②b 而且那个数字是他自己的，不是示例",
    rows.every(([, m]) => !m.big || !SAMPLE.test(m.big.t)),
    rows.filter(([, m]) => m.big && SAMPLE.test(m.big.t)).map(([l, m]) => `${l} ${m.big.t}`).join(" · "));
  check("③ 圆图标格子当捷径", rows.some(([, m]) => m.round >= 4));
  check("④ 一单一张照片", rows.some(([, m]) => m.photos >= 1));
  check("不横滑", rows.every(([, m]) => !m.wide));

  console.log(`\n→ ${OUT}/   ⚠️ 现在用眼睛看，读数只能否决`);
} finally {
  if (userId) await admin.auth.admin.deleteUser(userId);
  if (leadId) await admin.from("leads").delete().eq("id", leadId);
}

process.exit(failed.length ? 1 : 0);
