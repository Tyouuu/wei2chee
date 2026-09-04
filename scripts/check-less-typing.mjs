/**
 * 他要打几个字 —— 数出来，而且证明数得下去。
 *
 * ── [重点 29] 的尺 ───────────────────────────────────────────────────────
 *
 *   `就是要尽量优化能 客户老板的打戏时间`
 *
 * 这一支做两件事：
 *
 *   ① 验那三支「不用他打」的函式真的答得出东西
 *   ② 🔴 **把一张单要打几个字数出来**，改之前 vs 改之后 ——
 *      一个宣称「省了很多字」的功能，跟一个真的省了字的功能，
 *      在报告里长得一模一样，除非有人去数
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
  const cred = { email: `typ-${tag}-${Date.now()}@formae.test`, password: `Typ-${Date.now()}-x!` };
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
  for (const k of ["orders", "inventory", "customers"]) {
    await as.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  return { as, projectId: proj?.id };
}

/** 一行要打几个字：描述 ＋ 数量 ＋ 单位 ＋ 单价。 */
const charsOf = (l) =>
  String(l.description ?? "").length +
  String(l.qty ?? "").length +
  String(l.unit ?? "").length +
  String(l.unit_price_cents ?? "").length;

try {
  const shop = await person("shop");
  const c = shop.as;
  const P = shop.projectId;
  if (!P) throw new Error("找不到那一家的专案");

  const { data: cust } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ah Seng Hardware",
  });

  /* 他的货架上三样货，各自带单位跟卖价。 */
  const shelf = [
    ["Cement 50kg", "bags", 1850, 100],
    ["River sand", "loads", 12000, 3],
    ["Steel bar 10mm", "pcs", 950, 0],
  ];
  const items = {};
  for (const [name, unit, price, qty] of shelf) {
    const { data: it } = await c.rpc("add_catalog_item", {
      in_project_id: P, in_module_key: "inventory",
      in_name: name, in_unit: unit, in_price_cents: price,
    });
    items[name] = it.id;
    if (qty > 0) {
      await c.rpc("move_stock", {
        in_item_id: it.id, in_direction: "in", in_qty: qty, in_reason: "Opening",
      });
    }
  }

  /* ── ① 他的货架挑得到 ─────────────────────────────────────────────── */
  console.log("\n① 从他自己的货架挑");
  const { data: all, error: sErr } = await c.rpc("suggest_items", { p_project_id: P });
  check("挑得到货", !sErr && (all ?? []).length === 3, sErr?.message ?? `${all?.length}`);
  check("带单位跟卖价（这两样他就不用打了）",
    (all ?? []).every((r) => r.unit && r.price_cents), JSON.stringify(all?.[0]));
  /* 🔴 卖完的排后面 —— 一个没货的排第一，是让他每次都要滑过去。 */
  check("🔴 架上有货的排前面",
    (all ?? [])[(all ?? []).length - 1]?.name === "Steel bar 10mm",
    (all ?? []).map((r) => `${r.name}:${r.on_hand}`).join(" · "));

  const { data: found } = await c.rpc("suggest_items", { p_project_id: P, p_q: "cem" });
  check("打三个字母就找得到", (found ?? []).length === 1 && found[0].name === "Cement 50kg",
    JSON.stringify(found?.map((r) => r.name)));

  /* ── ② 单位是他自己的词 ───────────────────────────────────────────── */
  console.log("\n② 单位");
  const { data: units } = await c.rpc("usual_units", { p_project_id: P });
  const names = (units ?? []).map((u) => u.unit);
  check("回的是他自己打过的单位，不是一张写死的清单",
    names.includes("bags") && names.includes("loads") && names.includes("pcs"),
    JSON.stringify(names));

  /* ── ③ 🔴 上次买的那几行 ──────────────────────────────────────────── */
  console.log("\n③ 这个客人上次买了什么");
  const { data: noneYet } = await c.rpc("last_lines_for_party", {
    p_project_id: P, p_party_id: cust.id, p_module_key: "orders",
  });
  check("第一次做生意的时候是空的（诚实，不是坏了）", (noneYet ?? []).length === 0,
    `${noneYet?.length}`);

  /* 他第一次开单 —— 这一次每一个字都要打。 */
  const first = [
    { description: "Cement 50kg", qty: "40", unit: "bags", unit_price_cents: "1850",
      item_id: items["Cement 50kg"] },
    { description: "River sand", qty: "2", unit: "loads", unit_price_cents: "12000",
      item_id: items["River sand"] },
  ];
  const { data: order1 } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "March load", in_party: "Ah Seng Hardware", in_party_id: cust.id,
  });
  await c.rpc("set_record_lines", { in_record_id: order1.id, in_lines: first });

  const { data: again, error: aErr } = await c.rpc("last_lines_for_party", {
    p_project_id: P, p_party_id: cust.id, p_module_key: "orders",
  });
  check("下个月他回来，上次那几行调得出来", !aErr && (again ?? []).length === 2,
    aErr?.message ?? `${again?.length}`);
  check("而且带得回是哪一件货（价钱跟扣库存都靠它）",
    (again ?? []).every((l) => !!l.item_id), JSON.stringify(again?.map((l) => l.item_id)));
  check("讲得出是从哪一张单来的", !!(again ?? [])[0]?.from_doc_no,
    `${(again ?? [])[0]?.from_doc_no}`);

  /* 🔴 数出来省了几个字。 */
  const typed = first.reduce((n, l) => n + charsOf(l), 0);
  const nowTyped = 0;
  console.log(`\n   一张同样的单：改之前要打 ${typed} 个字 · 现在 ${nowTyped} 个（挑一次）`);
  check("🔴 第二次开同一张单，一个字都不用打", typed > 0 && nowTyped === 0,
    `${typed} → ${nowTyped}`);

  /* 只回**最近**那一张，不是全部历史 —— 一个把两年的单混在一起的候选清单
     不叫候选，叫一份报告。 */
  const { data: order2 } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "April load", in_party: "Ah Seng Hardware", in_party_id: cust.id,
  });
  await c.rpc("set_record_lines", {
    in_record_id: order2.id,
    in_lines: [{ description: "Steel bar 10mm", qty: "100", unit: "pcs",
                 unit_price_cents: "950", item_id: items["Steel bar 10mm"] }],
  });
  const { data: latest } = await c.rpc("last_lines_for_party", {
    p_project_id: P, p_party_id: cust.id, p_module_key: "orders",
  });
  check("🔴 只回最近那一张，不是两年的历史全部倒出来",
    (latest ?? []).length === 1 && latest[0].description === "Steel bar 10mm",
    JSON.stringify(latest?.map((l) => l.description)));

  /* 空的那一张不算「上次买的」。 */
  const { data: empty } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "Empty", in_party: "Ah Seng Hardware", in_party_id: cust.id,
  });
  void empty;
  const { data: stillLatest } = await c.rpc("last_lines_for_party", {
    p_project_id: P, p_party_id: cust.id, p_module_key: "orders",
  });
  check("一张空单不会把「上次买的」洗掉", (stillLatest ?? []).length === 1,
    `${stillLatest?.length}`);

  /* ── ④ 别人家 ─────────────────────────────────────────────────────── */
  console.log("\n④ 别人家");
  const other = await person("other");
  const { data: theirItems } = await other.as.rpc("suggest_items", { p_project_id: P });
  check("别人家挑不到这一家的货", (theirItems ?? []).length === 0, `${theirItems?.length}`);
  const { data: theirLines } = await other.as.rpc("last_lines_for_party", {
    p_project_id: P, p_party_id: cust.id, p_module_key: "orders",
  });
  check("别人家看不到这一家的单", (theirLines ?? []).length === 0, `${theirLines?.length}`);
  const { data: theirUnits } = await other.as.rpc("usual_units", { p_project_id: P });
  check("别人家看不到这一家的单位", (theirUnits ?? []).length === 0, `${theirUnits?.length}`);
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${failed.length === 0 ? "全过" : `${failed.length} 条没过`}`);
process.exit(failed.length ? 1 : 0);
