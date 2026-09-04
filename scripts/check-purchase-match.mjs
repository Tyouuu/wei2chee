/**
 * 这张进货单对不对得上 —— 用真的身分打，而且**一个新表单都不填**。
 *
 * ── 这一支同时在证明一件事 ──────────────────────────────────────────────
 *
 * 三个数字全部来自他**今天已经在做的三个动作**：开单 · 按「货到了」·
 * 记一笔开销。所以这里种资料的时候**只用那三支既有的函式** ——
 * 如果哪一天要多一个动作才凑得齐，这一支会先红。
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

async function person(tag) {
  const cred = { email: `pm-${tag}-${Date.now()}@formae.test`, password: `Pm-${Date.now()}-x!` };
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
  for (const k of ["purchases", "inventory", "expenses", "suppliers"]) {
    await as.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  return { as, projectId: proj?.id };
}

const one = async (c, id) => ((await c.rpc("purchase_match", { in_record_id: id })).data ?? [])[0];

try {
  const shop = await person("shop");
  const c = shop.as;
  const P = shop.projectId;
  if (!P) throw new Error("找不到那一家的专案");

  /* 一张真的进货单：水泥 100 包 × RM 18.50 = RM 1,850。 */
  const { data: po } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases",
    in_title: "Cement load", in_party: "Seng Huat", in_amount_cents: 185_000,
  });
  await c.rpc("set_record_lines", {
    in_record_id: po.id,
    in_lines: [
      { description: "Cement 50kg", qty: "100", unit: "bags", unit_price_cents: "1850",
        amount_cents: "185000" },
      /* 一口价那种行 —— 架上没有东西要动。 */
      { description: "Lorry charge", amount_cents: "0" },
    ],
  });

  /* ── ① 刚开单：什么都没到，什么都没付 ─────────────────────────────── */
  console.log("\n① 刚开单");
  let m = await one(c, po.id);
  check("叫了 RM 1,850", Number(m?.ordered_cents) === 185_000, `${m?.ordered_cents}`);
  check("还没付", Number(m?.paid_cents) === 0, `${m?.paid_cents}`);
  check("还欠供应商 RM 1,850", Number(m?.unpaid_cents) === 185_000, `${m?.unpaid_cents}`);
  check("货还没到", m?.arrived === false, `${m?.arrived}`);
  /* 🔴 一口价那一行不可以被算成「没到」—— 不然每一张单都对不上。 */
  check("🔴 只数有数量的行（一口价那行不算）", Number(m?.lines_total) === 1,
    `${m?.lines_total}`);

  /* ── ② 他先付了钱，货还没到 ───────────────────────────────────────── */
  console.log("\n② 先付了钱，货还没到");
  const { data: pay } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses",
    in_amount_cents: 185_000, in_party: "Seng Huat",
  });
  await c.rpc("set_payment_allocations", {
    in_entry_id: pay.id, in_rows: [{ record_id: po.id, amount_cents: 185_000 }],
  });
  m = await one(c, po.id);
  check("付了 RM 1,850", Number(m?.paid_cents) === 185_000, `${m?.paid_cents}`);
  check("不欠了", Number(m?.unpaid_cents) === 0, `${m?.unpaid_cents}`);
  check("🔴 但货还是没到", m?.arrived === false, `${m?.arrived}`);

  const bad = (await c.rpc("purchase_mismatches", { in_project_id: P })).data ?? [];
  check("🔴 这张单出现在「对不上」那一份里", bad.length === 1, `${bad.length} 张`);
  check("🔴 而且讲得出是哪一种：钱付了货没到",
    bad[0]?.problem === "paid_not_arrived", bad[0]?.problem);

  /* ── ③ 货到了 ─────────────────────────────────────────────────────── */
  console.log("\n③ 货到了");
  const { data: got } = await c.rpc("receive_purchase", { in_record_id: po.id });
  check("收得了货", Number((got ?? [])[0]?.moved) === 1, JSON.stringify(got));
  m = await one(c, po.id);
  check("🔴 现在货到了", m?.arrived === true, `${m?.arrived}`);
  check("到的行数对得上", Number(m?.lines_arrived) === Number(m?.lines_total),
    `${m?.lines_arrived}/${m?.lines_total}`);

  const clean = (await c.rpc("purchase_mismatches", { in_project_id: P })).data ?? [];
  /* 🔴 对得上的**不列** —— 一份每次印全部的清单没有人看。 */
  check("🔴 对得上之后就从那一份里消失", clean.length === 0, JSON.stringify(clean));

  /* ── ④ 付超过了 ───────────────────────────────────────────────────── */
  console.log("\n④ 付多了");
  const { data: po2 } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases",
    in_title: "Sand", in_party: "Seng Huat", in_amount_cents: 50_000,
  });
  const { data: over } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses",
    in_amount_cents: 80_000, in_party: "Seng Huat",
  });
  /* 分摊那一支自己会挡超收 —— 所以先把它挡下来的行为验一次。 */
  const { error: tooMuch } = await c.rpc("set_payment_allocations", {
    in_entry_id: over.id, in_rows: [{ record_id: po2.id, amount_cents: 80_000 }],
  });
  check("分摊超过单据金额会被挡", !!tooMuch, tooMuch?.message ?? "居然让它过了");

  /* ── ⑤ 冲正之后那笔钱不算 ─────────────────────────────────────────── */
  console.log("\n⑤ 冲正");
  await c.rpc("reverse_ledger_entry", { in_entry_id: pay.id });
  m = await one(c, po.id);
  check("🔴 冲正之后，付了多少回到 0", Number(m?.paid_cents) === 0, `${m?.paid_cents}`);
  check("而且又欠回 RM 1,850", Number(m?.unpaid_cents) === 185_000, `${m?.unpaid_cents}`);
  const again = (await c.rpc("purchase_mismatches", { in_project_id: P })).data ?? [];
  check("又回到「对不上」那一份里", again.some((r) => r.record_id === po.id),
    JSON.stringify(again.map((r) => r.problem)));
  check("而且这一次是「货到了钱没付」",
    again.find((r) => r.record_id === po.id)?.problem === "arrived_not_paid",
    again.find((r) => r.record_id === po.id)?.problem);

  /* ── ⑥ 谁看得到 ───────────────────────────────────────────────────── */
  console.log("\n⑥ 谁看得到");
  /* ⚠️ 第一版我拿 `po2` 来测「不是进货单」—— 而 po2 就是一张进货单，
     那条断言的逻辑我还写成了一句永远为真的话。**红的是我的尺。**
     开一张真的报价单来测。 */
  await c.rpc("add_project_page", { requested_key: "quotations", new_title: "quotations" });
  const { data: quote } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "A quote", in_amount_cents: 1000,
  });
  const { error: notPo } = await c.rpc("purchase_match", { in_record_id: quote.id });
  check("卖出去的单不走这一支", !!notPo, notPo?.message ?? "居然让它过了");

  const other = await person("other");
  const { error: theirs } = await other.as.rpc("purchase_match", { in_record_id: po.id });
  check("别人家看不到", !!theirs, theirs?.message ?? "居然让它过了");
  const { data: theirList } = await other.as.rpc("purchase_mismatches", { in_project_id: P });
  check("别人家也拉不出那一份", (theirList ?? []).length === 0, `${theirList?.length} 张`);
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${failed.length === 0 ? "全过" : `${failed.length} 条没过`}`);
process.exit(failed.length ? 1 : 0);
