/**
 * 三碟粿条，出了一碟 —— 用**真的登入身分**打一次。
 *
 * 🔴 `db push` 成功证明不了任何事（[重点 26](../docs/founder-points.md)）。
 *
 * 它守的那几件：
 *   · 🔴 出菜是一个**数字**不是一个勾 —— 三碟出一碟，剩两碟
 *   · 🔴 出得比点的多 → 拒绝，而且讲差多少
 *   · 🔴 加一碟**不动已经出的那几碟**（而整批换会把它归零 —— 那一条在 ⑥）
 *   · 出完的那一行自己从厨房那一屏上走掉
 *   · 🔴 厨房那一屏**一分钱都没有**
 *   · 没有数量的那种行出不了（一行「防水工程」没有「几件」）
 *   · 别人家出不了、也读不到
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
let pass = 0;
let fail = 0;
const check = (what, ok, detail) => {
  if (ok) {
    pass += 1;
    console.log("  PASS  " + what);
  } else {
    fail += 1;
    console.log("  FAIL  " + what + (detail ? " — " + detail : ""));
  }
};
const one = (d) => (Array.isArray(d) ? d[0] : d);
const n = (v) => Number(v);

async function person(tag) {
  const email = "wok-" + tag + "-" + Date.now() + "@formae.test";
  const password = "Wok-" + Date.now() + "-x!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error("createUser(" + tag + "): " + error.message);
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error("signIn(" + tag + "): " + e2.message);
  people.push(data.user.id);
  return { id: data.user.id, email, client };
}
dropThrowawayOnExit(admin, () => people);

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", boss.id)
    .single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "counter" });
  for (const k of ["orders", "customers", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  /* 道具：三号桌坐下，点三碟粿条 ＋ 一杯咖啡。 */
  const { data: t3 } = await C.rpc("add_dining_table", {
    in_project_id: P,
    in_name: "3",
    in_seats: 4,
  });
  const { data: seated, error: seatErr } = await C.rpc("seat_table", {
    in_project_id: P,
    in_table_id: t3.id,
    in_module_key: "orders",
    in_party: "Walk-in",
  });
  const R = one(seated)?.record_id;
  check("道具：三号桌开了台", !seatErr && !!R, seatErr?.message);

  const { error: lineErr } = await C.rpc("set_record_lines", {
    in_record_id: R,
    in_lines: [
      {
        description: "Char kway teow",
        qty: 3,
        unit: "plate",
        unit_price_cents: 900,
        amount_cents: 2700,
      },
      {
        description: "Kopi O",
        qty: 1,
        unit: "cup",
        unit_price_cents: 550,
        amount_cents: 550,
      },
    ],
  });
  check("道具：点了两样", !lineErr, lineErr?.message);
  const { data: lines } = await C.from("record_lines")
    .select("id, description, qty, served_qty")
    .eq("record_id", R)
    .order("sort_order");
  const ckt = lines.find((l) => l.description.startsWith("Char"));
  const kopi = lines.find((l) => l.description.startsWith("Kopi"));
  check("一碟都还没出", n(ckt.served_qty) === 0, String(ckt.served_qty));

  /* ── ① 厨房那一屏 ─────────────────────────────────────────── */
  console.log("\n① 厨房那一屏");
  const q1 = await C.rpc("kitchen_queue", { in_project_id: P }).then((r) => r.data ?? []);
  check("两样都在上面", q1.length === 2, String(q1.length));
  const qCkt = q1.find((r) => r.line_id === ckt.id);
  check("🔴 三碟，一碟没出", n(qCkt?.ordered) === 3 && n(qCkt?.still_due) === 3,
    qCkt?.ordered + " / " + qCkt?.still_due);
  check("讲得出是哪一桌", qCkt?.table_name === "3", String(qCkt?.table_name));
  check("有单号", !!qCkt?.doc_no, String(qCkt?.doc_no));
  check("等了多久算得出来", Number.isInteger(qCkt?.waiting_minutes),
    String(qCkt?.waiting_minutes));
  check(
    "🔴 一分钱都没有 —— 厨房不需要知道那一碟卖多少",
    !Object.keys(qCkt ?? {}).some((k) => /cent|price|amount|total/i.test(k)),
    Object.keys(qCkt ?? {}).join(","),
  );
  check("排最前的是等最久那一碟", q1[0]?.line_id === ckt.id, String(q1[0]?.description));

  /* ── ② 出一碟 ─────────────────────────────────────────────── */
  console.log("\n② 出一碟（三碟里的一碟）");
  const { data: served1, error: s1Err } = await C.rpc("serve_line", {
    in_line_id: ckt.id,
    in_qty: 1,
  });
  const v1 = one(served1);
  check("出得了", !s1Err && v1?.line_id === ckt.id, s1Err?.message);
  check("🔴 出了一碟，还剩两碟 —— 是数字不是勾",
    n(v1?.served) === 1 && n(v1?.still_due) === 2,
    v1?.served + " / " + v1?.still_due);

  const q2 = await C.rpc("kitchen_queue", { in_project_id: P }).then((r) => r.data ?? []);
  check("🔴 它还在厨房那一屏上，写着还剩两碟",
    n(q2.find((r) => r.line_id === ckt.id)?.still_due) === 2,
    String(q2.find((r) => r.line_id === ckt.id)?.still_due));

  /* ── ③ 出多了要挡 ─────────────────────────────────────────── */
  console.log("\n③ 出多了");
  const { error: tooMany } = await C.rpc("serve_line", {
    in_line_id: ckt.id,
    in_qty: 5,
  });
  check("🔴 出得比点的多 → 挡下来", !!tooMany, "居然让它过了");
  check(
    "🔴 而且讲差多少，不是一句「不行」",
    /2/.test(tooMany?.message ?? "") && /3/.test(tooMany?.message ?? ""),
    tooMany?.message,
  );
  const { data: stillTwo } = await C.from("record_lines")
    .select("served_qty")
    .eq("id", ckt.id)
    .single();
  check("被挡下来之后，还是出了一碟", n(stillTwo?.served_qty) === 1,
    String(stillTwo?.served_qty));

  const { error: below } = await C.rpc("serve_line", { in_line_id: ckt.id, in_qty: -5 });
  check("退回去退到负数也挡", !!below, "居然让它过了");
  const { data: backOne } = await C.rpc("serve_line", { in_line_id: ckt.id, in_qty: -1 });
  check("🔴 而退一碟回去是可以的（菜退了、按错了）",
    n(one(backOne)?.served) === 0, String(one(backOne)?.served));
  await C.rpc("serve_line", { in_line_id: ckt.id, in_qty: 1 });

  /* ── ④ 出完了就走掉 ───────────────────────────────────────── */
  console.log("\n④ 出完了");
  await C.rpc("serve_line", { in_line_id: kopi.id, in_qty: 1 });
  const q3 = await C.rpc("kitchen_queue", { in_project_id: P }).then((r) => r.data ?? []);
  check("🔴 咖啡出完了，自己从那一屏上走掉",
    !q3.some((r) => r.line_id === kopi.id), String(q3.length));
  check("而粿条还在（还剩两碟）", q3.some((r) => r.line_id === ckt.id),
    q3.map((r) => r.description).join(","));

  /* ── ⑤ 没有数量的那种行 ───────────────────────────────────── */
  console.log("\n⑤ 没有数量的那种行");
  const { data: lump } = await C.rpc("append_record_line", {
    in_record_id: R,
    in_description: "Service charge",
    in_amount_cents: 300,
  });
  check("加得进去", !!lump?.id, "加不进去");
  const { error: lumpErr } = await C.rpc("serve_line", { in_line_id: lump.id, in_qty: 1 });
  check("🔴 一行没有「几件」的东西出不了，而且讲得出为什么",
    !!lumpErr && /quantity/i.test(lumpErr?.message ?? ""), lumpErr?.message);
  const q4 = await C.rpc("kitchen_queue", { in_project_id: P }).then((r) => r.data ?? []);
  check("🔴 而它也不会挂在厨房那一屏上",
    !q4.some((r) => r.line_id === lump.id), String(q4.length));

  /* ── ⑥ 加一碟，不动已经出的那几碟 ─────────────────────────── */
  console.log("\n⑥ 加一碟（这一条是整支真正的靶）");
  const { data: added, error: addErr } = await C.rpc("append_record_line", {
    in_record_id: R,
    in_description: "Teh ais",
    in_qty: 2,
    in_unit: "cup",
    in_unit_price_cents: 300,
  });
  check("加得了一碟", !addErr && !!added?.id, addErr?.message);
  check("金额自己算出来 RM 6.00", n(added?.amount_cents) === 600,
    String(added?.amount_cents));
  const { data: afterAdd } = await C.from("record_lines")
    .select("id, served_qty")
    .eq("id", ckt.id)
    .single();
  check(
    "🔴 已经出的那一碟粿条还在 —— 加菜没有把厨房归零",
    n(afterAdd?.served_qty) === 1,
    String(afterAdd?.served_qty),
  );
  const { data: recNow } = await C.from("pipeline_records")
    .select("amount_cents")
    .eq("id", R)
    .single();
  check(
    "那张单的总额跟着走：27 + 5.50 + 3 + 6 = RM 41.50",
    n(recNow?.amount_cents) === 4150,
    String(recNow?.amount_cents),
  );
  const { error: blankLine } = await C.rpc("append_record_line", {
    in_record_id: R,
    in_description: "   ",
  });
  check("没有名字的一行加不了", !!blankLine, "居然让它过了");

  /* ── ⑥b 整批换要挡 ───────────────────────────────────────── */
  console.log("\n⑥b 🔴 整批换（那是 20260908050000 那条收紧守的东西）");
  const { error: replaceErr } = await C.rpc("set_record_lines", {
    in_record_id: R,
    in_lines: [
      { description: "Char kway teow", qty: 3, unit: "plate", amount_cents: 2700 },
      { description: "Nasi lemak", qty: 1, unit: "plate", amount_cents: 600 },
    ],
  });
  check("🔴 已经出过菜的单，行不给整批换掉", !!replaceErr, "居然让它过了");
  check(
    "🔴 而且讲得出出路（加一行），不是一句「不行」",
    /line|加一行|另加/i.test(replaceErr?.message ?? ""),
    replaceErr?.message,
  );
  const { data: notWiped } = await C.from("record_lines")
    .select("served_qty")
    .eq("id", ckt.id)
    .single();
  check(
    "🔴 所以那一碟已经出的粿条没有被归零",
    n(notWiped?.served_qty) === 1,
    String(notWiped?.served_qty),
  );

  /* ── ⑦ 厨房那个人 ─────────────────────────────────────────── */
  console.log("\n⑦ 厨房那个人（不是老板）");
  const cook = await person("cook");
  const { error: memErr } = await C.rpc("add_project_member", { in_email: cook.email });
  check("控制组：那个人真的进了这一家", !memErr, memErr?.message);
  const K = cook.client;
  const cookQ = await K.rpc("kitchen_queue", { in_project_id: P }).then((r) => r.data ?? []);
  check("🔴 他看得到还有什么没出", cookQ.length >= 1, String(cookQ.length));
  const { error: cookServe } = await K.rpc("serve_line", { in_line_id: ckt.id, in_qty: 1 });
  check("🔴 他出得了菜", !cookServe, cookServe?.message);

  /* ── ⑧ 别人家 ─────────────────────────────────────────────── */
  console.log("\n⑧ 别人家");
  const other = await person("other");
  const O = other.client;
  await O.rpc("set_project_style", { new_style: "counter" });
  const { data: theirQ } = await O.rpc("kitchen_queue", { in_project_id: P });
  check("🔴 另一家那一屏是空的", (theirQ ?? []).length === 0, String(theirQ?.length));
  const { error: theirServe } = await O.rpc("serve_line", {
    in_line_id: ckt.id,
    in_qty: 1,
  });
  check("🔴 出不了别人家的菜", !!theirServe, "居然让它过了");
  const { error: theirAdd } = await O.rpc("append_record_line", {
    in_record_id: R,
    in_description: "Something else",
    in_qty: 1,
  });
  check("🔴 也加不了别人家那一张单的行", !!theirAdd, "居然让它过了");

  console.log(
    fail === 0
      ? "\n判：全部过（" + people.length + " 个用完就删的帐号）"
      : "\n判：" + pass + " 过 · " + fail + " 没过",
  );
  if (fail > 0) process.exitCode = 1;
} catch (err) {
  console.error("\n🔴 走到一半炸了：" + (err?.message ?? err));
  process.exitCode = 1;
} finally {
  await dropThrowaways(admin, people);
}
