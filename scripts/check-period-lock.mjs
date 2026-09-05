/**
 * 他签过字的那个月不会再自己变 —— 用真的登入身分打。
 *
 * 🔴 这一支量的是这四个洞里**唯一一个「收紧」**，而收紧要量的东西跟「加」
 *    不一样：**除了「挡得住」，更要量「没有挡到不该挡的」**。
 *    一道挡太宽的锁，在画面上只看得到「存不了」，而他会去把整个功能关掉。
 *
 * 所以这一支一半的断言是**反面**的：
 *   · 还没签之前照样补得进去（控制组 —— 少了它，量的是空气）
 *   · 补一张收据 · 改一句注解 · 改「谁做的」，在关掉的月份里照样做得了
 *   · 他签的是「进」，那个月的「出」照样记得进去
 *   · **这个月不锁** —— 客人从付款连结付进来那一笔没有别的地方去
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

/** 马来西亚的月份，不是伺服器的（产品那一边用 today_myt()）。 */
const monthOf = (n) => {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const firstOf = (n) => `${monthOf(n)}-01`;
const midOf = (n) => `${monthOf(n)}-15`;
const locked = (e) => !!e && /period_locked/.test(e.message);

async function person(tag, pages) {
  const cred = { email: `plk-${tag}-${Date.now()}@formae.test`, password: `Plk-${Date.now()}-x!` };
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
  for (const k of pages) await as.rpc("add_project_page", { requested_key: k, new_title: k });
  return { as, cred, userId: user.user.id, projectId: proj?.id };
}

async function main() {
  const owner = await person("owner", ["payments", "expenses", "reconciliation", "customers"]);
  const { as: C, projectId: P } = owner;

  const money = async (monthN, cents, dir = "in", note = "") => {
    const mod = dir === "in" ? "payments" : "expenses";
    return C.rpc("add_ledger_entry", {
      in_project_id: P, in_module_key: mod, in_direction: dir,
      in_amount_cents: cents, in_party: "Ravi Kumar",
      in_entry_on: midOf(monthN), in_note: note,
    });
  };

  // ── ① 上个月的钱，跟一张还没签的对帐单 ────────────────────────────────
  console.log("\n① 上个月的钱，跟一张还没签的对帐单");

  const { data: first, error: e1 } = await money(-1, 3800000, "in", "August takings");
  check("上个月记得进钱", !e1 && !!first?.id, e1?.message);

  const { data: recId, error: recErr } = await C.rpc("add_reconciliation", {
    in_project_id: P, in_module_key: "reconciliation",
    in_period: firstOf(-1), in_source: "Upstream statement",
    in_their_cents: 3800000, in_direction: "in",
  });
  check("上游的月结单进得来", !recErr && !!recId, recErr?.message);

  /* 🔴 控制组。少了这一条，底下那一条「挡得住」量的是空气 ——
     一个本来就写不进去的地方，挡不挡都一样红（任务 125 学到的）。 */
  const { error: beforeErr } = await money(-1, 99900, "in", "before he signed");
  check("🔴 控制组：还没签之前，补得进去", !beforeErr, beforeErr?.message?.slice(0, 80));

  const { data: notYet } = await C.rpc("is_period_locked", {
    in_project_id: P, in_on: midOf(-1), in_direction: "in",
  });
  check("而画面问得到「还没锁」", notYet === false, `${notYet}`);

  // ── ② 他签了字 ───────────────────────────────────────────────────────
  console.log("\n② 🔴 他签了字");

  await C.rpc("set_reconciliation_settled", { in_id: recId, in_settled: true });

  const { data: nowLocked } = await C.rpc("is_period_locked", {
    in_project_id: P, in_on: midOf(-1), in_direction: "in",
  });
  check("画面问得到「锁了」，不用等他按下去才讲", nowLocked === true, `${nowLocked}`);

  const { error: afterErr } = await money(-1, 99900, "in", "forgotten August sale");
  check("🔴 补不进去了", locked(afterErr), afterErr?.message?.slice(0, 90) ?? "居然让它过了");
  check("而且那句话讲得出该怎么做",
    /reopen that month/.test(afterErr?.message ?? ""), afterErr?.message?.slice(0, 120));

  const { count: stillThere } = await C
    .from("ledger_entries").select("id", { count: "exact", head: true })
    .eq("project_id", P).eq("direction", "in");
  check("被挡下来之后，原本那两笔还在", stillThere === 2, `${stillThere}`);

  // ── ③ 🔴 关掉的月份里，照样做得了事 ──────────────────────────────────
  console.log("\n③ 🔴 关掉的月份里照样做得了事");

  const { error: noteErr } = await C.rpc("update_ledger_words", {
    in_id: first.id, in_note: "客人说这一笔是八月十号转的",
  });
  check("改一句注解，过", !noteErr, noteErr?.message?.slice(0, 80));

  const { error: recptErr } = await C.rpc("update_ledger_words", {
    in_id: first.id, in_receipt_url: "receipts/aug.jpg", in_reference: "TRX-88",
  });
  check("补一张收据，过", !recptErr, recptErr?.message?.slice(0, 80));

  const { data: aida } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Aida Rahman",
  });
  const { error: whoErr } = await C.rpc("update_ledger_words", {
    in_id: first.id, in_done_by: aida.id,
  });
  check("改「谁做的」，过", !whoErr, whoErr?.message?.slice(0, 80));

  // ── ④ 会动那个总数的三样，挡 ─────────────────────────────────────────
  console.log("\n④ 会动那个总数的三样");

  const { error: amtErr } = await C
    .from("ledger_entries").update({ amount_cents: 4000000 }).eq("id", first.id);
  check("🔴 改金额，挡", locked(amtErr), amtErr?.message?.slice(0, 80) ?? "居然让它过了");

  /* ⚠️ 第一版我写的是 `midOf(-1)` —— **跟它原本的日子一模一样**，
     於是那条「动不到总数就放过」的快路正确地放它过了，
     而红的看起来像产品坏了。**第十二次红的是我的道具。**
     改成同一个月的另一天，那才是真的在改日子。 */
  const { error: dayErr } = await C
    .from("ledger_entries").update({ entry_on: `${monthOf(-1)}-20` }).eq("id", first.id);
  /* 🔴 同一个月里挪一天，那个月的总数其实**一分都不会动** —— 而照样挡。
     理由跟他 0031 一样：日子就是这一行属於哪个月的凭据，
     在一本已经签过的帐里让它漂，没有任何好处；真的要改就重开那个月。 */
  check("同一个月里改日子，也挡（就算总数不会动）", locked(dayErr),
    dayErr?.message?.slice(0, 80) ?? "居然让它过了");

  /* ⑤ 搬出去一样会动那个月 —— 所以旧日子也要看。 */
  const { error: outErr } = await C
    .from("ledger_entries").update({ entry_on: midOf(0) }).eq("id", first.id);
  check("🔴 把它搬出那个月，也挡", locked(outErr), outErr?.message?.slice(0, 80) ?? "居然让它过了");

  const { error: delErr } = await C.from("ledger_entries").delete().eq("id", first.id);
  check("删掉它，也挡", locked(delErr), delErr?.message?.slice(0, 80) ?? "居然让它过了");

  /* 🔴 绕过那几支函式直接写，也挡 —— `ledger_entries` 的 policy 是 for all。 */
  const { error: rawErr } = await C.from("ledger_entries").insert({
    project_id: P, module_key: "payments", doc_no: "RAW-1",
    direction: "in", amount_cents: 12345, entry_on: midOf(-1),
  });
  check("🔴 绕过那几支函式直接写，也挡", locked(rawErr), rawErr?.message?.slice(0, 80) ?? "居然让它过了");

  // ── ⑤ 只锁他签过的那一边 ─────────────────────────────────────────────
  console.log("\n⑤ 只锁他签过的那一边");

  const { error: outSideErr } = await money(-1, 50000, "out", "August cement");
  check("🔴 他签的是「进」，那个月的「出」照样记得进去", !outSideErr,
    outSideErr?.message?.slice(0, 90));

  const { data: outLocked } = await C.rpc("is_period_locked", {
    in_project_id: P, in_on: midOf(-1), in_direction: "out",
  });
  check("而画面也讲得出那一边没锁", outLocked === false, `${outLocked}`);

  // ── ⑥ 🔴 这个月不锁 —— 外面进来的钱没有别的地方去 ───────────────────
  console.log("\n⑥ 🔴 这个月不锁");

  const { data: recNow } = await C.rpc("add_reconciliation", {
    in_project_id: P, in_module_key: "reconciliation",
    in_period: firstOf(0), in_source: "Upstream mid-month", in_their_cents: 100,
    in_direction: "in",
  });
  await C.rpc("set_reconciliation_settled", { in_id: recNow, in_settled: true });
  const { error: thisMonthErr } = await money(0, 300000, "in", "a payment that just landed");
  check("🔴 这个月签了字，钱照样进得来", !thisMonthErr, thisMonthErr?.message?.slice(0, 90));
  const { data: curLocked } = await C.rpc("is_period_locked", {
    in_project_id: P, in_on: midOf(0), in_direction: "in",
  });
  check("而且它老实讲这个月没锁", curLocked === false, `${curLocked}`);

  // ── ⑦ 重开 → 改 → 再关，就是唯一的绕过方法 ──────────────────────────
  console.log("\n⑦ 重开 → 改 → 再关");

  await C.rpc("set_reconciliation_settled", { in_id: recId, in_settled: false });
  const { data: reopened, error: reopenErr } = await money(-1, 99900, "in", "the forgotten one");
  check("重开之后补得进去", !reopenErr && !!reopened?.id, reopenErr?.message?.slice(0, 80));
  await C.rpc("set_reconciliation_settled", { in_id: recId, in_settled: true });
  const { error: shutAgain } = await money(-1, 111, "in", "and shut again");
  check("再关起来，又挡住了", locked(shutAgain), shutAgain?.message?.slice(0, 80) ?? "居然让它过了");

  /* 🔴 没有逐笔的例外旗子 —— 抄他 0031 的判断。这一条量的是**没有**东西：
     `ledger_entries` 上不准长出一个「这一笔不受锁管」的栏位。 */
  const { data: cols } = await C.from("ledger_entries").select("*").limit(1);
  const flags = Object.keys(cols?.[0] ?? {}).filter((k) =>
    /override|bypass|ignore_lock|unlocked/i.test(k));
  check("🔴 那张表上没有逐笔的例外旗子", flags.length === 0, flags.join(","));

  // ── ⑧ 收起来的对帐单不锁 ─────────────────────────────────────────────
  console.log("\n⑧ 收起来的对帐单");

  const { data: rec2 } = await C.rpc("add_reconciliation", {
    in_project_id: P, in_module_key: "reconciliation",
    in_period: firstOf(-2), in_source: "Old one", in_their_cents: 1, in_direction: "in",
  });
  await C.rpc("set_reconciliation_settled", { in_id: rec2, in_settled: true });
  const { error: twoAgo } = await money(-2, 1000, "in", "two months back");
  check("两个月前也锁得住", locked(twoAgo), twoAgo?.message?.slice(0, 80) ?? "居然让它过了");
  await C.rpc("set_reconciliation_archived", { in_id: rec2, in_archived: true });
  const { error: afterArchive } = await money(-2, 1000, "in", "after archiving it");
  check("收起来那张对帐单之后，就不锁了", !afterArchive, afterArchive?.message?.slice(0, 80));

  // ── ⑨ 别人家 ─────────────────────────────────────────────────────────
  console.log("\n⑨ 别人家");

  const other = await person("other", ["payments"]);
  const { data: theirs } = await other.as.rpc("is_period_locked", {
    in_project_id: P, in_on: midOf(-1), in_direction: "in",
  });
  check("🔴 别人家问不到我的月份锁没锁", theirs === false, `${theirs}`);
  const { error: coreErr } = await other.as.rpc("period_lock_hit", {
    in_project_id: P, in_on: midOf(-1), in_direction: "in",
  });
  check("而没有守卫的那一支，一个人都打不到", !!coreErr, "居然让它过了");

  await dropThrowaways(admin, made);
}

main()
  .then(() => {
    console.log(
      failed.length === 0 ? `\n判：全过` : `\n判：${failed.length} 条没过 —— ${failed.join(" · ")}`,
    );
    process.exit(failed.length === 0 ? 0 : 1);
  })
  .catch(async (e) => {
    console.error("\n" + e.message);
    await dropThrowaways(admin, made).catch(() => {});
    process.exit(1);
  });
