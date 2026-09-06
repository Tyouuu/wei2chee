/**
 * 序号 —— 一台车、一支手机，一个一个记。拿真的登入身分打一次每一支。
 *
 * [任务 181] 数过：怡保 262 家里 122 家（47%）要它，而**车行排第一**。
 *
 * 🔴 这一支最要紧的两条：
 *   · 一台一台管的东西，**不准替他挑是哪一台** —— 客人买的是那一台，
 *     序号会印在过户文件上，挑错一台画面上完全正常
 *   · 一箱奶粉那一边**一个字都没变**（效期最早的先出，照旧自动挑）
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
  const email = `sn-${tag}-${stamp}@formae.test`;
  const password = `Sn-${stamp}-x!`;
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
  for (const k of ["inventory", "orders", "customers", "purchases", "suppliers"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const lots = async (id) => (await C.rpc("batches_of", { in_item_id: id })).data ?? [];
  const onHand = async (name) => {
    const { data } = await C.from("stock_on_hand").select("name, on_hand").eq("project_id", P);
    const r = (data ?? []).find((x) => x.name === name);
    return r ? Number(r.on_hand) : null;
  };

  /* ── ① 一间车行：一台一台管 ───────────────────────────────────────── */
  console.log("\n① 车行：Myvi 一台一台管");
  const { data: car } = await C.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Myvi 1.3", in_unit: "unit",
  });
  const { data: on, error: onErr } = await C.rpc("set_item_serial_tracking", {
    in_item_id: car.id, in_on: true,
  });
  check("开得起来", !onErr && on?.tracks_serial === true, onErr?.message ?? `${on?.tracks_serial}`);

  /* ── ② 🔴 架上有没挂序号的货，就不准开 ────────────────────────────── */
  console.log("\n② 🔴 架上有散的就不准开");
  const { data: milk } = await C.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Milk powder", in_unit: "tin",
  });
  await C.rpc("move_stock", {
    in_item_id: milk.id, in_direction: "in", in_qty: 5, in_reason: "开帐",
  });
  const { error: refuse } = await C.rpc("set_item_serial_tracking", {
    in_item_id: milk.id, in_on: true,
  });
  check("🔴 挡下来了", !!refuse, "居然让它过了");
  check("🔴 而且讲得出该怎么做", (refuse?.message ?? "").includes("count them out"),
    refuse?.message);
  const { error: offErr } = await C.rpc("set_item_serial_tracking", {
    in_item_id: milk.id, in_on: false,
  });
  check("关掉永远可以（那是放宽）", !offErr, offErr?.message);

  /* ── ③ 进两台车，各有底盘号跟自己的进价 ───────────────────────────── */
  console.log("\n③ 进两台车");
  const { data: lotA } = await C.rpc("add_stock_batch", {
    in_item_id: car.id, in_code: "WA1234A", in_unit_cost_cents: 3_500_000,
  });
  const { data: lotB } = await C.rpc("add_stock_batch", {
    in_item_id: car.id, in_code: "WB5678B", in_unit_cost_cents: 3_800_000,
  });
  await C.rpc("move_stock", {
    in_item_id: car.id, in_direction: "in", in_qty: 1, in_reason: "收车",
    in_batch_id: lotA.id,
  });
  await C.rpc("move_stock", {
    in_item_id: car.id, in_direction: "in", in_qty: 1, in_reason: "收车",
    in_batch_id: lotB.id,
  });
  const twoCars = await lots(car.id);
  check("车场里两台", twoCars.filter((b) => Number(b.on_hand) > 0).length === 2,
    JSON.stringify(twoCars.map((b) => [b.code, b.on_hand])));
  check("🔴 每一台自己的进价看得到",
    Number(twoCars.find((b) => b.code === "WA1234A")?.unit_cost_cents) === 3_500_000,
    JSON.stringify(twoCars.map((b) => [b.code, b.unit_cost_cents])));

  /* 🔴 第二车到的时候不覆盖第一次讲的进价 —— 抄效期那一条。 */
  await C.rpc("add_stock_batch", {
    in_item_id: car.id, in_code: "WA1234A", in_unit_cost_cents: 9_900_000,
  });
  check("🔴 已经有的进价不覆盖",
    Number((await lots(car.id)).find((b) => b.code === "WA1234A")?.unit_cost_cents)
      === 3_500_000,
    `${(await lots(car.id)).find((b) => b.code === "WA1234A")?.unit_cost_cents}`);

  /* ── ④ 🔴 卖的时候不讲是哪一台 → 挡下来 ───────────────────────────── */
  console.log("\n④ 🔴 不讲是哪一台，挡下来");
  const { data: cust } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mr Tan",
  });
  const { data: sale } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "One Myvi",
    in_party: "Mr Tan", in_party_id: cust.id, in_amount_cents: 4_200_000,
  });
  const { data: l1 } = await C.rpc("set_record_lines", {
    in_record_id: sale.id,
    in_lines: [{ description: "Myvi 1.3", qty: "1", unit: "unit",
      item_id: car.id, amount_cents: "4200000" }],
  });
  const { error: noPick } = await C.rpc("deliver_record", {
    in_record_id: sale.id, in_lines: [{ line_id: l1[0].id, qty: "1" }],
  });
  check("🔴 挡下来了", !!noPick, "居然替他挑了一台");
  check("🔴 而且讲的是「要讲是哪一个序号」",
    (noPick?.message ?? "").includes("which serial"), noPick?.message);
  check("被挡下来之后两台都还在", (await onHand("Myvi 1.3")) === 2,
    `${await onHand("Myvi 1.3")}`);

  /* ── ⑤ 一行两台 → 挡下来 ──────────────────────────────────────────── */
  console.log("\n⑤ 一行两台");
  await C.rpc("set_record_lines", {
    in_record_id: sale.id,
    in_lines: [{ description: "Myvi 1.3", qty: "2", unit: "unit", item_id: car.id,
      batch_code: "WA1234A", amount_cents: "8400000" }],
  });
  const { data: l2 } = await C.rpc("set_record_lines", {
    in_record_id: sale.id,
    in_lines: [{ description: "Myvi 1.3", qty: "2", unit: "unit", item_id: car.id,
      batch_code: "WA1234A", amount_cents: "8400000" }],
  });
  const { error: twoOnOne } = await C.rpc("deliver_record", {
    in_record_id: sale.id, in_lines: [{ line_id: l2[0].id, qty: "2" }],
  });
  check("🔴 挡下来了", !!twoOnOne, "居然让它过了");
  check("🔴 而且讲得出该怎么做：一台一行",
    (twoOnOne?.message ?? "").includes("own line"), twoOnOne?.message);

  /* ── ⑥ 讲了就出得去 ──────────────────────────────────────────────── */
  console.log("\n⑥ 讲了是哪一台就出得去");
  const { data: l3 } = await C.rpc("set_record_lines", {
    in_record_id: sale.id,
    in_lines: [{ description: "Myvi 1.3", qty: "1", unit: "unit", item_id: car.id,
      batch_code: "WA1234A", amount_cents: "4200000" }],
  });
  const { error: dErr } = await C.rpc("deliver_record", {
    in_record_id: sale.id, in_lines: [{ line_id: l3[0].id, qty: "1" }],
  });
  check("出得去", !dErr, dErr?.message);
  check("车场剩一台", (await onHand("Myvi 1.3")) === 1, `${await onHand("Myvi 1.3")}`);
  const after = await lots(car.id);
  check("🔴 出去的是他讲的那一台，不是另一台",
    Number(after.find((b) => b.code === "WA1234A")?.on_hand) === 0
      && Number(after.find((b) => b.code === "WB5678B")?.on_hand) === 1,
    JSON.stringify(after.map((b) => [b.code, b.on_hand])));

  /* ── ⑦ 这一台的来龙去脉 ──────────────────────────────────────────── */
  console.log("\n⑦ WA1234A 这一台");
  const { data: hist, error: hErr } = await C.rpc("serial_history", {
    in_project_id: P, in_code: "wa 1234 a".replace(/\s/g, ""),
  });
  check("查得到", !hErr && (hist ?? []).length >= 2, hErr?.message ?? `${hist?.length}`);
  check("现在不在车场里了", Number(hist?.[0]?.on_hand) === 0, `${hist?.[0]?.on_hand}`);
  check("看得到进价 RM 35,000", Number(hist?.[0]?.unit_cost_cents) === 3_500_000,
    `${hist?.[0]?.unit_cost_cents}`);
  check("🔴 而且讲得出卖给谁", (hist ?? []).some((r) => r.party === "Mr Tan"),
    JSON.stringify(hist?.map((r) => [r.direction, r.party])));

  /* ── ⑧ 🔴 师傅：查得到那一台，查不到进价 ──────────────────────────── */
  console.log("\n⑧ 🔴 师傅");
  const crew = await person("crew");
  await C.rpc("add_project_member", { in_email: crew.email });
  const { data: cHist } = await crew.client.rpc("serial_history", {
    in_project_id: P, in_code: "WA1234A",
  });
  check("师傅查得到这一台在不在（那是他一天的工作）",
    (cHist ?? []).length >= 2, `${cHist?.length}`);
  check("🔴 而进价那一栏是空的（不是 0）",
    (cHist ?? []).every((r) => r.unit_cost_cents === null),
    JSON.stringify(cHist?.map((r) => r.unit_cost_cents)));
  const { data: cLots } = await crew.client.rpc("batches_of", { in_item_id: car.id });
  check("🔴 货架那一支也一样挡进价",
    (cLots ?? []).every((b) => b.unit_cost_cents === null),
    JSON.stringify(cLots?.map((b) => b.unit_cost_cents)));
  /* 控制组 —— 没有这一条，上面两条量的是空气。 */
  check("而老板自己看得到（控制组）",
    (await lots(car.id)).some((b) => Number(b.unit_cost_cents) > 0), "老板也看不到");

  /* ── ⑨ 一箱奶粉那一边一个字都没变 ─────────────────────────────────── */
  console.log("\n⑨ 没开序号的那一边（回归）");
  const { data: lotAug } = await C.rpc("add_stock_batch", {
    in_item_id: milk.id, in_code: "L-AUG", in_expiry_on: "2027-08-31",
  });
  const { data: lotJun } = await C.rpc("add_stock_batch", {
    in_item_id: milk.id, in_code: "L-JUN", in_expiry_on: "2027-06-30",
  });
  await C.rpc("move_stock", {
    in_item_id: milk.id, in_direction: "in", in_qty: 10, in_reason: "进货",
    in_batch_id: lotAug.id,
  });
  await C.rpc("move_stock", {
    in_item_id: milk.id, in_direction: "in", in_qty: 10, in_reason: "进货",
    in_batch_id: lotJun.id,
  });
  const { data: sale2 } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_title: "Six tins",
    in_party: "Mr Tan", in_party_id: cust.id, in_amount_cents: 12_000,
  });
  const { data: l4 } = await C.rpc("set_record_lines", {
    in_record_id: sale2.id,
    in_lines: [{ description: "Milk powder", qty: "6", unit: "tin",
      item_id: milk.id, amount_cents: "12000" }],
  });
  const { error: mErr } = await C.rpc("deliver_record", {
    in_record_id: sale2.id, in_lines: [{ line_id: l4[0].id, qty: "6" }],
  });
  check("🔴 没讲哪一批照样出得去（没开序号）", !mErr, mErr?.message);
  const mLots = await lots(milk.id);
  check("🔴 而且照旧是效期最早的先出",
    Number(mLots.find((b) => b.code === "L-JUN")?.on_hand) === 4
      && Number(mLots.find((b) => b.code === "L-AUG")?.on_hand) === 10,
    JSON.stringify(mLots.map((b) => [b.code, b.on_hand])));

  /* ── ⑩ 别人家 ─────────────────────────────────────────────────────── */
  console.log("\n⑩ 别人家");
  const other = await person("other");
  const { data: oHist } = await other.client.rpc("serial_history", {
    in_project_id: P, in_code: "WA1234A",
  });
  check("🔴 别人家一行都读不到", (oHist ?? []).length === 0, `${oHist?.length}`);
  const { error: oSet } = await other.client.rpc("set_item_serial_tracking", {
    in_item_id: car.id, in_on: false,
  });
  check("🔴 别人家关不掉我的开关", !!oSet, "居然让它过了");
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
