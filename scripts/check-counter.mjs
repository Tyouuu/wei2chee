/**
 * 柜台：扫一下 · 一按结帐 · 找零 —— 用**真的登入身分**打一次。
 *
 * 🔴 `db push` 成功证明不了任何事（[重点 26](../docs/founder-points.md)）。
 *   今天已经栽过两次：第十一个讯号整支是坏的、开一堂课那一支
 *   把写入放进了扫描的条件里 —— 两次都是推上去回报成功。
 *
 * 它守的那几件：
 *   · 扫一串码回**刚好一件**（不是开头相符）
 *   · 一按做完四件事：开单 · 写行 · 架上扣掉 · 记一笔钱
 *   · 🔴 **进帐是 min(收到的, 这一篮)** —— 找出去的那几块不算他的收入
 *   · 付不够照样成交，而那张单自己留在「谁欠我钱」上
 *   · 一分都没付就不记帐
 *   · 🔴 按两下只成交一次
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
  if (ok) { pass += 1; console.log(`  PASS  ${what}`); }
  else { fail += 1; console.log(`  FAIL  ${what}${detail ? ` — ${detail}` : ""}`); }
};
const one = (d) => (Array.isArray(d) ? d[0] : d);

async function person(tag) {
  const email = `till-${tag}-${Date.now()}@formae.test`;
  const password = `Till-${Date.now()}-x!`;
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
  return { id: data.user.id, client };
}
dropThrowawayOnExit(admin, () => people[people.length - 1]);

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "counter" });
  for (const k of ["orders", "customers", "inventory", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  /* 道具：两件货，一件有条码。 */
  const { data: coke, error: cokeErr } = await C.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Coke 320ml",
    in_unit: "can", in_sku: "9556001", in_price_cents: 250,
  });
  check("道具：一件有条码的货", !!coke?.id, cokeErr?.message);
  const { data: bread } = await C.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Roti Gardenia",
    in_unit: "loaf", in_sku: "9556002", in_price_cents: 320,
  });
  for (const [item, qty] of [[coke, 100], [bread, 20]]) {
    await C.rpc("move_stock", {
      in_item_id: item.id, in_direction: "in", in_qty: qty, in_reason: "进货",
    });
  }
  const at = async (id) => {
    const { data } = await C.from("stock_on_hand").select("item_id, on_hand")
      .eq("project_id", P);
    return Number((data ?? []).find((r) => r.item_id === id)?.on_hand ?? 0);
  };
  check("道具：架上 100 罐 · 20 条", (await at(coke.id)) === 100
    && (await at(bread.id)) === 20, `${await at(coke.id)} / ${await at(bread.id)}`);

  /* ── ① 扫一下 ─────────────────────────────────────────────── */
  console.log("\n① 扫一下");
  const { data: scanned, error: scanErr } = await C.rpc("scan_item", {
    in_project_id: P, in_code: "9556001",
  });
  const hit = one(scanned);
  check("扫得到", !scanErr && hit?.item_id === coke.id, scanErr?.message);
  check("而且带着卖价跟架上几件",
    Number(hit?.price_cents) === 250 && Number(hit?.on_hand) === 100,
    `${hit?.price_cents} / ${hit?.on_hand}`);
  const { data: loose } = await C.rpc("scan_item", {
    in_project_id: P, in_code: " 9556001 ",
  });
  check("前后有空格照样扫得到", one(loose)?.item_id === coke.id, "扫不到");
  /* 🔴 开头相符会回两件 —— 而柜台那一刻不能停下来让他挑。 */
  const { data: prefix } = await C.rpc("scan_item", {
    in_project_id: P, in_code: "95560",
  });
  check("🔴 只是开头一样 → 扫不到（不是回两件）",
    (prefix ?? []).length === 0, `${(prefix ?? []).length} 件`);
  const { data: nothing } = await C.rpc("scan_item", {
    in_project_id: P, in_code: "0000000",
  });
  check("没有那件货 → 空的", (nothing ?? []).length === 0, "居然有");

  /* ── ② 一按结帐 ───────────────────────────────────────────── */
  console.log("\n② 一按结帐（两罐可乐 ＋ 一条面包 = RM 8.20，收 RM 10）");
  const key1 = crypto.randomUUID();
  const { data: sale, error: saleErr } = await C.rpc("ring_up_sale", {
    in_project_id: P, in_module_key: "orders",
    in_lines: [
      { description: "Coke 320ml", item_id: coke.id, qty: 2, unit: "can" },
      { description: "Roti Gardenia", item_id: bread.id, qty: 1, unit: "loaf" },
    ],
    in_paid_cents: 1000, in_method: "cash", in_idempotency_key: key1,
  });
  const s = one(sale);
  check("成交", !saleErr && !!s?.record_id, saleErr?.message);
  check("有单号", !!s?.doc_no, `${s?.doc_no}`);
  check("🔴 这一篮 RM 8.20 —— 明细加起来的，卖价自己填",
    Number(s?.total_cents) === 820, `${s?.total_cents}`);
  check("🔴 找他 RM 1.80", Number(s?.change_cents) === 180, `${s?.change_cents}`);
  check("不欠", Number(s?.owed_cents) === 0, `${s?.owed_cents}`);
  check("🔴 架上自己少：98 罐 · 19 条",
    (await at(coke.id)) === 98 && (await at(bread.id)) === 19,
    `${await at(coke.id)} / ${await at(bread.id)}`);

  /* 🔴 进帐是 min(收到的, 这一篮) —— 找出去那 RM 1.80 不是他的收入。 */
  const { data: entries } = await C.from("ledger_entries")
    .select("amount_cents, direction, against_id, method").eq("project_id", P);
  const paid = (entries ?? []).find((e) => e.against_id === s?.record_id);
  check("🔴 帐上记的是 RM 8.20，不是他手上那张 RM 10",
    Number(paid?.amount_cents) === 820, `${paid?.amount_cents}`);
  check("而且记得他是付现金", paid?.method === "cash", `${paid?.method}`);
  const { data: owing } = await C.rpc("party_debts", { in_project_id: P });
  check("那张单收齐了，「谁欠我钱」上没有它",
    !(owing ?? []).some((r) => r.record_id === s?.record_id), "还挂着");

  /* ── ③ 🔴 按两下 ──────────────────────────────────────────── */
  console.log("\n③ 🔴 柜台按两下");
  const { data: again } = await C.rpc("ring_up_sale", {
    in_project_id: P, in_module_key: "orders",
    in_lines: [
      { description: "Coke 320ml", item_id: coke.id, qty: 2, unit: "can" },
      { description: "Roti Gardenia", item_id: bread.id, qty: 1, unit: "loaf" },
    ],
    in_paid_cents: 1000, in_method: "cash", in_idempotency_key: key1,
  });
  const a2 = one(again);
  check("🔴 还是同一张单", a2?.record_id === s?.record_id, `${a2?.record_id}`);
  check("🔴 而且它讲得出这一下什么都没做", a2?.rang === false, `${a2?.rang}`);
  check("🔴 架上没有再少一次",
    (await at(coke.id)) === 98 && (await at(bread.id)) === 19,
    `${await at(coke.id)} / ${await at(bread.id)}`);
  const { count: entryRows } = await C.from("ledger_entries")
    .select("id", { count: "exact", head: true }).eq("project_id", P);
  check("🔴 钱也只记了一次", entryRows === 1, `${entryRows} 笔`);

  /* ── ④ 付不够 ─────────────────────────────────────────────── */
  console.log("\n④ 付不够（老客户赊数）");
  const { data: cust } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ah Seng",
  });
  const { data: partial } = await C.rpc("ring_up_sale", {
    in_project_id: P, in_module_key: "orders",
    in_lines: [{ description: "Coke 320ml", item_id: coke.id, qty: 10, unit: "can" }],
    in_paid_cents: 1000, in_method: "cash",
    in_party: "Ah Seng", in_party_id: cust?.id,
    in_idempotency_key: crypto.randomUUID(),
  });
  const p2 = one(partial);
  check("🔴 付不够照样成交", !!p2?.record_id, "被挡了");
  check("这一篮 RM 25、收 RM 10、还欠 RM 15",
    Number(p2?.total_cents) === 2500 && Number(p2?.owed_cents) === 1500,
    `${p2?.total_cents} / ${p2?.owed_cents}`);
  check("🔴 不用找他钱", Number(p2?.change_cents) === 0, `${p2?.change_cents}`);
  check("架上照样少十罐", (await at(coke.id)) === 88, `${await at(coke.id)}`);
  const { data: owing2 } = await C.rpc("party_debts", { in_project_id: P });
  const his = (owing2 ?? []).find((r) => r.party_id === cust?.id);
  check("🔴 那张单自己留在「谁欠我钱」上，欠 RM 15",
    Number(his?.owed_cents) === 1500, `${his?.owed_cents}`);

  /* ── ⑤ 一分都没付 ─────────────────────────────────────────── */
  console.log("\n⑤ 一分都没付");
  const { count: before } = await C.from("ledger_entries")
    .select("id", { count: "exact", head: true }).eq("project_id", P);
  const { data: credit } = await C.rpc("ring_up_sale", {
    in_project_id: P, in_module_key: "orders",
    in_lines: [{ description: "Roti Gardenia", item_id: bread.id, qty: 2, unit: "loaf" }],
    in_paid_cents: 0, in_party: "Ah Seng", in_party_id: cust?.id,
    in_idempotency_key: crypto.randomUUID(),
  });
  const c3 = one(credit);
  const { count: afterCount } = await C.from("ledger_entries")
    .select("id", { count: "exact", head: true }).eq("project_id", P);
  check("🔴 一分都没付 → 不记那一笔帐（RM 0 的收款看起来像真的收款）",
    afterCount === before, `${before} → ${afterCount}`);
  check("而单还是开了、货还是出了",
    !!c3?.record_id && (await at(bread.id)) === 17, `${await at(bread.id)}`);

  /* ── ⑥ 挡下来的那几种 ─────────────────────────────────────── */
  console.log("\n⑥ 挡下来的那几种");
  const { error: empty } = await C.rpc("ring_up_sale", {
    in_project_id: P, in_module_key: "orders", in_lines: [], in_paid_cents: 100,
  });
  check("空篮子 → 挡", !!empty, "居然让它过了");
  const { error: negative } = await C.rpc("ring_up_sale", {
    in_project_id: P, in_module_key: "orders",
    in_lines: [{ description: "Coke 320ml", item_id: coke.id, qty: 1 }],
    in_paid_cents: -100,
  });
  check("收到负数的钱 → 挡", !!negative, "居然让它过了");

  /* ── ⑦ 别人家 ─────────────────────────────────────────────── */
  console.log("\n⑦ 别人家");
  const other = await person("other");
  const O = other.client;
  await O.rpc("set_project_style", { new_style: "counter" });
  const { data: theirScan } = await O.rpc("scan_item", {
    in_project_id: P, in_code: "9556001",
  });
  check("🔴 扫不到别人家的货", (theirScan ?? []).length === 0,
    `${(theirScan ?? []).length}`);
  const { error: theirSale } = await O.rpc("ring_up_sale", {
    in_project_id: P, in_module_key: "orders",
    in_lines: [{ description: "Coke 320ml", item_id: coke.id, qty: 1 }],
    in_paid_cents: 250,
  });
  check("🔴 也结不了别人家的帐", !!theirSale, "居然让它过了");

  console.log(
    fail === 0
      ? `\n判：全部过（${people.length} 个用完就删的帐号）`
      : `\n判：${pass} 过 · ${fail} 没过`);
  if (fail > 0) process.exitCode = 1;
} catch (err) {
  console.error(`\n🔴 走到一半炸了：${err?.message ?? err}`);
  process.exitCode = 1;
} finally {
  await dropThrowaways(admin, people);
}
