/**
 * 退货 —— 拿真的登入身分打一次每一支。
 *
 * 重点 26：`db push` 成功证明不了任何事。plpgsql 到**执行**才解析名字，
 * 而这一支同时在验两件独立的事：**架上的数字**跟**他还欠多少**。
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
  const email = `rt-${tag}-${stamp}@formae.test`;
  const password = `Rt-${stamp}-x!`;
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

/** 架上现在几件。走那个 view，跟画面读的是同一个东西。 */
const onHand = async (C, P, name) => {
  const { data } = await C.from("stock_on_hand").select("name, on_hand").eq("project_id", P);
  const row = (data ?? []).find((r) => r.name === name);
  return row ? Number(row.on_hand) : null;
};

try {
  const owner = await person("own");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", owner.id).single();
  const P = proj.id;
  const C = owner.client;
  await C.rpc("set_project_style", { new_style: "ledger" });

  /* 一间五金店：一件货、一张订单、真的送出去。 */
  for (const [key, title] of [["orders", "Orders"], ["inventory", "Stock"], ["tasks", "Tasks"]]) {
    await C.rpc("add_project_page", { requested_key: key, new_title: title });
  }

  const { data: item, error: itErr } = await C.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Cement 50kg",
    in_unit: "bag", in_price_cents: 1850,
  });
  if (itErr) throw new Error(`add_catalog_item: ${itErr.message}`);
  const { error: opErr } = await C.rpc("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 100, in_reason: "Opening",
  });
  if (opErr) throw new Error(`move_stock: ${opErr.message}`);

  const { data: cust } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Kedai Ah Seng",
  });
  const { data: order, error: ordErr } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_party: "Kedai Ah Seng",
    in_party_id: cust.id, in_title: "Ten bags", in_amount_cents: 18500,
  });
  if (ordErr) throw new Error(`add_pipeline_record: ${ordErr.message}`);

  const { data: lines, error: lnErr } = await C.rpc("set_record_lines", {
    in_record_id: order.id,
    in_lines: [{ description: "Cement 50kg", qty: 10, unit: "bag",
                 unit_price_cents: 1850, amount_cents: 18500, item_id: item.id }],
  });
  if (lnErr) throw new Error(`set_record_lines: ${lnErr.message}`);
  const LINE = (lines ?? [])[0];

  const { data: sent, error: dvErr } = await C.rpc("deliver_record", { in_record_id: order.id });
  if (dvErr) throw new Error(`deliver_record: ${dvErr.message}`);
  check("道具摆好了：十包送出去，架上剩九十", Number(sent?.[0]?.moved) === 1
    && (await onHand(C, P, "Cement 50kg")) === 90, `moved=${sent?.[0]?.moved}`);

  console.log("\n① 退三包回来");
  const { data: r1, error: e1 } = await C.rpc("record_return", {
    in_record_id: order.id,
    in_lines: [{ line_id: LINE.id, qty: 3, amount_cents: 5550 }],
    in_credit_cents: 5550,
    in_reason: "尺寸不对",
  });
  const R1 = r1?.[0];
  check("记得进去", !e1 && !!R1?.return_id, e1?.message);
  check("一行真的放回架上", Number(R1?.back) === 1, `back=${R1?.back}`);
  check("🔴 架上从九十变九十三", (await onHand(C, P, "Cement 50kg")) === 93,
    `${await onHand(C, P, "Cement 50kg")}`);
  check("那笔进货写着「退货」，而且指得回那张单", await (async () => {
    const { data } = await admin.from("stock_moves")
      .select("direction, qty, reason, against_id, return_id, line_id")
      .eq("return_id", R1.return_id);
    const m = (data ?? [])[0];
    return m && m.direction === "in" && Number(m.qty) === 3
      && m.against_id === order.id && m.line_id === LINE.id;
  })(), "那一笔的样子不对");

  console.log("\n② 这张单退过多少");
  const { data: credited } = await C.rpc("record_credited", { in_record_id: order.id });
  check("🔴 退过多少是数出来的（RM 55.50）", Number(credited) === 5550, `${credited}`);
  const { data: listed, error: lsErr } = await C.rpc("returns_of", { in_record_id: order.id });
  check("列得出来", !lsErr && (listed ?? []).length === 1, lsErr?.message);
  check("他自己写的理由留着", listed?.[0]?.reason === "尺寸不对", listed?.[0]?.reason);
  check("退回来的那一行也在", (listed?.[0]?.lines ?? []).length === 1
    && Number(listed[0].lines[0].qty) === 3, JSON.stringify(listed?.[0]?.lines));

  console.log("\n③ 挡住的");
  /* 🔴 抄 ERPNext 的第 ① 条：不能退比卖出去的多，含已经退过的。 */
  const { error: tooMany } = await C.rpc("record_return", {
    in_record_id: order.id,
    in_lines: [{ line_id: LINE.id, qty: 8 }],
  });
  check("🔴 退不了比卖出去的多（已经退过三包，剩七包）",
    !!tooMany && /more than was sold/i.test(tooMany.message ?? ""), tooMany?.message);
  /* 被挡下来之后原本那一笔还在，架上也没有动。 */
  check("被挡下来之后架上没有动", (await onHand(C, P, "Cement 50kg")) === 93,
    `${await onHand(C, P, "Cement 50kg")}`);

  /* 🔴 抄他们的第 ② 条：退的钱不能高过单上的钱。 */
  const { error: tooRich } = await C.rpc("record_return", {
    in_record_id: order.id, in_credit_cents: 20000,
  });
  check("🔴 退的钱高过单上的钱要挡（不然是一条凭空生出钱的路）",
    !!tooRich && /more than this document is worth/i.test(tooRich.message ?? ""),
    tooRich?.message);

  const { data: task } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "tasks", in_party: "内部",
    in_title: "Call supplier", in_amount_cents: 0,
  });
  const { error: taskErr } = await C.rpc("record_return", { in_record_id: task.id });
  check("一件任务退不了", !!taskErr && /does not take returns/i.test(taskErr.message ?? ""),
    taskErr?.message);

  const { data: shelved } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_party: "X",
    in_title: "Old", in_amount_cents: 100,
  });
  await C.rpc("set_pipeline_archived", { in_id: shelved.id, in_archived: true });
  const { error: shErr } = await C.rpc("record_return", { in_record_id: shelved.id });
  check("收起来的单退不了，而且讲得出该怎么做",
    !!shErr && /take it back out/i.test(shErr.message ?? ""), shErr?.message);

  console.log("\n④ 没有送出去过的，钱照记而货不加回去");
  const { data: undelivered } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_party: "Kedai Ah Seng",
    in_party_id: cust.id, in_title: "Not sent yet", in_amount_cents: 9250,
  });
  const { data: uLines } = await C.rpc("set_record_lines", {
    in_record_id: undelivered.id,
    in_lines: [{ description: "Cement 50kg", qty: 5, unit: "bag",
                 amount_cents: 9250, item_id: item.id }],
  });
  const before = await onHand(C, P, "Cement 50kg");
  const { data: r2, error: e2 } = await C.rpc("record_return", {
    in_record_id: undelivered.id,
    in_lines: [{ line_id: uLines[0].id, qty: 2 }],
    in_credit_cents: 3700,
  });
  check("记得进去", !e2 && !!r2?.[0]?.return_id, e2?.message);
  /* 🔴 一张还没交货的单退两包，加回去就是**凭空生出两包货** ——
     而凭空多出来的货跟真的到货长得一模一样。 */
  check("🔴 架上一件都没有多出来", (await onHand(C, P, "Cement 50kg")) === before,
    `${before} -> ${await onHand(C, P, "Cement 50kg")}`);
  check("🔴 而且它讲出来了（not_out = 1）", Number(r2?.[0]?.not_out) === 1,
    `not_out=${r2?.[0]?.not_out}`);
  check("钱那一半照记", Number(r2?.[0]?.credit_cents) === 3700, `${r2?.[0]?.credit_cents}`);

  console.log("\n⑤ 只退钱不退货（沙龙退一次服务）");
  const { data: svc } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_party: "Kedai Ah Seng",
    in_party_id: cust.id, in_title: "A service", in_amount_cents: 12000,
  });
  const { data: r3, error: e3 } = await C.rpc("record_return", {
    in_record_id: svc.id, in_credit_cents: 12000, in_reason: "客人不满意",
  });
  check("一行货都没有也记得了", !e3 && Number(r3?.[0]?.credit_cents) === 12000, e3?.message);

  console.log("\n⑥ 按两下");
  const key = crypto.randomUUID();
  const a = await C.rpc("record_return", {
    in_record_id: order.id, in_credit_cents: 1000, in_idempotency_key: key,
  });
  const b = await C.rpc("record_return", {
    in_record_id: order.id, in_credit_cents: 1000, in_idempotency_key: key,
  });
  check("同一把钥匙回同一笔", a.data?.[0]?.return_id === b.data?.[0]?.return_id,
    `${a.data?.[0]?.return_id} vs ${b.data?.[0]?.return_id}`);
  const { data: nowCredited } = await C.rpc("record_credited", { in_record_id: order.id });
  check("而且只算一次（5550 + 1000）", Number(nowCredited) === 6550, `${nowCredited}`);

  console.log("\n⑦ 撤销一笔退货");
  const backBefore = await onHand(C, P, "Cement 50kg");
  const { data: undone, error: unErr } = await C.rpc("drop_return", { in_id: R1.return_id });
  check("撤销得了", !unErr && Number(undone) === 1, unErr?.message);
  /* 🔴 跟「收起一趟货」不一样：那几笔进货身上写着 return_id，所以
     这一支分得出该拿哪几件出去。 */
  check("🔴 架上那三包真的又出去了", (await onHand(C, P, "Cement 50kg")) === backBefore - 3,
    `${backBefore} -> ${await onHand(C, P, "Cement 50kg")}`);
  check("🔴 而且是写一笔反的，不是把那一笔删掉", await (async () => {
    const { data } = await admin.from("stock_moves")
      .select("direction, qty, reason").eq("line_id", LINE.id).eq("direction", "in");
    return (data ?? []).length === 1;   /* 原本那一笔还在 */
  })(), "原本那一笔不见了");
  const { data: afterDrop } = await C.rpc("record_credited", { in_record_id: order.id });
  check("退过多少跟着少（只剩那一笔 1000）", Number(afterDrop) === 1000, `${afterDrop}`);

  console.log("\n⑩ 他还欠我多少，跟着少");
  /* 一个乾净的客人，一张一万块的单，先付两千。
     🔴 这一段验的是这一整件事真正的重点：退货一进来，
     **三个算「他还欠多少」的地方**要一起跟着少。 */
  const { data: cln } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Sing Heng",
  });
  const { data: bill } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_party: "Sing Heng",
    in_party_id: cln.id, in_title: "Ten thousand", in_amount_cents: 1000000,
    in_stage: "Confirmed",
  });
  const { error: payErr } = await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 200000, in_party: "Sing Heng", in_party_id: cln.id,
    in_against_id: bill.id,
  });
  if (payErr) throw new Error(`add_ledger_entry: ${payErr.message}`);

  const owed = async () => {
    const { data } = await C.rpc("party_debts", { in_project_id: P });
    return Number((data ?? []).find((r) => r.party_id === cln.id)?.owed_cents ?? 0);
  };
  const aged = async () => {
    const { data } = await C.rpc("party_aging", { p_project_id: P });
    return Number((data ?? []).find((r) => r.party_id === cln.id)?.total_cents ?? 0);
  };
  const closing = async () => {
    const { data } = await C.rpc("party_statement", {
      p_project_id: P, p_party_id: cln.id, p_from: "2026-01-01", p_to: "2026-12-31",
    });
    const rows = data ?? [];
    return { last: Number(rows[rows.length - 1]?.running_cents ?? 0), rows };
  };
  check("道具：付了两千，还欠八千", (await owed()) === 800000, `${await owed()}`);

  const { error: rcErr } = await C.rpc("record_return", {
    in_record_id: bill.id, in_credit_cents: 150000, in_reason: "退了一部分",
  });
  check("退一千五记得进去", !rcErr, rcErr?.message);
  check("🔴 谁欠我钱：八千变六千五", (await owed()) === 650000, `${await owed()}`);
  check("🔴 帐龄那一页也是六千五", (await aged()) === 650000, `${await aged()}`);
  const st = await closing();
  /* 🔴 月结那张纸的期末，必须跟「谁欠我钱」一模一样 ——
     两个数字答的是同一个问题（20260905140000 那条断言）。 */
  /* 🔴 拿它跟「谁欠我钱」**互相比**，不是跟一个写死的数字比。
     故意弄坏 party_debts 那一次（20260905890000）它照样是绿的，
     而那时候两个数字已经在互相矛盾（800,000 对 650,000）——
     一个跟死数字比的断言，看不到两个答案分家。 */
  check("🔴 月结那张纸的期末，跟「谁欠我钱」一模一样",
    st.last === (await owed()), `纸上 ${st.last} · 那一页 ${await owed()}`);
  check("而且那个数字是六千五", st.last === 650000, `${st.last}`);
  check("而且那张纸上看得到那一笔退货",
    (st.rows ?? []).some((r) => r.kind === "return" && Number(r.credit_cents) === 150000),
    JSON.stringify((st.rows ?? []).map((r) => r.kind)));

  /* 🔴 **每一行的累计 = 上一行的累计 ＋ 这一行。**
     这一条守的是 20260905880000 修掉的那个：那张纸的行序本来跟它自己的
     累计不是同一把钥匙排的，於是画出来是

         开单  1,000,000
         退货     -1,500   累计 650,000
         收款     -2,000   累计 800,000   ← 收了钱累计反而变大

     一张自己跟自己打架的对帐单，而总数那一条抓不到它 ——
     总数只看最后一行。 */
  const walk = (st.rows ?? []).map((r) => ({
    kind: r.kind,
    run: Number(r.running_cents),
    delta: Number(r.charge_cents) - Number(r.credit_cents),
  }));
  const drift = walk.slice(1).find((r, i) => r.run !== walk[i].run + r.delta);
  check("🔴 那张纸读下来的顺序，就是它加起来的顺序",
    !drift, JSON.stringify(walk));

  console.log("\n⑧ 师傅那一边（柜台收退货的就是他）");
  const crew = await person("crew");
  const { error: memErr } = await C.rpc("add_project_member", { in_email: crew.email });
  if (memErr) throw new Error(`add_project_member: ${memErr.message}`);
  const { data: crewList, error: crewErr } = await crew.client.rpc("returns_of", {
    in_record_id: order.id,
  });
  check("师傅看得到这张单退过什么", !crewErr && (crewList ?? []).length >= 1, crewErr?.message);
  const { data: crewMade, error: crewWErr } = await crew.client.rpc("record_return", {
    in_record_id: svc.id, in_credit_cents: 0, in_reason: "counter",
  });
  check("而且记得了一笔", !crewWErr && !!crewMade?.[0]?.return_id, crewWErr?.message);

  console.log("\n⑨ 别人家");
  const other = await person("other");
  const { data: otherList } = await other.client.rpc("returns_of", { in_record_id: order.id });
  check("读不到我的", (otherList ?? []).length === 0, `${(otherList ?? []).length}`);
  const { error: otherWrite } = await other.client.rpc("record_return", {
    in_record_id: order.id, in_credit_cents: 100,
  });
  check("写不进我的单", !!otherWrite, "居然让它过了");
  const { data: otherRaw } = await other.client.from("returns").select("id");
  check("直接读那张表也是零行", (otherRaw ?? []).length === 0, `${(otherRaw ?? []).length}`);
  const { data: otherLines } = await other.client.from("return_lines").select("id");
  check("那几行也是零行", (otherLines ?? []).length === 0, `${(otherLines ?? []).length}`);

  /* 🔴 那一笔属於那张单的那一家 —— 两个 id 各自都合法，外键挡不住。 */
  const { data: otherProj } = await admin
    .from("projects").select("id").eq("account_id", other.id).single();
  const { error: crossErr } = await admin.from("returns").insert({
    project_id: otherProj.id, record_id: order.id, credit_cents: 0,
  });
  check("🔴 挂到别人的单上要被挡（触发器，不是外键）",
    !!crossErr && /not in this project/i.test(crossErr.message ?? ""),
    crossErr?.message ?? "居然让它过了");
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  bad.push(err.message);
} finally {
  let stuck = 0;
  for (const id of people) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      console.log(`  FAIL  🔴 整个帐号删得掉 — ${id}：${error.message}`);
      stuck += 1;
    }
  }
  if (stuck) bad.push("整个帐号删得掉");
  else console.log("\n  PASS  🔴 整个帐号删得掉（cascade 没有被挡）");
  console.log("(临时帐号都删掉了)");
}

console.log(`\n判：${bad.length ? `${bad.length} 条没过` : "全过"}`);
for (const b of bad) console.log(`  · ${b}`);
process.exit(bad.length ? 1 : 0);
