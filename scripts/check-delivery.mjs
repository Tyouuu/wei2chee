/**
 * 卖出去了，架上就该少 —— 用真的身分打每一支。
 *
 * ── 为什么这一支非有不可 ──────────────────────────────────────────────────
 *
 * 库存 2026-09-01 上线，而**没有任何东西会因为卖掉而扣它**。
 * 那不是少一个功能，那是一个已经上线的东西在说谎：一间五金店卖掉十包水泥，
 * 架上的数字一动都不动，而**没有人用眼睛看得出来**（钱看得出来，数量看不出来）。
 *
 * 这里量的是那条线的五段，而其中三段是这一次新长出来的：
 *
 *   ① 一行说得出它是架上的哪一件（`set_record_lines` 收 `item_id`）
 *   ② 🔴 **他没写价钱的时候，价从货品上来** —— `price_cents` 从建表那天
 *      就在，而在今天之前零个地方读过它
 *   ③ 出货真的扣了
 *   ④ 🔴 **按两次只扣一次**
 *   ⑤ 🔴 **架上不够照样出，然后讲出来** —— 挡下去他就绕过系统卖
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
  const cred = {
    email: `dlv-${tag}-${Date.now()}@formae.test`,
    password: `Dlv-${Date.now()}-x!`,
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

  for (const [key, title] of [["orders", "Orders"], ["inventory", "Stock"], ["quotations", "Quotes"]]) {
    await as.rpc("add_project_page", { requested_key: key, new_title: title });
  }
  return { as, userId: user.user.id, projectId: proj?.id };
}

/** 架上现在几件。走那个 view，跟画面读的是同一个东西。 */
async function onHand(c, projectId, name) {
  const { data } = await c
    .from("stock_on_hand").select("name, on_hand").eq("project_id", projectId);
  const row = (data ?? []).find((r) => r.name === name);
  return row ? Number(row.on_hand) : null;
}

try {
  const shop = await person("shop");
  const other = await person("other");
  const c = shop.as;
  const P = shop.projectId;
  if (!P) throw new Error("找不到那一家的专案");

  /* 一件架上的货，**带卖价**。RM 18.50 一包。 */
  const { data: item, error: itemErr } = await c.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "Cement 50kg", in_unit: "bags",
    in_price_cents: 1850,
  });
  check("建得起一件带卖价的货", !itemErr && !!item?.id, itemErr?.message);
  check("卖价存得进去", Number(item?.price_cents) === 1850, `${item?.price_cents}`);

  await c.rpc("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 100, in_reason: "Opening",
  });
  check("开帐 100 包", (await onHand(c, P, "Cement 50kg")) === 100);

  /* ── ① 一行说得出它是架上的哪一件 ─────────────────────────────────── */
  console.log("\n① 一行指得到架上那一件");
  const { data: order } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "Counter sale", in_party: "Walk-in", in_amount_cents: 18500,
  });
  const { data: lines, error: lineErr } = await c.rpc("set_record_lines", {
    in_record_id: order.id,
    /* **故意不写价钱** —— 要看它从货品上拿。 */
    in_lines: [{ description: "Cement 50kg", qty: "10", unit: "bags", item_id: item.id }],
  });
  check("行写得进去，而且记得住是哪一件货", !lineErr && lines?.[0]?.item_id === item.id,
    lineErr?.message ?? `${lines?.[0]?.item_id}`);
  /* 🔴 第二十次「能力有、线没接」的那一栏，第一次被读到。 */
  check("🔴 他没写价钱，价从货品上来", Number(lines?.[0]?.unit_price_cents) === 1850,
    `${lines?.[0]?.unit_price_cents}`);
  check("而且金额算出来是 10 × 18.50", Number(lines?.[0]?.amount_cents) === 18500,
    `${lines?.[0]?.amount_cents}`);

  /* 他自己写的价永远赢 —— 一个会盖掉他谈好的价的目录，他第二天就不敢用。 */
  const { data: order2 } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "Discounted", in_party: "Ah Seng",
  });
  const { data: cheap } = await c.rpc("set_record_lines", {
    in_record_id: order2.id,
    in_lines: [{ description: "Cement 50kg", qty: "2", unit: "bags",
                 item_id: item.id, unit_price_cents: "1500" }],
  });
  check("🔴 他谈好的价赢过目录上的价", Number(cheap?.[0]?.unit_price_cents) === 1500,
    `${cheap?.[0]?.unit_price_cents}`);

  /* 别人家的货挂不上来。 */
  const { data: theirItem } = await other.as.rpc("add_catalog_item", {
    in_project_id: other.projectId, in_module_key: "inventory", in_name: "Theirs",
  });
  const { error: crossErr } = await c.rpc("set_record_lines", {
    in_record_id: order2.id,
    in_lines: [{ description: "x", qty: "1", item_id: theirItem?.id }],
  });
  check("别人家的货挂不上来", !!crossErr, crossErr?.message ?? "居然让它过了");

  /* ── ② 出货 ────────────────────────────────────────────────────────── */
  console.log("\n② 货真的出去了");
  const { data: out, error: outErr } = await c.rpc("deliver_record", {
    in_record_id: order.id,
  });
  const r = (out ?? [])[0];
  check("出得了货", !outErr && Number(r?.moved) === 1, outErr?.message ?? JSON.stringify(r));
  check("🔴 架上从 100 变成 90", (await onHand(c, P, "Cement 50kg")) === 90);
  check("单自己走到「交货了」", /Delivered|交货/.test(r?.stage ?? ""), r?.stage);

  /* ── ③ 按第二次 ────────────────────────────────────────────────────── */
  console.log("\n③ 他又按了一次");
  const { data: twice } = await c.rpc("deliver_record", { in_record_id: order.id });
  const t = (twice ?? [])[0];
  check("第二次一件都不动", Number(t?.moved) === 0 && Number(t?.skipped) === 1, JSON.stringify(t));
  check("🔴 架上还是 90", (await onHand(c, P, "Cement 50kg")) === 90);

  /* 出过货的单，行就锁了 —— 而且拒绝的时候讲的是**出**，不是进。 */
  const { error: shutErr } = await c.rpc("set_record_lines", {
    in_record_id: order.id,
    in_lines: [{ description: "Cement 50kg", qty: "999", item_id: item.id }],
  });
  check("出过货的单，行不能再改", !!shutErr, "居然改得动");
  check("🔴 而且讲的是「出」不是「进」",
    /already left your stock|已经出了库存/.test(shutErr?.message ?? ""),
    shutErr?.message?.slice(0, 70));

  /* ── ④ 架上不够 ────────────────────────────────────────────────────── */
  console.log("\n④ 架上不够（他就是卖了）");
  const { data: big } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "Big load", in_party: "Contractor",
  });
  await c.rpc("set_record_lines", {
    in_record_id: big.id,
    in_lines: [{ description: "Cement 50kg", qty: "200", item_id: item.id }],
  });
  const { data: shortOut } = await c.rpc("deliver_record", { in_record_id: big.id });
  const s = (shortOut ?? [])[0];
  check("🔴 不挡他，照样出", Number(s?.moved) === 1, JSON.stringify(s));
  check("🔴 但是讲出来有一行不够", Number(s?.short) === 1, JSON.stringify(s));
  check("架上变成 -110（而他知道）", (await onHand(c, P, "Cement 50kg")) === -110);

  /* ── ⑤ 架上没有这件东西 ────────────────────────────────────────────── */
  console.log("\n⑤ 架上根本没有那件东西");
  const { data: odd } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "Typo", in_party: "Someone",
  });
  await c.rpc("set_record_lines", {
    in_record_id: odd.id,
    in_lines: [
      { description: "Cemnet 50kgg", qty: "5" },
      { description: "Delivery charge" },
    ],
  });
  const { data: oddOut } = await c.rpc("deliver_record", { in_record_id: odd.id });
  const o = (oddOut ?? [])[0];
  /* 🔴 打错字的描述**不可以**变出一件幽灵货品。 */
  check("🔴 认不得的那一行跳过，不建新货品", Number(o?.unknown) === 1 && Number(o?.moved) === 0,
    JSON.stringify(o));
  check("没有数量的那一行也跳过（一口价）", Number(o?.skipped) === 1, JSON.stringify(o));
  const { data: shelf } = await c
    .from("stock_on_hand").select("name").eq("project_id", P);
  check("架上还是只有一件货", (shelf ?? []).length === 1,
    JSON.stringify((shelf ?? []).map((x) => x.name)));

  /* ── ⑥ 谁出得了货 ──────────────────────────────────────────────────── */
  console.log("\n⑥ 只有订单出得了货");
  const { data: quote } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "Just a quote",
  });
  const { error: quoteErr } = await c.rpc("deliver_record", { in_record_id: quote.id });
  check("报价单出不了货", !!quoteErr, quoteErr?.message ?? "居然让它过了");

  const { error: notMine } = await other.as.rpc("deliver_record", { in_record_id: order.id });
  check("别人家的单出不了货", !!notMine, notMine?.message ?? "居然让它过了");
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${failed.length === 0 ? "全过" : `${failed.length} 条没过`}`);
process.exit(failed.length ? 1 : 0);
