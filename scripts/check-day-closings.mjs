/**
 * 收工记录——沙龙 End of Day Cash 那一页的「Lock Drawer」终于存得下来
 * （[任务 415] 第 2 项，20260925010000）。
 *
 * 用真的登入身分打每一支——`db push` 成功证明不了任何事（[重点 26]）。
 *
 * 守的是：
 *   ① 点钞合计是从面额算出来的，不是页面传来的；差额、要存银行的数是
 *      generated column，永远从那两个数字算出来
 *   ② 一家一天只有一份「现行」的收工；同一把钥匙按两下回原来那一份
 *   ③ 收错了是「重开」——那一份留着（标记），不是删掉；重开完可以再收
 *   ④ 输入会被挡：不认识的面额 · 不是整数 · 负数 · 未来的日期 · 形状不对
 *   ⑤ 只有老板碰：员工读不到、收不了、重开不了；别人家的老板也一样；
 *      表本身没有 insert / update 的路
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

const stamp = Date.now();
const bad = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

const people = [];
async function person(tag) {
  const email = `dcl-${tag}-${stamp}@formae.test`;
  const password = `Dcl-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  people.push(data.user.id);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn(${tag}): ${e2.message}`);
  return { id: data.user.id, email, client };
}

const kl = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kuala_Lumpur" }).format(d);
};
const TODAY = kl(0);
const YESTERDAY = kl(-1);
const TWO_DAYS_AGO = kl(-2);
const TOMORROW = kl(1);

const SETTLEMENTS = [
  { method: "Cash", count: 2, totalCents: 13000, isCash: true },
  { method: "DuitNow QR", count: 1, totalCents: 12000, isCash: false },
];
const CHECKLIST = [
  { label: "Cash drawer physically verified", done: true },
  { label: "Equipment powered off", done: false },
];

try {
  const boss = await person("boss");
  const { data: proj } = await admin.from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;

  /** 收一天。只列要变的，其余是一份合理的默认。 */
  const lock = (over = {}, client = C, project = P) =>
    client.rpc("lock_day_closing", {
      in_project_id: project,
      in_closing_date: TODAY,
      in_counts: { "100": 1, "20": 3 },
      in_float_cents: 3000,
      in_expected_cash_cents: 16000,
      in_gross_cents: 25000,
      in_outflows_cents: 1500,
      in_settlements: SETTLEMENTS,
      in_checklist: CHECKLIST,
      in_note: "Fan in room 2 is broken",
      ...over,
    });

  /* ── ① 收一天：数字是算出来的 ─────────────────────────────── */
  console.log("\n① 收一天");
  const { data: d1, error: e1 } = await lock({ in_counts: { "100": 1, "50": 0, "20": 3 } });
  check("收得下去", !e1 && !!d1?.id, e1?.message);
  check("🔴 点钞合计是从面额算的：1×100 + 3×20 = RM 160.00", Number(d1?.counted_cents) === 16000, `${d1?.counted_cents}`);
  check("🔴 点了 0 张的面额不进记录（只存点过的）",
    JSON.stringify(d1?.counts) === JSON.stringify({ "20": 3, "100": 1 }) || (d1?.counts?.["100"] === 1 && d1?.counts?.["20"] === 3 && !("50" in (d1?.counts ?? {}))),
    JSON.stringify(d1?.counts));
  check("🔴 差额是算出来的：点出来 160 − 该有 160 = 0", Number(d1?.variance_cents) === 0, `${d1?.variance_cents}`);
  check("🔴 要存银行的是算出来的：160 − 备用金 30 = RM 130.00", Number(d1?.net_deposit_cents) === 13000, `${d1?.net_deposit_cents}`);
  check("谁收的是登入的那个人（不是页面传来的）", d1?.locked_by === boss.id, `${d1?.locked_by}`);
  check("🔴 名字取自登入的邮箱，不是页面写的", d1?.locked_by_name === boss.email.split("@")[0], `${d1?.locked_by_name}`);
  check("交班那一句、清单、各渠道原样存着",
    d1?.note === "Fan in room 2 is broken" && d1?.checklist?.length === 2 && d1?.settlements?.[0]?.method === "Cash",
    JSON.stringify([d1?.note, d1?.checklist?.length]));
  check("日期是那一天", d1?.closing_date === TODAY, `${d1?.closing_date}`);
  check("还没有重开过", d1?.voided_at === null, `${d1?.voided_at}`);

  /* ── ② 差额是从两个数字算的：少了钱是负的 ─────────────────── */
  console.log("\n② 少了钱");
  const { data: d2 } = await lock({
    in_closing_date: YESTERDAY, in_counts: { "100": 1, "20": 1 }, in_expected_cash_cents: 15000, in_float_cents: 0,
  });
  check("🔴 点出来 120 该有 150：差额 −RM 30.00", Number(d2?.variance_cents) === -3000, `${d2?.variance_cents}`);
  check("备用金 0：要存的就是点出来的全部 RM 120.00", Number(d2?.net_deposit_cents) === 12000, `${d2?.net_deposit_cents}`);

  const { data: d2b } = await lock({
    in_closing_date: TWO_DAYS_AGO, in_counts: { "10": 2 }, in_float_cents: 5000,
  });
  check("🔴 备用金比点出来的还多：要存的是 0，不是负数", Number(d2b?.net_deposit_cents) === 0, `${d2b?.net_deposit_cents}`);

  /* ── ③ 一天只有一份现行的 ─────────────────────────────────── */
  console.log("\n③ 一天只收一次");
  const { error: dupErr } = await lock({ in_counts: { "50": 4 } });
  check("🔴 同一天再收一次：挡下来，而且讲得出怎么办", !!dupErr && /already closed/.test(dupErr.message) && /reopen/.test(dupErr.message), dupErr?.message);
  const { data: liveToday } = await admin.from("day_closings").select("id, counted_cents").eq("project_id", P).eq("closing_date", TODAY).is("voided_at", null);
  check("🔴 挡下来之后现行的还是第一份，没被盖掉", liveToday?.length === 1 && liveToday[0].id === d1.id && Number(liveToday[0].counted_cents) === 16000, JSON.stringify(liveToday));

  /* ── ④ 按两下：同一把钥匙回同一份 ─────────────────────────── */
  console.log("\n④ 按两下");
  const key = crypto.randomUUID();
  const { data: k1 } = await lock({ in_closing_date: kl(-3), in_idempotency_key: key });
  const { data: k2, error: k2e } = await lock({ in_closing_date: kl(-3), in_idempotency_key: key });
  check("🔴 同一把钥匙第二次不报错，回的是第一份", !k2e && k1?.id && k2?.id === k1.id, k2e?.message ?? `${k1?.id} vs ${k2?.id}`);
  const { data: kRows } = await admin.from("day_closings").select("id").eq("project_id", P).eq("closing_date", kl(-3));
  check("🔴 库里只有一份，不是两份", kRows?.length === 1, `${kRows?.length}`);

  /* ── ⑤ 重开：留着，不删；重开完可以再收 ───────────────────── */
  console.log("\n⑤ 重开");
  const { data: r1, error: re1 } = await C.rpc("reopen_day_closing", { in_id: d1.id, in_reason: "Miscounted the RM 20s" });
  check("重开得了", !re1 && !!r1?.voided_at, re1?.message);
  check("🔴 原因存着、是谁重开的存着", r1?.void_reason === "Miscounted the RM 20s" && r1?.voided_by === boss.id, JSON.stringify([r1?.void_reason, r1?.voided_by]));
  const { data: stillThere } = await admin.from("day_closings").select("id, counted_cents").eq("id", d1.id);
  check("🔴 那一份还在库里、点钞的数字原样——是标记，不是删掉", stillThere?.length === 1 && Number(stillThere[0].counted_cents) === 16000, JSON.stringify(stillThere));
  const { data: r1b } = await C.rpc("reopen_day_closing", { in_id: d1.id, in_reason: "second press" });
  check("🔴 重开按两下：第一次的时间跟原因不被改掉", r1b?.voided_at === r1.voided_at && r1b?.void_reason === "Miscounted the RM 20s", JSON.stringify([r1b?.voided_at, r1b?.void_reason]));
  const { data: relock, error: relockErr } = await lock({ in_counts: { "100": 1, "20": 2, "10": 2 }, in_note: "recounted" });
  check("🔴 重开之后同一天可以再收，是新的一份", !relockErr && relock?.id && relock.id !== d1.id, relockErr?.message);
  check("重收的数字是新的：100 + 40 + 20 = RM 160.00，备注是新的", Number(relock?.counted_cents) === 16000 && relock?.note === "recounted", JSON.stringify([relock?.counted_cents, relock?.note]));
  const { data: liveAfter } = await admin.from("day_closings").select("id").eq("project_id", P).eq("closing_date", TODAY).is("voided_at", null);
  const { data: allToday } = await admin.from("day_closings").select("id").eq("project_id", P).eq("closing_date", TODAY);
  check("🔴 这一天现行的只有 1 份，历史里有 2 份（旧的那份留着）", liveAfter?.length === 1 && allToday?.length === 2, `${liveAfter?.length}/${allToday?.length}`);

  /* ── ⑥ 什么都没点也收得了 ─────────────────────────────────── */
  console.log("\n⑥ 一张钞票都没点");
  const { data: none, error: noneErr } = await lock({ in_closing_date: kl(-4), in_counts: {}, in_expected_cash_cents: 8000 });
  check("收得下去（一间只收卡的店那天抽屉是空的）", !noneErr && !!none?.id, noneErr?.message);
  check("🔴 点钞合计 0，差额是 −RM 80.00（页面上写「not counted」，是页面的事）", Number(none?.counted_cents) === 0 && Number(none?.variance_cents) === -8000, JSON.stringify([none?.counted_cents, none?.variance_cents]));

  /* ── ⑦ 输入被挡 ───────────────────────────────────────────── */
  console.log("\n⑦ 输入被挡");
  const rejects = async (name, over) => {
    const { error } = await lock({ in_closing_date: kl(-9), ...over });
    check(`🔴 ${name}`, !!error, "居然让它过了");
  };
  await rejects("不认识的面额（RM 200）", { in_counts: { "200": 1 } });
  await rejects("张数不是整数（1.5）", { in_counts: { "100": 1.5 } });
  await rejects("张数是负数", { in_counts: { "100": -1 } });
  await rejects("张数是字", { in_counts: { "100": "many" } });
  await rejects("点钞不是一份「面额 → 张数」（给了一个数组）", { in_counts: [1, 2] });
  await rejects("备用金是负数", { in_float_cents: -1 });
  await rejects("该有的现金是负数", { in_expected_cash_cents: -1 });
  await rejects("总额是负数", { in_gross_cents: -1 });
  await rejects("开销是负数", { in_outflows_cents: -1 });
  await rejects("各渠道不是数组", { in_settlements: { a: 1 } });
  await rejects("各渠道多到 51 条", { in_settlements: Array.from({ length: 51 }, (_, i) => ({ method: `m${i}` })) });
  await rejects("清单多到 21 条", { in_checklist: Array.from({ length: 21 }, (_, i) => ({ label: `c${i}`, done: false })) });
  await rejects("没写日期", { in_closing_date: null });
  const { error: futureErr } = await lock({ in_closing_date: TOMORROW });
  check("🔴 明天的日子收不了（还没到）", !!futureErr && /today or an earlier day/.test(futureErr.message), futureErr?.message);
  const { data: junk } = await admin.from("day_closings").select("id").eq("project_id", P).eq("closing_date", kl(-9));
  check("🔴 被挡的那些一份都没有留下", (junk ?? []).length === 0, `${junk?.length}`);

  const { data: longNote } = await lock({ in_closing_date: kl(-5), in_note: "x".repeat(5000) });
  check("备注很长的话截在 2000 字，不是整个挡掉（他写了一大段交班不该丢）", longNote?.note?.length === 2000, `${longNote?.note?.length}`);

  /* ── ⑧ 只有老板碰 ─────────────────────────────────────────── */
  console.log("\n⑧ 员工 · 别人家");
  const staff = await person("staff");
  const memberAdd = await C.rpc("add_project_member", { in_email: staff.email });
  check("前提：员工加进来了", !memberAdd.error, memberAdd.error?.message);

  const { error: staffLockErr } = await lock({ in_closing_date: kl(-6) }, staff.client);
  check("🔴 员工收不了工（那是老板的事）", !!staffLockErr && /for the owner/.test(staffLockErr.message), staffLockErr?.message);
  const { error: staffReopenErr } = await staff.client.rpc("reopen_day_closing", { in_id: relock.id, in_reason: "sneaky" });
  check("🔴 员工重开不了", !!staffReopenErr, "居然让它过了");
  const { data: staffRead } = await staff.client.from("day_closings").select("id").eq("project_id", P);
  check("🔴 员工读不到任何一份（连有几份都不该知道）", (staffRead ?? []).length === 0, `${staffRead?.length}`);
  const { data: stillLive } = await admin.from("day_closings").select("voided_at").eq("id", relock.id).single();
  check("员工那一下没有动到那一份", stillLive?.voided_at === null, `${stillLive?.voided_at}`);

  const other = await person("other");
  const { data: otherProj } = await admin.from("projects").select("id").eq("account_id", other.id).single();
  const { error: crossLock } = await lock({ in_closing_date: kl(-7) }, other.client, P);
  check("🔴 别人家的老板收不了我这一家的工", !!crossLock, "居然让它过了");
  const { error: crossReopen } = await other.client.rpc("reopen_day_closing", { in_id: relock.id, in_reason: "x" });
  check("🔴 别人家的老板重开不了我的", !!crossReopen, "居然让它过了");
  const { data: crossRead } = await other.client.from("day_closings").select("id").eq("project_id", P);
  check("🔴 别人家的老板读不到我的", (crossRead ?? []).length === 0, `${crossRead?.length}`);
  const { data: ownLock, error: ownLockErr } = await lock({ in_closing_date: TODAY }, other.client, otherProj.id);
  check("对照：别人家收他自己那一家的，收得下去（尺子没有把人全挡掉）", !ownLockErr && !!ownLock?.id, ownLockErr?.message);

  /* ── ⑨ 表本身没有写的路 ───────────────────────────────────── */
  console.log("\n⑨ 直接写表");
  const { error: directInsert } = await C.from("day_closings").insert({
    project_id: P, closing_date: kl(-8), counted_cents: 99_999_999,
  });
  check("🔴 老板自己也不能绕过 RPC 直接塞一份（数字就不是算出来的了）", !!directInsert, "居然让它过了");
  const upd = await C.from("day_closings").update({ counted_cents: 1 }).eq("id", relock.id).select();
  const { data: unchanged } = await admin.from("day_closings").select("counted_cents").eq("id", relock.id).single();
  check("🔴 直接改一份的点钞数字改不动", Number(unchanged?.counted_cents) === 16000, `${unchanged?.counted_cents} / ${upd.error?.message ?? "no error"}`);
  const del = await C.from("day_closings").delete().eq("id", relock.id).select();
  const { data: notDeleted } = await admin.from("day_closings").select("id").eq("id", relock.id);
  check("🔴 直接删不掉", notDeleted?.length === 1, `${del.error?.message ?? "no error"}`);

  console.log(
    bad.length ? `\n判：${bad.length} 条没过\n  ${bad.join("\n  ")}` : `\n判：全部过（${people.length} 个用完就删的帐号）`,
  );
} catch (err) {
  console.error(`\n🔴 尺子自己炸了：${err?.message ?? err}`);
  bad.push("尺子炸了");
} finally {
  await dropThrowaways(admin, people);
  process.exit(bad.length ? 1 : 0);
}
