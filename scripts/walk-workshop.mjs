/**
 * 一间车厂，从柜台打一个车牌到「谁好久没来」—— 走一次，**数他要动手几次**。
 *
 * 跟 `walk:reno` · `walk:salon` 同一把尺（[任务 231](../docs/founder-tasks.md#231)）。
 *
 * 🔴 为什么走这一条：`find:prospects` 扫怡保 278 家，
 *   **车相关的 132 家，将近一半**（车行 91 · 车厂 30 · 汽车配件 11）——
 *   而这一条链**从来没有走过**，车牌那几支（[任务 157](../docs/founder-tasks.md#157)）
 *   也从来没有被一次真的流程碰过。
 *
 * ⚠️ 车牌全部是编的。
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
  const email = `ws-${tag}-${Date.now()}@formae.test`;
  const password = `Ws-${Date.now()}-x!`;
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
  await C.rpc("set_project_style", { new_style: "counter" });
  await admin.from("projects")
    .update({ business_name: "Ah Hock Auto Service" }).eq("id", P);
  for (const k of ["quotations", "customers", "payments", "inventory", "expenses"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  const started = acts;

  /* ── ① 柜台打一个车牌 —— 没有这一台 ───────────────────────── */
  let n = acts;
  const missing = await act(C, "打车牌找车", "find_vehicle", {
    in_project_id: P, in_plate: "wa 1234 a",
  });
  node("柜台打一个车牌（第一次来）", acts - n, (missing ?? []).length === 0,
    "一次；找不到 —— 那就是新客人");

  /* ── ② 就在那里登记 ───────────────────────────────────────── */
  n = acts;
  const owner = await act(C, "建车主", "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mr Ong",
    in_phone: "016-777 8899",
  });
  const car = await act(C, "登记那台车", "add_vehicle", {
    in_project_id: P, in_plate: "WA-1234-A", in_party_id: owner?.id,
    in_descr: "Perodua Myvi 1.3", in_service_every_km: 10_000,
  });
  node("就在那里登记（车牌已经在框里了）", acts - n, !!car?.id,
    "两次（车主 · 车）；而那个车牌他不用再打一次");

  /* ── ③ 🔴 大小写空格横杠换掉，还是同一台 ──────────────────── */
  n = acts;
  const again = await act(C, "换一种写法再找", "find_vehicle", {
    in_project_id: P, in_plate: "wa1234a",
  });
  const found = one(again);
  node("🔴 换一种写法打，还是同一台", acts - n,
    found?.vehicle_id === car?.id,
    found ? `一次；${found.plate} · ${found.descr} · 车主 ${found.owner_name}`
      : "找不到");

  /* ── ④ 开单，挂上那台车跟里程 ─────────────────────────────── */
  n = acts;
  const job = await act(C, "开一张单", "add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "Service + brake pads",
    in_party: "Mr Ong", in_party_id: owner?.id, in_amount_cents: 48_000,
  });
  await act(C, "挂上车跟里程", "set_record_vehicle", {
    in_record_id: job?.id, in_vehicle_id: car?.id, in_odometer_km: 62_000,
  });
  node("开单 ＋ 挂上那台车跟里程", acts - n, !!job?.id, "两次");

  /* ── ⑤ 🔴 里程往回走要挡 ──────────────────────────────────── */
  n = acts;
  const job2 = await act(C, "下一次进厂", "add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "Aircon service",
    in_party: "Mr Ong", in_party_id: owner?.id, in_amount_cents: 25_000,
  });
  const { error: backwards } = await C.rpc("set_record_vehicle", {
    in_record_id: job2?.id, in_vehicle_id: car?.id, in_odometer_km: 6_200,
  });
  acts += 1;
  node("🔴 里程打成 6,200（少打一个零）→ 挡", acts - n, !!backwards,
    backwards ? "而且讲得出该怎么做" : "居然让它过了");

  /* ── ⑥ 这台车做过什么 ─────────────────────────────────────── */
  n = acts;
  await C.rpc("set_record_vehicle", {
    in_record_id: job2?.id, in_vehicle_id: car?.id, in_odometer_km: 68_500,
  });
  acts += 1;
  const history = await act(C, "翻这台车的历史", "vehicle_history", {
    in_vehicle_id: car?.id,
  });
  node("「这台车做过什么」", acts - n, (history ?? []).length === 2,
    `两次（改对里程 · 翻历史）；${(history ?? []).length} 次进厂`);

  /* ── ⑦ 🔴 下次几公里保养 ──────────────────────────────────── */
  n = acts;
  const now = one(await act(C, "再打一次车牌", "find_vehicle", {
    in_project_id: P, in_plate: "WA 1234 A",
  }));
  node("🔴 柜台再打车牌 → 上次几时来、几公里、下次几公里", acts - n,
    Number(now?.last_odometer_km) === 68_500 && Number(now?.due_at_km) === 78_500,
    now ? `一次；上次 ${now.last_odometer_km} km · 下次 ${now.due_at_km} km · 来过 ${now.visits} 次`
      : "问不到");

  /* ── ⑧ 谁好久没来 ─────────────────────────────────────────── */
  n = acts;
  const quiet = await act(C, "问谁好久没来", "vehicles_overdue", {
    in_project_id: P, in_months: 6,
  });
  const cold = (quiet ?? []).some((r) => r.vehicle_id === car?.id);
  node("「谁好久没来」（按多久没来排，不按公里）", acts - n, !cold,
    `一次；刚来过的那一台**不在**名单上（${(quiet ?? []).length} 台在）`);

  /* ── ⑨ 收钱 · 成本 ────────────────────────────────────────── */
  n = acts;
  await act(C, "收钱", "add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 48_000, in_party: "Mr Ong", in_party_id: owner?.id,
    in_against_id: job?.id,
  });
  await act(C, "记零件成本", "add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses", in_direction: "out",
    in_amount_cents: 18_000, in_party: "Parts supplier",
    in_category: "零件", in_job_id: job?.id,
  });
  const { data: debts } = await C.rpc("party_debts", { in_project_id: P });
  const stillOwes = (debts ?? []).find((r) => r.party_id === owner?.id);
  node("收钱 ＋ 记零件成本", acts - n, true,
    `两次；那张单结清了，他还欠 RM ${((stillOwes?.owed_cents ?? 0) / 100).toFixed(0)}`);

  /* ── 读数 ─────────────────────────────────────────────────── */
  console.log("\n一间车厂，从柜台打一个车牌到「谁好久没来」\n");
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
