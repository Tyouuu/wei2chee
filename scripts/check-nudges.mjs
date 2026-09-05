/**
 * 下一步自己长出来 —— 拿真的登入身分打一次每一支。
 *
 * 交接那一份（任务 204 / 206）数过：六条链断掉 21 节，
 * **18 节落在通知 · 触发 · 收钱三样上**，而触发是唯一一个不等公司的。
 *
 * 🔴 这一支最要紧的三条：
 *   · 每一个信号**事实一变就自己消失**（收了订金 · 补了货）——
 *     因为它是算出来的，不是存起来的
 *   · 「先别提」七天之后自己回来
 *   · 师傅看得到他要做的三种，看不到老板的钱那两种
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
const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
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
  const email = `nd-${tag}-${stamp}@formae.test`;
  const password = `Nd-${stamp}-x!`;
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

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  for (const k of ["quotations", "orders", "payments", "customers",
                   "inventory", "bookings", "contracts"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  /* 🔴 日子一律从**资料库自己的今天**往回／往前数，不是从这台机的 UTC。
     产品用马来西亚时间，两边差八个钟头 —— 凌晨到早上八点之间跑，
     每一个天数都差一天，而那条红看起来完全像产品坏了。 */
  const { data: today } = await admin.rpc("today_myt");
  const day = (n) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };

  const nudges = async (client = C, until = null) => {
    const { data, error } = await client.rpc("nudges_due", {
      in_project_id: P, in_until: until,
    });
    if (error) throw new Error(`nudges_due: ${error.message}`);
    return data ?? [];
  };
  const has = (rows, kind, id) =>
    rows.some((r) => r.kind === kind && (!id || r.subject_id === id));

  const { data: cust } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Lim",
  });

  console.log("\n① 一开始什么都不该讲");
  check("干净的帐号，一条都没有", (await nudges()).length === 0,
    JSON.stringify((await nudges()).map((r) => r.kind)));

  /* ── ② 报价快到期 ─────────────────────────────────────────────────── */
  console.log("\n② 报价快到期");
  const { data: quote } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "Kitchen top",
    in_party: "Mrs Lim", in_party_id: cust.id, in_amount_cents: 480_000,
    in_due_on: day(2),
  });
  check("两天后到期 → 讲", has(await nudges(), "quote_expiring", quote.id),
    JSON.stringify((await nudges()).map((r) => r.kind)));
  check("而且带着金额", Number((await nudges()).find((r) => r.kind === "quote_expiring")
    ?.amount_cents) === 480_000, "金额不见了");

  /* 🔴 收了订金，事实变了 —— 那一条要**自己消失**，不用有人去关掉它。 */
  const { data: dep } = await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 100_000, in_party: "Mrs Lim", in_party_id: cust.id,
    in_against_id: quote.id,
  });
  check("🔴 收了订金就自己不讲了（算出来的，不是存起来的）",
    !has(await nudges(), "quote_expiring", quote.id),
    JSON.stringify((await nudges()).map((r) => r.kind)));

  /* 冲正回去 —— 事实又变回来，那一条也要回来。 */
  await C.rpc("reverse_ledger_entry", { in_entry_id: dep.id });
  check("🔴 冲正之后又讲了", has(await nudges(), "quote_expiring", quote.id),
    JSON.stringify((await nudges()).map((r) => r.kind)));

  /* ── ③ 🔴 客人按了同意，一分订金都还没进来 ────────────────────────── */
  console.log("\n③ 🔴 同意了没付订金");
  const { data: shared } = await C.rpc("share_record", { in_record_id: quote.id });
  const { error: aErr } = await anon.rpc("answer_shared_record", {
    in_ref: shared.share_ref, in_answer: "accepted", in_name: "Mrs Lim",
  });
  check("客人按得下去（陌生人那把钥匙）", !aErr, aErr?.message);
  check("🔴 而老板这边当天就讲得出来",
    has(await nudges(), "agreed_unpaid", quote.id),
    JSON.stringify((await nudges()).map((r) => r.kind)));

  /* ── ④ 保养该去了 ────────────────────────────────────────────────── */
  console.log("\n④ 保养该去了");
  const { data: ct } = await C.rpc("add_service_contract", {
    in_project_id: P, in_party_id: cust.id, in_title: "Aircon service",
    in_every_months: 6, in_starts_on: day(-200),
  });
  check("到期的那一次讲得出来", has(await nudges(), "contract_due", ct.id),
    JSON.stringify((await nudges()).map((r) => [r.kind, r.title])));

  /* ── ⑤ 套票剩最后一次 ────────────────────────────────────────────── */
  console.log("\n⑤ 套票剩一次");
  const { data: pk } = await C.rpc("add_service_package", {
    in_party_id: cust.id, in_name: "10 次洗剪吹", in_sessions_total: 3,
  });
  check("剩三次的时候不讲（那不是快用完）",
    !has(await nudges(), "package_last", pk.id), "太早讲了");
  await C.rpc("use_package_session", { in_package_id: pk.id });
  await C.rpc("use_package_session", { in_package_id: pk.id });
  const last = await nudges();
  check("🔴 剩一次就讲", has(last, "package_last", pk.id),
    JSON.stringify(last.map((r) => [r.kind, r.qty_left])));
  check("而且讲得出还剩几次",
    Number(last.find((r) => r.kind === "package_last")?.qty_left) === 1,
    `${last.find((r) => r.kind === "package_last")?.qty_left}`);
  await C.rpc("use_package_session", { in_package_id: pk.id });
  check("🔴 用完了就不讲了（那不是「快用完」，那是「用完了」）",
    !has(await nudges(), "package_last", pk.id), "用完了还在讲");

  /* ── ⑥ 补货线破了 ────────────────────────────────────────────────── */
  console.log("\n⑥ 补货线破了");
  const { data: item } = await C.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Cement 50kg",
    in_unit: "bags", in_reorder_at: 20,
  });
  await C.rpc("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 8, in_reason: "开帐",
  });
  const low = await nudges();
  check("🔴 架上八包、补货线二十 → 讲", has(low, "below_reorder", item.id),
    JSON.stringify(low.map((r) => [r.kind, r.qty_left, r.qty_floor])));
  check("而且两个数字都讲得出来",
    Number(low.find((r) => r.kind === "below_reorder")?.qty_left) === 8
      && Number(low.find((r) => r.kind === "below_reorder")?.qty_floor) === 20,
    JSON.stringify(low.find((r) => r.kind === "below_reorder")));
  await C.rpc("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 50, in_reason: "进货",
  });
  check("🔴 补了货就自己不讲了", !has(await nudges(), "below_reorder", item.id),
    "补了还在讲");

  /* ── ⑦ 🔴 先别提 ──────────────────────────────────────────────────── */
  console.log("\n⑦ 🔴 先别提");
  const before = (await nudges()).length;
  check("道具：现在有东西可以按掉", before > 0, `${before}`);
  const { error: szErr } = await C.rpc("snooze_nudge", {
    in_project_id: P, in_kind: "quote_expiring", in_subject_id: quote.id, in_days: 7,
  });
  check("按得下去", !szErr, szErr?.message);
  check("🔴 那一条不见了", !has(await nudges(), "quote_expiring", quote.id),
    "按了还在讲");
  check("别的那几条一条都没少", (await nudges()).length === before - 1,
    `${(await nudges()).length} vs ${before - 1}`);

  /* 把那一天推到昨天 —— 时间到了它要自己回来。
     ⚠️ **要看回传的错误。** 第一版没看，而那一句其实被守卫挡下来了
     （那支守卫在问「你是谁」，而管理钥匙没有身分）——
     於是下面两条红看起来完全像产品坏了。
     一句不看错误的写入，跟一句没有写过的写入，在报告里长得一模一样。 */
  const { error: expErr } = await admin.from("nudge_snoozes")
    .update({ until: day(-1) })
    .eq("project_id", P).eq("kind", "quote_expiring");
  check("道具：那一天推得到昨天", !expErr, expErr?.message);
  check("🔴 过了那一天就自己回来了",
    has(await nudges(), "quote_expiring", quote.id), "回不来");

  const { error: tooLong } = await C.rpc("snooze_nudge", {
    in_project_id: P, in_kind: "quote_expiring", in_subject_id: quote.id, in_days: 999,
  });
  check("按太久要挡（一年以上不叫先别提）", !!tooLong, "居然让它过了");

  /* ── ⑧ 🔴 师傅 ───────────────────────────────────────────────────── */
  console.log("\n⑧ 🔴 师傅");
  /* 先把补货线那一条弄回来，师傅那一边才有东西可以看。 */
  await C.rpc("move_stock", {
    in_item_id: item.id, in_direction: "out", in_qty: 55, in_reason: "卖掉",
  });
  const bossSees = await nudges();
  check("控制组：老板五种里看得到钱那两种",
    bossSees.some((r) => r.kind === "quote_expiring")
      && bossSees.some((r) => r.kind === "agreed_unpaid"), "老板自己也看不到");

  const crew = await person("crew");
  await C.rpc("add_project_member", { in_email: crew.email });
  const crewSees = await nudges(crew.client);
  check("🔴 师傅看不到「报价快到期」",
    !crewSees.some((r) => r.kind === "quote_expiring"),
    JSON.stringify(crewSees.map((r) => r.kind)));
  check("🔴 师傅也看不到「同意了没付订金」",
    !crewSees.some((r) => r.kind === "agreed_unpaid"),
    JSON.stringify(crewSees.map((r) => r.kind)));
  check("🔴 而他要做的三种看得到（补货 · 保养 · 套票）",
    crewSees.some((r) => r.kind === "below_reorder")
      && crewSees.some((r) => r.kind === "contract_due"),
    JSON.stringify(crewSees.map((r) => r.kind)));
  check("🔴 金额那一栏对他是空的（不是 0）",
    crewSees.every((r) => r.amount_cents === null),
    JSON.stringify(crewSees.map((r) => r.amount_cents)));

  /* ── ⑨ 别人家 ─────────────────────────────────────────────────────── */
  console.log("\n⑨ 别人家");
  const other = await person("other");
  check("🔴 别人家一条都读不到", (await nudges(other.client)).length === 0,
    `${(await nudges(other.client)).length}`);
  const { error: oSnooze } = await other.client.rpc("snooze_nudge", {
    in_project_id: P, in_kind: "below_reorder", in_subject_id: item.id,
  });
  check("🔴 别人家按不掉我的", !!oSnooze, "居然让它过了");
  const { data: oRead } = await other.client
    .from("nudge_snoozes").select("id").eq("project_id", P);
  check("🔴 那张表他也读不到", (oRead ?? []).length === 0, `${oRead?.length}`);
} finally {
  for (const id of people) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.log(`  ⚠️ 删不掉 ${id}：${error.message}`);
  }
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
