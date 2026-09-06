/**
 * 一间五金店，从叫一车货到「什么快没了」—— 走一次，**数他要动手几次**。
 *
 * 跟另外三条同一把尺（[任务 231](../docs/founder-tasks.md#231)）。
 *
 * 🔴 为什么走这一条：库存那一整族
 * （盘点 · 一箱几罐 · 补货线 · 分店调拨 · 批号效期 · 序号）
 * **到今天还没有被一次真的流程碰过** —— 每一支都有自己的尺，
 * 而「他一天下来要按几次」没有人量过。
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
  const email = `hw-${tag}-${Date.now()}@formae.test`;
  const password = `Hw-${Date.now()}-x!`;
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
const one = (d) => (Array.isArray(d) ? d[0] : d);
const node = (name, hands, ok, detail) => chain.push({ name, hands, ok, detail });
const day = (fwd) => {
  const d = new Date(Date.now() + 8 * 3600e3);
  d.setUTCDate(d.getUTCDate() + fwd);
  return d.toISOString().slice(0, 10);
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "counter" });
  await admin.from("projects").update({ business_name: "Seng Huat Hardware" }).eq("id", P);
  for (const k of ["inventory", "purchases", "suppliers", "orders",
                   "customers", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  const started = acts;

  /* ── ① 建一件货：一箱二十四罐 · 补货线 ───────────────────── */
  let n = acts;
  const paint = await act(C, "建一件货", "add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Emulsion paint 5L",
    in_unit: "tins", in_pack_size: 24, in_pack_unit: "carton",
    in_reorder_at: 20, in_price_cents: 4_500, in_cost_cents: 3_000,
  });
  node("建一件货（一箱二十四罐 · 补货线 20）", acts - n, !!paint?.id,
    "一次；箱 · 罐 · 补货线 · 进价 · 卖价，一次讲完");

  /* ── ② 叫一车货 → 收货 → 架上 ─────────────────────────────── */
  n = acts;
  const supplier = await act(C, "建供应商", "add_directory_entry", {
    in_project_id: P, in_module_key: "suppliers", in_name: "Nippon agent",
  });
  const po = await act(C, "开进货单", "add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "Paint restock",
    in_party: "Nippon agent", in_party_id: supplier?.id, in_amount_cents: 144_000,
  });
  await act(C, "写明细", "set_record_lines", {
    in_record_id: po?.id,
    in_lines: [{ description: "Emulsion paint 5L", qty: "48", unit: "tins",
      item_id: paint?.id, amount_cents: "144000" }],
  });
  const got = one(await act(C, "按货到了", "receive_purchase", {
    in_record_id: po?.id,
  }));
  const shelf = async () => {
    const { data } = await C.from("stock_by_branch")
      .select("item_id, on_hand").eq("project_id", P);
    return Number((data ?? []).find((r) => r.item_id === paint?.id)?.on_hand ?? 0);
  };
  node("叫一车货 → 收货 → 架上", acts - n, (await shelf()) === 48,
    `四次（供应商 · 单 · 明细 · 收货）；架上 ${await shelf()} 罐 = 两箱`);

  /* ── ③ 卖出去，架上自己少 ─────────────────────────────────── */
  n = acts;
  const cust = await act(C, "建客户", "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mr Chan",
  });
  const sale = await act(C, "开一张订单", "add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "10 tins",
    in_party: "Mr Chan", in_party_id: cust?.id, in_amount_cents: 45_000,
  });
  const saleLines = await act(C, "写明细", "set_record_lines", {
    in_record_id: sale?.id,
    in_lines: [{ description: "Emulsion paint 5L", qty: "10", unit: "tins",
      item_id: paint?.id, amount_cents: "45000" }],
  });
  await act(C, "出货", "deliver_record", {
    in_record_id: sale?.id,
    in_lines: [{ line_id: (saleLines ?? [])[0]?.id, qty: "10" }],
  });
  node("🔴 卖出去 → 架上自己少", acts - n, (await shelf()) === 38,
    `四次（客户 · 单 · 明细 · 出货）；架上 ${await shelf()} 罐`);

  /* ── ④ 数一次架上 ─────────────────────────────────────────── */
  n = acts;
  const counted = one(await act(C, "盘点", "count_stock", {
    in_item_id: paint?.id, in_counted: 35, in_reason: "月底盘点",
  }));
  node("🔴 月底数一次（架上其实只有 35）", acts - n, (await shelf()) === 35,
    `一次；差额自己算 —— 架上 ${await shelf()} 罐`);

  /* ── ⑤ 卖到补货线以下，他知道吗 ───────────────────────────── */
  n = acts;
  const sale2 = await act(C, "再卖一张", "add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "20 tins",
    in_party: "Mr Chan", in_party_id: cust?.id, in_amount_cents: 90_000,
  });
  const l2 = await act(C, "写明细", "set_record_lines", {
    in_record_id: sale2?.id,
    in_lines: [{ description: "Emulsion paint 5L", qty: "20", unit: "tins",
      item_id: paint?.id, amount_cents: "90000" }],
  });
  await act(C, "出货", "deliver_record", {
    in_record_id: sale2?.id,
    in_lines: [{ line_id: (l2 ?? [])[0]?.id, qty: "20" }],
  });
  const { data: sig } = await C.rpc("nudges_due", { in_project_id: P });
  const low = (sig ?? []).some((r) => r.kind === "below_reorder");
  node("🔴 卖到剩 15（补货线 20）→ 系统讲一句", acts - n, low,
    low ? `三次（单 · 明细 · 出货）；讯号算得出来（画面上没有人读它）`
      : `架上 ${await shelf()}，而讯号没有出现`);

  /* ── ⑥ 两间店，搬二十罐过去 ───────────────────────────────── */
  n = acts;
  const kl = await act(C, "开第一间店", "add_branch", {
    in_project_id: P, in_name: "Ipoh Garden",
  });
  const br2 = await act(C, "开第二间店", "add_branch", {
    in_project_id: P, in_name: "Menglembu",
  });
  /* 🔴 他本来就有的货**全部挂在「没有分店」上**（一间店的生意本来就这样）——
     所以开第二间店那一天的第一件事，是把它们分到第一间店去。
     [任务 237](../docs/founder-tasks.md#237) 之前这一步根本做不到，
     而这一节的读数当时是「差 10 罐」。 */
  const split = one(await act(C, "把本来就有的货分到第一间店", "transfer_stock", {
    in_item_id: paint?.id, in_from_branch: null, in_to_branch: kl?.id,
    in_qty: 15,
  }));
  const moved = one(await act(C, "搬十罐过去", "transfer_stock", {
    in_item_id: paint?.id, in_from_branch: kl?.id, in_to_branch: br2?.id,
    in_qty: 10,
  }));
  node("开两间店 ＋ 把货分进去 ＋ 搬十罐过去", acts - n,
    !!moved?.transfer_id && Number(moved?.short) === 0
      && Number(split?.short) === 0,
    `四次；而搬那两次各是**一个动作两笔**，`
    + `分进去差 ${split?.short} 罐 · 搬过去差 ${moved?.short} 罐`);

  /* ── ⑦ 批号 · 效期 ────────────────────────────────────────── */
  n = acts;
  const glue = await act(C, "建一件有效期的货", "add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Tile adhesive",
    in_unit: "bags",
  });
  const batch = await act(C, "进一批，带效期", "add_stock_batch", {
    in_item_id: glue?.id, in_code: "L-2609", in_expiry_on: day(20),
  });
  await act(C, "那一批进货", "move_stock", {
    in_item_id: glue?.id, in_direction: "in", in_qty: 40,
    in_reason: "进货", in_batch_id: batch?.id,
  });
  const soon = await act(C, "问什么快过期", "expiring_soon", {
    in_project_id: P, in_days: 90,
  });
  const hit = (soon ?? []).find((r) => r.code === "L-2609");
  node("🔴 一批带效期的货 →「什么快过期了」", acts - n, !!hit,
    hit ? `四次；${hit.item_name} · ${hit.code} · 还剩 ${hit.days_left} 天 · ${hit.on_hand} 包`
      : "问不到");

  /* ── ⑧ 序号：一台一台认的货 ───────────────────────────────── */
  n = acts;
  const drill = await act(C, "建一件一台一台认的货", "add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Hammer drill",
    in_unit: "units",
  });
  await act(C, "开启序号", "set_item_serial_tracking", {
    in_item_id: drill?.id, in_on: true,
  });
  const sn = await act(C, "进一台，带序号", "add_stock_batch", {
    in_item_id: drill?.id, in_code: "SN-77120",
  });
  await act(C, "那一台进货", "move_stock", {
    in_item_id: drill?.id, in_direction: "in", in_qty: 1,
    in_reason: "进货", in_batch_id: sn?.id,
  });
  const hist = await act(C, "打序号查这一台", "serial_history", {
    in_project_id: P, in_code: "SN-77120",
  });
  node("🔴 一台一台认的货（怡保 47% 的店要）", acts - n,
    (hist ?? []).length >= 1,
    `五次（建 · 开启 · 序号 · 进货 · 查）；查得到 ${(hist ?? []).length} 笔`);

  /* ── ⑨ 卖一台不讲序号 → 挡 ────────────────────────────────── */
  n = acts;
  const sale3 = await act(C, "开一张卖钻机的单", "add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "One drill",
    in_party: "Mr Chan", in_party_id: cust?.id, in_amount_cents: 35_000,
  });
  const l3 = await act(C, "写明细（不讲序号）", "set_record_lines", {
    in_record_id: sale3?.id,
    in_lines: [{ description: "Hammer drill", qty: "1", unit: "units",
      item_id: drill?.id, amount_cents: "35000" }],
  });
  const { error: noSerial } = await C.rpc("deliver_record", {
    in_record_id: sale3?.id,
    in_lines: [{ line_id: (l3 ?? [])[0]?.id, qty: "1" }],
  });
  acts += 1;
  node("🔴 卖一台不讲哪一个序号 → 挡", acts - n, !!noSerial,
    noSerial ? "而且讲得出该怎么做" : "居然让它过了");

  /* ── 读数 ─────────────────────────────────────────────────── */
  console.log("\n一间五金店，从叫一车货到「什么快没了」\n");
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
