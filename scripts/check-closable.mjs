/**
 * 一个员工离职，帐号删得掉；一家公司关得掉。
 *
 * 🔴 这一支是 2026-09-06 一个真的删不掉的帐号逼出来的:
 * 做「下一步自己长出来」的时候，尺子跑完删不掉自己的测试帐号 ——
 * `Database error deleting user`。那句话是 API 包过的，问不出是哪一条，
 * 所以推了一支临时探针去问资料库原话: `P0001 | that project is not yours`。
 *
 * 怎么发生的:
 *   删一个使用者 → `references auth.users(id) on delete set null` 那几栏
 *   （created_by · recorded_by · taken_by · by_who）要被设成 null
 *   → 那是一次 **update** → 守卫开火 → **整句删除被挡下来**。
 *
 * [任务 129] 一模一样炸过一次，而那一次的代价是**示范帐号被我炸掉**。
 * 所以这一支不是一个功能的尺，是那一件事的常驻守卫:
 * **每一张会记「谁做的」的表，都要能被一句删除穿过去。**
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
  const email = `cl-${tag}-${stamp}@formae.test`;
  const password = `Cl-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn(${tag}): ${e2.message}`);
  people.push({ id: data.user.id, email });
  return { id: data.user.id, email, client };
}

/** 那十张表里，这个使用者留下了几行「谁做的」。 */
const TRACKED = [
  ["deliveries", "created_by"],
  ["follow_ups", "created_by"],
  ["nudge_snoozes", "by_who"],
  ["package_uses", "recorded_by"],
  ["record_photos", "taken_by"],
  ["rentals", "created_by"],
  ["service_contracts", "created_by"],
  ["service_packages", "created_by"],
  ["service_visits", "recorded_by"],
  ["stock_batches", "created_by"],
  ["vehicles", "created_by"],
];

/* 关公司那一段要数到的表 —— 比上面多一张：
   `appointments` 没有「谁做的」那种栏（[任务 213] 拿掉了），
   而它正好是那一轮把帐号锁住的那张。 */
const CLEARED = [...TRACKED.map(([t]) => t), "appointments", "messages", "message_settings"];

try {
  /* ── ⓪ 🔴 每一栏「谁做的」都要放得开那个人 ─────────────────────────
     这一条才是这一支真正的守卫 —— 上面那两段量的是**今天这十一张表**，
     这一段量的是**以后新加的每一张**。

     它逐栏去问资料库（不是读 migration 的字）：一栏叫 created_by /
     recorded_by / taken_by / done_by / by_who / verified_by 的 uuid，
     有没有真的挂着一个外键，而且删的时候是 `set null`。

     🔴 而它第一次跑就抓到两栏，其中一栏是**档案里写着、资料库里没有**的
     （`follow_ups.created_by`）—— [重点 26]：`db push` 成功证明不了任何事。 */
  console.log("\n⓪ 🔴 每一栏「谁做的」");
  const { data: cols, error: colErr } = await admin.rpc("who_did_it_columns");
  if (colErr) throw new Error(`who_did_it_columns: ${colErr.message}`);
  const loose = (cols ?? []).filter((c) => !c.points_at || c.on_delete !== "set null");
  check(`🔴 ${cols?.length} 栏，一栏都不是光秃秃的 uuid`,
    loose.length === 0,
    loose.map((c) => `${c.tbl}.${c.col}(${c.points_at ?? "没有外键"} ${c.on_delete ?? ""})`)
      .join(" · "));
  /* 控制组 —— 没有这一条，上面那一条在函式坏掉的时候也会绿。 */
  check("控制组：真的量到东西了（不是空的）", (cols ?? []).length >= 15,
    `${cols?.length} 栏`);

  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  for (const k of ["quotations", "orders", "customers", "inventory",
                   "bookings", "contracts", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  /* 🔴 一个员工 —— 而且他要**真的做过事**，不然这一支量的是空气
     （[任务 125] 的教训）。 */
  const crew = await person("crew");
  await C.rpc("add_project_member", { in_email: crew.email });
  const W = crew.client;

  console.log("\n① 让那个员工在每一张表上都留下痕迹");
  const { data: cust } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Lim",
  });

  /* 货 · 批 —— stock_batches.created_by */
  const { data: item } = await C.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Cement 50kg",
    in_unit: "bags", in_reorder_at: 20,
  });
  await W.rpc("add_stock_batch", { in_item_id: item.id, in_code: "L-01" });
  await W.rpc("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 100, in_reason: "进货",
  });

  /* 一张单 · 送货 —— deliveries.created_by */
  const { data: order } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "Ten bags",
    in_party: "Mrs Lim", in_party_id: cust.id, in_amount_cents: 25_000,
  });
  const { data: lines } = await C.rpc("set_record_lines", {
    in_record_id: order.id,
    in_lines: [{ description: "Cement 50kg", qty: "10", unit: "bags",
      item_id: item.id, amount_cents: "25000" }],
  });
  await W.rpc("deliver_record", {
    in_record_id: order.id, in_lines: [{ line_id: lines[0].id, qty: "10" }],
  });

  /* 下一步 —— follow_ups.created_by */
  await W.rpc("set_follow_up", {
    in_record_id: order.id, in_what: "打电话问收到没有",
  });

  /* 工地照 —— record_photos.taken_by
     ⚠️ 这几支原本挂着 `.catch(() => {})`，而 supabase-js 的那个 builder
     **不是完整的 Promise，没有 `.catch`** —— 整支尺当场炸掉，
     而它照样印「全部过」。参数名也是猜的，现在照原文改对了。 */
  const said = async (fn, args) => {
    const { error } = await W.rpc(fn, args);
    if (error) console.log(`   ⚠️ ${fn}：${error.message}`);
  };
  await said("add_record_photo", {
    in_record_id: order.id, in_path: `jobs/${P}/probe.jpg`,
  });

  /* 车 —— vehicles.created_by */
  await said("add_vehicle", {
    in_project_id: P, in_plate: "WA 1234 A", in_descr: "Perodua Myvi",
  });

  /* 套票 · 用一次 —— service_packages.created_by · package_uses.recorded_by */
  const { data: pk } = await C.rpc("add_service_package", {
    in_party_id: cust.id, in_name: "10 次洗剪吹", in_sessions_total: 5,
  });
  await W.rpc("use_package_session", { in_package_id: pk.id });

  /* 保养合约 · 去了一次 —— service_contracts.created_by · service_visits.recorded_by */
  const { data: ct } = await C.rpc("add_service_contract", {
    in_project_id: P, in_party_id: cust.id, in_title: "Aircon service",
    in_every_months: 6,
  });
  const { data: visits } = await C.rpc("due_visits", { in_project_id: P });
  if ((visits ?? []).length) {
    await said("log_service_visit", {
      in_contract_id: ct.id, in_due_on: visits[0].due_on,
    });
  }

  /* 租借 —— rentals.created_by */
  await said("lend_item", {
    in_record_id: order.id, in_descr: "折叠桌 ×10", in_qty: 10,
  });

  /* 🔴 官网来的预约 —— `appointments`。
     这一行是 2026-09-06 补的，而它的理由值得写下来：
     那一天我给 `appointments` 加了一栏 `seen_by`，
     而它把一个帐号锁住了 —— **因为这一支从来没有种过那张表**，
     所以那个洞在它眼皮底下过了一整轮。
     一张没有被种过的表，跟一张没有问题的表，在报告里一模一样。 */
  await said("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() + 36e5 * 26).toISOString(),
    in_ends_at: new Date(Date.now() + 36e5 * 27).toISOString(),
    in_party: "Mr Ong", in_service: "Colour and cut", in_source: "website",
  });
  await C.rpc("mark_bookings_seen", { in_project_id: P });

  /* 🔴 他自己按 WhatsApp 发出去的那一句 —— messages.sent_by。
     这一行是 2026-09-06 补的，而它的理由跟 `appointments.seen_by`
     那一行一模一样：那张新表第一次跑就把一个帐号锁住了，
     **而这一支当时没有种过那张表** ——
     一张没有被种过的表，跟一张没有问题的表，在报告里一模一样。 */
  const bossSaid = async (fn, args) => {
    const { error } = await C.rpc(fn, args);
    if (error) console.log(`   ⚠️ ${fn}：${error.message}`);
  };
  await bossSaid("record_message_sent", {
    in_project_id: P, in_audience: "customer", in_kind: "quote_sent",
    in_body: "陈太太，这是你那张报价。",
    in_subject_id: order.id, in_party_id: cust.id,
  });
  await bossSaid("set_message_settings", { in_project_id: P, in_to_customer: true });

  /* 先别提 —— nudge_snoozes.by_who */
  await W.rpc("snooze_nudge", {
    in_project_id: P, in_kind: "below_reorder", in_subject_id: item.id, in_days: 7,
  });

  /* 数一次：他到底在几张表上留下了痕迹。 */
  const touched = [];
  for (const [t, col] of TRACKED) {
    const { data } = await admin.from(t).select("id").eq(col, crew.id).limit(1);
    if ((data ?? []).length) touched.push(t);
  }
  console.log(`   他在这几张表上留下了痕迹：${touched.join(" · ")}`);
  check("🔴 道具：至少踩到五张表（少於五张，下面那一条量的是空气）",
    touched.length >= 5, `${touched.length} 张`);

  /* ── ② 🔴 员工离职 ───────────────────────────────────────────────── */
  console.log("\n② 🔴 员工离职，帐号删得掉");
  const { error: delCrew } = await admin.auth.admin.deleteUser(crew.id);
  check("🔴 删得掉", !delCrew, delCrew?.message);
  if (!delCrew) people.splice(people.findIndex((p) => p.id === crew.id), 1);

  /* 而他做过的事**一件都不该消失** —— 那是这门生意的历史。 */
  const { data: stillThere } = await admin
    .from("follow_ups").select("id, created_by").eq("project_id", P);
  check("🔴 他写下的那一条还在（只是不知道是谁写的了）",
    (stillThere ?? []).length === 1 && stillThere[0].created_by === null,
    `那一栏是 ${stillThere?.[0]?.created_by} · 师傅是 ${crew.id} · 老板是 ${boss.id}`);
  const { data: batch } = await admin
    .from("stock_batches").select("id").eq("project_id", P);
  check("他建的那一批货还在", (batch ?? []).length === 1, `${batch?.length}`);

  /* ── ③ 🔴 整家公司关得掉 ─────────────────────────────────────────── */
  console.log("\n③ 🔴 整家公司关得掉");
  const { error: delBoss } = await admin.auth.admin.deleteUser(boss.id);
  check("🔴 关得掉", !delBoss, delBoss?.message);
  if (!delBoss) people.splice(people.findIndex((p) => p.id === boss.id), 1);

  const { data: gone } = await admin.from("projects").select("id").eq("id", P);
  check("那家公司真的不在了", (gone ?? []).length === 0, `${gone?.length}`);
  for (const t of CLEARED) {
    const { data: left } = await admin.from(t).select("id").eq("project_id", P).limit(1);
    if ((left ?? []).length) bad.push(`${t} 还留着行`);
  }
  check(`🔴 那 ${CLEARED.length} 张表一行都没有留下`, !bad.some((b) => b.includes("还留着行")),
    bad.filter((b) => b.includes("还留着行")).join(" · "));
} catch (e) {
  /* 🔴 抛了例外要算没过。第一版没有这一段，於是它中途炸掉、
     `finally` 照样印「全部过」—— 一把说谎的尺，跟一把跑完的尺
     在报告里长得一模一样。这个仓库被这个形状骗过四次。 */
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  for (const p of people) {
    const { error } = await admin.auth.admin.deleteUser(p.id);
    if (error) console.log(`  ⚠️ 删不掉 ${p.email}：${error.message}`);
  }
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
