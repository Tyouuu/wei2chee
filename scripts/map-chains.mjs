/**
 * 二百多支函式，十三条链 —— 中间那一段去哪了？
 *
 * 他 2026-09-07 问：
 *   `你说我们这里有200+的功能 怎么可能才那么少的workflow
 *    是不是有些功能是没有workflow的`
 *
 * 那一句要用**量的**答，不是用记忆答。这一支做的是：
 *
 *   ① 每一支**活着而且开出去**的函式（最后一次是 create，不是 drop）
 *   ② 它**碰哪几张表** —— 从它自己的函式本文里读出来，不是从我记得的清单
 *   ③ 那几张表属於哪一条链 —— 那一张对照表是**唯一**手写的东西，
 *      而它一张一张表列出来，看得完也改得动
 *   ④ 🔴 **落不进任何一条链的，逐支印出来** —— 那才是他问的那一句
 *
 * ⚠️ 它**不判对错**，只印读数。「一条链几支算多」是他的判断，
 * 而一条我发明的门槛会让这份读数从第一天起就替他做决定。
 *
 * 🔴 三件跟 `npm run brief` 对齐的，不要另外发明一套：
 *   · 开出去 = `grant execute on function public.X`（多行的也算）
 *   · 有门（严）= 画面代码里真的有 `.rpc("X")`
 *   · 有门（引号）= 画面代码里有一个**带引号的同名字串**（`call("X")` 那种）
 *     两个都印 —— **它们的差额本身就是资讯**（换了个写法接上的，跟没接的，
 *     在严的那一栏长得一模一样）。
 */
import { readFileSync, readdirSync } from "node:fs";
import { execSync } from "node:child_process";
import { join } from "node:path";

const ROOT = process.cwd();
const sh = (cmd) => {
  try {
    /* 🔴 `maxBuffer` 预设 1MB，而那个宽的 grep 回六十六万行（约 5MB）——
       爆掉会抛，而我原本把它吞成空字串：**一个静静回空的读数，
       跟「一支都没接」长得一模一样**。这个仓库被这个形状骗过五次。 */
    return execSync(cmd, {
      cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"],
      maxBuffer: 256 * 1024 * 1024,
    });
  } catch {
    return "";
  }
};

/* ── ① 活着而且开出去的 ──────────────────────────────────────────────── */
const dir = join(ROOT, "supabase", "migrations");
const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
if (!files.length) {
  console.error("读不到 supabase/migrations —— 拒绝拿一份空的清单去算");
  process.exit(2);
}

/** 名字 → { alive, body } —— 照档名顺序走，后面的盖前面的。 */
const fn = new Map();
const tables = new Set();
for (const f of files) {
  const sql = readFileSync(join(dir, f), "utf8");
  /* 建表 —— 拿来做那张对照表的底 */
  for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?public\.(\w+)/gi)) {
    tables.add(m[1]);
  }
  /* drop 掉的 */
  for (const m of sql.matchAll(/drop\s+function\s+(?:if\s+exists\s+)?public\.(\w+)/gi)) {
    const cur = fn.get(m[1]) ?? { body: "" };
    fn.set(m[1], { ...cur, alive: false });
  }
  /* 建出来的 —— 连本文一起留着，等下要读它碰哪几张表 */
  for (const m of sql.matchAll(
    /create\s+(?:or\s+replace\s+)?function\s+public\.(\w+)\s*\(/gi,
  )) {
    const from = m.index;
    /* 到下一个 create function 为止就是这一支的本文（够用了：
       我们只要知道它提到哪几张表，不是要解析 SQL）。 */
    const rest = sql.slice(from + 1);
    const nextAt = rest.search(/create\s+(?:or\s+replace\s+)?function\s+public\./i);
    const body = nextAt === -1 ? sql.slice(from) : sql.slice(from, from + 1 + nextAt);
    fn.set(m[1], { alive: true, body });
  }
}

const grantedNames = new Set(
  [...readFileSync(join(dir, files[files.length - 1]), "utf8") ? [] : []],
);
const allSql = files.map((f) => readFileSync(join(dir, f), "utf8")).join("\n");
for (const m of allSql.matchAll(/grant\s+execute\s+on\s+function\s+public\.(\w+)/gi)) {
  grantedNames.add(m[1]);
}

const live = [...grantedNames]
  .filter((n) => fn.get(n)?.alive)
  .sort();

/* ── ② 有门没有 ──────────────────────────────────────────────────────── */
const FE = "app lib components design-system";
const INC = "--include=*.ts --include=*.tsx";
const strict = new Set(
  [...sh(`grep -rhoE "[.]rpc[(][^)]*" ${FE} ${INC} 2>/dev/null`)
    .matchAll(/\.rpc\(\s*"([a-z_]+)"/g)].map((m) => m[1]),
);
/* 🔴 第二种判法要**准**，不要宽。
   `npm run brief` 已经量过一次而且写下来了：宽松地 grep 每一个小写字串，
   会把**注解里提到的**也算成接上了（实测差 15 支）—— 那条判断是对的，
   不推翻它（重点 7h）。
   而它漏掉的是另一种真的接法：`call("share_record")` —— 包一层的呼叫。
   所以第二种判法是「**有没有一个带引号的同名字串**」：
   包一层的接得到，而注解里裸写的那个名字接不到。 */
const quoted = new Set(
  [...sh(`grep -rhoE '"[a-z_]{4,}"' ${FE} ${INC} 2>/dev/null`)
    .matchAll(/"([a-z_]{4,})"/g)].map((m) => m[1]),
);
if (!strict.size) {
  console.error("画面代码里一支 .rpc 都读不到 —— 那不是「一支都没接」，是 grep 坏了");
  process.exit(2);
}
/* 🔴 第二栏也要一条守卫 —— 它第一次跑就是空的（上面那个 maxBuffer），
   而空的那一栏会把「换个写法接上了」印成「没接」。 */
if (quoted.size < strict.size) {
  console.error(`带引号那一份比严的还少（${quoted.size} < ${strict.size}）—— 那不是读数，是 grep 坏了`);
  process.exit(2);
}

/* ── ③ 一张表属於哪一条链 ────────────────────────────────────────────
   🔴 **这是这一支唯一手写的东西**，所以它一张一张表写出来，
   而且底下有一条守卫：建了新表而这里没有登记 → 印出来。
   十三条链的名字照任务 219 那一份。 */
const TABLE_CHAIN = {
  /* ① 接客到成交 */
  leads: "接客到成交", analysis_results: "接客到成交", site_enquiries: "接客到成交",
  handoff_requests: "接客到成交",
  /* ② 成交到收款 */
  pipeline_records: "成交到收款", record_lines: "成交到收款", record_terms: "成交到收款",
  record_changes: "成交到收款", returns: "成交到收款", return_lines: "成交到收款",
  deliveries: "成交到收款", follow_ups: "成交到收款", nudge_snoozes: "成交到收款",
  /* ③ 叫货到付款 */
  /* （进货单也住在 pipeline_records 上 —— 那一栏归 ② ，不重复算） */
  /* ④ 钱到帐 */
  ledger_entries: "钱到帐", ledger_allocations: "钱到帐", reconciliations: "钱到帐",
  reconciliation_lines: "钱到帐", opening_balances: "钱到帐", accounts_chart: "钱到帐",
  tax_profiles: "钱到帐", payment_requests: "钱到帐",
  /* ⑤ 人 */
  project_members: "人", staff_pay_terms: "人", pay_runs: "人", pay_lines: "人",
  work_days: "人", commission_tiers: "人", commission_schemes: "人", staff_hours: "人",
  /* ⑥ 客人关系 */
  directory_entries: "客人关系", directory_addresses: "客人关系",
  service_packages: "客人关系", package_uses: "客人关系", party_requests: "客人关系",
  /* ⑦ 预约到来店 */
  appointments: "预约到来店", class_groups: "预约到来店", class_members: "预约到来店",
  class_slots: "预约到来店", class_attendance: "预约到来店",
  /* ⑧ 库存 */
  catalog_items: "库存", stock_moves: "库存", stock_batches: "库存", branches: "库存",
  /* ⑨ 保养合约 */
  service_contracts: "保养合约", service_visits: "保养合约",
  /* ⑩ 租赁押金 */
  rentals: "租赁押金",
  /* ⑪ 车 */
  vehicles: "车",
  /* ⑫ 讯息 */
  messages: "讯息", message_settings: "讯息",
  /* ⑬ Formae 自己（建造期 —— 那不是他的生意的链，是我们的） */
  accounts: "Formae 自己", projects: "Formae 自己", project_pages: "Formae 自己",
  page_versions: "Formae 自己", project_domains: "Formae 自己",
  ai_usage: "Formae 自己", industries: "Formae 自己", registers: "Formae 自己",
  palettes: "Formae 自己", project_doc_prefixes: "Formae 自己",
  record_photos: "成交到收款", job_photos: "成交到收款",
  /* ⚠️ 底下这七张是第一次跑的时候它自己报出来的 —— 那条
     「建了表而没登记」的警告就是为了这个（不补，它们上面的函式
     会被算成「没有链」，而那是一个假的孤儿）。 */
  doc_counters: "成交到收款",
  ledger_accounts: "钱到帐", tax_profile: "钱到帐",
  payslips: "人", payslip_lines: "人",
  statutory_schedules: "人", statutory_brackets: "人",
};

const unmapped = [...tables].filter((t) => !TABLE_CHAIN[t]).sort();

/* ── ④ 每一支落在哪 ──────────────────────────────────────────────────── */
const rows = live.map((name) => {
  const body = fn.get(name)?.body ?? "";
  const touched = new Set();
  for (const m of body.matchAll(/public\.(\w+)/g)) {
    if (TABLE_CHAIN[m[1]]) touched.add(m[1]);
  }
  const chains = [...new Set([...touched].map((t) => TABLE_CHAIN[t]))];
  return {
    name,
    chains,
    door: strict.has(name) ? "严" : quoted.has(name) ? "引号" : "",
  };
});

/* 🔴 「没门」还要再分一次，不然那个数字会把两种东西算在一起：
     · **内部零件** —— 别的函式在用它（`today_myt` · `works_here` ·
       `next_doc_no` · `branch_is_ours`）。它本来就不该有门
     · 🔴 **真的没门的功能** —— 没有任何函式用它，画面也没提过它。
       **那才是他按不到的那一格**
   任务 243 那一份是**用手扣掉十二支零件**的；这一次让它自己算：
   一支函式的名字有没有出现在**另一支**函式的本文里。 */
const calledBySql = new Set();
for (const [caller, meta] of fn) {
  if (!meta.alive) continue;
  for (const m of (meta.body ?? "").matchAll(/public\.(\w+)\s*\(/g)) {
    if (m[1] !== caller) calledBySql.add(m[1]);
  }
}
for (const r of rows) r.plumbing = !r.door && calledBySql.has(r.name);

const byChain = new Map();
for (const r of rows) {
  const key = r.chains.length ? r.chains[0] : "🔴 没有链";
  if (!byChain.has(key)) byChain.set(key, []);
  byChain.get(key).push(r);
}

const pad = (s, n) => String(s) + " ".repeat(Math.max(0, n - [...String(s)].reduce(
  (w, c) => w + (c.charCodeAt(0) > 0x2e80 ? 2 : 1), 0)));

console.log(`\n活着而且开出去的：${live.length} 支\n`);
console.log(`  ${pad("链", 16)}${pad("几支", 6)}${pad("有门(严)", 10)}${pad("有门(引号)", 12)}${pad("🔴 没门", 8)}内部零件`);
const order = [...byChain.keys()].sort(
  (a, b) => byChain.get(b).length - byChain.get(a).length);
for (const k of order) {
  const g = byChain.get(k);
  const s = g.filter((r) => r.door === "严").length;
  const w = g.filter((r) => r.door === "引号").length;
  const plumb = g.filter((r) => r.plumbing).length;
  console.log(`  ${pad(k, 16)}${pad(g.length, 6)}${pad(s, 10)}${pad(w, 12)}${pad(g.length - s - w - plumb, 8)}${plumb}`);
}

const orphans = byChain.get("🔴 没有链") ?? [];
console.log(`\n🔴 落不进任何一条链的：${orphans.length} 支`);
for (const r of orphans) {
  console.log(`  ${r.door ? `有门(${r.door})` : "没门   "}  ${r.name}`);
}

const noDoor = rows.filter((r) => !r.door && !r.plumbing).sort(
  (a, b) => (a.chains[0] ?? "").localeCompare(b.chains[0] ?? ""));
console.log(`
🔴 画面上一个字都没提过，而且没有别的函式在用它：${noDoor.length} 支`);
console.log("   （扣掉内部零件之后 —— 那才是他按不到的那几格）");
for (const r of noDoor) console.log(`  ${pad(r.chains[0] ?? "没有链", 16)}${r.name}`);

if (unmapped.length) {
  console.log(`\n⚠️ 建了表而这一支没有登记它属於哪一条链：${unmapped.length} 张`);
  console.log(`  ${unmapped.join(" · ")}`);
  console.log("  （那几张表上的函式会被算成「没有链」—— 先去补 TABLE_CHAIN 再读上面）");
}
console.log("");
