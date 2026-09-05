/**
 * 佣金率的历史 —— 用真的登入身分打。
 *
 * 🔴 这一支只为一条断言存在，其余都是它的配套：
 *
 *   **今天把率从一成改成一成半，上个月那个数字一分都不准动。**
 *
 * 走 vibe-dealer 那一次（任务 175）量出来的就是它坏掉的样子：
 * 上个月本来 RM 760，改完率之后变 RM 1,140 —— 一个已经付掉的月份，
 * 数字自己动了 RM 380，而画面上没有任何东西会讲。
 *
 * ⚠️ 第 ⑤ 段是反过来的那一半，而它一样要守：**他自己写一个过去的日期，
 *    那个月就该动** —— 那是他讲的，不是我们偷偷做的。一支只会「不动」的
 *    函式，等於他打错一次率就永远改不回来。
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

/**
 * 🔴 **马来西亚的月份，不是伺服器的。** 产品那一边用 `today_myt()`（UTC+8），
 * 而这一支整支在数月份 —— 照 UTC 算，每个月一号的头八个钟头会差一个月，
 * 而那一条红看起来会像产品坏了（check:rentals 那一次就是这样，第九次）。
 */
const monthOf = (n) => {
  const d = new Date(Date.now() + 8 * 3600 * 1000);
  d.setUTCDate(1);
  d.setUTCMonth(d.getUTCMonth() + n);
  return d.toISOString().slice(0, 7);
};
const firstOf = (n) => `${monthOf(n)}-01`;
const midOf = (n) => `${monthOf(n)}-15`;
const todayMyt = () => new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);

async function person(tag, pages) {
  const cred = {
    email: `cmh-${tag}-${Date.now()}@formae.test`,
    password: `Cmh-${Date.now()}-x!`,
  };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email,
    password: cred.password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);

  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: sErr } = await as.auth.signInWithPassword(cred);
  if (sErr) throw new Error(`sign-in(${tag}): ${sErr.message}`);

  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", user.user.id)
    .single();
  for (const k of pages) await as.rpc("add_project_page", { requested_key: k, new_title: k });
  return { as, cred, userId: user.user.id, projectId: proj?.id };
}

/** 那个月，那个人，赚多少 · 抽多少 · 照哪一份办法。 */
async function earnings(c, projectId, monthN, who) {
  const { data, error } = await c.rpc("staff_earnings", {
    in_project_id: projectId,
    in_month: monthOf(monthN),
  });
  if (error) throw new Error(`staff_earnings(${monthOf(monthN)}): ${error.message}`);
  return (data ?? []).find((r) => r.party_id === who) ?? null;
}

async function main() {
  const owner = await person("owner", ["staff", "payments", "customers"]);
  const { as: C, projectId: P } = owner;

  // ── ① 立起来 ─────────────────────────────────────────────────────────
  console.log("\n① 一个师傅、一份办法、几个月的钱");

  const { data: aida, error: aidaErr } = await C.rpc("add_directory_entry", {
    in_project_id: P,
    in_module_key: "staff",
    in_name: "Aida Rahman",
  });
  check("师傅进得了名册", !aidaErr && !!aida?.id, aidaErr?.message);
  const AIDA = aida.id;

  /* 上个月一号起：全部抽一成。 */
  const { error: t1 } = await C.rpc("set_commission_tiers", {
    in_party_id: AIDA,
    in_tiers: [{ from_cents: 0, percent: 10 }],
    in_effective_from: firstOf(-1),
  });
  check("写得进一份带生效日的办法", !t1, t1?.message);

  const money = async (monthN, cents, tag) => {
    const { data, error } = await C.rpc("add_ledger_entry", {
      in_project_id: P,
      in_module_key: "payments",
      in_direction: "in",
      in_amount_cents: cents,
      in_party: "Ravi Kumar",
      in_entry_on: midOf(monthN),
      in_done_by: AIDA,
      in_note: tag,
    });
    if (error) throw new Error(`add_ledger_entry(${tag}): ${error.message}`);
    return data;
  };

  await money(-3, 100000, "three months back");
  await money(-1, 800000, "last month");
  await money(0, 100000, "this month");
  check("三个月的钱都挂在她身上", true);

  // ── ② 改率之前的读数 ─────────────────────────────────────────────────
  console.log("\n② 改之前");

  const before1 = await earnings(C, P, -1, AIDA);
  check("上个月赚 RM 8,000", Number(before1?.earned_cents) === 800000, `${before1?.earned_cents}`);
  check("上个月抽一成 = RM 800", Number(before1?.commission_cents) === 80000,
    `${before1?.commission_cents}`);
  check("而且讲得出照哪一份算的", before1?.rate_from === firstOf(-1), `${before1?.rate_from}`);

  const before0 = await earnings(C, P, 0, AIDA);
  check("这个月抽一成 = RM 100", Number(before0?.commission_cents) === 10000,
    `${before0?.commission_cents}`);

  // ── ③ 🔴 今天改率 —— 这一段就是整支的理由 ─────────────────────────────
  console.log("\n③ 🔴 今天把率改成一成半");

  const { error: t2 } = await C.rpc("set_commission_tiers", {
    in_party_id: AIDA,
    in_tiers: [{ from_cents: 0, percent: 15 }],
  });
  check("改得了", !t2, t2?.message);

  const after1 = await earnings(C, P, -1, AIDA);
  check("🔴 上个月还是 RM 800，一分都没动", Number(after1?.commission_cents) === 80000,
    `${after1?.commission_cents}`);
  check("🔴 而且照的还是上个月那一份", after1?.rate_from === firstOf(-1), `${after1?.rate_from}`);

  const after0 = await earnings(C, P, 0, AIDA);
  check("这个月也没动 —— 已经开始的月份不会被改到",
    Number(after0?.commission_cents) === 10000, `${after0?.commission_cents}`);

  // ── ④ 新的率从下个月开始 ─────────────────────────────────────────────
  console.log("\n④ 新的率从下个月开始");

  await money(1, 200000, "next month");
  const next = await earnings(C, P, 1, AIDA);
  check("下个月抽一成半 = RM 300", Number(next?.commission_cents) === 30000,
    `${next?.commission_cents}`);
  check("而且讲得出是今天写的那一份", next?.rate_from === todayMyt(), `${next?.rate_from}`);

  // ── ⑤ 他自己写一个过去的日期 —— 那才动得了 ───────────────────────────
  console.log("\n⑤ 他自己写一个过去的日期");

  const { error: t3 } = await C.rpc("set_commission_tiers", {
    in_party_id: AIDA,
    in_tiers: [{ from_cents: 0, percent: 20 }],
    in_effective_from: firstOf(-1),
  });
  check("回头改上个月，写得进去", !t3, t3?.message);

  const fixed1 = await earnings(C, P, -1, AIDA);
  check("🔴 上个月变成 RM 1,600 —— 因为那是他讲的",
    Number(fixed1?.commission_cents) === 160000, `${fixed1?.commission_cents}`);

  const fixed0 = await earnings(C, P, 0, AIDA);
  check("这个月也跟着变 —— 它读的是上个月一号那一份",
    Number(fixed0?.commission_cents) === 20000, `${fixed0?.commission_cents}`);

  const stillNext = await earnings(C, P, 1, AIDA);
  check("而下个月不受影响，它有自己那一份", Number(stillNext?.commission_cents) === 30000,
    `${stillNext?.commission_cents}`);

  // ── ⑥ 那个月之前一份都没有 → 用最早那一份 ────────────────────────────
  console.log("\n⑥ 三个月前 —— 那时候一份办法都还没有");

  const old = await earnings(C, P, -3, AIDA);
  /* 🔴 **这一条 2026-09-05 改过一次，理由写下来。**
     它本来写「照最早那一份算（一成）」，而**一成那一份已经作废了** ——
     上一段（⑤）刚把上个月一号那一份改成两成，所以那个日子上有两行，
     而资料库对上个月认的是两成（第 197 行那一条就是这样断言的）。
     两条退路当时的排序是反的：① 同一天取**后改**的，② 取**先写**的。
     → 同一份办法，上个月两成、三个月前一成，**而一成没有任何一个月在用**。
     20260905770000 把 ② 改成也取后改的。这一条跟着改成两成。
     ⚠️ **不是为了让我的改动过关才放宽的** —— 是那一天的读数
     （上个月 20000 · 三个月前 10000）自己讲出了这个矛盾。 */
  check("照最早那一份算，而且是那一天最后改的那一版（两成）",
    Number(old?.commission_cents) === 20000, `${old?.commission_cents}`);
  check("而且讲得出那一份是哪一天的", old?.rate_from === firstOf(-1), `${old?.rate_from}`);

  // ── ⑦ 「从那个月起不抽了」──────────────────────────────────────────────
  console.log("\n⑦ 从下下个月起不抽了");

  const { error: t4 } = await C.rpc("set_commission_tiers", {
    in_party_id: AIDA,
    in_tiers: [],
    in_effective_from: firstOf(2),
  });
  check("一份空的办法写得进去", !t4, t4?.message);

  await money(2, 300000, "month after next");
  const gone = await earnings(C, P, 2, AIDA);
  check("那个月抽零", Number(gone?.commission_cents) === 0, `${gone?.commission_cents}`);
  check("而钱照样算她的", Number(gone?.earned_cents) === 300000, `${gone?.earned_cents}`);
  const untouched = await earnings(C, P, -1, AIDA);
  check("🔴 上个月还是 RM 1,600", Number(untouched?.commission_cents) === 160000,
    `${untouched?.commission_cents}`);

  // ── ⑧ 他改过几次 ─────────────────────────────────────────────────────
  console.log("\n⑧ 改过几次，每一次从哪天开始");

  const { data: gens, error: genErr } = await C.rpc("commission_schemes_of", {
    in_party_id: AIDA,
  });
  check("列得出四份", !genErr && (gens ?? []).length === 4,
    genErr?.message ?? `${(gens ?? []).length}`);
  const used = (gens ?? []).filter((g) => g.used_this_month);
  check("而且刚好一份标着「这个月用的是它」", used.length === 1, `${used.length}`);
  /* 🔴 这一条是 20260905650000 存在的理由：那个标签，跟画面上那个数字，
     必须是同一份。第一版标的是「今天在跑的那一份」，而画面上那个数字
     用的是「这个月一号那一份」—— 实测那天两个就不一样了。 */
  const thisMonth = await earnings(C, P, 0, AIDA);
  check("🔴 标签跟这个月那个数字讲同一份", used[0]?.effective_from === thisMonth?.rate_from,
    `${used[0]?.effective_from} vs ${thisMonth?.rate_from}`);
  check("而且就是回头改的那两成（这个月的数字是照它算的）",
    Number(used[0]?.tiers?.[0]?.percent) === 20 &&
      Number(thisMonth?.commission_cents) === 20000,
    `${JSON.stringify(used[0]?.tiers)} · ${thisMonth?.commission_cents}`);

  // ── ⑨ 零头照截，不照四舍五入 ─────────────────────────────────────────
  console.log("\n⑨ 零头 —— 跟浏览器那一份要给同一个答案");

  const { data: bee } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Bee Lian",
  });
  await C.rpc("set_commission_tiers", {
    in_party_id: bee.id,
    in_tiers: [{ from_cents: 0, percent: 10.5 }],
    in_effective_from: firstOf(-1),
  });
  await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 333, in_party: "Ravi Kumar",
    in_entry_on: midOf(-1), in_done_by: bee.id,
  });
  const beeRow = await earnings(C, P, -1, bee.id);
  /* 333 × 10.5% = 34.965 分。lib/portal/commission.ts 用 Math.trunc → 34。
     原本那一支收尾是 `::bigint`，而 numeric→bigint 是四舍五入 → 35。
     两边差一分，而档头写着截掉才对（多的那一分是我们替他付的）。 */
  check("🔴 34 分，不是 35 —— 跟浏览器那一份同一个答案",
    Number(beeRow?.commission_cents) === 34, `${beeRow?.commission_cents}`);

  // ── ⑩ 有人绕过 RPC 直接写那张表 ──────────────────────────────────────
  console.log("\n⑩ 绕过 RPC 直接写 commission_tiers（policy 允许）");

  const { data: chan } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Chan Wai",
  });
  const { error: rawErr } = await C.from("commission_tiers").insert({
    party_id: chan.id, project_id: P, from_cents: 0, percent: 12,
  });
  check("写得进去（这一条今天就是这样）", !rawErr, rawErr?.message);
  await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 500000, in_party: "Ravi Kumar",
    in_entry_on: midOf(-1), in_done_by: chan.id,
  });
  const chanRow = await earnings(C, P, -1, chan.id);
  check("🔴 照样算得出来 —— 今天的行为一个字都没变",
    Number(chanRow?.commission_cents) === 60000, `${chanRow?.commission_cents}`);
  check("而且老实讲它没有世代可以照", chanRow?.rate_from === null, `${chanRow?.rate_from}`);

  // ── ⑩b 下游经销商也抽成，而读的人分得出来 ────────────────────────────
  console.log("\n⑩b 洞〇：下游经销商也抽成");

  const { data: sub } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Sunrise Mobile (downstream)",
  });
  const { error: subTierErr } = await C.rpc("set_commission_tiers", {
    in_party_id: sub.id,
    in_tiers: [{ from_cents: 0, percent: 6 }],
    in_effective_from: firstOf(-1),
  });
  check("经销商身上写得了一份抽成办法", !subTierErr, subTierErr?.message);
  await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 1000000, in_party: "Sunrise Mobile (downstream)",
    in_entry_on: midOf(-1), in_done_by: sub.id,
  });
  const subRow = await earnings(C, P, -1, sub.id);
  check("🔴 抽成算得到他头上（6% = RM 600）",
    Number(subRow?.commission_cents) === 60000, `${subRow?.commission_cents}`);

  /* 🔴 原本那条守卫在保护「月底那张表不要把客户算成员工」。
     那件事没有不见 —— 它搬到这一栏上，所以这里必须量得到。 */
  const aidaRow = await earnings(C, P, -1, AIDA);
  check("🔴 而读的人分得出来：他是下游", subRow?.kind === "customers", `${subRow?.kind}`);
  check("🔴 她是自己人", aidaRow?.kind === "staff", `${aidaRow?.kind}`);

  const { data: shelved } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Closed shop",
  });
  await C.rpc("set_directory_archived", { in_id: shelved.id, in_archived: true });
  const { error: shelvedErr } = await C.rpc("add_ledger_entry", {
    in_project_id: P, in_module_key: "payments", in_direction: "in",
    in_amount_cents: 100, in_party: "x", in_done_by: shelved.id,
  });
  check("收起来的人还是当不了「谁做的」", !!shelvedErr, "居然让它过了");

  // ── ⑪ 师傅看不到（＋控制组）──────────────────────────────────────────
  console.log("\n⑪ 师傅看不到，而老板看得到");

  const crew = await person("crew", []);
  await C.rpc("add_project_member", { in_email: crew.cred.email });
  const crewC = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await crewC.auth.signInWithPassword(crew.cred);

  const { data: crewGens } = await crewC.rpc("commission_schemes_of", { in_party_id: AIDA });
  check("师傅列不出任何一份办法", (crewGens ?? []).length === 0, `${(crewGens ?? []).length}`);
  const { data: crewRaw } = await crewC.from("commission_schemes").select("id");
  check("直接读那张表也是零行", (crewRaw ?? []).length === 0, `${(crewRaw ?? []).length}`);
  /* 🔴 控制组 —— 少了它，这一段量的是空气（任务 125 学到的）。 */
  const { data: ownerRaw } = await C.from("commission_schemes").select("id");
  check("控制组：老板自己读得到", (ownerRaw ?? []).length >= 4, `${(ownerRaw ?? []).length}`);

  // ── ⑫ 另一家 ─────────────────────────────────────────────────────────
  console.log("\n⑫ 另一家公司");

  const other = await person("other", ["staff", "payments"]);
  const { data: otherGens } = await other.as.rpc("commission_schemes_of", { in_party_id: AIDA });
  check("别人家列不出我的办法", (otherGens ?? []).length === 0, `${(otherGens ?? []).length}`);
  const { data: otherRaw } = await other.as.from("commission_schemes").select("id");
  check("直接读也是零行", (otherRaw ?? []).length === 0, `${(otherRaw ?? []).length}`);
  const { error: otherWrite } = await other.as.rpc("set_commission_tiers", {
    in_party_id: AIDA, in_tiers: [{ from_cents: 0, percent: 99 }],
  });
  check("也改不了我的", !!otherWrite, "居然让它过了");

  // ── 收尾 ─────────────────────────────────────────────────────────────
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
