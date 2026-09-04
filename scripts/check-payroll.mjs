/**
 * 薪资 —— 用真的登入身分打每一支，不是用管理员钥匙。
 *
 * 重点 26：`supabase db push` 成功证明不了任何事。plpgsql 到**执行**才解析
 * 名字，而这三支 migration 里有十支函式、四张表、九条 policy。
 *
 * ── 这一支真正在守的两件 ─────────────────────────────────────────────────
 *
 *   ① **查不到法定表就抛错，绝不回 0。**
 *      一个回 0 的查询在薪资单上长得跟「这个人不用缴」一模一样 ——
 *      而那是一笔漏缴，老板要负责。
 *   ② **没有人核对过的表，算得出来，发不出去。**
 *      钱不准踩着没有人核对过的数字离开。
 *
 * ⚠️ 里面有一个帐号会被临时设成 founder（法定表只有我们装得了）。
 * 那是一个**用完就删**的帐号，而且从头到尾没有碰过任何一个真的帐号。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split(/\r?\n/)
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let passed = 0;
const failures = [];
const check = (name, ok, detail = "") => {
  if (ok) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failures.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const stamp = Date.now();
const made = [];
const schedules = [];

async function person(tag) {
  const email = `${tag}-${stamp}@formae.test`;
  const password = `Pay-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser ${tag}: ${error.message}`);
  made.push(data.user.id);
  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: inErr } = await c.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn ${tag}: ${inErr.message}`);
  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", data.user.id)
    .single();
  if (!proj?.id) throw new Error(`no project for ${tag}`);
  return { id: data.user.id, email, client: c, project: proj.id };
}

const rm = (n) => Math.round(n * 100);

try {
  const owner = await person("towkay");
  const mandor = await person("mandor");
  const other = await person("outsider");
  const P = owner.project;
  const C = owner.client;

  /* 法定表只有我们装得了。 */
  await admin.from("accounts").update({ role: "founder" }).eq("id", owner.id);

  // ① 这个人怎么算钱 ──────────────────────────────────────────────────────
  console.log("\n① 这个人怎么算钱");

  const { data: ali } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Ali bin Osman",
  });
  const { data: siti } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Siti Nurhaliza",
  });
  const { data: subbie } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Chong (subcontract)",
  });
  const { data: buyer } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ang Chee Keong",
  });

  const { data: aliTerms, error: aliErr } = await C.rpc("set_staff_pay_terms", {
    in_staff_id: ali.id, in_basis: "monthly", in_rate_cents: rm(3200),
    in_epf_part: "A", in_socso_part: "1", in_eis_part: "1",
  });
  check("一个师傅有薪资条件了", aliTerms?.rate_cents === rm(3200), aliErr?.message);

  const { data: siti2 } = await C.rpc("set_staff_pay_terms", {
    in_staff_id: siti.id, in_basis: "daily", in_rate_cents: rm(120),
    in_epf_part: "A", in_socso_part: "1", in_eis_part: "1",
  });
  check("按天算的也写得下", siti2?.basis === "daily", JSON.stringify(siti2));

  /* 🔴 分包的师傅没有公积金类别，而那是一个**真的答案**，不是漏填。 */
  const { data: sub2 } = await C.rpc("set_staff_pay_terms", {
    in_staff_id: subbie.id, in_basis: "daily", in_rate_cents: rm(250),
  });
  check("分包的师傅可以没有法定类别（他自己缴）",
    sub2?.epf_part === null && sub2?.socso_part === null, JSON.stringify(sub2));

  const { error: onCustomer } = await C.rpc("set_staff_pay_terms", {
    in_staff_id: buyer.id, in_rate_cents: rm(1000),
  });
  check("挂在客户身上的薪资条件被挡", !!onCustomer, "a customer got pay terms");

  const { error: notMine } = await other.client.rpc("set_staff_pay_terms", {
    in_staff_id: ali.id, in_rate_cents: rm(9999),
  });
  check("别人改不了我师傅的薪水", !!notMine, "a stranger set my staff's pay");

  // ② 没有表就不准算 ──────────────────────────────────────────────────────
  console.log("\n② 没有法定表，就不准算");

  const { error: noTable } = await C.rpc("open_pay_run", {
    in_project_id: P, in_period_from: "2026-09-01", in_period_to: "2026-09-30",
  });
  check("🔴 没有法定表的时候，开薪直接拒绝", !!noTable, "it opened a run with no EPF table");
  check("而且讲得出是哪一个计划、哪一天",
    /epf/i.test(noTable?.message ?? "") && /2026-09-30/.test(noTable?.message ?? ""),
    noTable?.message?.slice(0, 160));
  check("而且讲得出该去装那份官方的表",
    /load the official schedule/i.test(noTable?.message ?? ""),
    noTable?.message?.slice(0, 160));

  // ③ 装一份表 ────────────────────────────────────────────────────────────
  console.log("\n③ 装一份表（只有我们装得了）");

  const { error: notFounder } = await other.client.rpc("upsert_statutory_schedule", {
    in_scheme: "epf", in_part: "A", in_effective_from: "2026-01-01",
    in_source_name: "Fake", in_source_url: "https://example.test",
    in_brackets: [{ wage_from_cents: 0, wage_to_cents: null, employee_permille: 999, employer_permille: 999 }],
  });
  check("🔴 一家生意改不了自己的法定费率表", !!notFounder, "a customer loaded a statutory table");

  /* 一份很小的、**编出来的**表 —— 这一支尺子测的是机器，不是费率。
     真的费率要从 KWSP / PERKESO 的文件装进去。 */
  const epfRows = [
    { wage_from_cents: 0, wage_to_cents: rm(10), employee_cents: 0, employer_cents: 0 },
    { wage_from_cents: rm(3180) + 1, wage_to_cents: rm(3200), employee_cents: rm(352), employer_cents: rm(416) },
    /* 表尾切回比例（法律在 RM20,000 以上才这样）。 */
    { wage_from_cents: rm(20000) + 1, wage_to_cents: null, employee_permille: 110, employer_permille: 120 },
  ];
  const { data: epfSched, error: epfErr } = await C.rpc("upsert_statutory_schedule", {
    in_scheme: "epf", in_part: "A", in_effective_from: "2026-01-01",
    in_source_name: "KWSP",
    in_source_url: "https://www.kwsp.gov.my/en/employer/responsibilities/mandatory-contribution",
    in_act: "EPF Act 1991 - Section 43(1), Third Schedule",
    in_via: "check:payroll fixture -- NOT the real table",
    in_brackets: epfRows,
  });
  check("装得进去，而且记得出处", !!epfSched?.id && /kwsp/i.test(epfSched?.source_url ?? ""), epfErr?.message);
  check("🔴 而且它一开始是**没有人核对过**的", epfSched?.confirmed_at === null, String(epfSched?.confirmed_at));
  if (epfSched?.id) schedules.push(epfSched.id);

  for (const scheme of ["socso", "eis"]) {
    const { data: s } = await C.rpc("upsert_statutory_schedule", {
      in_scheme: scheme, in_part: "1", in_effective_from: "2026-01-01",
      in_source_name: "PERKESO",
      in_source_url: "https://www.perkeso.gov.my/en/rate-of-contribution.html",
      in_via: "check:payroll fixture -- NOT the real table",
      in_brackets: [
        { wage_from_cents: 0, wage_to_cents: rm(100000),
          employee_cents: scheme === "socso" ? rm(15.25) : rm(6.4),
          employer_cents: scheme === "socso" ? rm(53.35) : rm(6.4) },
      ],
    });
    if (s?.id) schedules.push(s.id);
  }

  // ④ 查一格 ──────────────────────────────────────────────────────────────
  console.log("\n④ 查一格");

  const look = async (scheme, part, on, wage) =>
    C.rpc("statutory_lookup", { in_scheme: scheme, in_part: part, in_on: on, in_wage_cents: wage });

  const { data: hit } = await look("epf", "A", "2026-09-30", rm(3200));
  const one = Array.isArray(hit) ? hit[0] : hit;
  check("落在格子里的，拿到那一格的固定金额",
    Number(one?.employee_cents) === rm(352) && Number(one?.employer_cents) === rm(416),
    JSON.stringify(one));
  check("而且讲得出它是哪一份表算的", one?.schedule_id === epfSched.id, one?.schedule_id);

  const { data: tail } = await look("epf", "A", "2026-09-30", rm(25000));
  const t1 = Array.isArray(tail) ? tail[0] : tail;
  check("表尾那一段按比例算（11% / 12%）",
    Number(t1?.employee_cents) === rm(2750) && Number(t1?.employer_cents) === rm(3000),
    JSON.stringify(t1));

  /* 🔴 表有洞就抛错，**不准外推**。一张缺了一格的表，猜出来的那一格
     跟真的那一格在画面上长得一样。 */
  const { error: hole } = await look("epf", "A", "2026-09-30", rm(500));
  check("🔴 表里没有那一格的时候，抛错而不是猜一个", !!hole, "it extrapolated into a gap");
  check("而且讲得出是这张表不完整",
    /incomplete/i.test(hole?.message ?? ""), hole?.message?.slice(0, 140));

  const { error: tooEarly } = await look("epf", "A", "2025-06-30", rm(3200));
  check("生效日之前的那个月，查不到就抛错", !!tooEarly, "it used a table from the future");

  // ⑤ 开一次薪 ────────────────────────────────────────────────────────────
  console.log("\n⑤ 开一次薪");

  const runKey = crypto.randomUUID();
  const { data: run, error: runErr } = await C.rpc("open_pay_run", {
    in_project_id: P, in_period_from: "2026-09-01", in_period_to: "2026-09-30",
    in_idempotency_key: runKey,
  });
  check("开得了一次薪", !!run?.id, runErr?.message?.slice(0, 140));

  const { data: again } = await C.rpc("open_pay_run", {
    in_project_id: P, in_period_from: "2026-09-01", in_period_to: "2026-09-30",
    in_idempotency_key: runKey,
  });
  check("同一次按两下，只有一张", again?.id === run?.id, `${again?.id} vs ${run?.id}`);

  const slips = await C.from("payslips").select("*").eq("run_id", run.id);
  check("有薪资条件的三个人，三张单", (slips.data ?? []).length === 3, `${(slips.data ?? []).length} 张`);

  const aliSlip = (slips.data ?? []).find((s) => s.staff_id === ali.id);
  const subSlip = (slips.data ?? []).find((s) => s.staff_id === subbie.id);
  check("月薪的人自动带了底薪", Number(aliSlip?.gross_cents) === rm(3200), JSON.stringify(aliSlip));
  check("按天算的带 0（做了几天只有他知道）",
    Number(subSlip?.gross_cents) === 0, JSON.stringify(subSlip));

  /* 3200 → EPF 352/416 · SOCSO 15.25/53.35 · EIS 6.40/6.40 */
  check("扣掉的是三个计划的员工份",
    Number(aliSlip?.deduction_cents) === rm(352) + rm(15.25) + rm(6.4),
    `${aliSlip?.deduction_cents}`);
  check("老板另外缴的也算出来了",
    Number(aliSlip?.employer_cents) === rm(416) + rm(53.35) + rm(6.4),
    `${aliSlip?.employer_cents}`);
  check("🔴 而老板缴的那一份**不从实收里扣**",
    Number(aliSlip?.net_cents) === rm(3200) - (rm(352) + rm(15.25) + rm(6.4)),
    `${aliSlip?.net_cents}`);

  const lines = await C.from("payslip_lines").select("*").eq("payslip_id", aliSlip.id);
  const statutoryLines = (lines.data ?? []).filter((l) => l.schedule_id);
  check("法律那几行，每一行都记得住它是哪一份表算的",
    statutoryLines.length === 6 && statutoryLines.every((l) => !!l.schedule_id),
    `${statutoryLines.length} 行`);
  check("分包的那一张一行法定的都没有",
    !(lines.data ?? []).some((l) => l.payslip_id === subSlip.id),
    "the subcontractor got statutory lines");

  /* 他自己写的那几行 —— 底薪 + 加班。 */
  const { data: reSlip, error: earnErr } = await C.rpc("set_payslip_earnings", {
    in_payslip_id: subSlip.id,
    in_lines: [
      { label: "Days worked (14 x 250)", amount_cents: rm(3500) },
      { label: "Site allowance", amount_cents: rm(150) },
    ],
  });
  check("他填得了做了几天", Number(reSlip?.gross_cents) === rm(3650), earnErr?.message);
  check("而分包的那一张还是一分法定的都不扣",
    Number(reSlip?.deduction_cents) === 0 && Number(reSlip?.net_cents) === rm(3650),
    JSON.stringify(reSlip));

  // ⑥ 🔴 没有人核对过的表，发不出去 ───────────────────────────────────────
  console.log("\n⑥ 没有人核对过的表，钱发不出去");

  const { error: unconfirmed } = await C.rpc("pay_pay_run", {
    in_run_id: run.id, in_category: "Wages",
  });
  check("🔴 表还没有人核对，钱就发不出去", !!unconfirmed, "it paid on unchecked figures");
  check("而且讲得出是哪几份、去哪里核对",
    /epf/i.test(unconfirmed?.message ?? "") && /kwsp\.gov\.my/.test(unconfirmed?.message ?? ""),
    unconfirmed?.message?.slice(0, 200));

  /* 薪资单**照样算得出来** —— 挡的是钱，不是资讯。 */
  check("而薪资单照样算得出来（挡的是钱，不是资讯）",
    Number(aliSlip?.net_cents) > 0, "the slip was blocked too");

  for (const id of schedules) {
    await C.rpc("confirm_statutory_schedule", { in_id: id, in_note: "checked against the PDF" });
  }
  const { data: confirmed } = await C.from("statutory_schedules").select("confirmed_at").eq("id", epfSched.id).single();
  check("核对过之后它记得住是谁、什么时候", !!confirmed?.confirmed_at, String(confirmed?.confirmed_at));

  // ⑦ 发出去 ──────────────────────────────────────────────────────────────
  console.log("\n⑦ 发出去");

  const { data: paidRun, error: payErr } = await C.rpc("pay_pay_run", {
    in_run_id: run.id, in_category: "Wages", in_method: "Bank transfer",
  });
  check("核对过之后发得出去", !!paidRun?.paid_at, payErr?.message?.slice(0, 160));

  const entries = await C.from("ledger_entries")
    .select("id, direction, amount_cents, party_id, done_by, category, module_key")
    .eq("project_id", P).eq("module_key", "expenses");
  /* ⚠️ 三张单，**两笔钱** —— Siti 是按天算的而他还没填做了几天，
     所以她这一期一分都不欠。**不写一笔 RM 0 的开销**，那是一笔
     没有发生过的事。
     ⚠️ 第一版我写的是 3，而**错的是我的期望不是产品** ——
     把作者算错的数字写成正确答案，尺子就不再量产品、开始量作者。 */
  check("欠钱的人一人一笔", (entries.data ?? []).length === 2, `${(entries.data ?? []).length} 笔`);
  const sitiSlip = (slips.data ?? []).find((s) => s.staff_id === siti.id);
  check("🔴 一分都不欠的那一张，不会写一笔 RM 0 的开销",
    Number(sitiSlip?.net_cents) === 0
      && !(entries.data ?? []).some((e) => e.party_id === siti.id),
    JSON.stringify(sitiSlip));
  const aliEntry = (entries.data ?? []).find((e) => e.party_id === ali.id);
  check("金额是**实收**，不是总额", Number(aliEntry?.amount_cents) === Number(aliSlip.net_cents),
    `${aliEntry?.amount_cents} vs ${aliSlip.net_cents}`);
  check("而且挂在他名下（我一共付过这个人多少，答得出来）",
    aliEntry?.done_by === ali.id, aliEntry?.done_by);
  check("而且是他自己的词当类别", aliEntry?.category === "Wages", aliEntry?.category);

  const slipAfter = await C.from("payslips").select("entry_id").eq("id", aliSlip.id).single();
  check("那张薪资单指得回那一笔钱", !!slipAfter.data?.entry_id, "no entry linked");

  /* 🔴 交叉检查：一笔发出去的薪水**不可以**灌大她的业绩 ——
     业绩数的是**进来的**钱（20260904120000），而薪水是出去的。 */
  const { data: earn } = await C.rpc("staff_earnings", { in_project_id: P, in_month: "2026-09" });
  const aliEarn = (earn ?? []).find((r) => r.party_id === ali.id);
  check("🔴 发出去的薪水没有被算成她的业绩",
    !aliEarn || Number(aliEarn.earned_cents) === 0, JSON.stringify(aliEarn));

  // ⑧ 发过就锁住 ──────────────────────────────────────────────────────────
  console.log("\n⑧ 发过就锁住");

  const { error: lateEdit } = await C.rpc("set_payslip_earnings", {
    in_payslip_id: aliSlip.id, in_lines: [{ label: "oops", amount_cents: rm(99999) }],
  });
  check("发过之后改不了薪资单", !!lateEdit, "a paid slip was edited");
  const { error: lateDrop } = await C.rpc("discard_pay_run", { in_run_id: run.id });
  check("发过之后删不掉那一次薪", !!lateDrop, "a paid run was deleted");
  check("而且讲得出该冲正，不是讲一句资料库的错",
    /reverse/i.test(lateDrop?.message ?? ""), lateDrop?.message?.slice(0, 140));

  const { error: payTwice } = await C.rpc("pay_pay_run", { in_run_id: run.id });
  check("同一次薪发不了第二遍", !!payTwice, "it paid twice");

  // ⑨ 谁看得到 ────────────────────────────────────────────────────────────
  console.log("\n⑨ 谁看得到");

  const strangerSlips = await other.client.from("payslips").select("id").eq("project_id", P);
  check("别人一张薪资单都看不到", (strangerSlips.data ?? []).length === 0,
    `${(strangerSlips.data ?? []).length} 张`);
  const strangerTerms = await other.client.from("staff_pay_terms").select("id").eq("project_id", P);
  check("别人看不到我付谁多少", (strangerTerms.data ?? []).length === 0,
    `${(strangerTerms.data ?? []).length} 行`);

  await C.rpc("add_project_member", { in_email: mandor.email });
  const mandorSlips = await mandor.client.from("payslips").select("id").eq("project_id", P);
  check("🔴 师傅看不到薪资单（薪资是钱）", (mandorSlips.data ?? []).length === 0,
    `${(mandorSlips.data ?? []).length} 张`);
  const mandorTerms = await mandor.client.from("staff_pay_terms").select("id").eq("project_id", P);
  check("师傅也看不到别人的薪水", (mandorTerms.data ?? []).length === 0,
    `${(mandorTerms.data ?? []).length} 行`);

  /* 法律是公开的 —— 一个读不到自己那张表的老板，核对不了我们替他算的数字。 */
  const mandorLaw = await mandor.client.from("statutory_schedules").select("id").limit(1);
  check("而法定那张表每一个人都读得到（法律是公开的）",
    (mandorLaw.data ?? []).length >= 1, `${(mandorLaw.data ?? []).length}`);

  // ⑩ 改过表就要重新核对 ──────────────────────────────────────────────────
  console.log("\n⑩ 改过表就要重新核对");

  const { data: reload } = await C.rpc("upsert_statutory_schedule", {
    in_scheme: "epf", in_part: "A", in_effective_from: "2026-01-01",
    in_source_name: "KWSP",
    in_source_url: "https://www.kwsp.gov.my/en/employer/responsibilities/mandatory-contribution",
    in_brackets: epfRows,
  });
  check("🔴 换过资料的表，上一次的核对不算数了", reload?.confirmed_at === null,
    String(reload?.confirmed_at));
  const stillOne = await C.from("statutory_schedules").select("id")
    .eq("scheme", "epf").eq("part", "A").eq("effective_from", "2026-01-01");
  check("而且不会变成两份重叠的表", (stillOne.data ?? []).length === 1,
    `${(stillOne.data ?? []).length} 份`);
} catch (err) {
  console.error(`\nthrew: ${err.message}`);
  failures.push(err.message);
} finally {
  /* 🔴 顺序：**先删帐号**（跟着删掉专案 → 薪资单 → 那几行），
     才删得了法定表 —— `payslip_lines.schedule_id` 是 `on delete restrict`。
     反过来写的后果我 2026-09-04 当场撞到了：删不掉、而且**不报错**，
     三份编出来的表留在一张**全局**的表里 —— 下一次跑的时候
     「没有法定表就不准算」那一条就红了，而产品是好的。 */
  for (const id of made) await dropThrowaway(admin, id);
  for (const id of schedules) {
    /* ⚠️ **看那个 error**。一支说「清掉了」而实际上没清掉的
       清理程式，跟任务 129 那支 `deleteUser` 是同一个毛病。 */
    const { error } = await admin.from("statutory_schedules").delete().eq("id", id);
    if (error) console.log(`  fixture schedule ${id} NOT deleted: ${error.message}`);
  }
  console.log("(test accounts and fixture tables deleted)");
}

console.log(`\n${passed} passed, ${failures.length} failed`);
for (const f of failures) console.log(`  · ${f}`);
process.exit(failures.length ? 1 : 0);
