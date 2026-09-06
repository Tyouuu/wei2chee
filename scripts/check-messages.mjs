/**
 * 「发过什么」那一份帐 —— 用真的登入身分打一次每一支。
 *
 * 🔴 这一支存在的理由，是我今天下午自己讲错的一句话:
 *   我顶回去说「那张表不用建，因为没有真的写它的人」——
 *   而他四十分钟前就拍板了 `現在就要對客戶開放就是兩個都開放`（任务 219）。
 *   讲给客人听的那一句**只在那一刻为真、不讲就丢掉**，那正是要记下来的东西。
 *
 * 它守四件，而第一件是这一整张表的形状:
 *   ① **开关挡的是「以后自动去发」，不是「记下他已经发过的」** ——
 *      一个因为开关关着而拒绝记下事实的系统，是在丢掉事实
 *   ② 按两下只留一行（那是他在客人面前会做的事）
 *   ③ **只有老板** —— body 是自由文字，里面常常有钱，遮不掉
 *   ④ 那一份共用的写入 **一个人都打不到**
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";

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
  const email = `msg-${tag}-${stamp}@formae.test`;
  const password = `Msg-${stamp}-x!`;
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

/* 🔴 一次被中断的跑会留下帐号，而没有任何东西会讲（任务 165 · 196）。
   接三个讯号，EPIPE 那个最容易漏 —— 把输出接给 head 就会走这条。 */
dropThrowawayOnExit(admin, () => people[people.length - 1]);

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  for (const k of ["quotations", "customers", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  const { data: cust } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Lim",
  });
  const { data: job } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "Bathroom",
    in_party: "Mrs Lim", in_party_id: cust.id, in_amount_cents: 4_850_000,
  });

  /* ── ① 他亲手发出去了，记一笔 ───────────────────────────────── */
  console.log("\n① 他亲手发出去了，记一笔");
  const WORDS = "陈太太，这是你那张浴室的报价 RM 48,500，看看有没有问题。";
  const { data: m1, error: e1 } = await C.rpc("record_message_sent", {
    in_project_id: P, in_audience: "customer", in_kind: "quote_sent",
    in_body: WORDS, in_subject_id: job.id, in_party_id: cust.id,
  });
  check("记得下来", !e1 && !!m1?.id, e1?.message);
  check("状态是「发过了」", m1?.status === "sent", `${m1?.status}`);
  check("盖了时间章", !!m1?.sent_at, `${m1?.sent_at}`);
  check("而且记得是谁按的", m1?.sent_by === boss.id, `${m1?.sent_by}`);
  check("🔴 原话一个字都没改", m1?.body === WORDS, `${m1?.body}`);

  const { error: eNoOne } = await C.rpc("record_message_sent", {
    in_project_id: P, in_audience: "nobody", in_kind: "x", in_body: "hi",
  });
  check("讲给谁听要讲清楚", !!eNoOne, "居然让它过了");

  const { error: eEmpty } = await C.rpc("record_message_sent", {
    in_project_id: P, in_audience: "owner", in_kind: "x", in_body: "   ",
  });
  check("一句没有字的讯息不是讯息", !!eEmpty, "居然让它过了");

  /* 按两下 —— 他在客人面前会做的事。 */
  const KEY = crypto.randomUUID();
  const twice = [];
  for (let i = 0; i < 2; i += 1) {
    const { data } = await C.rpc("record_message_sent", {
      in_project_id: P, in_audience: "customer", in_kind: "statement",
      in_body: "上个月的对帐单", in_party_id: cust.id, in_idempotency_key: KEY,
    });
    twice.push(data?.id);
  }
  check("按两下只留一行", twice[0] && twice[0] === twice[1], JSON.stringify(twice));

  /* ── ② 🔴 开关挡的是「以后自动去发」，不是「记下已经发过的」 ── */
  console.log("\n② 🔴 开关挡的是自动发，不是挡记录");
  const { data: q1, error: qe1 } = await C.rpc("queue_message", {
    in_project_id: P, in_audience: "customer", in_kind: "booking_reminder",
    in_body: "明天三点见", in_party_id: cust.id,
  });
  check("从来没碰过开关 → 两边都是开的", !qe1 && q1?.status === "queued",
    qe1?.message ?? `${q1?.status}`);
  check("排着的那一行没有时间章，也没有人按过",
    q1 && q1.sent_at === null && q1.sent_by === null,
    `${q1?.sent_at} / ${q1?.sent_by}`);

  const { data: st1, error: se1 } = await C.rpc("set_message_settings", {
    in_project_id: P, in_to_customer: false,
  });
  check("关得掉发给客人那一边", !se1 && st1?.to_customer === false, se1?.message);
  check("🔴 没给的那一个不动（null 是「别碰」不是「关掉」）",
    st1?.to_owner === true, `${st1?.to_owner}`);

  const { error: qe2 } = await C.rpc("queue_message", {
    in_project_id: P, in_audience: "customer", in_kind: "booking_reminder",
    in_body: "后天三点见", in_party_id: cust.id,
  });
  check("🔴 关了就拒绝，不是静静吞掉", !!qe2, "居然让它过了");

  const { data: q3, error: qe3 } = await C.rpc("queue_message", {
    in_project_id: P, in_audience: "owner", in_kind: "quote_expiring",
    in_body: "陈太太那张报价明天到期",
  });
  check("而发给他自己那一边照旧", !qe3 && q3?.status === "queued", qe3?.message);

  const { data: m2, error: e2b } = await C.rpc("record_message_sent", {
    in_project_id: P, in_audience: "customer", in_kind: "statement",
    in_body: "我刚刚自己按 WhatsApp 发给她了", in_party_id: cust.id,
  });
  check("🔴 开关关着，他自己发过的还是记得下来", !e2b && m2?.status === "sent",
    e2b?.message);

  await C.rpc("set_message_settings", { in_project_id: P, in_to_customer: true });

  /* ── ③ 投递那一段回来讲结果 ─────────────────────────────────── */
  console.log("\n③ 投递回来讲结果");
  const { data: sent, error: se2 } = await C.rpc("mark_message_sent", {
    in_message_id: q1.id, in_channel: "whatsapp",
  });
  check("发出去了", !se2 && sent?.status === "sent", se2?.message);
  check("这一次有人按了（自动那一段以后是 null，这一段不是）",
    sent?.sent_by === boss.id, `${sent?.sent_by}`);
  const { data: again } = await C.rpc("mark_message_sent", { in_message_id: q1.id });
  check("再讲一次不会把时间章往后推", again?.sent_at === sent?.sent_at,
    `${again?.sent_at} vs ${sent?.sent_at}`);

  const { data: failed, error: fe } = await C.rpc("mark_message_failed", {
    in_message_id: q3.id, in_reason: "没有号码",
  });
  check("发不出去也讲得出为什么",
    !fe && failed?.status === "failed" && failed?.fail_reason === "没有号码",
    fe?.message ?? JSON.stringify(failed));

  /* ── ④ 🔴 只有老板 ────────────────────────────────────────── */
  console.log("\n④ 🔴 只有老板");
  const crew = await person("crew");
  const { error: memErr } = await C.rpc("add_project_member", { in_email: crew.email });
  check("控制组：那个师傅真的进了这一家", !memErr, memErr?.message);
  const W = crew.client;

  const { data: bossSees } = await C.from("messages").select("id");
  check("控制组：老板自己看得到", (bossSees ?? []).length >= 4,
    `${bossSees?.length} 行`);
  const { data: crewSees } = await W.from("messages").select("id");
  check("🔴 师傅一行都读不到", (crewSees ?? []).length === 0,
    `${crewSees?.length} 行`);

  const { error: crewWrite } = await W.rpc("record_message_sent", {
    in_project_id: P, in_audience: "customer", in_kind: "x", in_body: "hi",
  });
  check("🔴 师傅也写不进去", !!crewWrite, "居然让它过了");

  const { error: crewSwitch } = await W.rpc("set_message_settings", {
    in_project_id: P, in_to_customer: false,
  });
  check("🔴 师傅关不掉那个开关", !!crewSwitch, "居然让它过了");

  const { data: crewSettings } = await W.from("message_settings").select("project_id");
  check("师傅也读不到那个开关", (crewSettings ?? []).length === 0,
    `${crewSettings?.length} 行`);

  /* ── ⑤ 别人家 ─────────────────────────────────────────────── */
  console.log("\n⑤ 别人家");
  const other = await person("other");
  const O = other.client;
  await O.rpc("set_project_style", { new_style: "ledger" });
  const { data: theirs } = await O.from("messages").select("id");
  check("🔴 另一家一行都读不到", (theirs ?? []).length === 0, `${theirs?.length} 行`);
  const { error: crossWrite } = await O.rpc("record_message_sent", {
    in_project_id: P, in_audience: "owner", in_kind: "x", in_body: "hi",
  });
  check("🔴 写不进别人家", !!crossWrite, "居然让它过了");
  const { error: crossMark } = await O.rpc("mark_message_sent", {
    in_message_id: q1.id,
  });
  check("🔴 也动不了别人家那一行", !!crossMark, "居然让它过了");
  const { error: crossSwitch } = await O.rpc("set_message_settings", {
    in_project_id: P, in_to_owner: false,
  });
  check("🔴 也关不了别人家的开关", !!crossSwitch, "居然让它过了");

  /* 那个人一定要是这一家自己的人。 */
  const { data: theirProj } = await admin
    .from("projects").select("id").eq("account_id", other.id).single();
  const { data: theirCust } = await O.rpc("add_directory_entry", {
    in_project_id: theirProj.id, in_module_key: "customers", in_name: "Someone else",
  });
  const { error: wrongParty } = await C.rpc("record_message_sent", {
    in_project_id: P, in_audience: "customer", in_kind: "x", in_body: "hi",
    in_party_id: theirCust.id,
  });
  check("🔴 讲给一个不在这本册子上的人 → 挡", !!wrongParty, "居然让它过了");

  /* ── ⑥ 🔴 那一份共用的写入，一个人都打不到 ────────────────── */
  console.log("\n⑥ 🔴 共用那一支打不到");
  const { error: coreErr } = await C.rpc("record_message_core", {
    in_project_id: P, in_audience: "customer", in_kind: "x", in_body: "hi",
    in_subject_id: null, in_party_id: null, in_channel: "whatsapp",
    in_idempotency_key: null, in_status: "sent",
  });
  check("🔴 老板自己也打不到那一支", !!coreErr, "居然让它过了");

  console.log(
    bad.length ? `\n判：${bad.length} 条没过\n  ${bad.join("\n  ")}`
      : `\n判：全部过（${people.length} 个用完就删的帐号）`,
  );
} catch (err) {
  console.error(`\n🔴 尺子自己炸了：${err?.message ?? err}`);
  bad.push("尺子炸了");
} finally {
  await dropThrowaways(admin, people);
  process.exit(bad.length ? 1 : 0);
}
