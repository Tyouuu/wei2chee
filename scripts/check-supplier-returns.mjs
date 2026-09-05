/**
 * 退给供应商 —— 拿真的登入身分打一次每一支。
 *
 * 它是 [任务 208] 客户那一边的镜像，而**方向是从那张单自己算出来的**：
 * 一张进货单退货 = 货送回去（架上**少**几件）+ 我欠他的**少**多少。
 *
 * 🔴 这一支最要紧的两条：
 *   · 撤销一笔退货，货要**真的再送出去**（架上回到原样）——
 *     不是把那一笔删掉
 *   · `purchase_match` 跟 `party_payables` 要给同一个答案 ——
 *     同一个问题两个答案，这个仓库栽过至少八次
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
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

const stamp = Date.now();
const bad = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

const people = [];
async function person(tag) {
  const email = `sr-${tag}-${stamp}@formae.test`;
  const password = `Sr-${stamp}-x!`;
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

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  for (const k of ["purchases", "expenses", "suppliers", "inventory", "orders", "customers"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  /** 架上现在几件 —— 走那个 view，跟画面读的是同一个东西。 */
  const onHand = async (name) => {
    const { data } = await C.from("stock_on_hand").select("name, on_hand").eq("project_id", P);
    const r = (data ?? []).find((x) => x.name === name);
    return r ? Number(r.on_hand) : null;
  };
  const match = async (id) => ((await C.rpc("purchase_match", { in_record_id: id })).data ?? [])[0];
  const owe = async (who) => {
    const { data } = await C.rpc("party_payables", { in_project_id: P });
    return (data ?? []).find((r) => r.party_id === who) ?? null;
  };

  /* ── ① 道具：叫一百包，全部到货 ───────────────────────────────────── */
  console.log("\n① 道具：叫一百包，到货");
  const { data: sup } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "suppliers", in_name: "Seng Huat Hardware",
  });
  const { data: po } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "Cement load",
    in_party: "Seng Huat Hardware", in_party_id: sup.id, in_amount_cents: 185_000,
  });
  const { data: lines } = await C.rpc("set_record_lines", {
    in_record_id: po.id,
    in_lines: [
      { description: "Cement 50kg", qty: "100", unit: "bags",
        unit_price_cents: "1850", amount_cents: "185000" },
      { description: "Lorry charge", amount_cents: "0" },
    ],
  });
  const cementLine = (lines ?? []).find((l) => l.description === "Cement 50kg");
  const lorryLine = (lines ?? []).find((l) => l.description === "Lorry charge");
  check("单开得出来、行写得进去", !!cementLine?.id, JSON.stringify(lines?.length));

  const { error: rvErr } = await C.rpc("receive_purchase", { in_record_id: po.id });
  check("收货收得进去", !rvErr, rvErr?.message);
  check("架上一百包", (await onHand("Cement 50kg")) === 100, `${await onHand("Cement 50kg")}`);
  check("我欠他 RM 1,850", Number((await owe(sup.id))?.owed_cents) === 185_000,
    `${(await owe(sup.id))?.owed_cents}`);

  /* ── ② 退三十包回去 ───────────────────────────────────────────────── */
  console.log("\n② 退三十包回去");
  const { data: r1, error: r1e } = await C.rpc("record_return", {
    in_record_id: po.id, in_credit_cents: 55_500, in_reason: "受潮",
    in_lines: [
      { line_id: cementLine.id, qty: "30" },
      /* 一口价那一行也送进去 —— 「跳过」数的是**送进去的行**里没有数量的
         那几行，不是那张单上的。第一版只送了一行，於是它正确地回 0，
         而红的看起来像产品坏了。 */
      { line_id: lorryLine.id, qty: "0" },
    ],
  });
  check("退货记得进去", !r1e, r1e?.message);
  const back1 = (r1 ?? [])[0];
  check("🔴 一行真的送回去了", Number(back1?.back) === 1, JSON.stringify(back1));
  check("没有一行是「没到过」", Number(back1?.not_out) === 0, `${back1?.not_out}`);
  check("一口价那一行跳过", Number(back1?.skipped) === 1, `${back1?.skipped}`);
  check("🔴 架上一百包变七十包", (await onHand("Cement 50kg")) === 70,
    `${await onHand("Cement 50kg")}`);

  const m1 = await match(po.id);
  check("🔴 那张单说还欠 RM 1,295（1850 − 555）",
    Number(m1?.unpaid_cents) === 129_500, `${m1?.unpaid_cents}`);
  const o1 = await owe(sup.id);
  check("🔴 「我欠谁」也说 RM 1,295 —— 同一个答案",
    Number(o1?.owed_cents) === 129_500, `${o1?.owed_cents}`);

  /* ── ③ 🔴 没到过的退不了 ──────────────────────────────────────────── */
  console.log("\n③ 🔴 没到过的退不了");
  const { data: po2 } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "Steel bar",
    in_party: "Seng Huat Hardware", in_party_id: sup.id, in_amount_cents: 90_000,
  });
  const { data: lines2 } = await C.rpc("set_record_lines", {
    in_record_id: po2.id,
    in_lines: [{ description: "Steel bar 12mm", qty: "20", unit: "pcs",
      unit_price_cents: "4500", amount_cents: "90000" }],
  });
  const steel = (lines2 ?? [])[0];
  const { data: r2 } = await C.rpc("record_return", {
    in_record_id: po2.id, in_credit_cents: 9_000,
    in_lines: [{ line_id: steel.id, qty: "2" }],
  });
  const back2 = (r2 ?? [])[0];
  check("🔴 一件都没送回去（那批货根本还没到）", Number(back2?.back) === 0,
    JSON.stringify(back2));
  check("🔴 而且讲出来是哪一种：没到过", Number(back2?.not_out) === 1, `${back2?.not_out}`);
  check("钱那一半照记（他就是要一个折让）",
    Number(back2?.credit_cents) === 9_000, `${back2?.credit_cents}`);

  /* ── ④ 退比到的多，挡下来 ─────────────────────────────────────────── */
  console.log("\n④ 退比到的多");
  const { error: tooMany } = await C.rpc("record_return", {
    in_record_id: po.id, in_lines: [{ line_id: cementLine.id, qty: "80" }],
  });
  check("🔴 挡下来了", !!tooMany, "居然让它过了");
  check("🔴 而且讲的是「到了多少」不是「卖了多少」",
    (tooMany?.message ?? "").includes("arrived"), tooMany?.message);
  check("被挡下来之后架上没有动", (await onHand("Cement 50kg")) === 70,
    `${await onHand("Cement 50kg")}`);

  /* ── ⑤ 退的钱不能高过单上的钱 ─────────────────────────────────────── */
  console.log("\n⑤ 退的钱不能高过单上的钱");
  const { error: tooMuch } = await C.rpc("record_return", {
    in_record_id: po.id, in_credit_cents: 200_000,
  });
  check("🔴 挡下来了", !!tooMuch, "居然让它过了");
  check("那张单的欠款没有变", Number((await match(po.id))?.unpaid_cents) === 129_500,
    `${(await match(po.id))?.unpaid_cents}`);

  /* ── ⑥ 🔴 撤销：货真的再送出去 ────────────────────────────────────── */
  console.log("\n⑥ 🔴 撤销一笔退货");
  const { data: undone, error: ue } = await C.rpc("drop_return", { in_id: back1.return_id });
  check("撤销得了", !ue, ue?.message);
  check("🔴 真的写了一笔反的（不是把那一笔删掉）", Number(undone) === 1, `${undone}`);
  check("🔴 架上回到一百包", (await onHand("Cement 50kg")) === 100,
    `${await onHand("Cement 50kg")}`);
  /* 🔴 `party_payables` 是**按这一家加起来**的，而第二张单（钢筋 RM 900，
     退了 RM 90 的折让）是同一家供应商。所以是 1850 + 900 − 90。
     第一版我只想着第一张单，报 176000 —— 红的是我的算术，不是产品。 */
  check("欠款回到 RM 1,850，加上钢筋那一张", 
    Number((await owe(sup.id))?.owed_cents) === 185_000 + 90_000 - 9_000,
    `${(await owe(sup.id))?.owed_cents}`);

  /* ── ⑦ 卖的那一边一个字都没变 ─────────────────────────────────────── */
  console.log("\n⑦ 卖的那一边（回归）");
  const { data: cust } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Lim",
  });
  const { data: sale } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "Ten bags",
    in_party: "Mrs Lim", in_party_id: cust.id, in_amount_cents: 25_000,
  });
  const { data: sLines } = await C.rpc("set_record_lines", {
    in_record_id: sale.id,
    in_lines: [{ description: "Cement 50kg", qty: "10", unit: "bags",
      unit_price_cents: "2500", amount_cents: "25000" }],
  });
  await C.rpc("deliver_record", {
    in_record_id: sale.id,
    in_lines: [{ line_id: sLines[0].id, qty: "10" }],
  });
  check("卖出去十包，架上剩九十", (await onHand("Cement 50kg")) === 90,
    `${await onHand("Cement 50kg")}`);
  const { data: r3 } = await C.rpc("record_return", {
    in_record_id: sale.id, in_credit_cents: 5_000,
    in_lines: [{ line_id: sLines[0].id, qty: "2" }],
  });
  check("客人退两包，一行回到架上", Number((r3 ?? [])[0]?.back) === 1,
    JSON.stringify((r3 ?? [])[0]));
  check("🔴 架上九十变九十二（卖的那一边方向没有反过来）",
    (await onHand("Cement 50kg")) === 92, `${await onHand("Cement 50kg")}`);
  const { data: cd } = await C.rpc("party_debts", { in_project_id: P });
  check("客人欠的少了 RM 50",
    Number((cd ?? []).find((r) => r.party_id === cust.id)?.owed_cents) === 20_000,
    JSON.stringify(cd));

  /* ── ⑧ 🔴 师傅 —— 柜台把货交回给罗厘的就是他 ──────────────────────── */
  console.log("\n⑧ 师傅");
  const crew = await person("crew");
  await C.rpc("add_project_member", { in_email: crew.email });
  const { data: r4, error: r4e } = await crew.client.rpc("record_return", {
    in_record_id: po.id, in_lines: [{ line_id: cementLine.id, qty: "5" }],
  });
  check("🔴 师傅退得了货（`works_here`，不是 `sees_money`）",
    !r4e && Number((r4 ?? [])[0]?.back) === 1, r4e?.message ?? JSON.stringify(r4));
  check("架上跟着少五包", (await onHand("Cement 50kg")) === 87,
    `${await onHand("Cement 50kg")}`);
  const { data: crewOwe } = await crew.client.rpc("party_payables", { in_project_id: P });
  check("🔴 而他还是问不出老板欠谁多少", (crewOwe ?? []).length === 0,
    `${crewOwe?.length}`);

  /* ── ⑨ 别人家 ─────────────────────────────────────────────────────── */
  console.log("\n⑨ 别人家");
  const other = await person("other");
  const { error: oe } = await other.client.rpc("record_return", {
    in_record_id: po.id, in_lines: [{ line_id: cementLine.id, qty: "1" }],
  });
  check("🔴 别人家退不了我的货", !!oe, "居然让它过了");
  check("架上没有动", (await onHand("Cement 50kg")) === 87,
    `${await onHand("Cement 50kg")}`);
} finally {
  for (const id of people) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.log(`  ⚠️ 删不掉 ${id}：${error.message}`);
  }
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
