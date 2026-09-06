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

  /* ── ⑧ 🔴 有人在官网上订了，而他还没看过 ──────────── */
  console.log("\n⑧ 🔴 官网来的预约，他还没看过");
  /* ⚙ 这一笔是用老板身分建的，只是把来源标成官网 ——
     陆上那一整条（陌生人那把钥匙 → `submit_site_booking`）
     `check:public-booking` 已经走完了；这一段验的是
     「来源是官网 ⬛ 而他没看过」那一条规则。 */
  const soon = new Date(Date.now() + 36e5 * 26).toISOString();
  const later = new Date(Date.now() + 36e5 * 27).toISOString();
  /* ⚠️ `add_appointment` 回的是**一个 uuid**，不是一整行。
     第一版写 `bk.id` —— 那是 undefined，而 `has()` 拿 undefined 去比
     会**配上任何一行**：两条断言因此是**假的绿**。 */
  const { data: bk, error: bkErr } = await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: soon, in_ends_at: later,
    in_party: "Mr Ong", in_service: "Colour and cut", in_source: "website",
  });
  check("预约建得起来", !bkErr && !!bk, bkErr?.message ?? "没回 id");
  check("🔴 他还没看过 → 讲",
    has(await nudges(), "booking_unseen", bk),
    JSON.stringify((await nudges()).map((r) => r.kind)));
  check("而且讲得出是谁、做什么",
    (await nudges()).some((r) => r.kind === "booking_unseen"
      && r.party === "Mr Ong" && r.title === "Colour and cut"),
    JSON.stringify((await nudges()).filter((r) => r.kind === "booking_unseen")));

  /* 他自己在柜台打的那一笔，他本来就知道 —— 不讲。 */
  const { data: own, error: ownErr } = await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() + 36e5 * 30).toISOString(),
    in_ends_at: new Date(Date.now() + 36e5 * 31).toISOString(),
    in_party: "Walk in", in_service: "Trim",
  });
  check("道具：柜台那一笔也建得起来", !ownErr && !!own, ownErr?.message ?? "没回 id");
  check("🔴 他自己打的那一笔不讲（他本来就知道）",
    !has(await nudges(), "booking_unseen", own),
    JSON.stringify((await nudges()).filter((r) => r.kind === "booking_unseen")
      .map((r) => r.party)));

  const { data: cleared, error: mkErr } = await C.rpc("mark_bookings_seen", {
    in_project_id: P,
  });
  check("按掉那一排", !mkErr && Number(cleared) === 1,
    mkErr?.message ?? `${cleared}`);
  check("🔴 按了就不讲了",
    !has(await nudges(), "booking_unseen", bk), "按了还在讲");

  /* ── ⑨ 🔴 催款 —— 一期的日子过了，钱还没到 ───────── */
  console.log("\n⑨ 🔴 催款");
  const { data: job } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "Bathroom",
    in_party: "Mrs Lim", in_party_id: cust.id, in_amount_cents: 1_000_000,
  });
  /* 订金三成，而那一期的日子是**上个礼拜** ——
     没有发明任何天数，那是他自己写在单上的。 */
  const { error: tErr } = await C.rpc("set_record_terms", {
    in_record_id: job.id,
    in_terms: [
      { description: "订金", portion: 30, due_on: day(-7) },
      { description: "完工", portion: 70, due_on: day(30) },
    ],
  });
  check("分期表写得进去", !tErr, tErr?.message);
  const od = await nudges();
  check("🔴 过了日子而钱没到 → 讲",
    has(od, "payment_overdue", job.id),
    JSON.stringify(od.map((r) => r.kind)));
  check("🔴 而且讲的是**还差多少**（RM 3,000），不是整张单",
    Number(od.find((r) => r.kind === "payment_overdue")?.amount_cents) === 300_000,
    `${od.find((r) => r.kind === "payment_overdue")?.amount_cents}`);

  /* 收了订金 → 那一条自己消失。 */
  const { data: dep2 } = await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 300_000, in_party: "Mrs Lim", in_party_id: cust.id,
    in_against_id: job.id,
  });
  check("🔴 收了订金就不讲了",
    !has(await nudges(), "payment_overdue", job.id),
    JSON.stringify((await nudges()).map((r) => r.kind)));
  await C.rpc("reverse_ledger_entry", { in_entry_id: dep2.id });
  check("冲正之后又讲了", has(await nudges(), "payment_overdue", job.id),
    JSON.stringify((await nudges()).map((r) => r.kind)));

  /* 🔴 一张**过期的报价单**不算欠款 ——
     报价单那个日子是**有效期**，不是付款日。 */
  const { data: oldQuote } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "Old quote",
    in_party: "Mrs Lim", in_party_id: cust.id, in_amount_cents: 700_000,
    in_due_on: day(-30),
  });
  check("🔴 一张过期的报价单不算欠款（那个日子是有效期）",
    !has(await nudges(), "payment_overdue", oldQuote.id),
    JSON.stringify((await nudges()).filter((r) => r.kind === "payment_overdue")
      .map((r) => r.title)));

  /* 🔴 进货单不算 —— 那是我欠人家。 */
  await C.rpc("add_project_page", { requested_key: "purchases", new_title: "Purchases" });
  const { data: po } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "Cement",
    in_party: "Seng Huat", in_amount_cents: 185_000, in_due_on: day(-20),
  });
  check("🔴 进货单不算（那是我欠人家）",
    !has(await nudges(), "payment_overdue", po.id),
    JSON.stringify((await nudges()).filter((r) => r.kind === "payment_overdue")
      .map((r) => r.title)));

  /* ── ⑩ 🔴 借出去的东西该还了 ───────────────── */
  console.log("\n⑩ 🔴 借出去该还了");
  const { data: lent, error: lErr } = await C.rpc("lend_item", {
    in_record_id: job.id, in_descr: "折叠桌 ×10", in_qty: 10,
    /* ⚙️ 借出去的日子要在归还日之前 —— 第一版没给，
       它预设是今天，于是那一句正确地拒绝了。 */
    in_out_on: day(-10), in_due_back_on: day(-3),
  });
  check("借得出去", !lErr, lErr?.message);
  const rd = await nudges();
  check("🔴 过了归还日还没还 → 讲",
    rd.some((r) => r.kind === "rental_overdue"),
    JSON.stringify(rd.map((r) => r.kind)));
  check("而且讲得出是什么、几件",
    rd.some((r) => r.kind === "rental_overdue" && Number(r.qty_left) === 10),
    JSON.stringify(rd.filter((r) => r.kind === "rental_overdue")));
  await C.rpc("return_rental", { in_rental_id: lent.id, in_qty: 10 });
  check("🔴 还了就不讲了",
    !(await nudges()).some((r) => r.kind === "rental_overdue"),
    JSON.stringify((await nudges()).filter((r) => r.kind === "rental_overdue")));

  /* ── ⑪ 🔴 答应了的介绍费还没给 ─────────────── */
  console.log("\n⑪ 🔴 介绍费还没给");
  const { data: ahMing } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ah Ming",
  });
  const { error: refErr } = await C.rpc("set_record_referral", {
    in_record_id: job.id, in_referrer_id: ahMing.id, in_portion: 3,
  });
  check("记得下是谁介绍的", !refErr, refErr?.message);
  /* 没收到钱就不欠 —— 比例算的是**收到的钱**。 */
  check("🔴 客人还没付钱，就不讲",
    !(await nudges()).some((r) => r.kind === "referral_owing"),
    JSON.stringify((await nudges()).filter((r) => r.kind === "referral_owing")));
  await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 400_000, in_party: "Mrs Lim", in_party_id: cust.id,
    in_against_id: job.id,
  });
  const rf = await nudges();
  check("🔴 钱进来了 → 讲一句“该给阿明了”",
    rf.some((r) => r.kind === "referral_owing" && r.subject_id === ahMing.id),
    JSON.stringify(rf.map((r) => [r.kind, r.party])));
  check("而且讲得出欠多少（RM 4,000 的 3%）",
    Number(rf.find((r) => r.kind === "referral_owing")?.amount_cents) === 12_000,
    `${rf.find((r) => r.kind === "referral_owing")?.amount_cents}`);

  /* ── ⑫ 🔴 经销商提交了一笔，他还没处理 ──────── */
  console.log("\n⑫ 🔴 经销商提交了一笔");
  const { data: dealer } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Kedai Ong",
  });
  const { data: portal, error: pErr } = await C.rpc("open_party_portal", {
    in_party_id: dealer.id,
  });
  check("给得出一条连结", !pErr && !!portal, pErr?.message);
  const ref = portal?.portal_ref ?? portal;
  const { data: word, error: sErr } = await anon.rpc("submit_party_request", {
    in_ref: ref, in_what: "要 200 张 SIM", in_qty: 200,
  });
  check("陌生人那把钥匙送得出去", !sErr && word === "ok",
    sErr?.message ?? `${word}`);
  const rq = await nudges();
  check("🔴 他还没处理 → 讲",
    rq.some((r) => r.kind === "request_open"),
    JSON.stringify(rq.map((r) => r.kind)));
  check("而且讲得出是谁、要什么",
    rq.some((r) => r.kind === "request_open" && r.party === "Kedai Ong"
      && Number(r.qty_left) === 200),
    JSON.stringify(rq.filter((r) => r.kind === "request_open")));

  /* 一按变单 → 那一条自己消失（`status` 变 done）。 */
  const { data: mine } = await C.rpc("party_requests_of", { in_project_id: P });
  const openOne = (mine ?? []).find((r) => r.status === "open");
  await C.rpc("record_from_request", {
    in_request_id: openOne.id, in_module_key: "orders",
  });
  check("🔴 一按变单就不讲了（不用另外一栏「看过没有」）",
    !(await nudges()).some((r) => r.kind === "request_open"),
    JSON.stringify((await nudges()).filter((r) => r.kind === "request_open")));

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
  check("🔴 师傅也看不到「催款」跟「介绍费」",
    !crewSees.some((r) => r.kind === "payment_overdue" || r.kind === "referral_owing"),
    JSON.stringify(crewSees.map((r) => r.kind)));
  /* 🔴 而「借出去该还了」他**看得到** —— 去把东西要回来的是柜台。 */
    check("🔴 师傅也看不到「同意了没付订金」",
    !crewSees.some((r) => r.kind === "agreed_unpaid"),
    JSON.stringify(crewSees.map((r) => r.kind)));
  check("🔴 而他要做的三种看得到（补货 · 保养 · 套票）",
    crewSees.some((r) => r.kind === "below_reorder")
      && crewSees.some((r) => r.kind === "contract_due"),
    JSON.stringify(crewSees.map((r) => r.kind)));
  /* 🔴 而官网来的预约他**看得到** —— 前台要知道今天谁要来。
     看得到跟按得掉是两件事：一个师傅按掉那个徽章，
     老板就再也不知道有人订过。 */
  const { data: bk2, error: bk2Err } = await C.rpc("add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() + 36e5 * 40).toISOString(),
    in_ends_at: new Date(Date.now() + 36e5 * 41).toISOString(),
    in_party: "Mrs Chan", in_service: "Perm", in_source: "website",
  });
  check("道具：第二笔官网预约建得起来", !bk2Err && !!bk2,
    bk2Err?.message ?? "没回 id");
  const crewSees2 = await nudges(crew.client);
  check("🔴 师傅看得到官网来的预约（前台的工作）",
    crewSees2.some((r) => r.kind === "booking_unseen" && r.subject_id === bk2),
    JSON.stringify(crewSees2.map((r) => r.kind)));
  const { error: crewClear } = await crew.client.rpc("mark_bookings_seen", {
    in_project_id: P,
  });
  check("🔴 而他按不掉那个徽章", !!crewClear, "居然按得掉");

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
} catch (e) {
  /* 🔴 抛了例外要算没过。没有这一段的尺子，
     中途炸掉会把 `finally` 里那句「全部过」印出来 ——
     **一把说谎的尺，跟一把跑完的尺，在报告里长得一模一样**。
     这个仓库被这个形状骗过四次。 */
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  for (const id of people) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.log(`  ⚠️ 删不掉 ${id}：${error.message}`);
  }
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
