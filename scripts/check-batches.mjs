/**
 * 批号跟效期 —— 药行 · 美容 · 食品。**用真的登入身分打。**
 *
 * ⚠️ 这一支真正在守的三件：
 *
 *   ① **「什么快过期了」答得出来** —— 那是这一整张表存在的理由
 *   ② **出货照效期先出，而且一行拆得开** ——
 *      不这样做，「这一批还剩几件」立刻变成一个假数字
 *   ③ **有批号的货不准在货品那一层盘点** ——
 *      数出来 84 是哪一批的，没有任何规则答得出来
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
const day = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function signIn(cred) {
  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await as.auth.signInWithPassword(cred);
  if (error) throw new Error(`sign-in: ${error.message}`);
  return as;
}

async function person(tag) {
  const cred = { email: `bat-${tag}-${Date.now()}@formae.test`, password: `Bat-${Date.now()}-x!` };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email, password: cred.password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);
  return { cred, id: user.user.id, as: await signIn(cred) };
}

try {
  const boss = await person("boss");
  const c = boss.as;
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  for (const k of ["inventory", "orders", "purchases", "suppliers", "customers"]) {
    await c.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const { data: panadol } = await c.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "Panadol 500mg", in_unit: "box", in_price_cents: 1290,
  });
  /* 一件没有批号的货 —— 用来证明既有的那一条路一个字都没有变。 */
  const { data: plaster } = await c.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "Plaster", in_unit: "box", in_price_cents: 500,
  });
  await c.rpc("move_stock", {
    in_item_id: plaster.id, in_direction: "in", in_qty: 50, in_reason: "Opening",
  });

  /* ── ① 开两批 ──────────────────────────────────────────────────────── */
  console.log("\n① 两批 Panadol，效期不一样");
  const { data: soon, error: bErr } = await c.rpc("add_stock_batch", {
    in_item_id: panadol.id, in_code: "A123", in_expiry_on: day(45),
  });
  check("开得了", !bErr && !!soon?.id, bErr?.message);
  const { data: later } = await c.rpc("add_stock_batch", {
    in_item_id: panadol.id, in_code: "B456", in_expiry_on: day(400),
  });
  const { data: dup } = await c.rpc("add_stock_batch", {
    in_item_id: panadol.id, in_code: "A123",
  });
  check("🔴 同一批分两车到，还是同一批（不是第二笔）", dup?.id === soon.id, `${dup?.id}`);
  const { data: keptExp } = await admin
    .from("stock_batches").select("expiry_on").eq("id", soon.id).single();
  check("🔴 第二次没讲效期，不会把原本那个效期洗掉",
    keptExp?.expiry_on === day(45), `${keptExp?.expiry_on}`);
  const { error: blankErr } = await c.rpc("add_stock_batch", {
    in_item_id: panadol.id, in_code: "  ",
  });
  check("没有批号要挡", !!blankErr, "空批号收下了");

  await c.rpc("move_stock", {
    in_item_id: panadol.id, in_direction: "in", in_qty: 30,
    in_reason: "Opening", in_batch_id: soon.id,
  });
  await c.rpc("move_stock", {
    in_item_id: panadol.id, in_direction: "in", in_qty: 100,
    in_reason: "Opening", in_batch_id: later.id,
  });

  const { data: lots } = await c.rpc("batches_of", { in_item_id: panadol.id });
  check("两批都在，效期早的排前面",
    (lots ?? []).length === 2 && lots[0].code === "A123", JSON.stringify(lots?.map((l) => l.code)));
  check("🔴 剩几件是加出来的（30 / 100）",
    Number(lots?.[0]?.on_hand) === 30 && Number(lots?.[1]?.on_hand) === 100,
    `${lots?.[0]?.on_hand} · ${lots?.[1]?.on_hand}`);
  check("算得出还有几天", lots?.[0]?.days_left >= 44 && lots?.[0]?.days_left <= 46,
    `${lots?.[0]?.days_left}`);

  const { error: wrongItem } = await c.rpc("move_stock", {
    in_item_id: plaster.id, in_direction: "in", in_qty: 1, in_batch_id: soon.id,
  });
  check("🔴 把别一件货的批号挂上来要挡", !!wrongItem, "居然挂上去了");

  /* ── ② 什么快过期了 ────────────────────────────────────────────────── */
  console.log("\n② 什么快过期了");
  const { data: near } = await c.rpc("expiring_soon", { in_project_id: P, in_days: 90 });
  check("九十天内只有 A123", (near ?? []).length === 1 && near[0].code === "A123",
    JSON.stringify(near?.map((n) => n.code)));
  check("讲得出是哪一件货、剩几件",
    near?.[0]?.item_name === "Panadol 500mg" && Number(near?.[0]?.on_hand) === 30,
    `${near?.[0]?.item_name} · ${near?.[0]?.on_hand}`);
  const { data: none } = await c.rpc("expiring_soon", { in_project_id: P, in_days: 10 });
  check("十天内没有", (none ?? []).length === 0, `${none?.length}`);
  const { error: silly } = await c.rpc("expiring_soon", { in_project_id: P, in_days: 5000 });
  check("问一个荒谬的区间会被挡", !!silly, "收下了 5000 天");

  /* ── ③ 🔴 出货照效期先出，一行拆两笔 ───────────────────────────────── */
  console.log("\n③ 卖 50 盒：A123 只有 30");
  const { data: cust } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Klinik Sihat",
  });
  const { data: order } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "Clinic order", in_party: "Klinik Sihat", in_party_id: cust.id,
  });
  await c.rpc("set_record_lines", {
    in_record_id: order.id,
    in_lines: [
      { description: "Panadol 500mg", qty: "50", unit: "box", unit_price_cents: "1290" },
      { description: "Plaster", qty: "5", unit: "box", unit_price_cents: "500" },
    ],
  });
  const { data: outcome, error: dErr } = await c.rpc("deliver_record", {
    in_record_id: order.id,
  });
  check("出得了货", !dErr && (outcome ?? [])[0]?.moved === 2,
    dErr?.message ?? JSON.stringify(outcome));

  const { data: lots2 } = await c.rpc("batches_of", { in_item_id: panadol.id });
  check("🔴 A123 空了（先出快过期的）", Number(lots2?.[0]?.on_hand) === 0,
    `${lots2?.[0]?.on_hand}`);
  check("🔴 剩下的 20 从 B456 拿（一行拆成两笔）",
    Number(lots2?.[1]?.on_hand) === 80, `${lots2?.[1]?.on_hand}`);

  const { data: moves } = await admin
    .from("stock_moves").select("qty, batch_id, direction")
    .eq("item_id", panadol.id).eq("direction", "out");
  check("真的是两笔，不是一笔", (moves ?? []).length === 2,
    JSON.stringify(moves?.map((m) => m.qty)));

  const { data: plasterMoves } = await admin
    .from("stock_moves").select("batch_id").eq("item_id", plaster.id).eq("direction", "out");
  check("没有批号的货照旧一笔、不挂批号（那条路一个字没变）",
    (plasterMoves ?? []).length === 1 && plasterMoves[0].batch_id === null,
    JSON.stringify(plasterMoves));

  const { data: nearNow } = await c.rpc("expiring_soon", { in_project_id: P, in_days: 90 });
  check("🔴 A123 卖完了就不再出现在「快过期」上（没有人在乎一批空的）",
    (nearNow ?? []).length === 0, JSON.stringify(nearNow?.map((n) => n.code)));

  /* 架上不够照样出，而且那一笔不挂任何一批。 */
  const { data: big } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "Big order", in_party: "Walk-in",
  });
  await c.rpc("set_record_lines", {
    in_record_id: big.id,
    in_lines: [{ description: "Panadol 500mg", qty: "100", unit: "box" }],
  });
  const { data: shortOut } = await c.rpc("deliver_record", { in_record_id: big.id });
  check("架上只有 80 要 100 —— 照样出，而且讲出来",
    (shortOut ?? [])[0]?.short === 1, JSON.stringify(shortOut));
  const { data: lots3 } = await c.rpc("batches_of", { in_item_id: panadol.id });
  check("🔴 B456 归零，多出来那 20 不挂任何一批（假装它属於某一批才是说谎）",
    Number(lots3?.[1]?.on_hand) === 0, `${lots3?.[1]?.on_hand}`);

  /* ── ④ 🔴 盘点 ─────────────────────────────────────────────────────── */
  console.log("\n④ 🔴 盘点");
  const { error: itemLevel } = await c.rpc("count_stock", {
    in_item_id: panadol.id, in_counted: 84,
  });
  check("🔴 有批号的货不准在货品那一层数", !!itemLevel, "居然数下去了");
  check("🔴 而且讲的是人话（讲得出该怎么做）",
    /count the batch|数哪一批/.test(itemLevel?.message ?? ""), `${itemLevel?.message}`);

  const { data: counted, error: cntErr } = await c.rpc("count_stock", {
    in_item_id: panadol.id, in_counted: 5, in_batch_id: later.id,
  });
  check("数那一批就可以", !cntErr && counted?.moved === 5, cntErr?.message ?? JSON.stringify(counted));
  const { data: lots4 } = await c.rpc("batches_of", { in_item_id: panadol.id });
  check("那一批变成 5", Number(lots4?.[1]?.on_hand) === 5, `${lots4?.[1]?.on_hand}`);

  const { data: same } = await c.rpc("count_stock", {
    in_item_id: panadol.id, in_counted: 5, in_batch_id: later.id,
  });
  check("数出来一样就什么都不写", same?.moved === 0, JSON.stringify(same));

  /* 没有批号的货照旧数得了 —— 那条路一个字都没有变。 */
  const { data: plainCount } = await c.rpc("count_stock", {
    in_item_id: plaster.id, in_counted: 40,
  });
  check("没有批号的货照旧数得了", plainCount?.moved === -5, JSON.stringify(plainCount));

  /* ── ⑤ 进货的时候一批货出生 ────────────────────────────────────────── */
  console.log("\n⑤ 进货：供应商单上印着批号跟效期");
  const { data: supplier } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "suppliers", in_name: "Pharma Supply",
  });
  const { data: po } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases",
    in_title: "Restock", in_party: "Pharma Supply", in_party_id: supplier.id,
  });
  await c.rpc("set_record_lines", {
    in_record_id: po.id,
    in_lines: [{
      description: "Panadol 500mg", qty: "200", unit: "box", unit_price_cents: "900",
      batch_code: "C789", expiry_on: day(700),
    }],
  });
  const { data: recv, error: rErr } = await c.rpc("receive_purchase", { in_record_id: po.id });
  check("收得了货", !rErr && (recv ?? [])[0]?.moved === 1, rErr?.message ?? JSON.stringify(recv));

  const { data: lots5 } = await c.rpc("batches_of", { in_item_id: panadol.id });
  const c789 = (lots5 ?? []).find((l) => l.code === "C789");
  check("🔴 那一批是收货的时候出生的（没有人另外去开）", !!c789, JSON.stringify(lots5?.map((l) => l.code)));
  check("效期从单上那一行带过来", c789?.expiry_on === day(700), `${c789?.expiry_on}`);
  check("两百件挂在它身上", Number(c789?.on_hand) === 200, `${c789?.on_hand}`);

  /* 分两车到，第二车是另一批。 */
  const { data: po2 } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases",
    in_title: "Two lorries", in_party: "Pharma Supply", in_party_id: supplier.id,
  });
  await c.rpc("set_record_lines", {
    in_record_id: po2.id,
    in_lines: [{ description: "Panadol 500mg", qty: "100", unit: "box" }],
  });
  const { data: lineRows } = await admin
    .from("record_lines").select("id").eq("record_id", po2.id);
  await c.rpc("receive_purchase", {
    in_record_id: po2.id,
    in_received: [{ line_id: lineRows[0].id, qty: 40, batch_code: "D111", expiry_on: day(900) }],
    in_idempotency_key: crypto.randomUUID(),
  });
  const { data: lots6 } = await c.rpc("batches_of", { in_item_id: panadol.id });
  const d111 = (lots6 ?? []).find((l) => l.code === "D111");
  check("🔴 同一行第二车是另一批（按下去的时候讲）",
    !!d111 && Number(d111.on_hand) === 40, JSON.stringify(lots6?.map((l) => `${l.code}:${l.on_hand}`)));

  /* ── ⑥ 别人家 ──────────────────────────────────────────────────────── */
  console.log("\n⑥ 别人家");
  const other = await person("other");
  const { data: oLots } = await other.as.rpc("batches_of", { in_item_id: panadol.id });
  check("别人家看不到这一家的批号", (oLots ?? []).length === 0, `${oLots?.length}`);
  const { data: oNear } = await other.as.rpc("expiring_soon", { in_project_id: P, in_days: 999 });
  check("别人家问不到什么快过期", (oNear ?? []).length === 0, `${oNear?.length}`);
  const { data: oRaw } = await other.as.from("stock_batches").select("id").eq("project_id", P);
  check("别人家直接读那张表也读不到", (oRaw ?? []).length === 0, `${oRaw?.length}`);
  const { error: oAdd } = await other.as.rpc("add_stock_batch", {
    in_item_id: panadol.id, in_code: "HACK",
  });
  check("别人家开不了批号", !!oAdd, "居然开得了");

  /* 师傅看得到 —— 拿货的是他，而那不是钱。 */
  const worker = await person("worker");
  await c.rpc("add_project_member", { in_email: worker.cred.email });
  const w = await signIn(worker.cred);
  const { data: wLots } = await w.rpc("batches_of", { in_item_id: panadol.id });
  check("🔴 师傅看得到批号跟效期（去架上拿货的是他）",
    (wLots ?? []).length >= 2, `${wLots?.length}`);
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${failed.length === 0 ? "全过" : `${failed.length} 条没过`}`);
process.exit(failed.length ? 1 : 0);
