/**
 * 他这个月做了几天 —— 用真的登入身分打一次每一支。
 *
 * 🔴 这一支存在的理由是一个**那张表自己的注解讲出来的洞**:
 *   `staff_pay_terms` 写着「三种都要…他最大的三个市场的工人
 *   **有一半是按天算的**，而一套只会月薪的薪资对他们等於没有」——
 *   而开一次薪的那一支里只有一句 `if basis = 'monthly'`。
 *   **所以一个按天算的师傅，拿到的是一张空的薪资单。**
 *
 * ③ 那一段才是这一整支的靶，而里面最要紧的一条是:
 *   **一天都没记的时候，那一行照样画出来，写着 0** ——
 *   一张没有那一行的薪资单看起来像还没做完，
 *   一张写着「0 天」的薪资单是一句他马上知道要去补什么的话。
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
  const email = `wd-${tag}-${stamp}@formae.test`;
  const password = `Wd-${stamp}-x!`;
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

/* 马来西亚的今天往回数几天。用本地日期，不用 UTC ——
   那个差别咬过好几次。 */
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
  for (const k of ["staff", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  const hire = async (name) => {
    const { data } = await C.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: "staff", in_name: name,
    });
    return data;
  };
  const ali = await hire("Ali");        // 按天
  const meng = await hire("Ah Meng");   // 按钟点
  const boh = await hire("Boh");        // 按天，一天都没记
  const kwan = await hire("Kwan");      // 月薪 —— 控制组

  /* ── ① 记一天 ────────────────────────────────────────────── */
  console.log("\n① 记一天");
  const { data: d1, error: e1 } = await C.rpc("log_work_day", {
    in_staff_id: ali.id, in_on_date: day(3), in_kind: "full",
  });
  check("记得下来", !e1 && d1?.kind === "full", e1?.message);
  const { data: d2 } = await C.rpc("log_work_day", {
    in_staff_id: ali.id, in_on_date: day(3), in_kind: "half",
  });
  check("同一天记两次是改，不是加",
    d2?.id === d1?.id && d2?.kind === "half", `${d2?.id} vs ${d1?.id}`);

  const { data: gone } = await C.rpc("log_work_day", {
    in_staff_id: ali.id, in_on_date: day(2), in_kind: "absent",
    in_hours: 8,
  });
  check("🔴 没来的那一天，钟点被清掉（没来就是没有钟点）",
    gone?.hours === null, `${gone?.hours}`);

  const { error: future } = await C.rpc("log_work_day", {
    in_staff_id: ali.id, in_on_date: day(-2),
  });
  check("还没到的日子记不了", !!future, "居然让它过了");

  const { error: nonsense } = await C.rpc("log_work_day", {
    in_staff_id: ali.id, in_on_date: day(1), in_kind: "maybe",
  });
  check("一天只有三个答案", !!nonsense, "居然让它过了");

  /* ── ② 这一段做了几天 ───────────────────────────────────── */
  console.log("\n② 这一段做了几天");
  await C.rpc("log_work_day", { in_staff_id: ali.id, in_on_date: day(1) });
  await C.rpc("log_work_day", { in_staff_id: ali.id, in_on_date: day(4) });
  await C.rpc("log_work_day", { in_staff_id: ali.id, in_on_date: day(5) });
  /* 现在：day1 全 · day3 半 · day4 全 · day5 全 · day2 没来 = 3.5 天 */
  const { data: tot } = await C.rpc("days_worked", {
    in_staff_id: ali.id, in_from: day(7), in_to: day(0),
  });
  check("🔴 半天算半天（3.5 天）", Number(tot?.[0]?.days) === 3.5,
    `${tot?.[0]?.days}`);
  check("而且数得出记过几天（五天）", Number(tot?.[0]?.logged) === 5,
    `${tot?.[0]?.logged}`);

  const { data: narrow } = await C.rpc("days_worked", {
    in_staff_id: ali.id, in_from: day(2), in_to: day(1),
  });
  check("区间外的不算", Number(narrow?.[0]?.days) === 1, `${narrow?.[0]?.days}`);

  for (const [d, h] of [[1, 8], [2, 4.5]]) {
    await C.rpc("log_work_day", {
      in_staff_id: meng.id, in_on_date: day(d), in_kind: "full", in_hours: h,
    });
  }
  const { data: hrs } = await C.rpc("days_worked", {
    in_staff_id: meng.id, in_from: day(7), in_to: day(0),
  });
  check("钟点加得起来（12.5）", Number(hrs?.[0]?.hours) === 12.5,
    `${hrs?.[0]?.hours}`);

  /* ── ③ 🔴 开一次薪 ──────────────────────────────────────── */
  console.log("\n③ 🔴 开一次薪");
  await C.rpc("set_staff_pay_terms", {
    in_staff_id: ali.id, in_basis: "daily", in_rate_cents: 15_000,
  });
  await C.rpc("set_staff_pay_terms", {
    in_staff_id: meng.id, in_basis: "hourly", in_rate_cents: 2_000,
  });
  await C.rpc("set_staff_pay_terms", {
    in_staff_id: boh.id, in_basis: "daily", in_rate_cents: 12_000,
  });
  await C.rpc("set_staff_pay_terms", {
    in_staff_id: kwan.id, in_basis: "monthly", in_rate_cents: 250_000,
  });

  const { data: run, error: re } = await C.rpc("open_pay_run", {
    in_project_id: P, in_period_from: day(7), in_period_to: day(0),
  });
  check("开得起来", !re && !!run?.id, re?.message);

  const { data: slips } = await admin
    .from("payslips").select("id, staff_id").eq("run_id", run.id);
  const lineOf = async (staffId) => {
    const s = (slips ?? []).find((x) => x.staff_id === staffId);
    const { data } = await admin
      .from("payslip_lines").select("label, amount_cents, kind")
      .eq("payslip_id", s?.id).eq("kind", "earning");
    return data ?? [];
  };

  const aliLines = await lineOf(ali.id);
  check("🔴 按天算的那一个终於有一行了", aliLines.length === 1,
    JSON.stringify(aliLines));
  check("🔴 而且算对了（3.5 天 × RM150 = RM525）",
    aliLines[0]?.amount_cents === 52_500, `${aliLines[0]?.amount_cents}`);
  check("🔴 那一行自己讲得出是几天（他看得懂的那一句）",
    /3\.5/.test(aliLines[0]?.label ?? ""), `${aliLines[0]?.label}`);

  const mengLines = await lineOf(meng.id);
  check("按钟点的也算对了（12.5 × RM20 = RM250）",
    mengLines[0]?.amount_cents === 25_000, `${mengLines[0]?.amount_cents}`);
  check("那一行讲得出是几个钟头", /12\.5/.test(mengLines[0]?.label ?? ""),
    `${mengLines[0]?.label}`);

  const bohLines = await lineOf(boh.id);
  check("🔴 一天都没记的那一个，那一行照样在（不是空的薪资单）",
    bohLines.length === 1, JSON.stringify(bohLines));
  check("🔴 而且它写着 0，让他马上知道要去补什么",
    bohLines[0]?.amount_cents === 0 && /0/.test(bohLines[0]?.label ?? ""),
    JSON.stringify(bohLines[0]));

  const kwanLines = await lineOf(kwan.id);
  check("控制组：月薪那一个照旧（只加不改）",
    kwanLines.length === 1 && kwanLines[0]?.amount_cents === 250_000
      && kwanLines[0]?.label === "Basic pay",
    JSON.stringify(kwanLines));

  /* ── ④ 谁看得到 ─────────────────────────────────────────── */
  console.log("\n④ 谁看得到");
  const crew = await person("crew");
  const { error: memErr } = await C.rpc("add_project_member", { in_email: crew.email });
  check("控制组：那个师傅真的进了这一家", !memErr, memErr?.message);
  const { data: crewSees } = await crew.client.rpc("work_days_of", {
    in_project_id: P, in_from: day(7), in_to: day(0),
  });
  check("🔴 师傅看得到工地上那几天（那不是钱）",
    (crewSees ?? []).length === 7, `${crewSees?.length}`);
  const { data: crewSlips } = await crew.client
    .from("payslips").select("id").eq("project_id", P);
  check("🔴 而薪资单他照旧看不到（那才是钱）",
    (crewSlips ?? []).length === 0, `${crewSlips?.length}`);

  /* ── ⑤ 别人家 ───────────────────────────────────────────── */
  console.log("\n⑤ 别人家");
  const other = await person("other");
  const O = other.client;
  await O.rpc("set_project_style", { new_style: "ledger" });
  const { data: theirs } = await O.from("work_days").select("id");
  check("🔴 另一家一行都读不到", (theirs ?? []).length === 0, `${theirs?.length}`);
  const { error: crossLog } = await O.rpc("log_work_day", {
    in_staff_id: ali.id, in_on_date: day(1),
  });
  check("🔴 记不了别人家的工", !!crossLog, "居然让它过了");

  /* ── ⑥ 🔴 他离职，帐号删得掉 ────────────────────────────── */
  console.log("\n⑥ 🔴 他离职，帐号删得掉");
  const { error: delCrew } = await admin.auth.admin.deleteUser(crew.id);
  check("🔴 删得掉（`recorded_by` 要清空，那是一次修改）", !delCrew, delCrew?.message);
  if (!delCrew) people.splice(people.indexOf(crew.id), 1);

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
