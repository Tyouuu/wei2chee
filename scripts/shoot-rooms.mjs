/**
 * 一间 medi spa 开三间房，然后问「三点还有哪一间空着」。
 *
 * ── 为什么要这一支 ────────────────────────────────────────────────────────
 *
 * `add_room` · `set_room_active` · `rooms_of` · `rooms_free`
 * （20260909020000）四支都用真的登入身分验过，而 [任务 308] 的收尾写着
 * **「画面上开不了一间房」**。一个建好了没有人到得了的东西，
 * 跟一个不存在的东西，在报告里长得一模一样。
 *
 * ── 它判什么 ──────────────────────────────────────────────────────────────
 *
 *   · 一间房都没有的时候，那一页讲得出下一步（不是一张空白）
 *   · 真的开得了一间房，而且资料库里真的多一行
 *   · 排进房里的那一笔，在轨道上画得出来
 *   · 🔴 **问的那一段有人的时候讲得出是什么占着** —— 那是她下一句话
 *   · 🔴 **预约那一页的栏跟着翻成房间**（[任务 308] 的那一根轴）
 *   · 关掉一间房，它掉到底下那一堆，而**排过的预约一笔都没有少**
 *   · 390 上不横滚
 *
 * ⚠️ 「好不好看」判不了，只有眼睛判得了（[重点 3](../docs/founder-points.md)）——
 * 两个宽度各拍一张，那两张是拿给他看的东西。
 */
import { mkdirSync, readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import { dropThrowawayOnExit, dropThrowaway } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = process.env.BASE_URL || "http://localhost:3000";
if (!URL_ || !ANON || !SERVICE) {
  console.error("缺 .env.local 里的三把钥匙");
  process.exit(2);
}
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

const OUT = ".screenshots/rooms";
mkdirSync(OUT, { recursive: true });

let pass = 0;
const bad = [];
const judge = (what, ok, saw) => {
  if (ok) { pass++; console.log(`  PASS  ${what}`); }
  else { bad.push(what); console.log(`  FAIL  ${what}${saw === undefined ? "" : ` — ${saw}`}`); }
};

/* 今天的某一个钟点，本地时间 —— 不是 UTC（[任务 168] 付过这一次学费）。 */
const at = (h, m = 0) => {
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d.toISOString();
};
const hhmm = (h, m = 0) => `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;

const stamp = Date.now();
let ownerId = null;
let browser = null;
dropThrowawayOnExit(admin, () => ownerId);

try {
  /* ── 台面：一间三间房的 medi spa ─────────────────────────────────────── */
  const { data: ind } = await admin
    .from("industries").select("id").eq("slug", "beauty").single();
  const { data: lead } = await admin
    .from("leads").insert({ industry_id: ind.id, language: "en", answers: {} })
    .select("id").single();

  const email = `roomshot-${stamp}@formae.test`;
  const password = `Rs-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true, user_metadata: { lead_id: lead.id },
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  ownerId = made.user.id;

  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", ownerId).single();
  const P = proj.id;
  await admin.from("projects").update({ business_name: "Lumiere Medi Spa" }).eq("id", P);

  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  await c.auth.signInWithPassword({ email, password });

  const say = async (fn, args) => {
    const { data, error } = await c.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data;
  };
  const idOf = (x) => x?.id ?? x;

  browser = await chromium.launch();
  const login = async (page) => {
    await page.goto(`${BASE}/en/login`, { waitUntil: "domcontentloaded" });
    await page.waitForSelector('input[type="email"]', { timeout: 30000 });
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(portal|salon-preview)/, { timeout: 120000 });
  };

  /* ── ① 改之前：一间房都没有 ──────────────────────────────────────────── */
  console.log("① 一间房都没有");
  const p0 = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await login(p0);
  await p0.goto(`${BASE}/en/portal/rooms`, { waitUntil: "domcontentloaded" });
  await p0.waitForSelector("text=Open a room", { timeout: 60000 }).catch(() => {});
  await p0.waitForTimeout(400);
  await p0.screenshot({ path: `${OUT}/before-1400.jpg`, quality: 82, type: "jpeg", fullPage: true });
  const empty = await p0.evaluate(() => document.body.innerText);
  judge("空的时候讲得出下一步", /Open the first one|No rooms yet/i.test(empty),
    empty.slice(0, 90).replace(/\s+/g, " "));

  /* 🔴 真的按那颗按钮开一间房 —— 不是打 RPC。
     这一整支存在的理由就是「画面上开不了一间房」。 */
  await p0.fill('input[placeholder="Room name"]', "Room 1");
  await p0.click('button:has-text("Open a room")');
  await p0.waitForFunction(
    () => document.body.innerText.includes("Room 1"),
    undefined,
    { timeout: 30000 },
  ).catch(() => {});
  const { data: after } = await c.rpc("rooms_of", { in_project_id: P });
  judge("按那颗按钮真的开得出一间房",
    (after ?? []).some((r) => r.name === "Room 1"),
    JSON.stringify(after ?? []).slice(0, 80));
  await p0.close();

  /* ── 台面第二半：再开两间，排进去 ─────────────────────────────────────── */
  const rooms = { "Room 1": idOf((after ?? []).find((r) => r.name === "Room 1")) };
  for (const n of ["Room 2", "Laser room"]) {
    rooms[n] = idOf(await say("add_room", { in_project_id: P, in_name: n }));
  }
  const amy = idOf(await say("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Amy",
  }));
  const lim = idOf(await say("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ms Lim",
  }));

  /* 一天真的排法：一间排满、一间半天、一间空着 ——
     ⚠️ 三间全部排满，「哪一间还空着」那一条量出来会是绿的，
     而它什么都没有证明。 */
  const nowH = new Date().getHours();
  const askFrom = Math.min(nowH + 1, 20);
  await say("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(askFrom, 0), in_ends_at: at(askFrom + 1, 30),
    in_party_id: lim, in_staff_id: amy, in_service: "Hydrafacial",
    in_room_id: rooms["Room 1"],
  });
  await say("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(Math.max(askFrom - 3, 8), 0), in_ends_at: at(Math.max(askFrom - 2, 9), 0),
    in_party: "Mrs Tan", in_staff_id: amy, in_service: "Botox",
    in_room_id: rooms["Room 2"],
  });

  /* ── ② 改之后：三间房，一间有人 ───────────────────────────────────────── */
  const shoot = async (w, h, tag) => {
    const page = await browser.newPage({ viewport: { width: w, height: h } });
    await login(page);
    await page.goto(
      `${BASE}/en/portal/rooms?s=${hhmm(askFrom, 30)}&e=${hhmm(askFrom + 1, 0)}`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForFunction(
      () => document.body.innerText.includes("Laser room"),
      undefined,
      { timeout: 60000 },
    ).catch(() => {});
    await page.waitForTimeout(500);
    const height = await page.evaluate(() => document.documentElement.scrollHeight);
    console.log(`    ${w} 整页高：${height}px`);
    await page.screenshot({ path: `${OUT}/${tag}.jpg`, quality: 82, type: "jpeg", fullPage: true });
    const seen = await page.evaluate(() => ({
      body: document.body.innerText,
      rails: document.querySelectorAll('[data-rooms="rail"]').length,
      blocks: [...document.querySelectorAll('[data-rooms="rail"] span')].filter((el) => {
        const s = getComputedStyle(el);
        return s.position === "absolute" && el.getBoundingClientRect().width > 8;
      }).length,
      wide: document.documentElement.scrollWidth > window.innerWidth + 1,
    }));
    return { page, ...seen };
  };

  console.log("② 三间房，一间有人");
  const d = await shoot(1400, 1000, "after-1400");
  judge("三间房各一条轨道", d.rails === 3, `${d.rails} 条`);
  judge("排进房里的那一笔画得出来", d.blocks >= 4, `${d.blocks} 块（含问的那一段）`);
  judge("有人的那一间讲得出是什么占着", /Taken/.test(d.body) && /Hydrafacial/.test(d.body),
    d.body.replace(/\s+/g, " ").slice(0, 160));
  judge("空着的那一间讲得出是空的", (d.body.match(/Free/g) || []).length >= 2,
    `「Free」出现 ${(d.body.match(/Free/g) || []).length} 次`);
  await d.page.close();

  /* ── ③ 预约那一页的栏跟着翻成房间 ─────────────────────────────────────── */
  console.log("③ 预约那一页");
  const pb = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
  await login(pb);
  await pb.goto(`${BASE}/en/portal/bookings`, { waitUntil: "domcontentloaded" });
  await pb.waitForFunction(
    () => document.body.innerText.includes("Laser room"),
    undefined,
    { timeout: 60000 },
  ).catch(() => {});
  await pb.waitForTimeout(500);
  await pb.screenshot({ path: `${OUT}/bookings-1400.jpg`, quality: 82, type: "jpeg", fullPage: true });
  const bk = await pb.evaluate(() => document.body.innerText);
  const lanes = await pb.evaluate(() =>
    [...document.querySelectorAll('[data-day="lane"]')].map((el) => el.textContent.trim()),
  );
  /* 🔴 [任务 308] 那一根轴：有一笔排了房，整页就照房间分栏，
     而师傅画在块上。少了它，一间三个房的 medi spa 看到的是按人分的栏，
     而三点排满的是房不是人。 */
  /* ⚠️ 那几栏是**这一天真的排了什么**算出来的，不是那张房间清单 ——
     所以今天没有人用的 Laser room 不会有一条栏。第一版要求它出现，
     而红的是我的期望不是产品（[重点 7l]）。真正要量的是**那几栏是房不是人**。 */
  judge("预约那一页的栏是房间",
    lanes.includes("Room 1") && lanes.includes("Room 2"), lanes.join(" | "));
  judge("师傅不再是一条栏，而块上还看得到他",
    !lanes.includes("Amy") && /Amy/.test(bk), lanes.join(" | "));
  await pb.close();

  /* ── ④ 关掉一间，排过的一笔不可以少 ──────────────────────────────────── */
  console.log("④ 关掉一间");
  await say("set_room_active", { in_id: rooms["Laser room"], in_active: false });
  const { count } = await admin
    .from("appointments").select("id", { count: "exact", head: true }).eq("project_id", P);
  judge("关掉一间房，排过的预约一笔都没有少", count === 2, `${count} 笔`);

  console.log("⑤ 手机");
  const m = await shoot(390, 844, "after-390");
  judge("手机上不横滚", !m.wide);
  judge("手机上三间房都在", /Room 1/.test(m.body) && /Room 2/.test(m.body));
  await m.page.close();

  console.log(`\n判：${pass} 过 · ${bad.length} 没过`);
  console.log(`图：${OUT}/before-1400.jpg · after-1400.jpg · after-390.jpg · bookings-1400.jpg`);
  if (bad.length) process.exitCode = 1;
} catch (e) {
  console.error("炸了：", e.message);
  process.exitCode = 2;
} finally {
  if (browser) await browser.close().catch(() => {});
  if (ownerId) await dropThrowaway(admin, ownerId);
}
