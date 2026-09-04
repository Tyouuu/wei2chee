/**
 * 老带新 —— 谁介绍的，答应了多少，给了没有。**用真的登入身分打。**
 *
 * ⚠️ 这一支要守的两件，都不是「功能会不会动」：
 *
 *   ① **师傅看不到他老板给了谁多少介绍费** —— 那是钱
 *   ② **「给了没有」不是一个旗子，是从他自己的帐上加出来的** ——
 *      所以它跟他的帐永远不会打架，而一个存起来的旗子会
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

async function signIn(cred) {
  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error } = await as.auth.signInWithPassword(cred);
  if (error) throw new Error(`sign-in: ${error.message}`);
  return as;
}

async function person(tag) {
  const cred = { email: `ref-${tag}-${Date.now()}@formae.test`, password: `Ref-${Date.now()}-x!` };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email, password: cred.password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);
  return { cred, id: user.user.id, as: await signIn(cred) };
}

const RM = (sen) => `RM ${(sen / 100).toLocaleString("en-MY")}`;

try {
  const boss = await person("boss");
  const c = boss.as;
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  for (const k of ["quotations", "customers", "payments", "expenses"]) {
    await c.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const { data: ahMing } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ah Ming",
    in_whatsapp: "012-345 6789",
  });
  const { data: tan } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mr Tan",
  });

  /* 阿明介绍来的那一单：RM 20,000，答应给他 3%。 */
  const { data: job } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "Taman Desa reno", in_party: "Mr Tan", in_party_id: tan.id,
    in_amount_cents: 2000000,
  });

  /* ── ① 写下来是谁介绍的 ────────────────────────────────────────────── */
  console.log("\n① 写下来是谁介绍的");
  const { data: set1, error: e1 } = await c.rpc("set_record_referral", {
    in_record_id: job.id, in_referrer_id: ahMing.id, in_portion: 3,
  });
  check("写得进去", !e1 && set1?.referrer_id === ahMing.id, e1?.message);

  const { error: bothErr } = await c.rpc("set_record_referral", {
    in_record_id: job.id, in_referrer_id: ahMing.id, in_portion: 3, in_amount_cents: 30000,
  });
  check("比例跟金额两个都给要挡", !!bothErr, "两个都收下了");
  const { error: neitherErr } = await c.rpc("set_record_referral", {
    in_record_id: job.id, in_referrer_id: ahMing.id,
  });
  check("一个都不给要挡", !!neitherErr, "什么都没讲也收下了");
  const { error: selfErr } = await c.rpc("set_record_referral", {
    in_record_id: job.id, in_referrer_id: tan.id, in_portion: 3,
  });
  check("🔴 客人自己介绍自己要挡（那一格挑的是同一份名册）", !!selfErr, "居然收下了");

  const { data: stillMing } = await admin
    .from("pipeline_records").select("referrer_id, referral_portion").eq("id", job.id).single();
  check("被挡下来之后，原本写好的那一笔还在",
    stillMing?.referrer_id === ahMing.id && Number(stillMing?.referral_portion) === 3,
    JSON.stringify(stillMing));

  /* ── ② 一分钱都还没收 ──────────────────────────────────────────────── */
  console.log("\n② 客人一分钱都还没付");
  const { data: owe0 } = await c.rpc("referrals_owing", { in_project_id: P });
  check("阿明在清单上", (owe0 ?? []).length === 1 && owe0[0].name === "Ah Ming",
    JSON.stringify(owe0?.map((r) => r.name)));
  check("🔴 答应给他的是 RM 0 —— 客人没付钱，介绍费也还没长出来",
    Number(owe0?.[0]?.promised_cents) === 0, `${owe0?.[0]?.promised_cents}`);
  check("带得出他的 WhatsApp（他要打的就是这一通）",
    (owe0?.[0]?.whatsapp ?? "").includes("012"), `${owe0?.[0]?.whatsapp}`);

  /* ── ③ 客人付了一半 ────────────────────────────────────────────────── */
  console.log("\n③ 客人付了 RM 10,000");
  const { data: pay1 } = await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 1000000, in_party: "Mr Tan", in_party_id: tan.id,
    in_against_id: job.id,
  });
  void pay1;
  const { data: owe1 } = await c.rpc("referrals_owing", { in_project_id: P });
  check(`🔴 介绍费按**收到的钱**算：${RM(1000000)} 的 3% = ${RM(30000)}`,
    Number(owe1?.[0]?.promised_cents) === 30000, `${owe1?.[0]?.promised_cents}`);
  check("还没给出去", Number(owe1?.[0]?.paid_cents) === 0, `${owe1?.[0]?.paid_cents}`);
  check("还欠阿明 RM 300", Number(owe1?.[0]?.owing_cents) === 30000, `${owe1?.[0]?.owing_cents}`);

  /* 🔴 没有人替他记一笔开销。 */
  const { data: spent } = await admin
    .from("ledger_entries").select("id").eq("project_id", P).eq("direction", "out");
  check("🔴 没有任何东西替他记一笔他还没答应要给的钱",
    (spent ?? []).length === 0, `${spent?.length} 笔开销`);

  /* ── ④ 他真的给了 ──────────────────────────────────────────────────── */
  console.log("\n④ 他给了阿明 RM 300");
  await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "expenses", in_direction: "out",
    in_amount_cents: 30000, in_party: "Ah Ming", in_party_id: ahMing.id,
    in_job_id: job.id, in_category: "Referral",
  });
  const { data: owe2 } = await c.rpc("referrals_owing", { in_project_id: P });
  check("🔴 「给了多少」是从他自己的帐上加出来的，不是一个旗子",
    Number(owe2?.[0]?.paid_cents) === 30000, `${owe2?.[0]?.paid_cents}`);
  check("不欠了", Number(owe2?.[0]?.owing_cents) === 0, `${owe2?.[0]?.owing_cents}`);

  /* 客人再付一半 —— 欠的自己长回来。 */
  await c.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 1000000, in_party: "Mr Tan", in_party_id: tan.id,
    in_against_id: job.id,
  });
  const { data: owe3 } = await c.rpc("referrals_owing", { in_project_id: P });
  check("客人付清了，欠阿明的自己长回 RM 300",
    Number(owe3?.[0]?.promised_cents) === 60000 &&
    Number(owe3?.[0]?.owing_cents) === 30000,
    `${owe3?.[0]?.promised_cents} · ${owe3?.[0]?.owing_cents}`);

  /* ── ⑤ 冲正 ────────────────────────────────────────────────────────── */
  console.log("\n⑤ 那一笔付款冲正掉");
  const { data: pays } = await admin
    .from("ledger_entries").select("id, amount_cents")
    .eq("project_id", P).eq("direction", "in").order("created_at");
  await c.rpc("reverse_ledger_entry", { in_entry_id: pays[0].id });
  const { data: owe4 } = await c.rpc("referrals_owing", { in_project_id: P });
  check("🔴 退回去的钱不算 —— 介绍费跟着掉回 RM 300",
    Number(owe4?.[0]?.promised_cents) === 30000, `${owe4?.[0]?.promised_cents}`);

  /* ── ⑥ 写死的金额 ──────────────────────────────────────────────────── */
  console.log("\n⑥ 一单给 RM 500，不看比例");
  const { data: job2 } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "Kitchen only", in_party: "Someone", in_amount_cents: 800000,
  });
  await c.rpc("set_record_referral", {
    in_record_id: job2.id, in_referrer_id: ahMing.id, in_amount_cents: 50000,
  });
  const { data: owe5 } = await c.rpc("referrals_owing", { in_project_id: P });
  check("🔴 写死的金额不吃「收到的钱」那一条（那是他答应的一个数字）",
    Number(owe5?.[0]?.promised_cents) === 30000 + 50000,
    `${owe5?.[0]?.promised_cents}`);
  check("两单都算他的", owe5?.[0]?.jobs === 2, `${owe5?.[0]?.jobs}`);

  const { data: his } = await c.rpc("referred_jobs", {
    in_project_id: P, in_referrer_id: ahMing.id,
  });
  check("看得出是哪两单", (his ?? []).length === 2,
    JSON.stringify((his ?? []).map((r) => r.doc_no)));

  /* ── ⑦ 清掉 ────────────────────────────────────────────────────────── */
  console.log("\n⑦ 清掉");
  await c.rpc("set_record_referral", { in_record_id: job2.id, in_referrer_id: null });
  const { data: cleared } = await admin
    .from("pipeline_records")
    .select("referrer_id, referral_portion, referral_amount_cents").eq("id", job2.id).single();
  check("🔴 三栏一起走（留一个没有人的比例，是一笔没有收款人的钱）",
    !cleared?.referrer_id && !cleared?.referral_portion && !cleared?.referral_amount_cents,
    JSON.stringify(cleared));

  /* 收起来的单不算。 */
  await c.rpc("set_pipeline_archived", { in_id: job.id, in_archived: true });
  const { data: oweGone } = await c.rpc("referrals_owing", { in_project_id: P });
  check("单收起来了，那一笔介绍费也不再挂着", (oweGone ?? []).length === 0,
    JSON.stringify(oweGone?.map((r) => r.name)));
  await c.rpc("set_pipeline_archived", { in_id: job.id, in_archived: false });

  /* ── ⑧ 🔴 师傅 ─────────────────────────────────────────────────────── */
  console.log("\n⑧ 🔴 师傅");
  const worker = await person("worker");
  await c.rpc("add_project_member", { in_email: worker.cred.email });
  const w = await signIn(worker.cred);

  const { data: wSees } = await w.rpc("referrals_owing", { in_project_id: P });
  check("🔴 师傅算不出老板给了谁多少介绍费", (wSees ?? []).length === 0, `${wSees?.length}`);
  const { data: wJobs } = await w.rpc("referred_jobs", {
    in_project_id: P, in_referrer_id: ahMing.id,
  });
  check("🔴 师傅也看不出是哪几单", (wJobs ?? []).length === 0, `${wJobs?.length}`);
  const { error: wSet } = await w.rpc("set_record_referral", {
    in_record_id: job.id, in_referrer_id: ahMing.id, in_portion: 10,
  });
  check("🔴 师傅改不了答应给多少", !!wSet, "居然改得了");

  /* 控制组 —— 没有这一条，上面三条量的是空气。 */
  const { data: bossSees } = await c.rpc("referrals_owing", { in_project_id: P });
  check("而老板自己看得到（控制组）", (bossSees ?? []).length === 1,
    `${bossSees?.length}`);

  /* ── ⑨ 别人家 ──────────────────────────────────────────────────────── */
  console.log("\n⑨ 别人家");
  const other = await person("other");
  const { data: oSees } = await other.as.rpc("referrals_owing", { in_project_id: P });
  check("别人家看不到", (oSees ?? []).length === 0, `${oSees?.length}`);
  const { error: oSet } = await other.as.rpc("set_record_referral", {
    in_record_id: job.id, in_referrer_id: ahMing.id, in_portion: 50,
  });
  check("别人家写不进去", !!oSet, "居然写得进去");
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${failed.length === 0 ? "全过" : `${failed.length} 条没过`}`);
process.exit(failed.length ? 1 : 0);
