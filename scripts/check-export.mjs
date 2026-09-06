/**
 * 「拿走我的资料」—— 而它今天只给他四十九张表里的三张。
 *
 * 🔴 这一支存在的理由是一个**已经出去的承诺破掉了**:
 *   [任务 64](../docs/founder-tasks.md#64) 定过「① 资料 —— 他的行，免费，随时」，
 *   而且明写那是**销售资产不是成本**（一个疑心的承包商，因为走得掉才签得下来）。
 *   那颗按钮抓的是 projects · project_pages · site_enquiries ＋ 官网照片。
 *   8-30 之后建的每一张表**一张都不在里面**。
 *
 *   而它比少一个功能糟：他按下去、拿到一个档案、**以为他的资料在手上**。
 *
 * 🔴 而这一支真正在守的是第 ② 段:
 *   **每一张带 project_id 的表，都要真的出现在汇出档里** ——
 *   而那份名单是**问资料库拿的**，不是我写在这里的。
 *   下一张表建出来的那天，这一条自己就会开始量它。
 */
import { readFileSync, readdirSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";

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
  const email = `exp-${tag}-${stamp}@formae.test`;
  const password = `Exp-${stamp}-x!`;
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

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  for (const k of ["quotations", "customers", "payments", "inventory"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  /* 种一点真的东西 —— 不然下面每一条量的是空气（[任务 125] 的教训）。 */
  const { data: cust } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Lim",
  });
  const { data: job } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "Bathroom",
    in_party: "Mrs Lim", in_party_id: cust.id, in_amount_cents: 4_850_000,
  });
  await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 1_000_000, in_party: "Mrs Lim", in_party_id: cust.id,
    in_against_id: job.id,
  });
  await C.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Cement 50kg",
    in_unit: "bags",
  });

  /* ── ① 控制组：他自己的东西真的在里面 ────────────────────────── */
  console.log("\n① 控制组：他自己的东西在里面");
  const { data: dump, error: de } = await C.rpc("export_my_data", {
    in_project_id: P,
  });
  check("汇得出来", !de && !!dump, de?.message);
  check("公司自己那一行在里面",
    Array.isArray(dump?.projects) && dump.projects[0]?.id === P,
    JSON.stringify(dump?.projects?.[0]?.id));
  check("那个客户在里面",
    (dump?.directory_entries ?? []).some((r) => r.id === cust.id),
    `${dump?.directory_entries?.length} 行`);
  check("那张单在里面",
    (dump?.pipeline_records ?? []).some((r) => r.id === job.id),
    `${dump?.pipeline_records?.length} 行`);
  check("🔴 那笔钱在里面（钱是他最不能丢的那一样）",
    (dump?.ledger_entries ?? []).some((r) => r.amount_cents === 1_000_000),
    `${dump?.ledger_entries?.length} 行`);
  check("而分摊那一行也在（一笔钱付了哪一张单）",
    (dump?.ledger_allocations ?? []).length === 1,
    `${dump?.ledger_allocations?.length} 行`);
  check("那件货在里面",
    (dump?.catalog_items ?? []).some((r) => r.name === "Cement 50kg"),
    `${dump?.catalog_items?.length} 行`);

  /* ── ② 🔴 每一张带 project_id 的表都要在里面 ───────────────── */
  console.log("\n② 🔴 每一张他的表都要在里面（名单问资料库拿的）");
  const { data: tables, error: te } = await C.rpc("his_data_tables");
  check("问得到那份名单", !te && (tables ?? []).length > 30,
    te?.message ?? `${tables?.length} 张`);
  const missing = (tables ?? [])
    .map((r) => r.tbl)
    .filter((t) => !(t in (dump ?? {})));
  check(`🔴 ${tables?.length} 张表，一张都没有漏掉`,
    missing.length === 0, missing.join(" · "));
  /* 🔴 而上面那一条有一个真的弱点，写下来：
     **它跟汇出那一支问的是同一句话** ——
     那一支哪天只回三张，两边会一起错而且一起继续绿。
     所以再问一次，而且问一个**不同的来源**：磁碟上那几百支
     migration 自己。两边对不上本身就是一个发现。
     ⚠️ 实查过：这个仓库从来没有 drop 过一张表，
     所以磁碟上建过的就是今天还在的。 */
  const sqlDir = new URL("../supabase/migrations/", import.meta.url);
  const files = readdirSync(sqlDir).filter((f) => f.endsWith(".sql"));
  const onDisk = new Set();
  for (const f of files) {
    const text = readFileSync(new URL(f, sqlDir), "utf8");
    const re = /create table if not exists public\.(\w+)\s*\(([\s\S]*?)\n\);/g;
    let m;
    while ((m = re.exec(text)) !== null) {
      if (/project_id/.test(m[2])) onDisk.add(m[1]);
    }
    const alt = /alter table public\.(\w+)[\s\S]{0,200}?add column if not exists project_id/g;
    while ((m = alt.exec(text)) !== null) onDisk.add(m[1]);
  }
  check("控制组：从磁碟上真的读到表了", onDisk.size > 30,
    `${onDisk.size} 张`);
  const missingOnDisk = [...onDisk].filter((t) => !(t in (dump ?? {})));
  check(`🔴 磁碟上那 ${onDisk.size} 张（另一个来源）也一张都没有漏`,
    missingOnDisk.length === 0, missingOnDisk.join(" · "));

  check("而且公司那一行是另外加的（它的栏位叫 id 不叫 project_id）",
    !(tables ?? []).some((r) => r.tbl === "projects") && "projects" in (dump ?? {}),
    "projects 那一段不见了");

  /* ── ③ 🔴 别人家的行一行都不在里面 ─────────────────────────── */
  console.log("\n③ 🔴 别人家的行一行都不在里面");
  const other = await person("other");
  const O = other.client;
  await O.rpc("set_project_style", { new_style: "ledger" });
  const { data: theirProj } = await admin
    .from("projects").select("id").eq("account_id", other.id).single();
  await O.rpc("add_project_page", { requested_key: "customers", new_title: "c" });
  const { data: theirCust } = await O.rpc("add_directory_entry", {
    in_project_id: theirProj.id, in_module_key: "customers", in_name: "Someone else",
  });

  const { data: dump2 } = await C.rpc("export_my_data", { in_project_id: P });
  const everyRow = Object.values(dump2 ?? {}).flat().filter(Boolean);
  check("控制组：真的捞到东西了（不是空的）", everyRow.length > 5,
    `${everyRow.length} 行`);
  check("🔴 别人家那个客户不在里面",
    !everyRow.some((r) => r?.id === theirCust.id), "居然在里面");
  check("🔴 每一行都属於这一家",
    everyRow.every((r) => r?.project_id === undefined || r.project_id === P),
    JSON.stringify(everyRow.filter((r) => r?.project_id && r.project_id !== P)
      .slice(0, 2)));

  /* ── ④ 🔴 汇不了别人家 ─────────────────────────────────────── */
  console.log("\n④ 🔴 汇不了别人家");
  const { error: crossErr } = await O.rpc("export_my_data", { in_project_id: P });
  check("🔴 另一家汇不了我的", !!crossErr, "居然让它过了");

  /* ── ⑤ 🔴 师傅拿不走（汇出档里有他每一笔钱）──────────────── */
  console.log("\n⑤ 🔴 师傅拿不走");
  const crew = await person("crew");
  const { error: memErr } = await C.rpc("add_project_member", { in_email: crew.email });
  check("控制组：那个师傅真的进了这一家", !memErr, memErr?.message);
  const { error: crewErr } = await crew.client.rpc("export_my_data", {
    in_project_id: P,
  });
  check("🔴 师傅汇不走（里面有钱）", !!crewErr, "居然让它过了");

  /* ── ⑥ 讲清楚它不含什么 ───────────────────────────────────── */
  console.log("\n⑥ 讲清楚它不含什么");
  check("照片不在这一支里（它们住在储存空间，要签名的网址）",
    !("photos" in (dump ?? {})) && !("site-photos" in (dump ?? {})),
    Object.keys(dump ?? {}).filter((k) => k.includes("photo")).join(" · "));

  console.log(
    bad.length ? `\n判：${bad.length} 条没过\n  ${bad.join("\n  ")}`
      : `\n判：全部过（${tables?.length} 张表 · ${people.length} 个用完就删的帐号）`,
  );
} catch (err) {
  console.error(`\n🔴 尺子自己炸了：${err?.message ?? err}`);
  bad.push("尺子炸了");
} finally {
  await dropThrowaways(admin, people);
  process.exit(bad.length ? 1 : 0);
}
