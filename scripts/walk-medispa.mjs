/**
 * 一间 medi spa，从客人在官网订时段到「上一次帮她打了什么」——
 * 走一次，**数她要动手几次**。
 *
 * 跟 `walk:salon` · `walk:tuition` 同一把尺（[任务 231](../docs/founder-tasks.md#231)）：
 *   **每一次老板非自己按不可的呼叫算一次动手**，
 *   系统自己接下去的（架上顺手少一支 · 触发器）**不算**。
 *   它不判对错，只印读数 —— 「几次算多」是他的判断。
 *
 * 🔴 为什么要有这一趟：他 2026-09-09 讲
 *   `第一個禮拜我會拿著我的demo去上門詢問店家 我要主推的就是saloon跟medi spa`，
 *   而三个行业里**只有 medi spa 一趟都没有走过**。
 *   沙龙那一趟走的是「订时段 · 套票 · 抽成」——
 *   而一间 medi spa 跟一间沙龙差的不是那几样，是**针打下去之前那一张纸**、
 *   **打了什么打在哪里**、**用掉哪一支、那一支什么时候过期**。
 *   这三件全部是 9-09 才做出来的，而**没有一件被人从头到尾走过一次**。
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
  const email = `medispa-${tag}-${Date.now()}@formae.test`;
  const password = `Medispa-${Date.now()}-x!`;
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

/* 一次动手。⚠️ **只有她非自己按不可的才走这一支** ——
   我为了验收而多问的那几句走 `C.rpc` 直接打，不然读数量的是我，不是她。 */
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
/* 往回数 `back` 天；负数就是往后。效期那两批用的是往后。 */
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
  const slug = `medispa-${Date.now()}`;
  await C.rpc("set_project_style", { new_style: "hearth" });
  await admin.from("projects")
    .update({ business_name: "Lumiere Aesthetics", site_slug: slug, site_published: true })
    .eq("id", P);
  /* 开箱那一组就是 `beauty` 那一组（`pages_for_industry`）——
     沙龙跟 medi spa 今天共用同一组，而这一趟顺手量的就是那一句成不成立。 */
  for (const k of ["bookings", "customers", "staff", "payments", "inventory", "commission"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } });
  const started = acts;

  /* ── ① 开店：美疗师 · 班表 ─────────────────────────────────── */
  let n = acts;
  const nurse = await act(C, "建美疗师", "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Sister Lim",
  });
  await act(C, "排一个礼拜的班", "set_staff_hours", {
    in_staff_id: nurse?.id,
    in_hours: [0, 1, 2, 3, 4, 5, 6].map((w) => ({
      weekday: w, starts_at: "10:00", ends_at: "20:00",
    })),
  });
  node("开店：一个美疗师 ＋ 一个礼拜的班", acts - n, !!nurse?.id,
    "两次，而且班表打一次就永远有效");

  /* ── ② 🔴 架上那两批，一批快过期 ──────────────────────────────
     一间沙龙的货架上是洗发水；一间 medi spa 的货架上是**会过期的针剂**，
     而「哪一支先用」不是偏好，是钱跟安全。 */
  n = acts;
  const vial = await act(C, "建一件货（肉毒）", "add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "Botulinum toxin 100u", in_unit: "支", in_cost_cents: 45_000,
  });
  const soon = await act(C, "开一个快过期的批号", "add_stock_batch", {
    in_item_id: vial?.id, in_code: "LOT-A", in_expiry_on: day(-45),
  });
  const later = await act(C, "开一个新的批号", "add_stock_batch", {
    in_item_id: vial?.id, in_code: "LOT-B", in_expiry_on: day(-300),
  });
  await act(C, "快过期那一批进 3 支", "move_stock", {
    in_item_id: vial?.id, in_direction: "in", in_qty: 3,
    in_reason: "supplier", in_batch_id: soon?.id,
  });
  await act(C, "新那一批进 5 支", "move_stock", {
    in_item_id: vial?.id, in_direction: "in", in_qty: 5,
    in_reason: "supplier", in_batch_id: later?.id,
  });
  node("🔴 架上两批肉毒，一批 45 天后过期", acts - n,
    !!vial?.id && !!soon?.id && !!later?.id,
    `${acts - n} 次（建货 · 两个批号 · 两次收货）—— 而建货那一次一辈子只做一次`);

  /* ── ③ 客人在官网自己订 ───────────────────────────────────── */
  const { data: booked, error: bookErr } = await anon.rpc("submit_site_booking", {
    p_slug: slug, visitor_name: "Ms Chong", visitor_contact: "012-777 8899",
    wants_from: slot(15), wants_to: slot(16), wants_service: "Botox consultation",
  });
  if (bookErr) notes.push(`🔴 客人自己订：${bookErr.message}`);
  /* ⚠️ 它回的是 `ok:<那一笔的号>`，不是 `ok` —— 第一次跑红的是这一条，
     而**红的是我的断言，产品一个字都没错**（[重点 31] 最后那一段）。 */
  node("客人在官网自己订一个时段", 0,
    !bookErr && String(booked ?? "").startsWith("ok"),
    bookErr ? "打不到" : "陌生人做的，她不用动手");

  /* ── ④ 🔴 针打下去之前那一张纸 ────────────────────────────────
     这一整节是 medi spa 跟沙龙真正的分界线。
     Aoikumo（马来西亚，我们真正的对手）把它放在**最高那一档**：
     `Electronic Forms & Documents（indemnity & consultation form）`。 */
  n = acts;
  const { data: appts } = await C.from("appointments")
    .select("id").eq("project_id", P).eq("source", "website").limit(1);
  const appt = appts?.[0]?.id;
  const form = await act(C, "写一次同意书范本", "add_consent_form", {
    in_project_id: P, in_name: "Botox consent",
    in_body: "I understand bruising and asymmetry are possible. "
      + "I have disclosed any pregnancy, allergy and medication.",
  });
  /* 🔴 **不重打她的名字跟号码**（`claim_booking_party`，20260909240000）——
     她刚刚才在官网上打过一次。这一支之前这一行是
     `add_directory_entry(in_name: "Ms Chong")`，也就是**一次抄写**
     （[重点 29](../docs/founder-points.md)）。 */
  const her = await act(C, "把官网那一笔认成客人", "claim_booking_party", {
    in_appointment_id: appt,
  });
  const asked = await act(C, "发给她签", "request_consent", {
    in_party_id: her?.id, in_form_id: form?.id,
  });
  /* 🔴 她在自己的手机上签，**没有登入过**（`/c/<ref>`）——
     所以这一下不算她动手。 */
  const { data: signed, error: signErr } = await anon.rpc("sign_consent", {
    in_ref: asked?.share_ref, in_name: "Chong Mei Ling",
    in_note: "No medication",
  });
  if (signErr) notes.push(`🔴 她签不了：${signErr.message}`);
  const back = await act(C, "看她签了没有", "consents_of", { in_party_id: her?.id });
  const done = (back ?? []).find((r) => r.signed_at);
  node("🔴 针打下去之前那一张纸（她自己在手机上签）", acts - n,
    signed === "ok" && !!done && her?.phone === "012-777 8899",
    `${acts - n} 次（范本 · 认人 · 发给她 · 看签了没有）—— `
    + "🔴 **范本一辈子写一次**，往后每一个客人只有「发给她」那一次；"
    + `她的名字跟号码（${her?.phone ?? "没带过来"}）是**她自己在官网上打的**，`
    + `老板一个字都没有重打；签名那一下也是她自己做的，`
    + `${done ? `签的是「${done.signed_name}」` : "而她没签成"}`);

  /* ── ⑤ 客人来了 ───────────────────────────────────────────── */
  n = acts;
  const came = await act(C, "按「来了」", "set_appointment_status", {
    in_id: appt, in_status: "done",
  });
  const cameRow = Array.isArray(came) ? came[0] : came;
  node("官网订的那一个，按一下「来了」", acts - n,
    cameRow?.status === "done",
    `${acts - n} 次；而那一笔本来就是客人自己订进来的，她一个字都没有打过`);

  /* ── ⑥ 🔴 打了什么 · 打在哪里 · 用掉哪一支 ────────────────────
     Zenoti 的原话：`Product, units, lot number, treatment areas recorded as
     structured fields; linked to inventory`。最后那三个字是这一节的靶：
     **架上要真的少一支**，不然她要记两次，而第二次三个月后就不记了。 */
  n = acts;
  const note1 = await act(C, "记这一次做了什么", "add_treatment_note", {
    in_party_id: her?.id, in_what: "Botox", in_area: "Forehead, glabella",
    in_appointment_id: appt, in_staff_id: nurse?.id,
    in_note: "20 units total",
  });
  /* 🔴 **不讲用哪一支** —— 让它自己拿效期最早那一批。 */
  const used = await act(C, "用掉一支", "add_treatment_product", {
    in_note_id: note1?.id, in_item_id: vial?.id, in_qty: 1,
  });
  const { data: lots } = await C.rpc("batches_of", { in_item_id: vial?.id });
  const lotA = (lots ?? []).find((b) => b.code === "LOT-A");
  const lotB = (lots ?? []).find((b) => b.code === "LOT-B");
  node("🔴 记一次疗程 → 架上自己少一支，而且少的是快过期那一批", acts - n,
    !!used?.id && Number(lotA?.on_hand) === 2 && Number(lotB?.on_hand) === 5,
    `${acts - n} 次（记疗程 · 用掉一支）—— `
    + `快过期那一批剩 ${lotA?.on_hand ?? "?"} 支、新的那一批还是 ${lotB?.on_hand ?? "?"} 支。`
    + "🔴 她**没有讲**用哪一支，而库存那一边她一次都没有动手");

  /* ── ⑦ 🔴 她上一次做了什么 ────────────────────────────────────
     这一句是她三个月后站在客人面前会问的那一句。 */
  n = acts;
  const history = await act(C, "问她上一次做了什么", "treatment_notes_of", {
    in_party_id: her?.id,
  });
  const last = (history ?? [])[0];
  /* ⚠️ 那几个键叫 `item` / `qty` / `unit` / `batch` —— 我第一次写的是
     `item_name` / `batch_code`，而画面上印出来是 `undefined`。**又是猜名字。** */
  const prod = (last?.products ?? [])[0];
  node("🔴 「她上一次做了什么、用了哪一支」", acts - n,
    !!last && !!prod?.batch,
    last
      ? `${acts - n} 次；${last.done_on} · ${last.what} · ${last.area} · `
        + `${last.staff_name || "—"} · `
        + `${prod ? `${prod.item} ${prod.qty}${prod.unit ?? ""}` : "没有用料"}`
        + `${prod?.batch ? ` · 批号 ${prod.batch}` : "（🔴 答不出批号）"}`
      : "问不到");

  /* ── ⑧ 🔴 四个月后叫她回来 ────────────────────────────────────
     肉毒撑三到四个月。一间 medi spa 的续单不是靠客人记得，
     是靠她那一份「该回来了」的名单（`due_visits`）。 */
  n = acts;
  const again = await act(C, "约她四个月后回来", "add_service_contract", {
    in_project_id: P, in_party_id: her?.id, in_title: "Botox top-up",
    in_every_months: 4, in_starts_on: day(0),
  });
  /* ⚠️ 它自己那个窗口是「往回 60 天、往前 30 天」，而四个月在窗外 ——
     所以这里明说要看到明年（**不是把日子往回搬到窗里**，那是在替读数造假）。 */
  const { data: due } = await C.rpc("due_visits", {
    in_project_id: P, in_from: day(-1), in_until: day(-150),
  });
  const hers = (due ?? []).find((r) => r.party_id === her?.id);
  node("🔴 四个月后该回来那一份名单", acts - n,
    !!again?.id && !!hers,
    hers
      ? `${acts - n} 次（约一次，往后**每一轮自己长出来**）；`
        + `名单上：${hers.party} · ${hers.title} · ${hers.due_on}`
      : "名单上没有她");

  /* ── ⑨ 快过期的那几支她知道吗 ─────────────────────────────── */
  const { data: soonList } = await C.rpc("expiring_soon", {
    in_project_id: P, in_days: 90,
  });
  const warned = (soonList ?? []).find((r) => r.code === "LOT-A");
  node("🔴 「LOT-A 还剩两支，45 天后过期」", 0, !!warned,
    warned
      ? `她不用动手；还剩 ${warned.on_hand} ${warned.unit || "支"}、`
        + `${warned.days_left} 天后过期`
      : "算不出来");

  /* ── ⑩ 收钱 · 这一笔算谁的 ────────────────────────────────── */
  n = acts;
  await act(C, "写抽成办法", "set_commission_tiers", {
    in_party_id: nurse?.id,
    in_tiers: [{ from_cents: 0, percent: 12 }],
    in_effective_from: day(60),
  });
  await act(C, "收这一次的钱", "add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 120_000, in_party: "Ms Chong", in_party_id: her?.id,
    in_done_by: nurse?.id,
  });
  const { data: earned } = await C.rpc("staff_earnings", {
    in_project_id: P, in_month: day(0).slice(0, 7),
  });
  const pay = (earned ?? []).find((r) => r.party_id === nurse?.id);
  node("这个月她抽多少", acts - n, !!pay,
    pay
      ? `${acts - n} 次（办法写一次 · 收钱一次）；做了 RM `
        + `${((pay.earned_cents ?? 0) / 100).toFixed(0)}、抽 RM `
        + `${((pay.commission_cents ?? 0) / 100).toFixed(0)}`
      : "算不出来");

  /* ── ⑪ 🔴 明天那一个还没签 ───────────────────────────────────
     20260909210000。这一趟第一次走完的时候十节零断，
     而少的就是这一句：她不会每天去翻谁签过谁没签，
     她要的是打开系统那一秒看到「明天三点那个还没签」。

     ⚠️ 控制组在同一节里：**Ms Chong 签过，所以她不该出现** ——
     一条对每一个客人都讲的讯号，跟一条对的讯号，
     在读数上长得一模一样。 */
  n = acts;
  const aida = await act(C, "建第二个客户", "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ms Aida",
  });
  const soonAppt = await act(C, "排她明天来", "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: slot(11), in_ends_at: slot(12),
    in_party: "Ms Aida", in_party_id: aida?.id, in_service: "Botox",
  });
  const { data: sig } = await C.rpc("nudges_due", { in_project_id: P });
  const unsigned = (sig ?? []).filter((r) => r.kind === "consent_unsigned");
  node("🔴 「明天要来的那一个，同意书还没签」", acts - n,
    unsigned.length === 1 && unsigned[0].subject_id === soonAppt,
    unsigned.length === 1
      ? `${acts - n} 次（都是排一个新客人本来就要做的）——`
        + `系统自己讲：「${unsigned[0].body}」。`
        + "🔴 而签过的那一个**没有**出现在这份名单上"
      : `名单上有 ${unsigned.length} 条 —— 应该刚好一条`);

  /* ── 读数 ─────────────────────────────────────────────────── */
  console.log("\n一间 medi spa，从官网订时段到「上一次帮她打了什么」\n");
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
