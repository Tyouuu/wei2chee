/**
 * 保养合约 —— 用真的身分打，而且**故意去踩那个会让一次保养变两次的错**。
 *
 * ── 这一支真正在守的三条 ────────────────────────────────────────────────
 *
 *  🔴 **在门口按两下，不可以变成两次保养、两张单。**
 *     一个师傅站在客人门口，讯号不好，他会按第二下。
 *
 *  🔴 **改了频率，做过的那一次不可以消失。**
 *     到期日是算出来的（不预生成），所以他把三个月改成四个月，
 *     那几个日子会移位 —— 而一次真的做过的保养是历史，不是排程。
 *
 *  🔴 **合约上没有价钱。** 师傅要看得到今天去哪几家，
 *     而一份带着「一次收 RM 180」的合约，等於把价钱交给每一个师傅。
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

async function person(tag) {
  const cred = { email: `sc-${tag}-${Date.now()}@formae.test`, password: `Sc-${Date.now()}-x!` };
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
  for (const k of ["customers", "suppliers", "projects"]) {
    await as.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  return { as, projectId: proj?.id };
}

/* 日子全部钉在每个月 15 号 —— 月底那种日子（31 号）在加月份的时候
   两边（Postgres 跟 JS）处理方式不一样，那会变成一个假的差异。 */
const t = new Date();
const on15 = (monthsFromNow) =>
  new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth() + monthsFromNow, 15));
const iso = (d) => d.toISOString().slice(0, 10);

const startsOn = iso(on15(-6));      // 半年前签的
const slotA = startsOn;              // 该做的第一次（过去了）
const slotB = iso(on15(-3));         // 第二次（过去了）
const slotC = iso(on15(0));          // 第三次（这个月 15 号，还没到）
const winFrom = iso(on15(-7));
const winUntil = iso(on15(1));

try {
  const shop = await person("shop");
  const c = shop.as;
  const P = shop.projectId;
  if (!P) throw new Error("找不到那一家的专案");

  const { data: cust } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Sri Damansara Cafe",
  });

  /* ── ① 签一份合约 ─────────────────────────────────────────────────── */
  console.log("\n① 签一份：三个月洗一次冷气");
  const { data: con, error: conErr } = await c.rpc("add_service_contract", {
    in_project_id: P, in_party_id: cust.id,
    in_title: "Aircond service - 4 units",
    in_every_months: 3,
    in_starts_on: startsOn,
    in_ends_on: iso(on15(6)),
  });
  check("签得起来", !conErr && !!con?.id, conErr?.message);
  check("🔴 合约上没有一栏放金额（价钱不交给师傅）",
    con && !("amount_cents" in con) && !("price_cents" in con),
    Object.keys(con ?? {}).join(","));

  /* ── ② 这个月有哪几家要去 ─────────────────────────────────────────── */
  console.log("\n② 该来的那几次（算出来的，没有人生成过任何一行）");
  const { data: due, error: dErr } = await c.rpc("due_visits", {
    in_project_id: P, in_from: winFrom, in_until: winUntil,
  });
  check("算得出来", !dErr && (due ?? []).length === 3,
    dErr?.message ?? `${due?.length}: ${(due ?? []).map((r) => r.due_on).join(" ")}`);
  check("日子对得上", (due ?? []).map((r) => r.due_on).sort().join(" ") ===
    [slotA, slotB, slotC].sort().join(" "),
    (due ?? []).map((r) => r.due_on).join(" "));
  check("🔴 漏掉的那两次排最前面", (due ?? []).slice(0, 2).every((r) => r.overdue === true),
    JSON.stringify((due ?? []).map((r) => [r.due_on, r.overdue])));
  check("这个月还没到的那一次不算漏",
    (due ?? []).find((r) => r.due_on === slotC)?.overdue === false);
  check("三次都还没做", (due ?? []).every((r) => r.status === "due"));
  check("带得出客人的名字", (due ?? [])[0]?.party === "Sri Damansara Cafe",
    (due ?? [])[0]?.party);

  /* ── ③ 🔴 做完了，顺手变一张真的单 ────────────────────────────────── */
  console.log("\n③ 做完第一次 —— 顺手开一张单");
  const { data: v1, error: vErr } = await c.rpc("log_service_visit", {
    in_contract_id: con.id, in_due_on: slotA, in_make_job_in: "projects",
  });
  check("记得起来", !vErr && !!v1?.id, vErr?.message);
  check("🔴 真的开出一张单", !!v1?.record_id, JSON.stringify(v1));

  const { data: job } = await c
    .from("pipeline_records").select("doc_no, party, party_id, module_key")
    .eq("id", v1?.record_id).single();
  check("🔴 那张单有单号（走的是人按的那一支，不是另开一条写入路径）",
    !!job?.doc_no, JSON.stringify(job));
  check("而且连到了这个客户", job?.party_id === cust.id && job?.party === "Sri Damansara Cafe",
    JSON.stringify(job));

  const { data: after } = await c.rpc("due_visits", {
    in_project_id: P, in_from: winFrom, in_until: winUntil,
  });
  const rowA = (after ?? []).find((r) => r.due_on === slotA);
  check("那一次变成「做了」", rowA?.status === "done", JSON.stringify(rowA));
  check("而且不再算漏掉", rowA?.overdue === false);
  check("第二次还是漏着", (after ?? []).find((r) => r.due_on === slotB)?.overdue === true);

  /* ── ④ 🔴 在门口按两下 ────────────────────────────────────────────── */
  console.log("\n④ 讯号不好，他按了第二下");
  const { data: v1b } = await c.rpc("log_service_visit", {
    in_contract_id: con.id, in_due_on: slotA, in_make_job_in: "projects",
  });
  check("🔴 还是同一次，不是第二次", v1b?.id === v1.id, `${v1b?.id} vs ${v1.id}`);
  check("🔴 也没有开出第二张单", v1b?.record_id === v1.record_id);
  const { count: jobs } = await c
    .from("pipeline_records").select("id", { count: "exact", head: true })
    .eq("project_id", P).eq("module_key", "projects");
  check("🔴 那一页上只有一张单", jobs === 1, `${jobs} 张`);

  /* ── ⑤ 跳过一次 ───────────────────────────────────────────────────── */
  console.log("\n⑤ 客人说这次不用来");
  const { data: v2 } = await c.rpc("log_service_visit", {
    in_contract_id: con.id, in_due_on: slotB, in_status: "skip",
    in_note: "Customer away",
  });
  check("跳得过", v2?.status === "skip", JSON.stringify(v2));
  check("跳过的没有开单（他没有去，没有东西可以收钱）", !v2?.record_id);
  const { data: afterSkip } = await c.rpc("due_visits", {
    in_project_id: P, in_from: winFrom, in_until: winUntil,
  });
  const rowB = (afterSkip ?? []).find((r) => r.due_on === slotB);
  check("🔴 跳过的那一次还在清单上（不是被删掉）", rowB?.status === "skip",
    JSON.stringify(rowB));
  check("而且不再算漏掉", rowB?.overdue === false);

  /* ── ⑥ 🔴 改了频率，做过的那一次不可以消失 ────────────────────────── */
  console.log("\n⑥ 他把起始日往后挪一个月（那几个日子会整批移位）");
  const { error: upErr } = await c.rpc("update_service_contract", {
    in_contract_id: con.id, in_starts_on: iso(on15(-5)),
  });
  check("改得了", !upErr, upErr?.message);
  const { data: moved } = await c.rpc("due_visits", {
    in_project_id: P, in_from: winFrom, in_until: winUntil,
  });
  const stillA = (moved ?? []).find((r) => r.due_on === slotA);
  const stillB = (moved ?? []).find((r) => r.due_on === slotB);
  check("🔴 做过的那一次还在", stillA?.status === "done",
    (moved ?? []).map((r) => `${r.due_on}:${r.status}`).join(" "));
  check("🔴 跳过的那一次也还在", stillB?.status === "skip");
  check("新的那几个日子也算出来了", (moved ?? []).length > 3, `${moved?.length}`);

  /* ── ⑦ 记错了 ─────────────────────────────────────────────────────── */
  console.log("\n⑦ 按错了，撤销");
  const { data: undone } = await c.rpc("undo_service_visit", {
    in_contract_id: con.id, in_due_on: slotB,
  });
  check("撤销得了", undone === true, `${undone}`);
  const { data: afterUndo } = await c.rpc("due_visits", {
    in_project_id: P, in_from: winFrom, in_until: winUntil,
  });
  /* ⚠️ 这一条我第一版写错了，红的是我的期望不是产品（第五次）。
     第 ⑥ 步把起始日挪走之后，这个日子**已经不是一个该来的日子**了 ——
     它还留在清单上，是因为那一行记录把它 union 进来。
     删掉那一行，它整个消失，而那正是对的。 */
  check("🔴 撤销之后那个日子整个不见（它本来就不再是该来的日子了）",
    (afterUndo ?? []).every((r) => r.due_on !== slotB),
    (afterUndo ?? []).map((r) => r.due_on).join(" "));

  /* 把起始日挪回去 —— 它就该再变回「还没做」。 */
  await c.rpc("update_service_contract", {
    in_contract_id: con.id, in_starts_on: startsOn,
  });
  const { data: restored } = await c.rpc("due_visits", {
    in_project_id: P, in_from: winFrom, in_until: winUntil,
  });
  check("挪回去之后，它退回「还没做」",
    (restored ?? []).find((r) => r.due_on === slotB)?.status === "due",
    (restored ?? []).map((r) => `${r.due_on}:${r.status}`).join(" "));
  check("而做过的那一次还是「做了」",
    (restored ?? []).find((r) => r.due_on === slotA)?.status === "done");
  const { count: stillOne } = await c
    .from("pipeline_records").select("id", { count: "exact", head: true })
    .eq("project_id", P).eq("module_key", "projects");
  check("🔴 撤销不会删掉已经开出去的单（单号发出去了）", stillOne === 1, `${stillOne}`);

  /* ── ⑧ 快到期的合约 —— 年金在这里 ─────────────────────────────────── */
  console.log("\n⑧ 快到期的");
  const { data: soon } = await c.rpc("contracts_ending", {
    in_project_id: P, in_within_days: 30,
  });
  check("半年后到期的，30 天内不会吵他", (soon ?? []).length === 0, `${soon?.length}`);
  const { data: wide } = await c.rpc("contracts_ending", {
    in_project_id: P, in_within_days: 240,
  });
  check("窗口开够就看得到", (wide ?? []).length === 1, `${wide?.length}`);
  check("数得出做过几次", Number((wide ?? [])[0]?.visits_done) === 1,
    JSON.stringify(wide?.[0]));

  /* ── ⑨ 挡下来的那几件 ─────────────────────────────────────────────── */
  console.log("\n⑨ 挡下来的");
  const { data: sup } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "suppliers", in_name: "Cold Air Supply",
  });
  const { error: supErr } = await c.rpc("add_service_contract", {
    in_project_id: P, in_party_id: sup.id, in_title: "x", in_every_months: 6,
  });
  check("🔴 供应商身上签不了保养合约", !!supErr, supErr?.message ?? "居然让它过了");

  const { error: wideErr } = await c.rpc("due_visits", {
    in_project_id: P, in_from: iso(on15(-30)), in_until: iso(on15(6)),
  });
  check("窗口开太宽会挡（一份十年的月度合约会算出一百多个日子）",
    !!wideErr, wideErr?.message ?? "居然让它过了");

  const { error: badPage } = await c.rpc("log_service_visit", {
    in_contract_id: con.id, in_due_on: slotC, in_make_job_in: "customers",
  });
  check("开不到一个放不了单据的页面上", !!badPage, badPage?.message ?? "居然让它过了");

  /* ── ⑩ 别人家 ─────────────────────────────────────────────────────── */
  console.log("\n⑩ 别人家");
  const other = await person("other");
  const { data: theirs } = await other.as.rpc("due_visits", {
    in_project_id: P, in_from: winFrom, in_until: winUntil,
  });
  check("别人家看不到这一家要去哪几户", (theirs ?? []).length === 0, `${theirs?.length}`);
  const { data: theirEnd } = await other.as.rpc("contracts_ending", {
    in_project_id: P, in_within_days: 240,
  });
  check("也看不到这一家的续约名单", (theirEnd ?? []).length === 0, `${theirEnd?.length}`);
  const { error: theirLog } = await other.as.rpc("log_service_visit", {
    in_contract_id: con.id, in_due_on: slotC,
  });
  check("也记不了这一家的保养", !!theirLog, theirLog?.message ?? "居然让它过了");
  const { data: peek } = await other.as
    .from("service_contracts").select("id").eq("project_id", P);
  check("🔴 那张表也读不到", (peek ?? []).length === 0, `${peek?.length} 行`);

  console.log("\n⑪ 🔴 那一位要真的是这家的人——log_service_visit 现在验了");
  await other.as.rpc("add_project_page", { requested_key: "staff", new_title: "staff" });
  const { data: foreignStaff } = await other.as.rpc("add_directory_entry", {
    in_project_id: other.projectId, in_module_key: "staff", in_name: "Not Ours",
  });
  const { error: foreignStaffErr } = await c.rpc("log_service_visit", {
    in_contract_id: con.id, in_due_on: slotC, in_staff_id: foreignStaff.id,
  });
  check("🔴 别人家的员工编号——挡下来", !!foreignStaffErr,
    foreignStaffErr?.message ?? "居然让它过了");
  const { data: ownStaff } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Our Own",
  });
  const { data: ownVisit, error: ownStaffErr } = await c.rpc("log_service_visit", {
    in_contract_id: con.id, in_due_on: slotC, in_staff_id: ownStaff.id,
  });
  check("而这家自己的员工照旧记得下", !ownStaffErr && ownVisit?.staff_id === ownStaff.id,
    ownStaffErr?.message ?? JSON.stringify(ownVisit));
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${failed.length === 0 ? "全过" : `${failed.length} 条没过`}`);
process.exit(failed.length ? 1 : 0);
