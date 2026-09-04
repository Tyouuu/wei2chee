/**
 * 拍一张收据，看它变成什么 —— 用真的登入、真的图、真的模型。
 *
 * ── 为什么这一支非有不可 ──────────────────────────────────────────────────
 *
 * 单元测试量的是「模型回了这一坨，我们信它多少」，那一段可以在没有网路的
 * 情况下每次结果一样。**这一支量的是另外五段**，而这个仓库的十八次
 * 「说了没做」全部掉在那几段里：
 *
 *   ① 传得进那个桶吗（RLS）
 *   ② 🔴 **师傅读不读得到**（这是这一整件事最贵的一条）
 *   ③ 别人家读不读得到
 *   ④ route 认不认得他的登入
 *   ⑤ 模型看着一张真的马来西亚收据，读出来的是不是那几个数字
 *
 * ⚠️ 而这张收据上**故意印着三个金额**：小计 · TOTAL · 收现金 150.00。
 * 一个照「最大的数字」读的东西会回 15000，而那是他多记 RM 29.50 的方式。
 *
 * 要开着 `npm run dev`。
 */
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { dropThrowaways } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const BASE = process.env.BASE ?? "http://localhost:3000";
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

const made = [];
const uploaded = [];

async function person(tag) {
  const cred = {
    email: `rcpt-${tag}-${Date.now()}@formae.test`,
    password: `Rcpt-${Date.now()}-x!`,
  };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email,
    password: cred.password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);

  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: sErr } = await as.auth.signInWithPassword(cred);
  if (sErr) throw new Error(`sign-in(${tag}): ${sErr.message}`);

  const { data: proj } = await admin
    .from("projects")
    .select("id, system_language")
    .eq("account_id", user.user.id)
    .single();
  return { as, cred, userId: user.user.id, projectId: proj?.id, language: proj?.system_language };
}

/** 一张真的马来西亚现金单，画出来的。
 *  ⚠️ 三个金额是**故意的**：小计 · TOTAL · 收的现金。 */
async function receiptImage() {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="720" height="1000">
  <rect width="720" height="1000" fill="#ffffff"/>
  <g font-family="monospace" fill="#111111">
    <text x="360" y="70" font-size="30" text-anchor="middle" font-weight="bold">SENG HUAT HARDWARE</text>
    <text x="360" y="106" font-size="20" text-anchor="middle">No 12, Jalan Kebun, Klang</text>
    <text x="360" y="134" font-size="20" text-anchor="middle">Tel 03-3341 2233</text>
    <text x="360" y="196" font-size="26" text-anchor="middle" font-weight="bold">CASH BILL</text>
    <text x="60"  y="250" font-size="22">Date : 01/09/2026</text>
    <text x="420" y="250" font-size="22">No : 004512</text>
    <line x1="60" y1="278" x2="660" y2="278" stroke="#111111" stroke-width="2"/>
    <text x="60"  y="330" font-size="22">Cement 50kg</text>
    <text x="360" y="330" font-size="22">5 x 24.10</text>
    <text x="660" y="330" font-size="22" text-anchor="end">120.50</text>
    <line x1="60" y1="368" x2="660" y2="368" stroke="#111111" stroke-width="2"/>
    <text x="60"  y="412" font-size="22">Subtotal</text>
    <text x="660" y="412" font-size="22" text-anchor="end">120.50</text>
    <text x="60"  y="462" font-size="26" font-weight="bold">TOTAL</text>
    <text x="660" y="462" font-size="26" text-anchor="end" font-weight="bold">RM 120.50</text>
    <text x="60"  y="512" font-size="22">Cash</text>
    <text x="660" y="512" font-size="22" text-anchor="end">RM 150.00</text>
    <text x="60"  y="552" font-size="22">Change</text>
    <text x="660" y="552" font-size="22" text-anchor="end">RM 29.50</text>
    <line x1="60" y1="590" x2="660" y2="590" stroke="#111111" stroke-width="2"/>
    <text x="360" y="640" font-size="20" text-anchor="middle">Terima kasih</text>
  </g>
</svg>`;
  return await sharp(Buffer.from(svg)).jpeg({ quality: 92 }).toBuffer();
}

/** 一张什么都没有的纸。**它要回 null，不是回一个猜的数字。** */
async function blankImage() {
  return await sharp({
    create: { width: 600, height: 800, channels: 3, background: "#d9d9d9" },
  })
    .jpeg({ quality: 60 })
    .toBuffer();
}

const run = async () => {
  console.log("\n── 建两家，一个师傅 ──────────────────────────────────────");
  const boss = await person("boss");
  const other = await person("other");
  const hand = await person("hand");
  check("老板有一家", !!boss.projectId);

  /* 师傅进老板那一家。走人按的那一支。 */
  const { error: invErr } = await boss.as.rpc("add_project_member", {
    in_email: hand.cred.email,
    in_role: "staff",
  });
  if (invErr) {
    /* 名字不对就把整支停掉 —— 一支猜函式名的检查，是一支会静静跳过
       最重要那一条的检查。 */
    throw new Error(`add_project_member: ${invErr.message}`);
  }
  const { data: hw } = await hand.as.rpc("my_workspace");
  check("师傅站在老板那一家", hw?.[0]?.project_id === boss.projectId, JSON.stringify(hw));
  check("而且他不是老板", hw?.[0]?.role === "staff");

  console.log("\n── 传一张收据进去 ────────────────────────────────────────");
  const bytes = await receiptImage();
  const path = `${boss.projectId}/${randomUUID()}.jpg`;
  const { error: upErr } = await boss.as.storage
    .from("receipts")
    .upload(path, bytes, { contentType: "image/jpeg" });
  check("老板传得进去", !upErr, upErr?.message);
  if (!upErr) uploaded.push(path);

  const { data: back, error: dlErr } = await boss.as.storage.from("receipts").download(path);
  check("老板读得回来", !dlErr && !!back, dlErr?.message);

  console.log("\n── 🔴 谁读不到（这一段是这一整件事的理由）────────────────");
  const { data: handRead, error: handErr } = await hand.as.storage.from("receipts").download(path);
  check("师傅读不到老板的收据", !handRead || !!handErr, handErr ? "" : "他读到了");

  const { error: handUpErr } = await hand.as.storage
    .from("receipts")
    .upload(`${boss.projectId}/${randomUUID()}.jpg`, bytes, { contentType: "image/jpeg" });
  check("师傅也传不进去", !!handUpErr, handUpErr ? "" : "他传进去了");

  const { data: otherRead, error: otherErr } = await other.as.storage
    .from("receipts")
    .download(path);
  check("别人家读不到", !otherRead || !!otherErr, otherErr ? "" : "他读到了");

  console.log("\n── 他自己用过的那个词 ────────────────────────────────────");
  const seeded = await boss.as.rpc("add_ledger_entry", {
    in_project_id: boss.projectId,
    in_module_key: "expenses",
    in_direction: "out",
    in_amount_cents: 5000,
    in_party: "Kedai Lama",
    in_note: "seed",
    in_category: "Materials",
  });
  check("种了一笔 Materials 的开销", !seeded.error, seeded.error?.message);

  console.log("\n── 用真的登入打那支 route ────────────────────────────────");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let ok = true;
  try {
    await page.goto(`${BASE}/en/login`, { waitUntil: "networkidle", timeout: 90000 });
    await page.fill('input[type="email"]', boss.cred.email);
    await page.fill('input[type="password"]', boss.cred.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/portal/, { timeout: 90000 });

    const res = await page.request.post(`${BASE}/api/receipt`, { data: { path }, timeout: 180000 });
    const body = await res.json();
    check("route 认得他的登入", res.status() !== 401 && res.status() !== 403, `${res.status()}`);
    check("读到了", body.ok === true, JSON.stringify(body).slice(0, 200));

    if (body.ok) {
      const d = body.draft;
      console.log(`        读了 ${(body.tookMs / 1000).toFixed(1)} 秒`);
      console.log(`        ${JSON.stringify(d)}`);
      /* 🔴 三个金额里挑对了那一个。150.00 是他给的现金，不是他花的钱。 */
      check("金额是 TOTAL，不是收的现金", d.amount === "120.50", d.amount);
      /* 01/09/2026 在这个市场是 9 月 1 号，不是 1 月 9 号。 */
      check("日期照日在前读", d.entryOn === "2026-09-01", d.entryOn);
      check("店名读到了", /seng\s*huat/i.test(d.party), d.party);
      check("类别只能是他用过的那个词", d.category === "Materials" || d.category === "", d.category);
      check("买了什么写了一句", d.note.length > 0, d.note);
      check("没有编出问题来", Array.isArray(d.troubles));
    }

    console.log("\n── 🔴 一张什么都没有的纸 ────────────────────────────────");
    const blankPath = `${boss.projectId}/${randomUUID()}.jpg`;
    const { error: bErr } = await boss.as.storage
      .from("receipts")
      .upload(blankPath, await blankImage(), { contentType: "image/jpeg" });
    if (!bErr) uploaded.push(blankPath);
    const res2 = await page.request.post(`${BASE}/api/receipt`, {
      data: { path: blankPath },
      timeout: 180000,
    });
    const body2 = await res2.json();
    if (body2.ok) {
      const d = body2.draft;
      console.log(`        ${JSON.stringify(d)}`);
      check("它不编一个金额出来", d.amount === "", d.amount);
      check("它不编一个日期出来", d.entryOn === "", d.entryOn);
      check("而且它讲得出为什么", d.troubles.length > 0 || d.said.length > 0, JSON.stringify(d));
      check("那几句话是给他看的，不是错误码", (body2.troubleLines ?? []).every((s) => s.length > 8));
    } else {
      check("空白那张至少没有当机", body2.reason === "read-failed", JSON.stringify(body2));
    }

    console.log("\n── 别人家的路径打不进来 ─────────────────────────────────");
    const res3 = await page.request.post(`${BASE}/api/receipt`, {
      data: { path: `${other.projectId}/${randomUUID()}.jpg` },
      timeout: 60000,
    });
    check("换成别人家的 project 会被挡", res3.status() === 403, `${res3.status()}`);
  } catch (err) {
    ok = false;
    check("浏览器那一段跑完了", false, String(err).slice(0, 200));
  } finally {
    await browser.close();
  }

  console.log("\n── 帐本记得这一笔花掉的钱 ───────────────────────────────");
  const { data: usage } = await admin
    .from("ai_usage")
    .select("surface, outcome, took_ms")
    .eq("surface", "receipt")
    .order("created_at", { ascending: false })
    .limit(3);
  check("帐本里有 receipt 这一格", (usage ?? []).length > 0, JSON.stringify(usage));

  console.log("\n── 存进那一笔开销，照片跟着它 ───────────────────────────");
  const made1 = await boss.as.rpc("add_ledger_entry", {
    in_project_id: boss.projectId,
    in_module_key: "expenses",
    in_direction: "out",
    in_amount_cents: 12050,
    in_party: "SENG HUAT HARDWARE",
    in_entry_on: "2026-09-01",
    in_category: "Materials",
    in_note: "Cement 50kg x 5",
    in_receipt_url: path,
  });
  check("开销存进去了", !made1.error, made1.error?.message);
  const entryId = made1.data?.id ?? made1.data?.[0]?.id;
  if (entryId) {
    const { data: row } = await admin
      .from("ledger_entries")
      .select("receipt_url, amount_cents, entry_on, category")
      .eq("id", entryId)
      .single();
    check("那一栏存的是路径", row?.receipt_url === path, row?.receipt_url ?? "null");
    check("金额对得上", Number(row?.amount_cents) === 12050, String(row?.amount_cents));
    check("日期对得上", row?.entry_on === "2026-09-01", String(row?.entry_on));
  }

  console.log("\n── 🔴 那一栏存不进一个网址 ──────────────────────────────");
  const badUrl = await boss.as.rpc("add_ledger_entry", {
    in_project_id: boss.projectId,
    in_module_key: "expenses",
    in_direction: "out",
    in_amount_cents: 100,
    in_note: "url probe",
    in_receipt_url: "https://example.test/signed-and-expiring.jpg",
  });
  check("网址被资料库挡下来", !!badUrl.error, badUrl.error ? "" : "它进去了");

  return ok;
};

let exitCode = 0;
try {
  await run();
} catch (err) {
  console.error(`\n🔴 ${String(err).slice(0, 400)}`);
  exitCode = 1;
} finally {
  console.log("\n── 收干净 ────────────────────────────────────────────────");
  /* 🔴 档案先删，帐号后删 —— 反过来的话储存里会留下孤儿，而它们的
     project 已经不在了，之后没有人删得掉。 */
  if (uploaded.length) {
    const { error } = await admin.storage.from("receipts").remove(uploaded);
    if (error) console.error(`  🔴 收据删不掉：${error.message}`);
    else console.log(`  删掉 ${uploaded.length} 张收据`);
  }
  const stuck = await dropThrowaways(admin, made);
  console.log(`  删掉 ${made.length - stuck.length}/${made.length} 个临时帐号`);
  if (stuck.length) exitCode = 1;
}

console.log(
  failed.length ? `\n判：${failed.length} 条没过 —— ${failed.join(" · ")}\n` : "\n判：全部过了\n",
);
process.exit(exitCode || (failed.length ? 1 : 0));
