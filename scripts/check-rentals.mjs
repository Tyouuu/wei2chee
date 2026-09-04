/**
 * 押金 · 租赁 —— 用真的身分打（器材租借 · 婚纱 · 桌椅帐篷）。
 *
 * 🔴 这一支要守的最要紧那一条不是「借得出去」，是 ②：
 *   **一件婚纱借出去，架上那一件当场变 0** —— 所以没有人订得了第二次。
 *   那不是多写的功能，那是把租赁挂在既有零件上顺手拿到的，
 *   而它一断掉，画面上完全看不出来（架上照样写着 1）。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways } from "./lib/throwaway.mjs";

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

const failed = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failed.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const made = [];
/**
 * 🔴 **马来西亚的今天，不是伺服器的。**
 *
 * 别的检查脚本这个helper 是照 UTC 算的，而它们都过 —— 因为它们不数天数。
 * 这一支要数「逾期几天」，而产品那一边用的是 `today_myt()`（UTC+8）。
 * 照 UTC 算，**马来西亚早上八点之前跑，每一个天数都会差一天**，
 * 而那一条红看起来会像产品坏了。我第一版就是那样，**第九次红的是我的道具**。
 */
const day = (n) => {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function person(tag, pages) {
  const cred = {
    email: `rnt-${tag}-${Date.now()}@formae.test`,
    password: `Rnt-${Date.now()}-x!`,
  };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email, password: cred.password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);

  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: sErr } = await as.auth.signInWithPassword(cred);
  if (sErr) throw new Error(`sign-in(${tag}): ${sErr.message}`);

  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", user.user.id).single();
  for (const k of pages) await as.rpc("add_project_page", { requested_key: k, new_title: k });
  return { as, cred, userId: user.user.id, projectId: proj?.id };
}

async function onHand(c, projectId, name) {
  const { data } = await c
    .from("stock_on_hand").select("name, on_hand").eq("project_id", projectId);
  const row = (data ?? []).find((r) => r.name === name);
  return row ? Number(row.on_hand) : null;
}

try {
  const shop = await person("shop", ["orders", "inventory", "payments", "projects", "quotations"]);
  const other = await person("other", ["orders", "inventory"]);
  const c = shop.as;
  const P = shop.projectId;
  if (!P) throw new Error("找不到那一家的专案");

  /* 一件架上的东西：**只有一件**。那正是这一整支的重点。 */
  const { data: gown } = await c.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "Bridal gown A", in_unit: "pcs",
  });
  await c.rpc("move_stock", {
    in_item_id: gown.id, in_direction: "in", in_qty: 1, in_reason: "Opening",
  });
  check("架上有一件婚纱", (await onHand(c, P, "Bridal gown A")) === 1);

  const { data: order } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "Wedding 12 Oct", in_party: "Mr Tan", in_amount_cents: 80000,
  });

  /* ── ① 押金那一半：帐上已经有了，不做第二份 ────────────────────────── */
  console.log("\n① 押金就是一笔还没分摊的钱（帐上那一份，不是第二份）");
  const { data: dep, error: depErr } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_direction: "in", in_amount_cents: 50000,
    in_party: "Mr Tan", in_note: "Deposit",
  });
  check("押金收得进来", !depErr && !!dep?.id, depErr?.message);
  check("而且它是「还没用完」的那一笔",
    Number(dep?.amount_cents) - Number(dep?.allocated_cents ?? 0) === 50000,
    `${dep?.amount_cents} / ${dep?.allocated_cents}`);

  /* ── ② 🔴 借出去，架上当场少一件 ─────────────────────────────────────── */
  console.log("\n② 🔴 借出去，架上那一件当场变 0");
  const { data: lent, error: lendErr } = await c.rpc("lend_item", {
    in_record_id: order.id,
    in_descr: "Bridal gown A",
    in_item_id: gown.id,
    in_qty: 1,
    /* ⚠️ 借出日要一起写 —— 我第一版只写归还日在两天前，
       而那支函式正确地挡下来了（还不出去的东西不可能先借出去）。
       **红的是我的道具，不是产品**（第八次）。 */
    in_out_on: day(-7),
    in_due_back_on: day(-2),
    in_deposit_entry_id: dep.id,
    in_note: "Collected at shop",
  });
  check("借得出去", !lendErr && !!lent?.id, lendErr?.message);
  check("🔴 架上当场变 0（所以订不了第二次）",
    (await onHand(c, P, "Bridal gown A")) === 0,
    `架上 ${await onHand(c, P, "Bridal gown A")}`);
  check("🔴 那一行上没有押金金额，只有一根指针",
    lent?.deposit_entry_id === dep.id && !("deposit_cents" in (lent ?? {})),
    Object.keys(lent ?? {}).join(","));

  /* ── ③ 现在有什么在外面 · 逾期几天 ───────────────────────────────────── */
  console.log("\n③ 现在有什么在外面，逾期的排最前面");
  const { data: out, error: outErr } = await c.rpc("rentals_out", { in_project_id: P });
  check("列得出来", !outErr && (out ?? []).length === 1, outErr?.message);
  check("🔴 逾期两天是算出来的", Number(out?.[0]?.days_over) === 2, `${out?.[0]?.days_over}`);
  check("而且写得出是哪一张单的", out?.[0]?.doc_no === (await (async () => {
    const { data } = await admin.from("pipeline_records").select("doc_no").eq("id", order.id).single();
    return data?.doc_no;
  })()), out?.[0]?.doc_no);

  /* 没写归还日的排最后，而且不算逾期。 */
  const { data: openEnded } = await c.rpc("lend_item", {
    in_record_id: order.id, in_descr: "Veil", in_qty: 1,
  });
  const { data: out2 } = await c.rpc("rentals_out", { in_project_id: P });
  check("没写归还日的也在清单上", (out2 ?? []).length === 2);
  check("🔴 但它不算逾期，而且排在后面",
    out2?.[out2.length - 1]?.id === openEnded.id
      && Number(out2?.[out2.length - 1]?.days_over) === 0,
    JSON.stringify((out2 ?? []).map((r) => [r.descr, r.days_over])));

  /* ── ④ 还回来 ────────────────────────────────────────────────────────── */
  console.log("\n④ 还回来");
  const { data: back, error: backErr } = await c.rpc("return_rental", {
    in_rental_id: lent.id, in_note: "Small stain, kept RM 50",
  });
  check("还得回来", !backErr && !!back?.returned_on, backErr?.message);
  check("🔴 架上自己回到 1", (await onHand(c, P, "Bridal gown A")) === 1,
    `架上 ${await onHand(c, P, "Bridal gown A")}`);
  const { data: outAfter } = await c.rpc("rentals_out", { in_project_id: P });
  check("还了就不在「还在外面」上", !(outAfter ?? []).some((r) => r.id === lent.id));

  const { data: hist } = await c.rpc("rentals_of", { in_record_id: order.id });
  const closed = (hist ?? []).find((r) => r.id === lent.id);
  check("🔴 还了之后，逾期那一栏讲的是「迟了几天还」", Number(closed?.days_over) === 2,
    `${closed?.days_over}`);
  check("他写的那句话留着", (closed?.note ?? "").includes("Small stain"), closed?.note);

  const { error: twiceErr } = await c.rpc("return_rental", { in_rental_id: lent.id });
  check("🔴 还过了不给再还（不然架上会多一件）", !!twiceErr, "居然让它过了");
  check("而且架上还是 1", (await onHand(c, P, "Bridal gown A")) === 1);

  /* ── ⑤ 少还了一件 ────────────────────────────────────────────────────── */
  console.log("\n⑤ 借五张桌子，还四张");
  const { data: table } = await c.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "Round table", in_unit: "pcs",
  });
  await c.rpc("move_stock", {
    in_item_id: table.id, in_direction: "in", in_qty: 10, in_reason: "Opening",
  });
  const { data: tables } = await c.rpc("lend_item", {
    in_record_id: order.id, in_descr: "Round table", in_item_id: table.id, in_qty: 5,
  });
  check("借出去五张，架上剩五张", (await onHand(c, P, "Round table")) === 5);
  const { data: four, error: fourErr } = await c.rpc("return_rental", {
    in_rental_id: tables.id, in_qty: 4,
  });
  check("🔴 少还一张照样收得回来", !fourErr && !!four?.returned_on, fourErr?.message);
  check("架上回到九张，不是十张", (await onHand(c, P, "Round table")) === 9,
    `架上 ${await onHand(c, P, "Round table")}`);
  check("🔴 而且纸上留着差多少", (four?.note ?? "").includes("short 1"), four?.note);

  /* ── ⑥ 挡住的 ────────────────────────────────────────────────────────── */
  console.log("\n⑥ 挡住的");
  const { error: futErr } = await c.rpc("lend_item", {
    in_record_id: order.id, in_descr: "Arch", in_out_on: day(3),
  });
  check("借出日期不给写未来", !!futErr, "居然让它过了");

  const { error: backwardsErr } = await c.rpc("lend_item", {
    in_record_id: order.id, in_descr: "Arch", in_out_on: day(-1), in_due_back_on: day(-5),
  });
  check("归还日不给早过借出日", !!backwardsErr, "居然让它过了");

  const { error: blankErr } = await c.rpc("lend_item", {
    in_record_id: order.id, in_descr: "   ",
  });
  check("不写是什么东西，借不出去", !!blankErr, "居然让它过了");

  const { data: outMoney } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_direction: "out", in_amount_cents: 10000, in_party: "Mr Tan", in_note: "Refund",
  });
  const { error: wrongDepErr } = await c.rpc("lend_item", {
    in_record_id: order.id, in_descr: "Arch", in_deposit_entry_id: outMoney.id,
  });
  check("🔴 押金不给指着一笔付出去的钱", !!wrongDepErr, "居然让它过了");

  const { data: quote } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "Not agreed", in_party: "Mr Tan", in_amount_cents: 100,
  });
  const { error: qErr } = await c.rpc("lend_item", {
    in_record_id: quote.id, in_descr: "Arch",
  });
  check("报价单借不出东西", !!qErr, "居然让它过了");

  const { error: theirsErr } = await c.rpc("lend_item", {
    in_record_id: order.id, in_descr: "Arch", in_item_id: gown.id,
  });
  check("（控制组）自己家的货借得出去", !theirsErr, theirsErr?.message);

  /* ── ⑦ 不带货品卡的东西 ──────────────────────────────────────────────── */
  console.log("\n⑦ 没有货品卡的东西照样借得出去");
  const { data: pa, error: paErr } = await c.rpc("lend_item", {
    in_record_id: order.id, in_descr: "PA system (no item card)", in_qty: 1,
    in_due_back_on: day(5),
  });
  check("借得出去", !paErr && !!pa?.id, paErr?.message);
  check("而且它没有指着架上任何一件", pa?.item_id === null, `${pa?.item_id}`);
  const { data: paBack, error: paBackErr } = await c.rpc("return_rental", { in_rental_id: pa.id });
  check("还得回来，而且不会去动库存", !paBackErr && !!paBack?.returned_on, paBackErr?.message);

  /* ── ⑧ 按两下 ────────────────────────────────────────────────────────── */
  console.log("\n⑧ 按两下只借一次");
  const key = crypto.randomUUID();
  const { data: b1 } = await c.rpc("lend_item", {
    in_record_id: order.id, in_descr: "Arch", in_idempotency_key: key,
  });
  const { data: b2 } = await c.rpc("lend_item", {
    in_record_id: order.id, in_descr: "Arch", in_idempotency_key: key,
  });
  check("同一把钥匙回同一行", b1?.id && b1.id === b2?.id, `${b1?.id} vs ${b2?.id}`);

  /* ── ⑨ 别人家 ────────────────────────────────────────────────────────── */
  console.log("\n⑨ 别人家");
  const { error: crossErr } = await other.as.rpc("lend_item", {
    in_record_id: order.id, in_descr: "Theirs",
  });
  check("别人家的单借不出东西", !!crossErr, "居然让它过了");
  const { error: crossReadErr } = await other.as.rpc("rentals_of", { in_record_id: order.id });
  check("别人家的清单读不到", !!crossReadErr, "居然让它过了");
  const { data: crossOut } = await other.as.rpc("rentals_out", { in_project_id: other.projectId });
  check("（控制组）他自己那一家读得到，而且是空的", Array.isArray(crossOut) && crossOut.length === 0,
    `${JSON.stringify(crossOut)}`);
  const { data: rowsAsOther } = await other.as.from("rentals").select("id");
  check("🔴 直接读那张表，别人家一行都读不到", (rowsAsOther ?? []).length === 0,
    `${(rowsAsOther ?? []).length}`);

  /* ── ⑩ 师傅那一边 ────────────────────────────────────────────────────── */
  console.log("\n⑩ 师傅看得到东西，看不到押金多少");
  const crew = await person("crew", []);
  await c.rpc("add_project_member", { in_email: crew.cred.email });
  const crewClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await crewClient.auth.signInWithPassword(crew.cred);
  const { data: crewOut, error: crewErr } = await crewClient.rpc("rentals_out", {
    in_project_id: P,
  });
  check("师傅看得到什么在外面", !crewErr && (crewOut ?? []).length >= 1,
    crewErr?.message ?? `${(crewOut ?? []).length}`);
  const flat = JSON.stringify(crewOut);
  check("🔴 那份清单上一分钱都没有", !flat.includes("50000") && !flat.includes("deposit"),
    flat.slice(0, 200));
  const { data: crewMoney } = await crewClient
    .from("ledger_entries").select("amount_cents").eq("project_id", P);
  check("🔴 而且师傅读不到那笔押金本身", (crewMoney ?? []).length === 0,
    `${(crewMoney ?? []).length}`);
} finally {
  await dropThrowaways(admin, made);
}

console.log(
  failed.length === 0
    ? `\n判：全过`
    : `\n判：${failed.length} 条没过 —— ${failed.join(" · ")}`,
);
process.exit(failed.length === 0 ? 0 : 1);
