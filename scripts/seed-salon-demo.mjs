/**
 * 沙龙示范帐号 —— 一间种满资料的发廊，登入就能把 14 页一页页看完。
 *
 * ── 为什么要有这一支（任务 420）───────────────────────────────────────────
 *
 * 老板 9-23 讲的顺序：抄源代码 → 精修 → 补功能 → **开一个 link 给他真实交付、可以 review** →
 * 修问题 → 才做手机 / iPad。前三步做完了，第四步没有人排过。
 *
 * 那 14 页读的是**登入帐号自己那家店的真资料**，所以没登入是登入页、一个新帐号是空的。
 * 这一支就是那个「登入就有东西看」的帐号。
 *
 * ── 跟 throwaway 那一类临时帐号不一样的地方 ────────────────────────────
 *
 *   · 它**不会被删**（除非你再跑一次，它会先把自己删掉再重建）
 *   · 它删的**只有 `salon.demo@formae.test` 这一个 email 对应的那一个 id**：
 *     不收正则、不列举。`rebuild-demo.mjs` 的档头写着一支照 pattern 扫全库的清理
 *     怎么把老板的示范帐号一起炸掉
 *   · 密码**不进仓库**：从 `DEMO_SALON_PASSWORD` 读，没有就现场生一个印出来。
 *     这个帐号在真的资料库里，而助手那一块会花钱 —— 一个写在仓库里的密码
 *     等於一扇没锁的门
 *
 * ── 怎么用 ───────────────────────────────────────────────────────────────
 *
 *   node scripts/seed-salon-demo.mjs            # 只讲要做什么，什么都不动
 *   DEMO_SALON_PASSWORD=... node scripts/seed-salon-demo.mjs --write
 *                                               # 真的做（先删旧的再重建，约两三分钟）
 *
 * ⚠️ 走的全部是产品自己那几支写入函式（跟人按按钮同一条路），不是直接写表 ——
 *    只有「改一个日期让它变逾期」「设补货线 / 成本 / 卖价」这类产品没有入口的
 *    设定才用 service role 补。所以审计日志里每一笔都有「谁」（salon.demo），
 *    不会出现一串「Unknown」。
 * ⚠️ 电话是 010-000 00xx 这一段（没有分配出去的号段）：示范里按「WhatsApp」
 *    不会打扰到真的人。
 */
import { readFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { dropThrowaway } from "./lib/throwaway.mjs";

const WRITE = process.argv.includes("--write");
const EMAIL = "salon.demo@formae.test";

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

if (!WRITE) {
  console.log(`
这一支会做（加 --write 才真的做）：
  1. 找 ${EMAIL}：有就先把它连同店里的照片删掉（只删这一个 id）
  2. 开一个新的帐号，店名 Wei Hair Studio，老板 Wei Lin
  3. 开出 预约 · 师傅 · 库存 · 开销 四页（侧栏才会有 12 行）
  4. 3 位师傅（各有抽成）· 14 位客人 · 12 件货 ＋ 8 项服务价目 · 2 家供应商 · 2 张进货单
  5. 过去十周的来访（每一笔一条预约 ＋ 一行做了什么 ＋ 一笔收款）、今天 9 笔、明后天几笔
  6. 4 张套票 ＋ 5 个会员（含逾期的、已取消的）· 放飞机 · 5 句评价
  7. 昨天已经收工、今天还没收 · 今天有现金收款 ＋ 两笔开销
  8. 作品集 6 份（带照片）· 放飞机订金规矩 · 集点卡 · 一间分店
`);
  process.exit(0);
}

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });

const PASSWORD = process.env.DEMO_SALON_PASSWORD || `Wei-${randomBytes(6).toString("base64url")}-2026!`;

async function must(label, p) {
  const r = await p;
  if (r.error) throw new Error(`${label}: ${r.error.message}`);
  return r.data;
}
/** 失败不停：只印一句（用在「今天的状态」这类允许被产品拒绝的地方）。 */
async function soft(label, p) {
  const r = await p;
  if (r.error) console.log(`   (跳过) ${label}: ${r.error.message}`);
  return r.data ?? null;
}
const step = (n, t) => console.log(`\n${n}  ${t}`);

// ── 日期：马来西亚时间 ────────────────────────────────────────────────────
const MYT = "Asia/Kuala_Lumpur";
const ymd = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: MYT }).format(new Date(ms));
const DAY = 86_400_000;
const today = ymd(Date.now());
const daysAgo = (n) => ymd(Date.now() - n * DAY);
const daysAhead = (n) => ymd(Date.now() + n * DAY);
const pad = (n) => String(n).padStart(2, "0");
const at = (date, h, m = 0) => `${date}T${pad(h)}:${pad(m)}:00+08:00`;

// ── 一个固定种子的随机数，重跑得到同一间店 ────────────────────────────────
let seed = 20260925;
const rand = () => {
  seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
};
const pick = (arr) => arr[Math.floor(rand() * arr.length)];

// ═══ 1. 旧的那个 ═══════════════════════════════════════════════════════════
step("1", `找旧的 ${EMAIL}`);
const { data: old } = await admin.from("accounts").select("id").eq("email", EMAIL).maybeSingle();
if (old?.id) {
  const { data: oldProj } = await admin.from("projects").select("id").eq("account_id", old.id).maybeSingle();
  if (oldProj?.id) {
    const folder = `${oldProj.id}/lookbook`;
    const { data: files } = await admin.storage.from("job-photos").list(folder);
    if (files?.length) await admin.storage.from("job-photos").remove(files.map((f) => `${folder}/${f.name}`));
  }
  if (!(await dropThrowaway(admin, old.id))) throw new Error("旧的帐号删不掉，停下来（不要在它上面叠一份）");
  console.log("   旧的已经删了（连店里的照片）");
} else {
  console.log("   没有旧的");
}

// ═══ 2. 新帐号 ═════════════════════════════════════════════════════════════
step("2", "开新帐号");
const { error: mkErr } = await admin.auth.admin.createUser({ email: EMAIL, password: PASSWORD, email_confirm: true });
if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
if (inErr) throw new Error(`signIn: ${inErr.message}`);
const { data: proj } = await api.from("projects").select("id").single();
if (!proj?.id) throw new Error("注册没有开出一个 project");
const pid = proj.id;
await must("identity", api.rpc("update_business_identity", { new_business_name: "Wei Hair Studio", new_owner_name: "Wei Lin" }));
for (const k of ["customers", "staff", "bookings", "payments", "inventory", "expenses"]) {
  await api.rpc("add_project_page", { requested_key: k, new_title: "" });
}
console.log(`   project ${pid}`);

// ═══ 3. 师傅 ═══════════════════════════════════════════════════════════════
step("3", "师傅（3 位，各有抽成）");
const mkStaff = async (name, status, tiers) => {
  const row = await must(name, api.rpc("add_directory_entry", { in_project_id: pid, in_module_key: "staff", in_name: name, in_status: status }));
  await must(`tiers ${name}`, api.rpc("set_commission_tiers", { in_party_id: row.id, in_tiers: tiers }));
  return row;
};
const jasmine = await mkStaff("Jasmine Chen", "Senior Stylist", [{ from_cents: 0, percent: 15 }, { from_cents: 600000, percent: 22 }]);
const amy = await mkStaff("Amy Lee", "Precision Lead", [{ from_cents: 0, percent: 12 }, { from_cents: 500000, percent: 18 }]);
const fara = await mkStaff("Fara Yusof", "Colour Specialist", [{ from_cents: 0, percent: 15 }]);
const STAFF = [jasmine, amy, fara];
for (const [s, day, from, to] of [[jasmine, 1, "01:00", "09:00"], [amy, 1, "01:00", "10:00"], [fara, 2, "02:00", "10:00"], [jasmine, 2, "01:00", "09:30"]]) {
  await admin.from("staff_shifts").insert({
    project_id: pid, staff_id: s.id,
    clock_in_at: `${daysAgo(day)}T${from}:00Z`, clock_out_at: `${daysAgo(day)}T${to}:00Z`,
  });
}

// ═══ 4. 客人 ═══════════════════════════════════════════════════════════════
step("4", "客人（14 位）");
const CLIENT_DEFS = [
  ["Datin Sarah Lim", "Colour: 6.3 + 20 vol, 35 min. Sensitive scalp, no bleach near the crown.", "VIP"],
  ["Michelle Ong", "Balayage every 10 weeks. Likes a cool ash finish.", "VIP"],
  ["Mei Ling Tan", "Keratin smoothing twice a year.", "VIP"],
  ["Priya Nair", "Prefers Amy. Books Saturdays.", "Regular"],
  ["Farah Hassan", "Blowout before events.", "Regular"],
  ["Amanda Chua", "Root touch-up every 6 weeks: 5.0 + 6.0 (1:1).", "Regular"],
  ["Nurul Aisyah", "Short precision cut, every 5 weeks.", "Regular"],
  ["Grace Tan", "", "Regular"],
  ["Sofia Ibrahim", "Toner only, avoid ammonia.", "Regular"],
  ["Joanne Wong", "", "Regular"],
  ["Aida Rahman", "Scalp therapy course.", "Regular"],
  ["Rachel Lee", "", "New"],
  ["Kavitha Menon", "Perm every 4 months.", "Regular"],
  ["Siti Khadijah", "", "New"],
];
const CLIENTS = [];
for (let i = 0; i < CLIENT_DEFS.length; i++) {
  const [name, note, status] = CLIENT_DEFS[i];
  const row = await must(name, api.rpc("add_directory_entry", {
    in_project_id: pid, in_module_key: "customers", in_name: name,
    in_whatsapp: `010-000 00${pad(i + 10)}`, in_note: note, in_status: status,
  }));
  CLIENTS.push(row);
}
const byName = (n) => CLIENTS.find((c) => c.name.startsWith(n));

// ═══ 5. 货的清单（先只是清单，等来访规划完知道每样用掉几件，再建）══════════
step("5", "货 · 服务价目（先定清单）");
// [名字, 单位, 成本, 卖价(可空), 补货线, 最后在架上几件, SKU]
const ITEM_DEFS = [
  ["Majirel 6.1 Tube", "tube", 2800, null, 6, 14, "COL-061"],
  ["Majirel 7.3 Tube", "tube", 2800, null, 6, 4, "COL-073"],
  ["Toner Ash 9.1", "tube", 2600, null, 4, 8, "TON-091"],
  ["Bleach Powder", "tub", 14200, null, 3, 2, "BLC-001"],
  ["20 Vol Developer", "bottle", 1800, null, 4, 9, "DEV-020"],
  ["Keratin Smoothing Kit", "kit", 18000, null, 2, 3, "KER-001"],
  ["Foils 100pc", "pack", 900, null, 5, 20, "FOL-100"],
  ["Salon Towels", "pc", 850, null, 20, 45, "TWL-001"],
  ["Olaplex No.3", "bottle", 9500, 16800, 4, 2, "RET-OLA"],
  ["Elixir Hair Oil 100ml", "bottle", 6800, 12800, 3, 5, "RET-ELX"],
  ["Sulfate-free Shampoo 500ml", "bottle", 2200, 5800, 5, 12, "RET-SHP"],
  ["Scalp Serum 50ml", "bottle", 3500, 8800, 4, 2, "RET-SCP"],
];
const ITEMS = {};

// ═══ 6. 过去十周的来访 ═════════════════════════════════════════════════════
step("6", "过去十周的来访（每一笔：预约 · 做了什么 · 收款）");
const METHODS = ["DuitNow QR", "Terminal EDC", "Cash Drawer"];
const SERVICES = [
  // 名字, 价钱, 分钟, 谁做(下标), 用什么, SKU
  ["Precision Cut", 14000, 60, 1, null, "SVC-CUT"],
  ["Blow Dry", 6000, 45, 1, null, "SVC-BLW"],
  ["Toner & Gloss", 12000, 45, 2, "Toner Ash 9.1", "SVC-TON"],
  ["Colour Touch-up", 22000, 120, 2, "Majirel 6.1 Tube", "SVC-CTU"],
  ["Full Balayage", 80000, 180, 0, "Majirel 7.3 Tube", "SVC-BAL"],
  ["Keratin Smoothing", 65000, 150, 2, "Keratin Smoothing Kit", "SVC-KER"],
  ["Scalp Therapy", 18000, 60, 0, "Scalp Serum 50ml", "SVC-SCP"],
  ["Soft Wave Perm", 45000, 150, 2, null, "SVC-PRM"],
];
const svc = (n) => SERVICES.find((x) => x[0] === n);
const VISITS_PER_CLIENT = [8, 7, 6, 5, 5, 4, 4, 3, 3, 3, 2, 2, 1, 1];
const busy = new Map(); // "staffId|date" -> [[startMin, endMin], ...]
const free = (staffId, date, startMin, endMin) =>
  !(busy.get(`${staffId}|${date}`) ?? []).some(([a, b]) => startMin < b && endMin > a);
const take = (staffId, date, startMin, endMin) => {
  const k = `${staffId}|${date}`;
  busy.set(k, [...(busy.get(k) ?? []), [startMin, endMin]]);
};

// ── 规划（不写库）：每位客人的来访均匀铺在过去十周，同一位师傅不撞时间 ──
const plan = [];
const usage = {};
for (let ci = 0; ci < CLIENTS.length; ci++) {
  const vip = ci < 3;
  const n = VISITS_PER_CLIENT[ci];
  for (let v = 0; v < n; v++) {
    const off = 1 + (ci % 5) + Math.round((v * (70 - (ci % 5))) / n) + Math.floor(rand() * 3);
    const date = daysAgo(off);
    const s = pick(vip ? SERVICES.slice(2) : SERVICES);
    const [name, price, mins, staffIdx, uses] = s;
    const staff = STAFF[staffIdx];
    let h = 10 + Math.floor(rand() * 6);
    let tries = 0;
    while (!free(staff.id, date, h * 60, h * 60 + mins) && tries++ < 9) h = 10 + ((h - 9) % 7);
    if (!free(staff.id, date, h * 60, h * 60 + mins)) continue;
    take(staff.id, date, h * 60, h * 60 + mins);
    if (uses) usage[uses] = (usage[uses] ?? 0) + 1;
    plan.push({
      client: CLIENTS[ci], staff, date, h, mins, name, price, uses,
      method: pick(METHODS), retail: rand() < 0.28 ? pick([5800, 12800, 16800]) : 0, retailMethod: pick(METHODS),
    });
  }
}
console.log(`   规划了 ${plan.length} 次来访`);

// ── 货：期初 = 最后想留的数 + 这十周用掉的数，所以「30 天出货」是真的用量 ──
for (const [name, unit, cost, price, reorder, onHand, sku] of ITEM_DEFS) {
  const row = await must(name, api.rpc("add_catalog_item", { in_project_id: pid, in_module_key: "inventory", in_name: name, in_unit: unit, in_sku: sku }));
  await admin.from("catalog_items").update({ cost_cents: cost, price_cents: price, reorder_at: reorder }).eq("id", row.id);
  await must(`stock ${name}`, api.rpc("count_stock", { in_item_id: row.id, in_counted: onHand + (usage[name] ?? 0), in_reason: "opening stock" }));
  ITEMS[name] = row;
}
// 服务价目：收银台要点得出「剪发」（这个产品的服务价目就放在货架那张清单里，没有库存数）
for (const [name, price, , , , sku] of SERVICES) {
  const row = await must(name, api.rpc("add_catalog_item", { in_project_id: pid, in_module_key: "inventory", in_name: name, in_unit: "service", in_sku: sku }));
  await admin.from("catalog_items").update({ price_cents: price }).eq("id", row.id);
}

// ── 执行 ──
const PAST_DONE = []; // 留给评价用
for (const t of plan) {
  const end = t.h * 60 + t.mins;
  const id = await must("appt", api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: at(t.date, t.h, 0), in_ends_at: at(t.date, Math.floor(end / 60), end % 60),
    in_party: t.client.name, in_party_id: t.client.id, in_staff_id: t.staff.id, in_service: t.name,
  }));
  await must("done", api.rpc("set_appointment_status", { in_id: id, in_status: "done" }));
  const line = await must("line", api.rpc("add_visit_line", { in_appointment_id: id, in_service: t.name, in_staff_id: t.staff.id, in_price_cents: t.price }));
  if (t.uses) await must(`use ${t.uses}`, api.rpc("add_visit_product", { in_line_id: line.id, in_item_id: ITEMS[t.uses].id, in_qty: 1 }));
  await must("pay", api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in", in_amount_cents: t.price,
    in_party: t.client.name, in_party_id: t.client.id, in_entry_on: t.date, in_method: t.method,
    in_category: "service", in_done_by: t.staff.id,
  }));
  if (t.retail) {
    await must("retail", api.rpc("add_ledger_entry", {
      in_project_id: pid, in_module_key: "payments", in_direction: "in", in_amount_cents: t.retail,
      in_party: t.client.name, in_party_id: t.client.id, in_entry_on: t.date, in_method: t.retailMethod, in_category: "product",
    }));
  }
  PAST_DONE.push({ id, client: t.client });
}
const visitCount = plan.length;
console.log(`   ${visitCount} 次来访`);

// 放飞机：Priya 两次没来
for (const off of [26, 41]) {
  const date = daysAgo(off);
  const id = await must("noshow", api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: at(date, 17, 0), in_ends_at: at(date, 18, 0),
    in_party: byName("Priya").name, in_party_id: byName("Priya").id, in_staff_id: amy.id, in_service: "Precision Cut",
  }));
  await must("noshow status", api.rpc("set_appointment_status", { in_id: id, in_status: "no_show" }));
}

// ═══ 7. 今天、明天、这个星期 ═══════════════════════════════════════════════
step("7", "今天 9 笔 · 明后天几笔");
const TODAY = [
  // 谁, 客人, 服务, 开始, 时长分钟, 状态
  [amy, "Nurul", "Precision Cut", 10, 0, 60, "done"],
  [amy, "Grace", "Blow Dry", 11, 30, 45, "arrived"],
  [amy, "Sofia", "Toner & Gloss", 14, 0, 45, "booked"],
  [jasmine, "Michelle", "Full Balayage", 10, 0, 180, "arrived"],
  [jasmine, "Datin", "Colour Touch-up", 14, 0, 120, "booked"],
  [fara, "Mei Ling", "Keratin Smoothing", 10, 30, 150, "done"],
  [fara, "Aida", "Scalp Therapy", 13, 30, 60, "booked"],
  [fara, "Kavitha", "Soft Wave Perm", 16, 0, 150, "booked"],
  [null, "Rachel", "Blow Dry", 15, 0, 45, "booked"],
];
const todayDone = [];
for (const [staff, who, service, h, m, mins, status] of TODAY) {
  const client = byName(who);
  const end = h * 60 + m + mins;
  const id = await must("today", api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: at(today, h, m), in_ends_at: at(today, Math.floor(end / 60), end % 60),
    in_party: client.name, in_party_id: client.id, ...(staff ? { in_staff_id: staff.id } : {}), in_service: service,
  }));
  if (status === "done") {
    await soft(`done ${client.name}`, api.rpc("set_appointment_status", { in_id: id, in_status: "done" }));
    const [, price] = svc(service);
    await soft("line", api.rpc("add_visit_line", { in_appointment_id: id, in_service: service, in_staff_id: staff.id, in_price_cents: price }));
    todayDone.push({ client, price, staff });
  } else if (status === "arrived") {
    await soft(`arrived ${client.name}`, api.rpc("mark_appointment_arrived", { in_id: id }));
  }
}
const FUTURE = [
  [1, amy, "Priya", "Precision Cut", 11, 0, 60], [1, jasmine, "Amanda", "Colour Touch-up", 10, 0, 120],
  [1, fara, "Farah", "Blow Dry", 14, 0, 45], [1, amy, "Joanne", "Precision Cut", 15, 30, 60],
  [2, jasmine, "Datin", "Scalp Therapy", 11, 0, 60], [2, fara, "Siti", "Toner & Gloss", 13, 0, 45], [2, amy, "Michelle", "Blow Dry", 16, 0, 45],
  [6, jasmine, "Mei Ling", "Full Balayage", 10, 0, 180], [6, amy, "Grace", "Precision Cut", 12, 0, 60],
];
for (const [ahead, staff, who, service, h, m, mins] of FUTURE) {
  const client = byName(who);
  const end = h * 60 + m + mins;
  await must("future", api.rpc("add_appointment", {
    in_project_id: pid, in_module_key: "bookings",
    in_starts_at: at(daysAhead(ahead), h, m), in_ends_at: at(daysAhead(ahead), Math.floor(end / 60), end % 60),
    in_party: client.name, in_party_id: client.id, in_staff_id: staff.id, in_service: service,
  }));
}

// ═══ 8. 今天的钱 ═══════════════════════════════════════════════════════════
step("8", "今天的收款 · 两笔开销");
const todayPays = [
  ...todayDone.map((d) => [d.client, d.price, d.staff]),
  [byName("Farah"), 6000, amy],
  [byName("Joanne"), 14000, amy],
  [byName("Amanda"), 22000, fara],
  [byName("Siti"), 5800, null],
];
let mi = 0;
for (const [client, cents, staff] of todayPays) {
  await must("today pay", api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in", in_amount_cents: cents,
    in_party: client.name, in_party_id: client.id, in_entry_on: today,
    in_method: METHODS[mi++ % METHODS.length], in_category: cents === 5800 ? "product" : "service",
    ...(staff ? { in_done_by: staff.id } : {}),
  }));
}
for (const [cents, note, party] of [[2500, "Cleaning supplies", "Kedai Runcit Sri Bangsar"], [800, "Parking for supplier drop-off", "Parking"]]) {
  await must("expense", api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "expenses", in_amount_cents: cents, in_party: party, in_entry_on: today,
    in_method: "Cash Drawer", in_note: note, in_category: "supplies",
  }));
}

// ═══ 9. 套票 ═══════════════════════════════════════════════════════════════
step("9", "套票（4 张）");
const PACKS = [
  ["Michelle", "Scalp Therapy x10", 10, 120000, 4, null],
  ["Datin", "Keratin Course x6", 6, 300000, 2, daysAhead(20)],
  ["Nurul", "Blow Dry x5", 5, 25000, 5, null],
  ["Grace", "Colour Care x8", 8, 160000, 1, null],
];
for (const [who, name, total, cents, used, expires] of PACKS) {
  const client = byName(who);
  const pay = await must("pack pay", api.rpc("add_ledger_entry", {
    in_project_id: pid, in_module_key: "payments", in_direction: "in", in_amount_cents: cents,
    in_party: client.name, in_party_id: client.id, in_entry_on: daysAgo(20), in_method: "Terminal EDC", in_category: "package",
  }));
  const pkg = await must("pack", api.rpc("add_service_package", {
    in_party_id: client.id, in_name: name, in_sessions_total: total, in_sold_on: daysAgo(20),
    ...(expires ? { in_expires_on: expires } : {}), in_entry_id: pay.id,
  }));
  for (let u = 0; u < used; u++) {
    await must("use", api.rpc("use_package_session", { in_package_id: typeof pkg === "object" ? pkg.id : pkg, in_staff_id: pick(STAFF).id, in_note: "" }));
  }
}

// ═══ 10. 会员 ══════════════════════════════════════════════════════════════
step("10", "会员（5 个，含逾期的、已取消的）");
const MEMB = [
  ["Datin", "VIP Monthly", 15000, 0, "ok"],
  ["Michelle", "VIP Monthly", 15000, 0, "ok"],
  ["Mei Ling", "VIP Monthly", 15000, 12, "overdue"],
  ["Farah", "Blowout Club", 9000, 40, "overdue"],
  ["Joanne", "Blowout Club", 9000, 0, "cancelled"],
];
for (const [who, planName, fee, overdueDays, state] of MEMB) {
  const client = byName(who);
  const m = await must("membership", api.rpc("add_membership", { in_project_id: pid, in_party_id: client.id, in_plan_name: planName, in_monthly_fee_cents: fee }));
  if (state === "ok" || state === "cancelled") await must("fee", api.rpc("collect_membership_fee", { in_membership_id: m.id }));
  if (overdueDays > 0) {
    await admin.from("memberships").update({ started_on: daysAgo(overdueDays + 60), next_due_on: daysAgo(overdueDays) }).eq("id", m.id);
  } else {
    await admin.from("memberships").update({ started_on: daysAgo(75) }).eq("id", m.id);
  }
  if (state === "cancelled") await must("cancel", api.rpc("set_membership_archived", { in_id: m.id, in_archived: true }));
}

// ═══ 11. 供应商 · 进货单 ═══════════════════════════════════════════════════
step("11", "供应商（2 家）· 进货单（2 张在路上）");
const sup1 = await must("sup1", api.rpc("add_directory_entry", { in_project_id: pid, in_module_key: "suppliers", in_name: "Beauty Trade Supplies Sdn Bhd", in_kind: "company", in_whatsapp: "010-000 0101" }));
const sup2 = await must("sup2", api.rpc("add_directory_entry", { in_project_id: pid, in_module_key: "suppliers", in_name: "Salon Pro Distributor", in_kind: "company", in_whatsapp: "010-000 0102" }));
async function po(supplier, lines) {
  const rec = await must("po", api.rpc("add_pipeline_record", { in_project_id: pid, in_module_key: "purchases", in_party: supplier.name, in_party_id: supplier.id }));
  await must("po lines", api.rpc("set_record_lines", {
    in_record_id: rec.id,
    in_lines: lines.map(([item, qty, unitCents]) => ({ description: item, qty, unit: ITEMS[item].unit ?? "", unit_price_cents: unitCents, item_id: ITEMS[item].id })),
  }));
}
await po(sup1, [["Bleach Powder", 4, 14200], ["Scalp Serum 50ml", 6, 3500]]);
await po(sup2, [["Majirel 7.3 Tube", 12, 2800]]);

// ═══ 12. 昨天收工 ══════════════════════════════════════════════════════════
step("12", "昨天已经收工（今天还没收）");
await soft("lock yesterday", api.rpc("lock_day_closing", {
  in_project_id: pid, in_closing_date: daysAgo(1),
  in_counts: { "100": 3, "50": 2, "20": 1, "10": 1, "5": 1 },
  in_float_cents: 5000, in_expected_cash_cents: 43500, in_gross_cents: 128000, in_outflows_cents: 3500,
  in_settlements: [
    { method: "Cash Drawer", count: 5, totalCents: 42000, isCash: true },
    { method: "DuitNow QR", count: 6, totalCents: 61000, isCash: false },
    { method: "Terminal EDC", count: 2, totalCents: 25000, isCash: false },
  ],
  in_checklist: [{ label: "Cash drawer physically verified", done: true }, { label: "Equipment powered off", done: true }],
  in_note: "Colour bar tap is dripping - plumber coming Monday",
}));

// ═══ 13. 评价 ══════════════════════════════════════════════════════════════
step("13", "评价（5 句）");
const REVIEWS = [
  [5, "Jasmine understood exactly the shade I wanted. My balayage has never looked this natural."],
  [5, "Quick, clean and Amy remembered my last cut without me saying anything."],
  [4, "Great result. Only wish the wait had been a bit shorter on Saturday."],
  [5, ""],
  [3, "Colour is nice but it took longer than quoted."],
];
const reviewable = PAST_DONE.filter((_, i) => i % 5 === 0).slice(0, REVIEWS.length);
for (let i = 0; i < reviewable.length; i++) {
  const { data: row } = await admin.from("appointments").select("public_ref").eq("id", reviewable[i].id).single();
  const [rating, text] = REVIEWS[i];
  await soft("review", anon.rpc("submit_appointment_review", { in_ref: row.public_ref, in_rating: rating, in_text: text }));
}

// ═══ 14. 作品集 ════════════════════════════════════════════════════════════
step("14", "作品集（6 份，带照片）");
const LOOKS = [
  ["Smoky Mocha Melt", "Balayage", "6.1", "Majirel 6.1 (35g) + 20 vol, melt to 8.1 at the ends", "Cool ash finish, soft root shadow", ["Cool", "Balayage", "Low maintenance"], jasmine, ["#3b2a22", "#a08872"]],
  ["Honey Lowlight Bronde", "Balayage", "8", "Majirel 8.3 + 7.3 (1:1), gloss with 9.3", "Warm dimension for a fair skin tone", ["Warm", "Bronde"], jasmine, ["#5a3d24", "#d8b070"]],
  ["Copper Gloss", "Colour", "7", "Majirel 7.4 + 7.43 (2:1) + 10 vol", "Rich copper that fades gracefully", ["Warm", "Copper"], fara, ["#7a3a1c", "#d9843c"]],
  ["Ash Blonde Reset", "Blonde", "9", "Bleach to level 9, tone 9.1 + 9.2, 20 min", "Toner refresh every 6 weeks", ["Cool", "Blonde"], fara, ["#8e8a80", "#efe6d2"]],
  ["Glass Bob", "Cut", "", "", "One-length bob, blunt edge, high-shine blow dry", ["Cut", "Short"], amy, ["#1f1a1a", "#6b5a55"]],
  ["Soft Wave Perm", "Perm", "", "Acid perm, medium rods, 25 min", "Loose S-waves, wash-and-go", ["Perm", "Texture"], fara, ["#402a26", "#b39480"]],
];
for (const [title, category, level, formula, note, tags, stylist, [c1, c2]] of LOOKS) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="900" height="1100"><defs><linearGradient id="g" x1="0" y1="0" x2="0.6" y2="1"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient><radialGradient id="r" cx="0.35" cy="0.3" r="0.6"><stop offset="0" stop-color="#ffffff" stop-opacity="0.28"/><stop offset="1" stop-color="#ffffff" stop-opacity="0"/></radialGradient></defs><rect width="900" height="1100" fill="url(#g)"/><rect width="900" height="1100" fill="url(#r)"/></svg>`;
  const jpg = await sharp(Buffer.from(svg)).jpeg({ quality: 82 }).toBuffer();
  const path = `${pid}/lookbook/${crypto.randomUUID()}.jpg`;
  const up = await api.storage.from("job-photos").upload(path, jpg, { contentType: "image/jpeg", upsert: false });
  if (up.error) throw new Error(`upload ${title}: ${up.error.message}`);
  await must(`look ${title}`, api.rpc("add_lookbook_work", {
    in_project_id: pid, in_title: title, in_category: category, in_level: level, in_formula: formula,
    in_note: note, in_tags: tags, in_stylist_id: stylist.id, in_photo_path: path,
  }));
}

// ═══ 15. 规矩 · 分店 ═══════════════════════════════════════════════════════
step("15", "放飞机订金 · 集点卡 · 分店");
await must("booking rules", api.rpc("set_booking_rules", { in_project_id: pid, in_no_show_deposit_after: 2, in_default_deposit_cents: 5000 }));
await must("loyalty", api.rpc("set_loyalty_rule", { in_project_id: pid, in_stamps_needed: 10 }));
await must("branch", api.rpc("add_branch", { in_project_id: pid, in_name: "Bangsar" }));

// ═══ 量一遍 ════════════════════════════════════════════════════════════════
step("16", "量一遍");
const count = async (table) => (await admin.from(table).select("*", { count: "exact", head: true }).eq("project_id", pid)).count;
const tallies = {
  clients: (await admin.from("directory_entries").select("*", { count: "exact", head: true }).eq("project_id", pid).eq("module_key", "customers")).count,
  staff: (await admin.from("directory_entries").select("*", { count: "exact", head: true }).eq("project_id", pid).eq("module_key", "staff")).count,
  appointments: await count("appointments"),
  ledger: await count("ledger_entries"),
  items: await count("catalog_items"),
  packages: (await admin.from("service_packages").select("*", { count: "exact", head: true }).in("party_id", CLIENTS.map((c) => c.id))).count,
  memberships: await count("memberships"),
  lookbook: await count("lookbook_works"),
  closings: await count("day_closings"),
};
console.log("  ", JSON.stringify(tallies));

console.log(`
============================================================
  示范沙龙已经种好
  登入： https://wei2chee.vercel.app/en/login
  帐号： ${EMAIL}
  密码： ${PASSWORD}
  登入后打开： https://wei2chee.vercel.app/en/salon-preview/overview
  （再跑一次 --write 会把它重建回这个样子；密码请用 DEMO_SALON_PASSWORD 指定，
   不指定就会换一个新的）
============================================================
`);
