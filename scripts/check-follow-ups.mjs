/**
 * 下一步 —— 拿真的登入身分打一次每一支。
 *
 * 重点 26：`db push` 成功证明不了任何事。plpgsql 到**执行**才解析名字。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")]; }),
);
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const stamp = Date.now();
const day = (n) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);
const bad = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

const people = [];
async function person(tag) {
  const email = `fu-${tag}-${stamp}@formae.test`;
  const password = `Fu-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn(${tag}): ${e2.message}`);
  people.push(data.user.id);
  return { id: data.user.id, email, client };
}

try {
  const owner = await person("own");
  const { data: proj } = await admin.from("projects").select("id").eq("account_id", owner.id).single();
  const P = proj.id;
  const C = owner.client;

  const { data: quote, error: qErr } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_party: "Mr Tan",
    in_title: "Taman Desa reno", in_amount_cents: 4850000,
  });
  if (qErr) throw new Error(`add_pipeline_record: ${qErr.message}`);
  const { data: second } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_party: "Puan Siti",
    in_title: "Bathroom", in_amount_cents: 900000,
  });

  console.log("\n① 写下一步");
  const { data: f1, error: e1 } = await C.rpc("set_follow_up", {
    in_record_id: quote.id, in_what: "打电话问决定了没有", in_due_on: day(2),
  });
  check("写得进去", !e1 && !!f1?.id, e1?.message);
  check("而且是他自己写的那一句", f1?.what === "打电话问决定了没有", f1?.what);

  /* 🔴 一张单只有一个还没做完的 —— 再写一次是**改它**，不是开第二个。 */
  const { data: f2, error: e2 } = await C.rpc("set_follow_up", {
    in_record_id: quote.id, in_what: "先叫师傅去量尺寸",
  });
  check("🔴 再写一次是改它，不是开第二个", !e2 && f2?.id === f1?.id, `${f2?.id}`);
  check("那一句换掉了", f2?.what === "先叫师傅去量尺寸", f2?.what);
  /* 没给日子就不动原本那一天 —— 他改的是要做什么，不是几时做。 */
  check("没给日子就不动原本那一天", f2?.due_on === f1?.due_on, `${f2?.due_on}`);

  const { error: blankErr } = await C.rpc("set_follow_up", {
    in_record_id: quote.id, in_what: "   ",
  });
  check("空的那一句挡住，而且讲人话",
    !!blankErr && /write what you are going to do/i.test(blankErr.message ?? ""), blankErr?.message);

  console.log("\n② 今天要跟哪几件");
  /* 一件昨天就该做的，一件今天的，一件下个礼拜的。 */
  await C.rpc("set_follow_up", { in_record_id: quote.id, in_what: "打电话", in_due_on: day(-2) });
  await C.rpc("set_follow_up", { in_record_id: second.id, in_what: "送图过去", in_due_on: day(7) });

  const { data: due, error: dErr } = await C.rpc("follow_ups_due", { in_project_id: P });
  check("列得出来", !dErr, dErr?.message);
  check("只有到期的那一件（下个礼拜那件不在）", (due ?? []).length === 1, `${(due ?? []).length}`);
  check("🔴 逾期几天是算出来的", Number(due?.[0]?.days_late) === 2, `${due?.[0]?.days_late}`);
  check("带着那张单是谁的、多少钱", due?.[0]?.party === "Mr Tan" &&
    Number(due?.[0]?.amount_cents) === 4850000, JSON.stringify(due?.[0]));
  check("而且有单号，他找得到那张单", !!due?.[0]?.doc_no, `${due?.[0]?.doc_no}`);

  const { data: week } = await C.rpc("follow_ups_due", { in_project_id: P, in_until: day(7) });
  check("往后拨到下个礼拜就两件都看得到", (week ?? []).length === 2, `${(week ?? []).length}`);
  check("🔴 逾期那一件排最前面", week?.[0]?.what === "打电话", `${week?.[0]?.what}`);

  const { data: one } = await C.rpc("follow_up_of", { in_record_id: quote.id });
  check("那一张单自己问得出来", (one ?? []).length === 1 && one[0].what === "打电话",
    JSON.stringify(one));

  console.log("\n③ 做完了 · 不跟了");
  const { data: done, error: doneErr } = await C.rpc("finish_follow_up", { in_id: due[0].id });
  check("做得完", !doneErr && !!done?.done_at, doneErr?.message);
  const { error: twice } = await C.rpc("finish_follow_up", { in_id: due[0].id });
  check("同一件做不了第二次", !!twice, "居然让它过了");

  /* 🔴 做完之后那张单可以写下一个了 —— 唯一索引只挡没做完的。 */
  const { data: next, error: nextErr } = await C.rpc("set_follow_up", {
    in_record_id: quote.id, in_what: "他说要考虑，下星期再打",
  });
  check("🔴 做完之后写得了下一个", !nextErr && next?.id !== due[0].id, nextErr?.message);

  const { data: after } = await admin.from("follow_ups").select("id, done_at").eq("record_id", quote.id);
  check("而做完的那一件留着，不是被删掉", (after ?? []).length === 2, `${(after ?? []).length}`);

  const { error: dropErr } = await C.rpc("drop_follow_up", { in_id: next.id });
  check("不跟了，删得掉", !dropErr, dropErr?.message);
  const { data: gone } = await C.rpc("follow_up_of", { in_record_id: quote.id });
  check("删掉之后那张单没有下一步了", (gone ?? []).length === 0, `${(gone ?? []).length}`);
  const { error: dropDone } = await C.rpc("drop_follow_up", { in_id: due[0].id });
  check("🔴 已经做完的删不掉（那是纪录）", !!dropDone, "居然让它过了");

  console.log("\n④ 挡住的");
  const { data: shelved } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_party: "X", in_title: "Old", in_amount_cents: 100,
  });
  await C.rpc("set_pipeline_archived", { in_id: shelved.id, in_archived: true });
  const { error: shErr } = await C.rpc("set_follow_up", {
    in_record_id: shelved.id, in_what: "追这一张",
  });
  check("收起来的单写不了下一步，而且讲得出该怎么做",
    !!shErr && /take it back out/i.test(shErr.message ?? ""), shErr?.message);

  console.log("\n⑤ 师傅那一边（明天去量尺寸是他的工作）");
  const crew = await person("crew");
  const { error: memErr } = await C.rpc("add_project_member", { in_email: crew.email });
  if (memErr) throw new Error(`add_project_member: ${memErr.message}`);
  const { data: crewDue, error: crewErr } = await crew.client.rpc("follow_ups_due", { in_project_id: P });
  check("师傅看得到要跟的（那是他一天的工作）", !crewErr, crewErr?.message);
  const { data: crewWrite, error: crewWErr } = await crew.client.rpc("set_follow_up", {
    in_record_id: second.id, in_what: "明天去量尺寸",
  });
  check("而且写得了一个", !crewWErr && !!crewWrite?.id, crewWErr?.message);
  void crewDue;

  console.log("\n⑥ 别人家");
  const other = await person("other");
  const { data: otherDue } = await other.client.rpc("follow_ups_due", { in_project_id: P });
  check("读不到我的", (otherDue ?? []).length === 0, `${(otherDue ?? []).length}`);
  const { error: otherWrite } = await other.client.rpc("set_follow_up", {
    in_record_id: quote.id, in_what: "偷写一个",
  });
  check("写不进我的单", !!otherWrite, "居然让它过了");
  const { data: otherRaw } = await other.client.from("follow_ups").select("id");
  check("直接读那张表也是零行", (otherRaw ?? []).length === 0, `${(otherRaw ?? []).length}`);

  /* 🔴 那一行属於那张单的那一家 —— 两个 id 各自都合法，外键挡不住。 */
  const { data: otherProj } = await admin.from("projects").select("id").eq("account_id", other.id).single();
  const { error: crossErr } = await admin.from("follow_ups").insert({
    project_id: otherProj.id, record_id: quote.id, what: "跨家",
  });
  check("🔴 挂到别人的单上要被挡（触发器，不是外键）",
    !!crossErr && /not in this project/i.test(crossErr.message ?? ""), crossErr?.message);

} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  bad.push(err.message);
} finally {
  /* 🔴 **删得掉整个帐号，是一条断言，不是一句警告。**
     第一次跑的时候 `dropThrowaway` 印了「删不掉」而尺子照样全过 ——
     而那正是任务 129 的形状：一条守卫挡住 cascade，然后清理的人
     拿正则去扫全库，把示范帐号一起炸掉。
     根因：`created_by` 的 set-null 是一次 UPDATE，会把那一行每一条外键
     重新验一遍，而 `follow_ups` 是唯一一张有两条 cascade 父路的表
     （20260905830000 把那两条外键拿掉了）。 */
  let stuck = 0;
  for (const id of people) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) {
      console.log(`  FAIL  🔴 整个帐号删得掉（cascade 没有被挡） — ${id}：${error.message}`);
      stuck += 1;
    }
  }
  if (stuck) bad.push("整个帐号删得掉（cascade 没有被挡）");
  else console.log("  PASS  🔴 整个帐号删得掉（cascade 没有被挡）");
  console.log("\n(临时帐号都删掉了)");
}

console.log(`\n判：${bad.length ? `${bad.length} 条没过` : "全过"}`);
for (const b of bad) console.log(`  · ${b}`);
process.exit(bad.length ? 1 : 0);
