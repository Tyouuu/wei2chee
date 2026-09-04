/**
 * 员工帐号跟权限 — can a second person work here, and is the money still his?
 *
 * 地基决定 3, approved 2026-08-30: 「谁看得到钱 —— 权限留在资料库（RLS），
 * 加员工帐号 + 角色」.
 *
 * ── WHY THIS FILE EXISTS, AND WHY IT MEASURES RATHER THAN READS ──────────
 *
 * The founder's own system measured the failure this is built to avoid. In
 * vibe-dealer's 0038 he wrote down what he saw with both test accounts set
 * inactive in the app:
 *
 *     accountant@dealerhub.test -> content-range: 0-0/284   (all dealers)
 *
 * A switched-off user, holding a token the app had stopped honouring, read
 * every row straight out of PostgREST. Switching somebody off in the app is
 * not switching them off. So the last section here logs a staff member in,
 * has the owner switch them off, and then asks the DATABASE -- through that
 * same live session -- what they can still see.
 *
 * ── AND WHY NO EXISTING RULER COULD CATCH THIS ───────────────────────────
 *
 * check:records and check:isolation both run as ONE customer who owns their
 * project. Every assertion here needs two people inside one business, which
 * neither of them has ever had. A permission system tested only by its owner
 * is a permission system nobody has tested.
 *
 * Run as REAL SESSIONS, never the service role -- the service role bypasses
 * RLS, and RLS is the entire subject.
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(1);
}
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

/** A real signed-in browser, not an admin key. */
async function person(tag) {
  const email = `${tag}-${stamp}@formae.test`;
  const password = `Staff-${stamp}-x!`;
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
  if (!proj?.id) throw new Error(`no project provisioned for ${tag}`);
  return { id: data.user.id, email, client: c, project: proj.id };
}

try {
  console.log("Three people: the owner, his supervisor, and a stranger…\n");
  const owner = await person("boss");
  const staff = await person("mandor");
  const other = await person("stranger");

  const P = owner.project;
  const S = staff.client;
  const O = other.client;

  /* The owner writes one of each kind, so every read below has something real
     to find, or to be refused. */
  const { data: job } = await owner.client.rpc("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "quotations",
    in_title: "Taman Desa 三房翻新",
    in_party: "陈先生",
    in_amount_cents: 4850000,
  });
  const { data: cust } = await owner.client.rpc("add_directory_entry", {
    in_project_id: P,
    in_module_key: "customers",
    in_name: "陈先生",
  });
  const { data: paid } = await owner.client.rpc("add_ledger_entry", {
    in_project_id: P,
    in_module_key: "payments",
    in_amount_cents: 300000,
    in_party: "陈先生",
  });
  check(
    "老板手上一单、一个客户、一笔收款",
    !!job?.id && !!cust?.id && !!paid?.id,
  );

  // ① ADDING SOMEBODY ─────────────────────────────────────────────────────
  console.log("\n① 把人加进来");

  const { error: strangerErr } = await owner.client.rpc("add_project_member", {
    in_email: `nobody-${stamp}@formae.test`,
  });
  check(
    "一个还没注册的 email，讲清楚而不是造一行指向空气的",
    !!strangerErr && /no account yet/i.test(strangerErr.message || ""),
    strangerErr?.message,
  );

  const { error: selfErr } = await owner.client.rpc("add_project_member", {
    in_email: owner.email,
  });
  check("老板加自己，被挡", !!selfErr, selfErr ? "" : "it accepted the owner");

  const { data: member, error: addErr } = await owner.client.rpc(
    "add_project_member",
    { in_email: staff.email },
  );
  check("老板加得了他的师傅", !!member && member.user_id === staff.id, addErr?.message);
  check("加进来就是上工的", member?.active === true && member?.role === "staff");

  /* Pressing invite twice is a normal thing for a person to do. */
  const { error: againErr } = await owner.client.rpc("add_project_member", {
    in_email: staff.email,
  });
  check("再加一次同一个人，不会报错", !againErr, againErr?.message);

  // ② WHAT THE STAFF MEMBER CAN SEE ───────────────────────────────────────
  console.log("\n② 师傅看得到的");

  const seeJobs = await S.from("pipeline_records").select("id").eq("project_id", P);
  check("看得到工程/报价单", (seeJobs.data ?? []).length === 1, `${(seeJobs.data ?? []).length} rows`);

  const seeCust = await S.from("directory_entries").select("id").eq("project_id", P);
  check("看得到客户名单", (seeCust.data ?? []).length === 1, `${(seeCust.data ?? []).length} rows`);

  const seePages = await S.from("project_pages").select("page_key").eq("project_id", P);
  check("看得到老板系统的页面", (seePages.data ?? []).length > 0, `${(seePages.data ?? []).length} pages`);

  const seeProj = await S.from("projects").select("id").eq("id", P);
  check("看得到这家公司本身", (seeProj.data ?? []).length === 1);

  // ③ 🔴 THE MONEY ────────────────────────────────────────────────────────
  console.log("\n③ 🔴 钱");

  const seeMoney = await S.from("ledger_entries").select("id").eq("project_id", P);
  check("收款一笔都看不到", (seeMoney.data ?? []).length === 0, `saw ${(seeMoney.data ?? []).length}`);

  /* Not「the list came back empty」-- 「the one row he knows the id of is not
     readable」. An empty list can be an empty list; this cannot. */
  const namedRow = await S.from("ledger_entries").select("id").eq("id", paid.id);
  check("就算知道那一笔的编号，也读不出来", (namedRow.data ?? []).length === 0);

  /* ⚠️ THE CONTROL, and it is not decoration. 「0 rows」 is also what a typo in
     the table name, a dropped session or a filter on the wrong column returns.
     The owner reading 1 through the identical call is what makes the 0 above
     mean「refused」rather than「asked wrongly」. */
  const ownerMoney = await owner.client
    .from("ledger_entries").select("id").eq("project_id", P);
  check("而老板自己读得到那一笔（不然「读不到」不算数）",
    (ownerMoney.data ?? []).length === 1, `${(ownerMoney.data ?? []).length} rows`);

  const { error: payErr } = await S.rpc("add_ledger_entry", {
    in_project_id: P,
    in_module_key: "payments",
    in_amount_cents: 999900,
    in_party: "他自己",
  });
  check("也记不了一笔收款", !!payErr, payErr ? "" : "a supervisor booked a payment");

  const { error: revErr } = await S.rpc("reverse_ledger_entry", {
    in_id: paid.id,
    in_note: "试试",
  });
  check("冲正不了老板的那一笔", !!revErr, revErr ? "" : "a supervisor reversed a payment");

  // ④ WHAT HE CAN DO, WHICH IS THE POINT OF THE ROLE ──────────────────────
  console.log("\n④ 师傅做得到的（不然请他进来干嘛）");

  const { data: hisJob, error: jobErr } = await S.rpc("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "quotations",
    in_title: "工地补一单",
    in_party: "李太太",
  });
  check("加得了一单", !!hisJob?.id, jobErr?.message);
  check("而那一单记在老板的公司里", hisJob?.project_id === P);

  const { data: hisCust, error: custErr } = await S.rpc("add_directory_entry", {
    in_project_id: P,
    in_module_key: "customers",
    in_name: "李太太",
  });
  check("加得了一个客户", !!hisCust?.id, custErr?.message);

  const { data: edited, error: editErr } = await S.rpc("update_pipeline_record", {
    in_id: hisJob.id,
    in_title: "工地补一单（改过）",
  });
  check("改得动自己写的那一单", !!edited?.title?.includes("改过"), editErr?.message);

  const { data: lines, error: lineErr } = await S.rpc("set_record_lines", {
    in_record_id: hisJob.id,
    in_lines: [{ description: "拆除", amount_cents: 300000 }],
  });
  check("写得了逐项明细", (lines ?? []).length === 1, lineErr?.message);

  // ⑤ WHAT IS STILL THE OWNER'S ALONE ─────────────────────────────────────
  console.log("\n⑤ 还是只有老板能做的");

  const { error: saveErr } = await S.rpc("save_project_page", {
    in_page_key: "overview",
    in_layout: { content: [], root: {} },
  });
  check("师傅动不了系统的版面", !!saveErr, saveErr ? "" : "a supervisor saved a layout");

  const wrotePage = await S.from("project_pages")
    .update({ title: "被改了" })
    .eq("project_id", P)
    .select("page_key");
  check(
    "也绕不过去直接改那张表",
    !!wrotePage.error || (wrotePage.data ?? []).length === 0,
    `${(wrotePage.data ?? []).length} rows written`,
  );

  const { data: hisMember } = await S.rpc("add_project_member", {
    in_email: other.email,
  });
  check(
    "师傅加人，加的是他自己那间，不是老板这间",
    hisMember?.project_id === staff.project && hisMember?.project_id !== P,
    `landed in ${hisMember?.project_id}`,
  );

  const stillMine = await admin
    .from("project_members")
    .select("user_id")
    .eq("project_id", P);
  check("老板这间还是只有一个师傅", (stillMine.data ?? []).length === 1, `${(stillMine.data ?? []).length} members`);

  // ⑥ THE STRANGER ────────────────────────────────────────────────────────
  console.log("\n⑥ 不相干的人");

  const oJobs = await O.from("pipeline_records").select("id").eq("project_id", P);
  const oCust = await O.from("directory_entries").select("id").eq("project_id", P);
  const oPages = await O.from("project_pages").select("page_key").eq("project_id", P);
  check(
    "看不到工程 · 客户 · 页面",
    (oJobs.data ?? []).length === 0 &&
      (oCust.data ?? []).length === 0 &&
      (oPages.data ?? []).length === 0,
  );
  const { error: oAdd } = await O.rpc("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "quotations",
    in_title: "偷写一单",
  });
  check("也写不进来", !!oAdd);

  // ⑥b 🔴 THE WIRE: WHICH BUSINESS DOES HE LAND IN ────────────────────────
  console.log("\n⑥b 🔴 他一登入，站在哪一间（这一条是「线接上了没有」）");

  /* The owner has actually set his business up; the supervisor never did.
     That difference is the signal my_workspace() reads. */
  await owner.client.rpc("set_project_style", { in_style: "ledger" });

  const { data: ownerWs } = await owner.client.rpc("my_workspace");
  check("老板站在自己那一间，身份是老板",
    ownerWs?.[0]?.project_id === P && ownerWs?.[0]?.role === "owner",
    JSON.stringify(ownerWs));

  const { data: staffWs } = await S.rpc("my_workspace");
  check("师傅站在老板那一间，不是自己签注册时那间空壳",
    staffWs?.[0]?.project_id === P && staffWs?.[0]?.role === "staff",
    JSON.stringify(staffWs));
  check("而那间空壳确实是他自己的（不是这条规则找不到东西）",
    staff.project !== P);

  const { data: staffCtx } = await S.rpc("get_my_business_context");
  const { data: ownerCtx } = await owner.client.rpc("get_my_business_context");
  check("师傅读到的是老板公司的名字跟语言，不是一份空的",
    JSON.stringify(staffCtx?.identity) === JSON.stringify(ownerCtx?.identity),
    `${JSON.stringify(staffCtx?.identity)} vs ${JSON.stringify(ownerCtx?.identity)}`);

  const { data: roster } = await owner.client.rpc("list_project_members");
  check("老板看得到名单，而且是 email 不是一串编号",
    (roster ?? []).length === 1 && roster[0].email === staff.email,
    JSON.stringify(roster));
  /* He asks the same question and gets HIS OWN shop's roster -- which in this
     run is the stranger he added back in ⑤, not his boss's supervisor list.
     「a different answer」 is the assertion; 「an empty answer」 would also be
     what a broken function returns. */
  const { data: staffRoster } = await S.rpc("list_project_members");
  check("师傅问名单，问到的是他自己那间的",
    (staffRoster ?? []).length === 1 && staffRoster[0].email === other.email,
    JSON.stringify(staffRoster));

  /* ⑤ made the stranger a member of the SUPERVISOR's own shop, so this is
     where he belongs -- and the thing that matters is that it is never P. */
  const { data: strangerWs } = await O.rpc("my_workspace");
  check("被请去另一间的人，站的是那一间，不是老板这一间",
    strangerWs?.[0]?.project_id === staff.project && strangerWs?.[0]?.project_id !== P,
    JSON.stringify(strangerWs));

  // ⑦ 🔴 SWITCHING SOMEBODY OFF ───────────────────────────────────────────
  console.log("\n⑦ 🔴 关掉一个人（vibe-dealer 0038 量到的那一件）");

  const { data: off, error: offErr } = await owner.client.rpc("set_member_active", {
    in_user_id: staff.id,
    in_active: false,
  });
  check("老板关得掉他", off?.active === false, offErr?.message);

  /* SAME session, same token, no re-login -- that is exactly the state he
     measured 284 rows through. */
  const afterJobs = await S.from("pipeline_records").select("id").eq("project_id", P);
  check("同一个还没过期的登入，工程读不到了", (afterJobs.data ?? []).length === 0, `still saw ${(afterJobs.data ?? []).length}`);

  const afterCust = await S.from("directory_entries").select("id").eq("project_id", P);
  check("客户也读不到了", (afterCust.data ?? []).length === 0);

  const afterProj = await S.from("projects").select("id").eq("id", P);
  check("连这家公司都不在了", (afterProj.data ?? []).length === 0);

  const { error: afterWrite } = await S.rpc("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "quotations",
    in_title: "关掉之后还写",
  });
  check("也写不进去了", !!afterWrite);

  /* Same control on the other side: the owner must be unaffected. Otherwise
     「the supervisor can no longer see it」 would also be satisfied by having
     broken the table for everybody. */
  const ownerAfter = await owner.client
    .from("pipeline_records").select("id").eq("project_id", P);
  check("而老板自己照样看得到（关掉的是一个人，不是这张表）",
    (ownerAfter.data ?? []).length === 2, `${(ownerAfter.data ?? []).length} rows`);

  const stillThere = await admin
    .from("pipeline_records")
    .select("id")
    .eq("id", hisJob.id)
    .single();
  check("而他写过的东西一行都没少", !!stillThere.data?.id);

  const ownMember = await S.from("project_members")
    .select("active")
    .eq("user_id", staff.id);
  check(
    "他自己看得到自己被关掉了",
    (ownMember.data ?? []).some((r) => r.active === false),
  );

  const { data: offWs } = await S.rpc("my_workspace");
  check("关掉之后，他站回自己那间空壳，不是站在一个打不开的地方",
    offWs?.[0]?.project_id === staff.project && offWs?.[0]?.role === "owner",
    JSON.stringify(offWs));

  const { data: back } = await owner.client.rpc("set_member_active", {
    in_user_id: staff.id,
    in_active: true,
  });
  const backJobs = await S.from("pipeline_records").select("id").eq("project_id", P);
  check(
    "开回来，东西也回来",
    back?.active === true && (backJobs.data ?? []).length === 2,
    `${(backJobs.data ?? []).length} rows`,
  );

  /* ── 🔴 「这个客户欠多少」也是钱 ───────────────────────────────────────
     `party_debts` 是 security definer，所以它**绕过 RLS** —— 它 join 的
     `ledger_allocations` 是老板一个人的。第一版我把它的守卫写成
     `works_here`，那样一个师傅打这一支就学得到每一个客户欠多少。
     在推上去之前改成 `sees_money`，而这一条是让它不可以再改回去。 */

  /* ⚠️ **先造一笔真的欠款。** 第一版没有造，於是这一段在守卫坏掉的时候
     照样全绿 —— 因为那个测试专案里根本没有人欠钱，**老板跟师傅都拿回 0 行**。
     一把量不到的尺回报的是沉默，不是警报。
     故意把 `party_debts` 改回 `works_here` 推上去，才看到这件事。 */
  const { data: owingParty } = await owner.client.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "欠钱的",
  });
  await owner.client.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations", in_title: "还没收的一单",
    in_party: "欠钱的", in_party_id: owingParty.id, in_amount_cents: 1_500_000,
  });

  const ownerDebts = await owner.client.rpc("party_debts", { in_project_id: P });
  const staffDebts = await S.rpc("party_debts", { in_project_id: P });
  /* 老板那一边先要真的看得到，这一段才量得到东西。 */
  check("老板问得到「谁欠多少」（不然下面那一条是空的）",
    (ownerDebts.data ?? []).length >= 1,
    `拿回 ${(ownerDebts.data ?? []).length} 行 · ${ownerDebts.error?.message ?? ""}`);
  check("师傅问不到「谁欠多少」",
    (staffDebts.data ?? []).length === 0,
    `拿回 ${(staffDebts.data ?? []).length} 行 · ${staffDebts.error?.message ?? ""}`);

  /* ── 🔴 佣金也是薪水 ─────────────────────────────────────────────────
     一个师傅看不到自己抽几成 —— 那听起来不近人情，直到你想到
     **他也看不到别人抽几成**。这一张表就是薪水，而薪水在这个 schema 里
     从来不是共用的。

     ⚠️ 照上一段学到的：**先造一份真的佣金**。没有的话，守卫坏掉的时候
     老板跟师傅都拿回 0 行，这一段照样全绿。 */
  const { data: aida } = await owner.client.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Aida",
  });
  await owner.client.rpc("set_commission_tiers", {
    in_party_id: aida.id, in_tiers: [{ from_cents: 0, percent: 10 }],
  });
  await owner.client.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments",
    in_amount_cents: 500_000, in_party: "", in_done_by: aida.id,
  });
  const month = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur", year: "numeric", month: "2-digit",
  }).format(new Date()).slice(0, 7);

  const ownerTiers = await owner.client.from("commission_tiers").select("id");
  const staffTiers = await S.from("commission_tiers").select("id");
  check("老板看得到那份佣金办法（不然下面那一条是空的）",
    (ownerTiers.data ?? []).length >= 1,
    `拿回 ${(ownerTiers.data ?? []).length} 行 · ${ownerTiers.error?.message ?? ""}`);
  check("师傅看不到任何人的佣金办法",
    (staffTiers.data ?? []).length === 0,
    `拿回 ${(staffTiers.data ?? []).length} 行`);

  const ownerPay = await owner.client.rpc("staff_earnings", { in_project_id: P, in_month: month });
  const staffPay = await S.rpc("staff_earnings", { in_project_id: P, in_month: month });
  check("老板算得出这个月谁做了多少（不然下面那一条是空的）",
    (ownerPay.data ?? []).length >= 1,
    `拿回 ${(ownerPay.data ?? []).length} 行 · ${ownerPay.error?.message ?? ""}`);
  /* 🔴 `staff_earnings` 是 security definer，所以它**绕过 RLS**。
     它的守卫是函式第一行那句 sees_money，跟 party_debts 同一条。 */
  check("师傅算不出别人这个月做了多少",
    (staffPay.data ?? []).length === 0,
    `拿回 ${(staffPay.data ?? []).length} 行`);

  /* ── 🔴 套票是唯一一样「师傅看得到」的客人资料 ───────────────────────
     一个前台要跟客人讲「你还剩三次」，不然这一整件事没有用。
     而那张表上**没有金额那一栏** —— 价钱住在付款那一笔上，那是 sees_money。
     所以这不是把钱交出去，是那条界线自己长出来的结果（20260904190000）。 */
  const { data: sheBought } = await owner.client.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "买了套票的",
  });
  await owner.client.rpc("add_service_package", {
    in_party_id: sheBought.id, in_name: "10 次洗剪吹", in_sessions_total: 10,
  });

  const ownerPacks = await owner.client.from("package_balance").select("*").eq("party_id", sheBought.id);
  const staffPacks = await S.from("package_balance").select("*").eq("party_id", sheBought.id);
  check("老板看得到那张套票（不然下面那一条是空的）",
    (ownerPacks.data ?? []).length === 1,
    `拿回 ${(ownerPacks.data ?? []).length} 行 · ${ownerPacks.error?.message ?? ""}`);
  check("🔴 师傅也看得到「还剩几次」—— 不然他没办法招呼客人",
    Number((staffPacks.data ?? [])[0]?.sessions_left) === 10,
    `拿回 ${(staffPacks.data ?? []).length} 行 · ${staffPacks.error?.message ?? ""}`);
  /* 而那一行上没有钱。 */
  check("而那一行上没有任何金额",
    !Object.keys((staffPacks.data ?? [])[0] ?? {}).some((k) => /amount|price|cents/.test(k)),
    Object.keys((staffPacks.data ?? [])[0] ?? {}).join(","));
  /* 师傅打得了卡 —— 客人来了是他在前台。 */
  const { error: staffPunch } = await S.rpc("use_package_session", {
    in_package_id: (staffPacks.data ?? [])[0]?.package_id,
  });
  check("师傅打得了卡", !staffPunch, staffPunch?.message?.slice(0, 80));


} catch (e) {
  failures.push(`threw: ${e.message}`);
  console.log(`\n  FAIL  ${e.message}`);
} finally {
  for (const id of made) await dropThrowaway(admin, id);
  console.log("\n(test accounts deleted)");
}

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("\nFAILURES:");
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("员工帐号跟权限：钱还是他一个人的。");
