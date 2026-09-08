/**
 * 一个装修承包商，从客人在官网问价到收完尾款 —— 走一次，**数他要动手几次**。
 *
 * ── 为什么是数动手，不是数功能（2026-09-06）─────────────────────────
 * 那份「十三条链」的报告排的第五步写着:
 *     「**目标每条链他动手 ≤ 1 次，今天中位数是 3**」
 * 而它自己也承认那个数字是**数画面动作数出来的**，没有一个真客户走过。
 *
 * 这一支把那个数字变成跑得出来的:
 *   每一次**老板非自己按不可**的呼叫算一次动手。
 *   系统自己接下去的（触发器 · 顺手做掉的第二件）**不算**。
 *
 * ⚠️ 它不判对错，它**印一份读数**。「几次算多」是他的判断，不是我的门槛。
 *
 * ⚠️ 名字全部是编的（[任务 136](../docs/founder-tasks.md#136)：
 * 真的名字搬进库里，责任就到我们身上）。
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
  const email = `reno-${tag}-${Date.now()}@formae.test`;
  const password = `Reno-${Date.now()}-x!`;
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

/* 一次「他动手」。每一支都看回传的错 ——
   一句不看错误的呼叫，跟一句没有呼叫过的，在报告里长得一模一样。 */
async function act(C, what, fn, args) {
  acts += 1;
  const { data, error } = await C.rpc(fn, args);
  if (error) {
    notes.push(`🔴 ${what}：${error.message}`);
    return null;
  }
  return data;
}
/* 系统自己接下去的那一段 —— 不算他动手，但要验它真的发生了。 */
const node = (name, hands, ok, detail) =>
  chain.push({ name, hands, ok, detail });

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
  await C.rpc("set_project_style", { new_style: "ledger" });
  await admin.from("projects")
    .update({ business_name: "Hup Seng Renovation", site_slug: `hupseng-${Date.now()}` })
    .eq("id", P);
  for (const k of ["quotations", "customers", "payments", "purchases",
                   "suppliers", "inventory", "expenses", "website"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  const startedAt = acts;

  /* ── ① 客人在官网问价 ─────────────────────────────────────── */
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } });
  const { data: project } = await admin
    .from("projects").select("site_slug, site_published").eq("id", P).single();
  await admin.from("site_enquiries").insert({
    project_id: P, name: "Mrs Lim", contact: "017-555 1234",
    answers: { message: "Bathroom, 3 rooms" },
  });
  const { data: enq } = await admin
    .from("site_enquiries").select("id").eq("project_id", P).single();
  node("客人在官网问价", 0, !!enq?.id, "陌生人做的，他不用动手");

  /* ── ② 一按变单 ───────────────────────────────────────────── */
  const before = acts;
  const made = await act(C, "询价变单", "convert_enquiry", {
    in_enquiry_id: enq.id,
  });
  /* ⚠️ 它回的是**一张表**（一行），不是一行 ——
     第二十八次红的是我的道具，而那一次拿到的 jobId
     是整个阵列，于是后面每一支都报「不是一个 uuid」。 */
  const madeRow = Array.isArray(made) ? made[0] : made;
  const jobId = madeRow?.record_id ?? madeRow?.id ?? null;
  node("询价 → 一张报价单", acts - before, !!jobId,
    jobId ? "一次，而且客户也建起来了" : "convert_enquiry 打不到");

  if (!jobId) throw new Error("没有报价单，后面走不下去");

  /* ── ③ 逐项 · 分期 · 有效期 ───────────────────────────────── */
  let n = acts;
  await act(C, "写逐项", "set_record_lines", {
    in_record_id: jobId,
    in_lines: [
      { description: "Bathroom waterproofing", qty: "1", unit: "job", amount_cents: "1200000" },
      { description: "Tiling 3 rooms", qty: "3", unit: "rooms", amount_cents: "2400000" },
    ],
  });
  await act(C, "写分期", "set_record_terms", {
    in_record_id: jobId,
    in_terms: [
      { description: "订金", portion: 30, due_on: day(-1) },
      { description: "完工", portion: 70, due_on: day(-30) },
    ],
  });
  node("报价单填好（逐项 ＋ 分期）", acts - n, true, "两次");

  /* ── ④ 发给客人、客人按同意 ───────────────────────────────── */
  n = acts;
  const share = await act(C, "开一条公开连结", "share_record", {
    in_record_id: jobId,
  });
  /* ⚠️ 那一栏叫 `share_ref`，不是 `public_ref` ——
     第二十九次红的是我又猜了一个名字。 */
  const shareRow = Array.isArray(share) ? share[0] : share;
  const ref = shareRow?.share_ref ?? null;
  let agreed = false;
  if (ref) {
    /* 🔴 它把失败回在**回传值**里（`bad_answer` · `answered` …），
       不是抛一个错。第三十次红的是我的道具，而那一次
       **它看起来是绿的** —— 我只看了 error。
       一支把失败写在回传值里的函式，对只看 error 的代码
       跟一支成功的函式长得一模一样。
       ⚠️ 而那个词是 `accepted`，不是 `agreed`。 */
    const { data: said, error: agreeErr } = await anon.rpc("answer_shared_record", {
      in_ref: ref, in_answer: "accepted", in_name: "Mrs Lim",
    });
    agreed = !agreeErr && said === "ok";
    if (agreeErr) notes.push(`🔴 客人按同意：${agreeErr.message}`);
    else if (said !== "ok") notes.push(`🔴 客人按同意：它回的是「${said}」`);
  }
  node("发给客人 → 客人按同意", acts - n, agreed,
    agreed ? "一次（客人那一按不算他动手）" : "那条连结或者那颗同意打不到");

  /* ── ⑤ 他知道客人同意了吗 ─────────────────────────────────── */
  const { data: sig } = await C.rpc("nudges_due", { in_project_id: P });
  const told = (sig ?? []).some((r) => r.kind === "agreed_unpaid");
  node("🔴 系统告诉他「客人同意了、订金还没进来」", 0, told,
    told ? "讯号算得出来，而「今天」那一页在读它" : "讯号没有出现");

  /* ── ⑥ 收订金 ─────────────────────────────────────────────── */
  n = acts;
  const paid = await act(C, "收订金", "add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 1_080_000, in_party: "Mrs Lim", in_against_id: jobId,
  });
  const { data: debts } = await C.rpc("party_debts", { in_project_id: P });
  const owing = (debts ?? [])[0];
  node("收订金", acts - n, !!paid,
    `一次；分摊自己写好了，还欠 RM ${((owing?.owed_cents ?? 0) / 100).toFixed(0)}`);

  /* ── ⑦ 叫货 → 收货 → 架上 ─────────────────────────────────── */
  n = acts;
  const supplier = await act(C, "建供应商", "add_directory_entry", {
    in_project_id: P, in_module_key: "suppliers", in_name: "Seng Huat Hardware",
  });
  const item = await act(C, "建货品", "add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Cement 50kg",
    in_unit: "bags", in_reorder_at: 20,
  });
  const po = await act(C, "开进货单", "add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "Cement + sand",
    in_party: "Seng Huat Hardware", in_party_id: supplier?.id,
    in_amount_cents: 185_000,
  });
  const lines = await act(C, "写进货明细", "set_record_lines", {
    in_record_id: po?.id,
    in_lines: [{ description: "Cement 50kg", qty: "100", unit: "bags",
      item_id: item?.id, amount_cents: "185000" }],
  });
  await act(C, "按货到了", "receive_purchase", { in_record_id: po?.id });
  const { data: shelf } = await C.from("stock_by_branch")
    .select("item_id, on_hand").eq("project_id", P);
  const onHand = Number((shelf ?? []).find((r) => r.item_id === item?.id)?.on_hand ?? 0);
  node("叫货 → 收货 → 架上有货", acts - n, onHand === 100,
    `五次（供应商 · 货品 · 单 · 明细 · 收货）；架上 ${onHand}`);

  /* ── ⑦b 🔴 第二次叫同一家同一件货 ────────────
     上面那五次里有两次是**一辈子只做一次**的（建供应商 · 建货品）。
     把它们算进「叫一次货要几次」是在把数字抬高 ——
     真正要量的是**他下个礼拜再叫一车要几次**。 */
  n = acts;
  const po2 = await act(C, "再开一张进货单", "add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "Cement again",
    in_party: "Seng Huat Hardware", in_party_id: supplier?.id,
    in_amount_cents: 185_000,
  });
  await act(C, "写明细", "set_record_lines", {
    in_record_id: po2?.id,
    in_lines: [{ description: "Cement 50kg", qty: "100", unit: "bags",
      item_id: item?.id, amount_cents: "185000" }],
  });
  await act(C, "按货到了", "receive_purchase", { in_record_id: po2?.id });
  const { data: shelf2 } = await C.from("stock_by_branch")
    .select("item_id, on_hand").eq("project_id", P);
  const onHand2 = Number((shelf2 ?? []).find((r) => r.item_id === item?.id)?.on_hand ?? 0);
  /* 而那三次里有一次（写明细）今天已经不用他打字了 ——
     `last_lines_for_party` 把上一张那几行调得出来（任务 150）。 */
  /* ⚠️ 它的参数叫 `p_*`，不是这个仓库到处在用的 `in_*` ——
     第三十一次红的是我又猜了一组名字，而它回了零行。 */
  const { data: lastLines, error: llErr } = await C.rpc("last_lines_for_party", {
    p_project_id: P, p_module_key: "purchases", p_party_id: supplier?.id,
  });
  if (llErr) notes.push(`🔴 上一张调不出来：${llErr.message}`);
  node("🔴 第二次叫同一家同一件货", acts - n, onHand2 === 200,
    `三次（单 · 明细 · 收货）；架上 ${onHand2}；`
    + `而明细那一次他不用打字 —— 上一张调得出 ${(lastLines ?? []).length} 行`);

  /* ── ⑧ 工地照 · 下一步 ────────────────────────────────────── */
  n = acts;
  await act(C, "挂一张工地照", "add_record_photo", {
    in_record_id: jobId, in_path: `jobs/${P}/day1.jpg`,
  });
  await act(C, "写下一步", "set_follow_up", {
    in_record_id: jobId, in_what: "叫云石厂来量尺寸",
  });
  node("工地照 ＋ 下一步", acts - n, true, "两次");

  /* ── ⑨ 完工、收尾款、对帐 ─────────────────────────────────── */
  n = acts;
  await act(C, "收尾款", "add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 2_520_000, in_party: "Mrs Lim", in_against_id: jobId,
  });
  const { data: debts2 } = await C.rpc("party_debts", { in_project_id: P });
  node("收尾款 → 那张单结清", acts - n, (debts2 ?? []).length === 0,
    (debts2 ?? []).length === 0 ? "一次；「谁欠我钱」自己空了"
      : `还挂着 ${(debts2 ?? []).length} 笔`);

  /* ── ⑩ 这个月赚多少 ───────────────────────────────────────── */
  await act(C, "记一笔材料开销", "add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses", in_direction: "out",
    in_amount_cents: 185_000, in_party: "Seng Huat Hardware",
    in_category: "材料", in_job_id: jobId,
  });
  /* ⚠️ **赚多少那一段没有资料库函式** ——
     它算在 `lib/portal/profit.ts`（画面那一边）。
     这里量得了的是它的原料：**那一笔开销有没有挂到这一单上**。 */
  const { data: costRows } = await C.from("ledger_entries")
    .select("id, amount_cents, job_id").eq("project_id", P).eq("direction", "out");
  const onJob = (costRows ?? []).filter((r) => r.job_id === jobId);
  node("这一单的成本挂得上去", 1, onJob.length === 1,
    onJob.length === 1
      ? `一次；材料 RM ${(onJob[0].amount_cents / 100).toFixed(0)} 挂在这一单上`
      : `${onJob.length} 笔挂在这一单上`);

  /* ── ⑪ 介绍费 ─────────────────────────────────────────────── */
  n = acts;
  const ahming = await act(C, "建介绍人", "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ah Ming",
  });
  await act(C, "记这一单是谁介绍的", "set_record_referral", {
    in_record_id: jobId, in_referrer_id: ahming?.id, in_portion: 3,
  });
  const { data: owed } = await C.rpc("referrals_owing", { in_project_id: P });
  node("老带新", acts - n, (owed ?? []).length === 1,
    `两次；该给 RM ${((owed?.[0]?.owing_cents ?? 0) / 100).toFixed(0)}`);

  /* ── 读数 ─────────────────────────────────────────────────── */
  console.log("\n一个装修承包商，从客人问价到收完尾款\n");
  let broken = 0;
  for (const c of chain) {
    console.log(`  ${c.ok ? "  " : "🔴"} ${String(c.hands).padStart(2)} 次  ${c.name}`);
    console.log(`         ${c.detail}`);
    if (!c.ok) broken += 1;
  }
  const hands = acts - startedAt;
  console.log(`\n  一共动手 ${hands} 次 · ${chain.length} 节 · ${broken} 节断掉`);
  const median = [...chain.map((c) => c.hands)].sort((a, b) => a - b)[
    Math.floor(chain.length / 2)];
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
