/**
 * 送货单 · 签收 —— 用真的身分打，不是读代码。
 *
 * 三种身分，因为这一件跨三边：
 *   · **老板**（登入）—— 开一趟、看清单
 *   · **师傅**（登入，同一家）—— 送货的就是他，所以他要看得到
 *   · **路人**（anon，只有一条连结）—— 签收的那个人
 *
 * 🔴 而这一支最要紧的一条不是功能，是 ②：
 *   `20260905330000` 照记忆重打 deliver_record，让「送过了没有」退回
 *   `exists(...)`，於是一张分两车出的单第二车永远出不去。
 *   **那条从今天起有人在守。**
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
/** 🔴 一个真的路人：anon key，没有登入过。 */
const stranger = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
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
const day = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function person(tag, pages) {
  const cred = {
    email: `dn-${tag}-${Date.now()}@formae.test`,
    password: `Dn-${Date.now()}-x!`,
  };
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

  await as.rpc("set_project_style", { new_style: "hearth" });
  for (const k of pages) await as.rpc("add_project_page", { requested_key: k, new_title: k });
  await admin.from("projects")
    .update({ business_name: `Hup Seng ${tag}` }).eq("id", proj.id);
  return { as, cred, userId: user.user.id, projectId: proj?.id };
}

async function onHand(c, projectId, name) {
  const { data } = await c
    .from("stock_on_hand").select("name, on_hand").eq("project_id", projectId);
  const row = (data ?? []).find((r) => r.name === name);
  return row ? Number(row.on_hand) : null;
}

try {
  const shop = await person("shop", ["orders", "inventory", "projects", "quotations", "customers"]);
  const other = await person("other", ["orders", "inventory"]);
  const c = shop.as;
  const P = shop.projectId;
  if (!P) throw new Error("找不到那一家的专案");

  const { data: item } = await c.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "Cement 50kg", in_unit: "bags", in_price_cents: 1850,
  });
  await c.rpc("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 200, in_reason: "Opening",
  });

  const { data: order } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "Taman Desa site", in_party: "Mr Tan", in_amount_cents: 185000,
  });
  const { data: lines } = await c.rpc("set_record_lines", {
    in_record_id: order.id,
    in_lines: [
      { description: "Cement 50kg", qty: "100", unit: "bags", item_id: item.id },
      /* 🔴 一口价那种行 —— 架上没有东西要动，而它**永远不该出现在「还没送到」上**。 */
      { description: "Delivery charge", amount_cents: 30000 },
    ],
  });
  const cementLine = (lines ?? []).find((l) => l.description === "Cement 50kg");

  /* ── ① 开一趟 ────────────────────────────────────────────────────────── */
  console.log("\n① 一趟就是一趟");
  const { data: run1, error: r1Err } = await c.rpc("deliver_record", {
    in_record_id: order.id,
    in_lines: [{ line_id: cementLine.id, qty: 90 }],
    in_driver: "Ah Meng lorry",
    in_received_by: "Site foreman",
  });
  const first = (run1 ?? [])[0];
  check("送得出去", !r1Err && !!first, r1Err?.message);
  check("这一趟有自己的一行", !!first?.delivery_id, `${first?.delivery_id}`);
  check("送了 90 包，架上剩 110", (await onHand(c, P, "Cement 50kg")) === 110);
  check("一口价那一行跳过了", Number(first?.skipped) >= 1, `skipped ${first?.skipped}`);

  const { data: moves1 } = await admin
    .from("stock_moves").select("qty, delivery_id")
    .eq("delivery_id", first.delivery_id);
  check("🔴 搬出去那一笔挂在这一趟上", (moves1 ?? []).length === 1
    && Number(moves1[0].qty) === 90, `${JSON.stringify(moves1)}`);

  /* ── ② 🔴 第二车 —— 这一条就是那个回归 ───────────────────────────────── */
  console.log("\n② 🔴 分两车：第二车出得去（20260905330000 的回归）");
  const { data: run2, error: r2Err } = await c.rpc("deliver_record", {
    in_record_id: order.id,
    in_driver: "Ah Meng lorry",
  });
  const second = (run2 ?? [])[0];
  check("第二车送得出去", !r2Err && Number(second?.moved) === 1,
    r2Err?.message ?? `moved ${second?.moved}`);
  check("🔴 只送剩下的 10 包，不是再送 100", (await onHand(c, P, "Cement 50kg")) === 100,
    `架上 ${await onHand(c, P, "Cement 50kg")}`);
  check("两趟是两趟", second?.delivery_id !== first?.delivery_id);

  /* 送完了，第三次什么都不会走。 */
  const { data: run3 } = await c.rpc("deliver_record", { in_record_id: order.id });
  check("送完了，第三次一件都不走", Number((run3 ?? [])[0]?.moved) === 0,
    `moved ${(run3 ?? [])[0]?.moved}`);
  check("而且架上没有变成 90", (await onHand(c, P, "Cement 50kg")) === 100);

  /* ── ③ 这一趟送了什么 ─────────────────────────────────────────────────── */
  console.log("\n③ 一趟送了什么，是从搬货那几笔算出来的");
  const { data: runs, error: runsErr } = await c.rpc("deliveries_of", { in_record_id: order.id });
  check("列得出三趟", !runsErr && (runs ?? []).length === 3,
    runsErr?.message ?? `${(runs ?? []).length}`);
  const oldest = (runs ?? []).find((r) => r.id === first.delivery_id);
  check("第一趟写着送了 90 包", Number(oldest?.lines?.[0]?.qty) === 90,
    JSON.stringify(oldest?.lines));
  check("而且写得出是哪一行货", oldest?.lines?.[0]?.description === "Cement 50kg");
  check("谁去送的记得住", oldest?.driver === "Ah Meng lorry", oldest?.driver);
  check("谁在门口收的记得住", oldest?.received_by === "Site foreman", oldest?.received_by);
  check("🔴 而且还没有人签过", oldest?.signed_at === null, `${oldest?.signed_at}`);

  /* ── ④ 还没送到的 ────────────────────────────────────────────────────── */
  console.log("\n④ 还没送到的");
  const { data: order2 } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "Half load", in_party: "Mr Lim", in_amount_cents: 92500,
  });
  const { data: l2 } = await c.rpc("set_record_lines", {
    in_record_id: order2.id,
    in_lines: [
      { description: "Cement 50kg", qty: "50", unit: "bags", item_id: item.id },
      { description: "Delivery charge", amount_cents: 30000 },
    ],
  });
  await c.rpc("deliver_record", {
    in_record_id: order2.id,
    in_lines: [{ line_id: (l2 ?? [])[0].id, qty: 20 }],
  });
  const { data: short, error: shortErr } = await c.rpc("delivery_shortfall", {
    in_record_id: order2.id,
  });
  check("算得出还欠多少", !shortErr && (short ?? []).length === 1, shortErr?.message);
  check("叫 50 送 20，还欠 30", Number(short?.[0]?.still) === 30,
    `ordered ${short?.[0]?.ordered} gone ${short?.[0]?.gone} still ${short?.[0]?.still}`);
  check("🔴 一口价那一行不算「还没送到」",
    !(short ?? []).some((r) => r.description === "Delivery charge"));

  /* 送完之后清单是空的。 */
  await c.rpc("deliver_record", { in_record_id: order2.id });
  const { data: short2 } = await c.rpc("delivery_shortfall", { in_record_id: order2.id });
  check("送完了就没有欠的", (short2 ?? []).length === 0, `${(short2 ?? []).length}`);

  /* ── ⑤ 装修那一行：一趟一笔货都没有 ──────────────────────────────────── */
  console.log("\n⑤ 一趟一笔货都没有，也是一趟（装修 · 服务）");
  const { data: job } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "projects",
    in_title: "Kitchen refit", in_party: "Mr Tan", in_amount_cents: 485000,
  });
  const { data: hand, error: handErr } = await c.rpc("open_delivery_run", {
    in_record_id: job.id,
    in_received_by: "Mrs Tan",
    in_note: "Handover, keys returned",
  });
  check("一件工程也交得了", !handErr && !!hand?.id, handErr?.message);
  const { data: jobRuns } = await c.rpc("deliveries_of", { in_record_id: job.id });
  check("那一趟上一件货都没有", (jobRuns ?? [])[0]?.lines?.length === 0,
    JSON.stringify((jobRuns ?? [])[0]?.lines));

  /* ── ⑥⑦ 挡住的 ──────────────────────────────────────────────────────── */
  console.log("\n⑥ 挡住的");
  const { error: futErr } = await c.rpc("open_delivery_run", {
    in_record_id: order.id, in_run_on: day(3),
  });
  check("送货日期不给写未来", !!futErr, "居然让它过了");

  const { data: quote } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "Not yet agreed", in_party: "Mr Tan", in_amount_cents: 100000,
  });
  const { error: qErr } = await c.rpc("open_delivery_run", { in_record_id: quote.id });
  check("报价单送不出去（还没有人答应）", !!qErr, "居然让它过了");

  const { error: mineErr } = await other.as.rpc("open_delivery_run", { in_record_id: order.id });
  check("别人家的单开不了一趟", !!mineErr, "居然让它过了");
  const { error: seeErr } = await other.as.rpc("deliveries_of", { in_record_id: order.id });
  check("别人家的清单读不到", !!seeErr, "居然让它过了");

  /* ── ⑧ 按两下 ────────────────────────────────────────────────────────── */
  console.log("\n⑧ 按两下只算一趟");
  const key = crypto.randomUUID();
  const { data: a1 } = await c.rpc("open_delivery_run", {
    in_record_id: order.id, in_idempotency_key: key, in_driver: "Twice",
  });
  const { data: a2 } = await c.rpc("open_delivery_run", {
    in_record_id: order.id, in_idempotency_key: key, in_driver: "Twice",
  });
  check("同一把钥匙回同一趟", a1?.id && a1.id === a2?.id, `${a1?.id} vs ${a2?.id}`);
  const { count: runCount } = await admin
    .from("deliveries").select("id", { count: "exact", head: true })
    .eq("record_id", order.id).eq("idempotency_key", key);
  check("资料库里只有一行", runCount === 1, `${runCount}`);

  /* ── ⑨ 客人自己签 ────────────────────────────────────────────────────── */
  console.log("\n⑨ 客人在他自己那条连结上按「收到了」");
  const { data: shared } = await c.rpc("share_record", { in_record_id: order.id });
  const ref = shared?.share_ref ?? shared;
  const { data: seenRows, error: seenErr } = await stranger.rpc("public_shared_record", {
    in_ref: ref,
  });
  const seen = (seenRows ?? [])[0];
  check("路人打得开", !seenErr && !!seen, seenErr?.message);
  check("那一页上看得到送货那几趟", Array.isArray(seen?.deliveries) && seen.deliveries.length >= 3,
    `${seen?.deliveries?.length}`);

  const mine = (seen?.deliveries ?? []).find((d) => Number(d.lines?.[0]?.qty) === 90);
  check("看得到「9 月 X 日送了 90 包」", !!mine, JSON.stringify(seen?.deliveries));

  const { data: signWord, error: signErr } = await stranger.rpc("sign_delivery", {
    in_ref: ref, in_delivery_ref: mine.ref, in_name: "Tan Ah Kow", in_note: "All good",
  });
  check("签得下去", !signErr && signWord === "ok", signErr?.message ?? signWord);

  const { data: after } = await c.rpc("deliveries_of", { in_record_id: order.id });
  const signed = (after ?? []).find((r) => r.id === first.delivery_id);
  check("🔴 老板那一边看得到他签了", !!signed?.signed_at, `${signed?.signed_at}`);
  check("而且看得到他签的名字", signed?.signed_name === "Tan Ah Kow", signed?.signed_name);
  check("🔴 「他自己签的」跟「我们打的」是两栏",
    signed?.signed_name === "Tan Ah Kow" && signed?.received_by === "Site foreman",
    `${signed?.signed_name} / ${signed?.received_by}`);

  /* ── ⑩ 漏不漏 ────────────────────────────────────────────────────────── */
  console.log("\n⑩ 🔴 那一页漏不漏东西");
  const { data: seen2Rows } = await stranger.rpc("public_shared_record", { in_ref: ref });
  const flat = JSON.stringify((seen2Rows ?? [])[0]);
  check("🔴 送货司机没有出去（那是他的师傅）", !flat.includes("Ah Meng"), "driver 漏了");
  check("🔴 老板自己打的「谁收的」没有出去", !flat.includes("Site foreman"), "received_by 漏了");
  check("🔴 一趟自己的 id 没有出去", !flat.includes(first.delivery_id), "delivery id 漏了");
  check("🔴 project id 没有出去", !flat.includes(P), "project id 漏了");
  check("而门牌是另一个号码", mine.ref !== first.delivery_id);

  /* ── ⑪ 签收挡住的 ────────────────────────────────────────────────────── */
  console.log("\n⑪ 签收挡住的");
  const { data: again } = await stranger.rpc("sign_delivery", {
    in_ref: ref, in_delivery_ref: mine.ref, in_name: "Someone else",
  });
  check("签过了不给再签", again === "signed", `${again}`);

  const { data: noName } = await stranger.rpc("sign_delivery", {
    in_ref: ref, in_delivery_ref: (seen.deliveries ?? []).find((d) => d.ref !== mine.ref)?.ref,
    in_name: "  ",
  });
  check("不写名字签不了", noName === "incomplete", `${noName}`);

  /* 🔴 别人家的门牌配这一张单的连结 —— 一定要挡。 */
  const { data: otherOrder } = await other.as.rpc("add_pipeline_record", {
    in_project_id: other.projectId, in_module_key: "orders",
    in_title: "Their order", in_party: "Nobody", in_amount_cents: 100,
  });
  const { data: otherRun } = await other.as.rpc("open_delivery_run", {
    in_record_id: otherOrder.id,
  });
  const { data: crossed } = await stranger.rpc("sign_delivery", {
    in_ref: ref, in_delivery_ref: otherRun.id, in_name: "Hacker",
  });
  check("🔴 拿别人家那一趟来签，签不了", crossed === "not_found", `${crossed}`);

  const { data: badRef } = await stranger.rpc("sign_delivery", {
    in_ref: crypto.randomUUID(), in_delivery_ref: mine.ref, in_name: "Hacker",
  });
  check("门牌不对，答案跟「不存在」一模一样", badRef === "not_found", `${badRef}`);

  const { data: rowsAsStranger } = await stranger.from("deliveries").select("id").limit(1);
  check("🔴 路人直接读那张表，一行都读不到", (rowsAsStranger ?? []).length === 0,
    `${(rowsAsStranger ?? []).length}`);

  /* ── ⑫ 收起一趟 ──────────────────────────────────────────────────────── */
  console.log("\n⑫ 收起一趟");
  const { error: signedArchErr } = await c.rpc("archive_delivery", { in_delivery_id: first.delivery_id });
  check("🔴 客人签过的那一趟收不掉", !!signedArchErr, "居然让它过了");

  /* ⚠️ 拿绝对数字比是错的 —— 第 ④ 段那张单也从同一件货上出过 50 包。
     **我第一版就是那样写的，红的是我的期望不是产品**（第七次）。
     要问的本来就是「收掉一趟之后，架上有没有变」。 */
  const before = await onHand(c, P, "Cement 50kg");
  const { data: arch, error: archErr } = await c.rpc("archive_delivery", { in_delivery_id: a1.id });
  check("没人签的收得掉", !archErr && !!arch?.archived_at, archErr?.message);
  const { data: left } = await c.rpc("deliveries_of", { in_record_id: order.id });
  check("收起来就不在清单上", !(left ?? []).some((r) => r.id === a1.id));
  check("🔴 而搬出去的货一件都没有自己回来", (await onHand(c, P, "Cement 50kg")) === before,
    `收之前 ${before} 收之后 ${await onHand(c, P, "Cement 50kg")}`);

  /* ── ⑬ 师傅那一边 ────────────────────────────────────────────────────── */
  console.log("\n⑬ 师傅看得到（送货的就是他）");
  const crew = await person("crew", []);
  await c.rpc("add_project_member", { in_email: crew.cred.email });
  const crewClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await crewClient.auth.signInWithPassword(crew.cred);
  const { data: crewRuns, error: crewErr } = await crewClient.rpc("deliveries_of", {
    in_record_id: order.id,
  });
  check("师傅看得到那几趟", !crewErr && (crewRuns ?? []).length >= 2,
    crewErr?.message ?? `${(crewRuns ?? []).length}`);
  const { data: crewRun, error: crewRunErr } = await crewClient.rpc("open_delivery_run", {
    in_record_id: order.id, in_driver: "Crew run",
  });
  check("师傅也开得了一趟", !crewRunErr && !!crewRun?.id, crewRunErr?.message);
} finally {
  await dropThrowaways(admin, made);
}

console.log(
  failed.length === 0
    ? `\n判：全过`
    : `\n判：${failed.length} 条没过 —— ${failed.join(" · ")}`,
);
process.exit(failed.length === 0 ? 0 : 1);
