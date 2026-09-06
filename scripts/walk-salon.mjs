/**
 * 一间沙龙，从客人在官网订时段到月底算抽成 —— 走一次，**数她要动手几次**。
 *
 * 跟 `walk:reno` 同一把尺（[任务 231](../docs/founder-tasks.md#231)）：
 *   **每一次老板非自己按不可的呼叫算一次动手**，
 *   系统自己接下去的（顺手扣一次套票 · 触发器）**不算**。
 *   它不判对错，只印读数 —— 「几次算多」是他的判断。
 *
 * 🔴 为什么先走沙龙：那是他手上**唯一签下来的那一个**
 *   （[任务 44](../docs/founder-tasks.md#44)，年费 RM1,000，明年才开始用），
 *   而它刚好压在这几天新做的那几件上（班表 · 套票 · 一颗按钮做两件）。
 *
 * ⚠️ 名字全部是编的。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

const people = [];
const notes = [];
const chain = [];
let acts = 0;

async function person(tag) {
  const email = `salon-${tag}-${Date.now()}@formae.test`;
  const password = `Salon-${Date.now()}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn(${tag}): ${e2.message}`);
  people.push(data.user.id);
  return { id: data.user.id, email, client };
}
dropThrowawayOnExit(admin, () => people[people.length - 1]);

async function act(C, what, fn, args) {
  acts += 1;
  const { data, error } = await C.rpc(fn, args);
  if (error) {
    notes.push(`🔴 ${what}：${error.message}`);
    return null;
  }
  return data;
}
const node = (name, hands, ok, detail) => chain.push({ name, hands, ok, detail });

/* 明天的某一个钟头，用马来西亚的墙上时钟。 */
const slot = (hour) => {
  const d = new Date(Date.now() + 8 * 3600e3);
  d.setUTCDate(d.getUTCDate() + 1);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(),
    hour - 8, 0, 0)).toISOString();
};
const day = (back) => {
  const d = new Date(Date.now() + 8 * 3600e3);
  d.setUTCDate(d.getUTCDate() - back);
  return d.toISOString().slice(0, 10);
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  const slug = `beauty-${Date.now()}`;
  await C.rpc("set_project_style", { new_style: "hearth" });
  await admin.from("projects")
    .update({ business_name: "Bella Hair Studio", site_slug: slug, site_published: true })
    .eq("id", P);
  for (const k of ["bookings", "customers", "staff", "payments", "commission"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } });
  const started = acts;

  /* ── ① 开店：发型师 · 班表 ─────────────────────────────────── */
  let n = acts;
  const girl = await act(C, "建发型师", "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Ah Girl",
  });
  await act(C, "排一个礼拜的班", "set_staff_hours", {
    in_staff_id: girl?.id,
    /* ⚠️ 七天都排 —— 不然「明天」刚好碰上她休的那一天，
       下面那一节的读数会变成在量一件别的事。 */
    in_hours: [0, 1, 2, 3, 4, 5, 6].map((w) => ({
      weekday: w, starts_at: "10:00", ends_at: "19:00",
    })),
  });
  node("开店：一个发型师 ＋ 一个礼拜的班", acts - n, !!girl?.id,
    "两次，而且班表打一次就永远有效");

  /* ── ② 客人在官网自己订 ───────────────────────────────────── */
  const { data: booked, error: bookErr } = await anon.rpc("submit_site_booking", {
    p_slug: slug, visitor_name: "Mrs Tan", visitor_contact: "017-333 2211",
    wants_from: slot(14), wants_to: slot(15), wants_service: "剪 + 染",
  });
  const bookedRow = Array.isArray(booked) ? booked[0] : booked;
  if (bookErr) notes.push(`🔴 客人自己订：${bookErr.message}`);
  node("客人在官网自己订一个时段", 0,
    !bookErr && !!bookedRow, bookErr ? "打不到" : "陌生人做的，她不用动手");

  /* ── ③ 她知道有人订了吗 ───────────────────────────────────── */
  const { data: sig } = await C.rpc("nudges_due", { in_project_id: P });
  const heard = (sig ?? []).some((r) => r.kind === "booking_unseen");
  node("🔴 系统告诉她「官网来了一个预约，你还没看」", 0, heard,
    heard ? "讯号算得出来（而画面那一边还没有人读它）" : "讯号没有出现");

  /* ── ④ 谁有空 ─────────────────────────────────────────────── */
  n = acts;
  const free = await act(C, "问谁有空", "who_is_free", {
    in_project_id: P, in_starts_at: slot(14), in_ends_at: slot(15),
  });
  const her = (free ?? []).find((r) => r.name === "Ah Girl");
  node("「明天下午两点谁有空」", acts - n, !!her,
    her ? `一次；她${her.on_duty ? "上班" : "不上班"}、那个钟头${her.busy ? "有人" : "空的"}`
      : "问不到");

  /* ── ⑤ 卖一张套票 ─────────────────────────────────────────── */
  n = acts;
  const cust = await act(C, "建客户", "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });
  const pack = await act(C, "卖一张套票", "add_service_package", {
    in_party_id: cust?.id, in_name: "洗剪吹 ×10", in_sessions_total: 10,
  });
  await act(C, "收那笔钱", "add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 50_000, in_party: "Mrs Tan", in_party_id: cust?.id,
    in_done_by: girl?.id,
  });
  const { data: dep } = await C.rpc("party_deposit", {
    p_project_id: P, p_party_id: cust?.id,
  });
  node("卖一张十次的套票", acts - n, !!pack?.id,
    `三次（建客户 · 卖套票 · 收钱）；她那边还有 RM ${((dep ?? 0) / 100).toFixed(0)} 没用掉`);

  /* ── ⑥ 🔴 客人来了 —— 一颗按钮做两件 ──────────────────────── */
  n = acts;
  const appt = await act(C, "手上再排一个", "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: slot(16), in_ends_at: slot(17),
    in_party: "Mrs Tan", in_party_id: cust?.id, in_staff_id: girl?.id,
    in_service: "洗剪吹",
  });
  const came = await act(C, "按「来了」", "set_appointment_status", {
    in_id: appt, in_status: "done",
  });
  const cameRow = Array.isArray(came) ? came[0] : came;
  node("🔴 客人来了 → 套票顺手少一次", acts - n,
    cameRow?.why === "used",
    cameRow?.why === "used"
      ? `两次（排 ＋ 按「来了」）；套票**自己**少一次，还剩 ${cameRow.sessions_left}`
      : `扣不到：${cameRow?.why}`);

  /* ── ⑦ 抽成 ───────────────────────────────────────────────── */
  n = acts;
  /* ⚠️ 它收的是 `in_party_id`（名册上那一行），而那几档叫
     `from_cents` / `percent` —— 第三十二次红的是我又猜了一组名字。 */
  await act(C, "写抽成办法", "set_commission_tiers", {
    in_party_id: girl?.id,
    in_tiers: [{ from_cents: 0, percent: 10 }],
    in_effective_from: day(60),
  });
  /* ⚠️ 它收的是**一个月**（`in_month`），不是一段日子 ——
     第三十三次。而那个月要是**马来西亚的这个月**。 */
  const { data: earned, error: seErr } = await C.rpc("staff_earnings", {
    in_project_id: P, in_month: day(0).slice(0, 7),
  });
  if (seErr) notes.push(`🔴 算抽成：${seErr.message}`);
  /* ⚠️ 那几栏叫 `party_id` 跟 `earned_cents` ——
     第三十五次，而这一次是**把它回的东西印出来**才知道的。 */
  const hers = (earned ?? []).find((r) => r.party_id === girl?.id);
  node("这个月她抽多少", acts - n, !!hers,
    hers ? `一次；做了 RM ${((hers.earned_cents ?? 0) / 100).toFixed(0)}、`
      + `抽 RM ${((hers.commission_cents ?? 0) / 100).toFixed(0)}`
      + `（而那份办法是 ${hers.rate_from} 起的）`
      : "算不出来");

  /* ── ⑧ 套票快用完了她知道吗 ───────────────────────────────── */
  for (let i = 0; i < 8; i += 1) {
    await C.rpc("use_package_session", {
      in_package_id: pack?.id, in_idempotency_key: crypto.randomUUID(),
    });
  }
  const { data: sig2 } = await C.rpc("nudges_due", { in_project_id: P });
  const last = (sig2 ?? []).some((r) => r.kind === "package_last");
  node("🔴 系统告诉她「Mrs Tan 那张套票剩最后一次」", 0, last,
    last ? "讯号算得出来（而画面那一边还没有人读它）" : "讯号没有出现");

  /* ── 读数 ─────────────────────────────────────────────────── */
  console.log("\n一间沙龙，从客人在官网订时段到月底算抽成\n");
  let broken = 0;
  for (const c of chain) {
    console.log(`  ${c.ok ? "  " : "🔴"} ${String(c.hands).padStart(2)} 次  ${c.name}`);
    console.log(`         ${c.detail}`);
    if (!c.ok) broken += 1;
  }
  const hands = acts - started;
  const median = [...chain.map((c) => c.hands)].sort((a, b) => a - b)[
    Math.floor(chain.length / 2)];
  console.log(`\n  一共动手 ${hands} 次 · ${chain.length} 节 · ${broken} 节断掉`);
  console.log(`  每一节中位数 ${median} 次`);
  if (notes.length) {
    console.log("\n  路上讲过的话：");
    for (const s of notes) console.log(`    ${s}`);
  }
} catch (err) {
  console.error(`\n🔴 走到一半炸了：${err?.message ?? err}`);
  for (const s of notes) console.error(`    ${s}`);
} finally {
  await dropThrowaways(admin, people);
}
