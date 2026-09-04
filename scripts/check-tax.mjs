/**
 * 电子发票 · SST —— 用真的身分打。
 *
 * 🔴 这一支要守的第一条是**「没登记就不算税」**：
 *   一张写着「SST RM 0.00」的单，是在讲一件他没有资格讲的话，
 *   而那跟「这一单不含税」在纸上长得不一样。
 *
 * 🔴 第二条是那份结构化单据**要自己承认还没签章、还没送出去** ——
 *   一份看起来完整的东西，会让他以为已经报过税了。
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

const failed = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failed.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const made = [];
/** 马来西亚的今天，不是伺服器的。 */
const day = (n) => {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function person(tag, pages) {
  const cred = {
    email: `tax-${tag}-${Date.now()}@formae.test`,
    password: `Tax-${Date.now()}-x!`,
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
  await admin.from("projects").update({ business_name: `Hup Seng ${tag}` }).eq("id", proj.id);
  for (const k of pages) await as.rpc("add_project_page", { requested_key: k, new_title: k });
  return { as, cred, userId: user.user.id, projectId: proj?.id };
}

const missingOf = (rows, needle) =>
  (rows ?? []).some((r) => (r.what ?? "").includes(needle));

try {
  const shop = await person("shop",
    ["orders", "payments", "customers", "quotations"]);
  const other = await person("other", ["orders"]);
  const c = shop.as;
  const P = shop.projectId;
  if (!P) throw new Error("找不到那一家的专案");

  const { data: cust } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers",
    in_name: "Tan Sdn Bhd", in_kind: "company",
  });
  const { data: walkIn } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers",
    in_name: "Walk-in", in_kind: "person",
  });
  const { data: inv } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "Kitchen refit", in_party: "Tan Sdn Bhd",
    in_party_id: cust.id, in_amount_cents: 500000,
  });
  await c.rpc("set_record_lines", {
    in_record_id: inv.id,
    in_lines: [{ description: "Kitchen refit", amount_cents: 500000 }],
  });

  /* ── ① 🔴 没登记 SST 就不算税 ────────────────────────────────────────── */
  console.log("\n① 🔴 没登记 SST，就不给套一个税率");
  const { error: noRegErr } = await c.rpc("set_record_tax", { in_record_id: inv.id });
  check("🔴 没登记就不给用预设税率", !!noRegErr, "居然让它过了");
  check("而且讲得出为什么", /not registered for SST/.test(noRegErr?.message ?? ""),
    noRegErr?.message);

  const { data: rec0 } = await admin
    .from("pipeline_records").select("tax_rate").eq("id", inv.id).single();
  check("🔴 那一栏是空的，不是 0（两件不一样的事）", rec0?.tax_rate === null,
    `${rec0?.tax_rate}`);

  const { data: pay0 } = await c.rpc("einvoice_payload", { in_record_id: inv.id });
  check("🔴 所以那份单据上没有税额", Number(pay0?.totals?.taxCents) === 0
    && pay0?.totals?.taxRate === null, JSON.stringify(pay0?.totals));
  check("而且总额就是净额", Number(pay0?.totals?.grossCents) === 500000,
    `${pay0?.totals?.grossCents}`);

  /* 就算没登记，他自己讲明白也开得了 —— 有些行业本来就代收。 */
  const { error: explicitErr } = await c.rpc("set_record_tax", {
    in_record_id: inv.id, in_rate: 8,
  });
  check("他自己讲明白 8%，开得了", !explicitErr, explicitErr?.message);
  await c.rpc("set_record_tax", { in_record_id: inv.id, in_clear: true });

  /* ── ② 登记之后 ──────────────────────────────────────────────────────── */
  console.log("\n② 登记之后，预设那个税率才用得了");
  const { data: prof, error: profErr } = await c.rpc("set_tax_profile", {
    in_project_id: P,
    in_tin: "C12345678900", in_reg_no: "202601012345",
    in_msic_code: "43301", in_msic_name: "Renovation and repair",
    in_address_line: "12 Jalan Kebun", in_postcode: "41200",
    in_city: "Klang", in_state: "Selangor",
    in_phone: "03-3344 5566", in_email: "acc@hupseng.test",
    in_sst_no: "W10-1808-32000123", in_sst_from: day(-60),
  });
  check("档案存得进去", !profErr && prof?.tin === "C12345678900", profErr?.message);
  check("预设税率是 8%", Number(prof?.sst_rate) === 8, `${prof?.sst_rate}`);

  const { data: taxed, error: taxErr } = await c.rpc("set_record_tax", { in_record_id: inv.id });
  check("现在预设用得了", !taxErr && Number(taxed?.tax_rate) === 8,
    taxErr?.message ?? `${taxed?.tax_rate}`);

  const { data: pay1 } = await c.rpc("einvoice_payload", { in_record_id: inv.id });
  check("税额是算出来的：5000 × 8% = 400", Number(pay1?.totals?.taxCents) === 40000,
    `${pay1?.totals?.taxCents}`);
  check("总额 5400", Number(pay1?.totals?.grossCents) === 540000,
    `${pay1?.totals?.grossCents}`);

  /* 🔴 多加一行，税额跟着变 —— 那正是不存税额的理由。 */
  await c.rpc("set_record_lines", {
    in_record_id: inv.id,
    in_lines: [
      { description: "Kitchen refit", amount_cents: 500000 },
      { description: "Extra socket", amount_cents: 100000 },
    ],
  });
  const { data: pay2 } = await c.rpc("einvoice_payload", { in_record_id: inv.id });
  check("🔴 多加一行明细，税额自己跟着变（480，不是 400）",
    Number(pay2?.totals?.taxCents) === 48000, `${pay2?.totals?.taxCents}`);
  check("而税率那一栏一个字都没动", Number(pay2?.totals?.taxRate) === 8,
    `${pay2?.totals?.taxRate}`);

  /* ── ③ 还差什么 ──────────────────────────────────────────────────────── */
  console.log("\n③ 这张单开得出电子发票吗，还差什么");
  const { data: ready1, error: readyErr } = await c.rpc("einvoice_readiness", {
    in_record_id: inv.id,
  });
  check("问得出来", !readyErr, readyErr?.message);
  check("🔴 公司客户少了纳税人编号，讲出来", missingOf(ready1, "customer"),
    JSON.stringify(ready1));

  /* ⚠️ 参数叫 `in_id` 不是 `in_entry_id` —— 我第一版写错，
     於是那两条红看起来像产品没有读到客户的编号。**红的是我的呼叫**（第十次）。
     所以这一句现在会看错误，不只看结果。 */
  const { error: updErr } = await c.rpc("update_directory_entry", {
    in_id: cust.id, in_tax_id: "C98765432100", in_reg_no: "199901012345",
  });
  check("客户的编号补得进去", !updErr, updErr?.message);
  const { data: ready2 } = await c.rpc("einvoice_readiness", { in_record_id: inv.id });
  check("补上之后就不差了", (ready2 ?? []).length === 0, JSON.stringify(ready2));

  /* 🔴 一个 walk-in 不用纳税人编号 —— LHDN 有一个通用编号给他们。 */
  const { data: cash } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders",
    in_title: "Counter sale", in_party: "Walk-in",
    in_party_id: walkIn.id, in_amount_cents: 20000,
  });
  await c.rpc("set_record_lines", {
    in_record_id: cash.id, in_lines: [{ description: "Tap", amount_cents: 20000 }],
  });
  const { data: ready3 } = await c.rpc("einvoice_readiness", { in_record_id: cash.id });
  check("🔴 一个陌生人客户不用纳税人编号", (ready3 ?? []).length === 0,
    JSON.stringify(ready3));

  /* 缺档案的那一家，每一条都要讲得出来。 */
  const bare = await person("bare", ["orders", "customers"]);
  const { data: bareRec } = await bare.as.rpc("add_pipeline_record", {
    in_project_id: bare.projectId, in_module_key: "orders",
    in_title: "Job", in_party: "Someone", in_amount_cents: 100,
  });
  const { data: ready4 } = await bare.as.rpc("einvoice_readiness", { in_record_id: bareRec.id });
  check("🔴 什么都没填的时候，讲得出五件以上", (ready4 ?? []).length >= 5,
    `${(ready4 ?? []).length}`);
  check("而且每一条都有「还差什么」", (ready4 ?? []).every((r) => (r.missing ?? "") !== ""),
    JSON.stringify(ready4));
  check("🔴 用的是他看得懂的话，不是栏位名",
    !JSON.stringify(ready4).includes("TIN is required")
      && !JSON.stringify(ready4).includes("null"),
    JSON.stringify(ready4).slice(0, 200));

  /* ── ④ 那份结构化单据 ────────────────────────────────────────────────── */
  console.log("\n④ 那份要送去税局的单据");
  const { data: pay } = await c.rpc("einvoice_payload", { in_record_id: inv.id });
  check("我方带着 TIN · SSM · MSIC", pay?.supplier?.tin === "C12345678900"
    && pay?.supplier?.registrationNumber === "202601012345"
    && pay?.supplier?.msicCode === "43301", JSON.stringify(pay?.supplier));
  check("SST 号码在上面", pay?.supplier?.sstNumber === "W10-1808-32000123",
    `${pay?.supplier?.sstNumber}`);
  check("客户是一个结构，不是一行字",
    pay?.buyer?.name === "Tan Sdn Bhd" && pay?.buyer?.tin === "C98765432100",
    JSON.stringify(pay?.buyer));
  check("明细在上面", (pay?.lines ?? []).length === 2, `${(pay?.lines ?? []).length}`);
  check("币别是 MYR", pay?.currency === "MYR");
  check("单号不超过 50 字", (pay?.eInvoiceNumber ?? "").length <= 50);
  check("🔴 它自己承认还没签章", /not implemented/.test(
    pay?.notReadyBecause?.digitalSignature ?? ""), JSON.stringify(pay?.notReadyBecause));
  check("🔴 也承认还没送出去", /not implemented/.test(
    pay?.notReadyBecause?.submission ?? ""), JSON.stringify(pay?.notReadyBecause));

  /* 一张报价单没有型别代号 —— 它不是那四种任何一种。 */
  const { data: quote } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "Not agreed", in_party: "Tan Sdn Bhd", in_party_id: cust.id,
    in_amount_cents: 100000,
  });
  const { data: qPay } = await c.rpc("einvoice_payload", { in_record_id: quote.id });
  check("🔴 一张报价单没有单据型别（它不是发票）", qPay?.typeCode === null,
    `${qPay?.typeCode}`);

  /* ── ⑤ 他要报的那张表 ────────────────────────────────────────────────── */
  console.log("\n⑤ SST 那张表：只算真的收到的钱");
  const { data: ret0Rows } = await c.rpc("sst_return", {
    in_project_id: P, in_from: day(-30), in_to: day(0),
  });
  const ret0 = (ret0Rows ?? [])[0];
  check("有登记", ret0?.registered === true);
  check("🔴 一分钱都还没收，所以要报的是 0", Number(ret0?.tax_cents) === 0,
    `${ret0?.tax_cents}`);

  const { data: got } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_direction: "in", in_amount_cents: 300000,
    in_party: "Tan Sdn Bhd", in_party_id: cust.id,
  });
  await c.rpc("set_payment_allocations", {
    in_entry_id: got.id, in_rows: [{ record_id: inv.id, amount_cents: 300000 }],
  });
  const { data: ret1Rows } = await c.rpc("sst_return", {
    in_project_id: P, in_from: day(-30), in_to: day(0),
  });
  const ret1 = (ret1Rows ?? [])[0];
  check("收了三千，应课税是三千", Number(ret1?.taxable_cents) === 300000,
    `${ret1?.taxable_cents}`);
  check("🔴 要报的税是 3000 × 8% = 240", Number(ret1?.tax_cents) === 24000,
    `${ret1?.tax_cents}`);

  /* 🔴 冲正之后要掉回去。 */
  await c.rpc("reverse_ledger_entry", { in_entry_id: got.id });
  const { data: ret2Rows } = await c.rpc("sst_return", {
    in_project_id: P, in_from: day(-30), in_to: day(0),
  });
  check("🔴 冲正之后掉回 0", Number((ret2Rows ?? [])[0]?.tax_cents) === 0,
    `${(ret2Rows ?? [])[0]?.tax_cents}`);

  /* 没登记的那一家：回 registered = false，不是一张 0 的报表。 */
  const { data: bareRet } = await bare.as.rpc("sst_return", {
    in_project_id: bare.projectId, in_from: day(-30), in_to: day(0),
  });
  check("🔴 没登记的回「没登记」，不是一张 0 的表",
    (bareRet ?? [])[0]?.registered === false, JSON.stringify((bareRet ?? [])[0]));

  /* ── ⑥ 谁看得到 ──────────────────────────────────────────────────────── */
  console.log("\n⑥ 谁看得到");
  const { error: crossErr } = await other.as.rpc("einvoice_payload", { in_record_id: inv.id });
  check("别人家的单据读不到", !!crossErr, "居然让它过了");
  const { error: crossProfErr } = await other.as.rpc("set_tax_profile", {
    in_project_id: P, in_tin: "HACKED",
  });
  check("别人改不了我的税务档案", !!crossProfErr, "居然让它过了");
  const { data: stillMine } = await admin
    .from("tax_profile").select("tin").eq("project_id", P).single();
  check("（控制组）而且它真的没有被改", stillMine?.tin === "C12345678900", stillMine?.tin);

  const crew = await person("crew", []);
  await c.rpc("add_project_member", { in_email: crew.cred.email });
  const crewClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await crewClient.auth.signInWithPassword(crew.cred);
  const { error: crewPayErr } = await crewClient.rpc("einvoice_payload", { in_record_id: inv.id });
  check("🔴 师傅读不到那份单据（上面有税跟金额）", !!crewPayErr, "居然让它过了");
  const { data: crewProf } = await crewClient.from("tax_profile").select("tin").eq("project_id", P);
  check("🔴 师傅读不到税务档案", (crewProf ?? []).length === 0, `${(crewProf ?? []).length}`);
  const { data: ownerProf } = await c.from("tax_profile").select("tin").eq("project_id", P);
  check("（控制组）老板自己读得到", (ownerProf ?? []).length === 1, `${(ownerProf ?? []).length}`);
} finally {
  await dropThrowaways(admin, made);
}

console.log(
  failed.length === 0
    ? `\n判：全过`
    : `\n判：${failed.length} 条没过 —— ${failed.join(" · ")}`,
);
process.exit(failed.length === 0 ? 0 : 1);
