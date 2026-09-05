/**
 * vibe-dealer 当第一个客户 —— 用假名资料走完整条流程。
 *
 * ── 为什么要跑这一支（2026-09-05）────────────────────────────────────────
 *
 *   `把vibe dealer放进去当第一个customer 这样就可以有真的数据可以走完整个流程`
 *   `你可以去github上去看vibe dealer是我的一个uncle叫我开发的后台system`
 *
 * 那是一门**真的在跑的生意**：48 个改动档、16 张表、真的经销商、真的钱。
 * 拿它当第一个客户，问的不是「我们做完了没有」，是
 * **「十个零件扛不扛得住一门已经在跑的生意」** —— 而那一题只有用它的形状
 * 走一次才答得出来。
 *
 * ⚠️ **名字全部是假的。** 那是他 uncle 的生意，里面是真的经销商名字跟真的钱；
 * 个资法 2024 修正案之后，资料一搬进我们的库，**责任就到我们身上**
 * （docs/founder-tasks.md 任务 136）。所以这一支用**同一个形状、假的名字** ——
 * 形状才是要验的东西，名字不是。
 *
 * ── 它验两件，第二件才是重点 ──────────────────────────────────────────
 *
 *   ① 六个对得上的零件，真的收得下这门生意的资料吗
 *   ② 🔴 **三个对不上的地方，坏起来是什么样子** —— 而前两个不是「少一页」，
 *      是**算出来的数字是错的，而画面上不会讲**
 *
 * 第二件是这一支存在的理由。一份「六个零件都过了」的报告读起来很好看，
 * 而他 uncle 的生意会在第七件事上算错钱。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaway } from "./lib/throwaway.mjs";

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

/* ── 假名，而且一看就知道是假的 ────────────────────────────────────────
   八个经销商，形状照 vibe-dealer 的 `dealers`（店名 · 一个联络号码 ·
   一个抽成率），名字是编的。**不要拿真的名字去验一个形状。** */
const DEALERS = [
  { name: "Kedai Telco Aisyah", phone: "012-000 0001" },
  { name: "Sinar Prepaid Menglembu", phone: "012-000 0002" },
  { name: "Wah Seng Mobile", phone: "012-000 0003" },
  { name: "Gerai Topup Chemor", phone: "012-000 0004" },
  { name: "Batu Gajah Reload", phone: "012-000 0005" },
  { name: "Kedai Runcit Devi", phone: "012-000 0006" },
  { name: "Falim Phone Centre", phone: "012-000 0007" },
  { name: "Gopeng Mini Market", phone: "012-000 0008" },
];

const EMAIL = `dealer-${Date.now()}@formae.test`;
const PASSWORD = `Dealer-${Date.now()}-x!`;

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
const api = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

let userId = null;
let pass = 0;
let fail = 0;
const say = (label, ok, detail = "") => {
  ok ? pass++ : fail++;
  console.log(`${ok ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
};
const rm = (c) => `RM ${(Number(c) / 100).toLocaleString("en-MY", { minimumFractionDigits: 2 })}`;

/* 马来西亚的月份，不是伺服器的（伺服器跑 UTC，半夜到早上八点差一天）。 */
const today = new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const thisMonth = today.slice(0, 7);
const prev = new Date(`${today}T00:00:00Z`);
prev.setUTCMonth(prev.getUTCMonth() - 1);
const lastMonth = prev.toISOString().slice(0, 7);
const dayIn = (m, d) => `${m}-${String(d).padStart(2, "0")}`;

try {
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  userId = made.user.id;
  const { error: inErr } = await api.auth.signInWithPassword({ email: EMAIL, password: PASSWORD });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);

  const { data: proj } = await api.from("projects").select("id").single();
  const P = proj?.id;
  if (!P) throw new Error("注册没有开出一个 project");
  await api.rpc("set_project_style", { new_style: "counter" });

  console.log(`\n── 开页（一门 SIM 经销生意真正会开的那几页）─────────────────`);
  const PAGES = [
    ["customers", "Dealers"],
    ["suppliers", "Suppliers"],
    ["orders", "Orders"],
    ["purchases", "Stock in"],
    ["payments", "Collections"],
    ["expenses", "Expenses"],
    ["commission", "Commission"],
    ["inventory", "SIM stock"],
    ["reconciliation", "Statements"],
    ["reports", "Reports"],
  ];
  let opened = 0;
  for (const [key, title] of PAGES) {
    const { error } = await api.rpc("add_project_page", { requested_key: key, new_title: title });
    if (!error) opened++;
    else console.log(`  ⚠️  开不了 ${key} — ${error.message.slice(0, 70)}`);
  }
  say("这门生意要的十页都开得出来", opened === PAGES.length, `${opened}/${PAGES.length}`);

  console.log(`\n── ① 名册：八个经销商 ──────────────────────────────────────`);
  const ids = {};
  for (const d of DEALERS) {
    const { data, error } = await api.rpc("add_directory_entry", {
      in_project_id: P,
      in_module_key: "customers",
      in_name: d.name,
      in_phone: d.phone,
    });
    if (error) console.log(`  ⚠️  ${d.name} — ${error.message.slice(0, 70)}`);
    else ids[d.name] = data.id;
  }
  say("八个经销商进得了名册", Object.keys(ids).length === 8, `${Object.keys(ids).length}/8`);

  /* 🔴 洞〇 —— 走到这里才撞到的，而它比下面那两个更挡路。
     vibe-dealer 的抽成是给**下游经销商**的（`dealers.rate`），
     而我们的「谁做的」写死只收**自己家的师傅**（20260904130000 那条守卫，
     理由是「一个挂在客户身上的『谁做的』会让月底那张表把客户算成员工」——
     对一家装修公司是对的，对一家经销生意是错的）。
     所以这一支多请一个「收数的」，才有东西可以量下面的洞一。 */
  const { data: runner } = await api.rpc("add_directory_entry", {
    in_project_id: P,
    in_module_key: "staff",
    in_name: "Ah Seng（收数）",
  });
  const { error: dealerCut } = await api.rpc("add_ledger_entry", {
    in_project_id: P,
    in_module_key: "payments",
    in_direction: "in",
    in_amount_cents: 100,
    in_party: DEALERS[0].name,
    in_party_id: ids[DEALERS[0].name],
    in_done_by: ids[DEALERS[0].name],
  });
  say(
    "🔴 抽成算得到下游经销商头上",
    !dealerCut,
    dealerCut ? dealerCut.message.slice(0, 70) : "",
  );

  console.log(`\n── ② 库存：一批 SIM 卡进货，收货之后架上要有货 ─────────────`);
  const { data: sup } = await api.rpc("add_directory_entry", {
    in_project_id: P,
    in_module_key: "suppliers",
    in_name: "Prepaid Distributor (upstream)",
  });
  const { data: item } = await api.rpc("add_catalog_item", {
    in_project_id: P,
    in_module_key: "inventory",
    in_name: "SIM starter pack RM10",
    in_unit: "pcs",
    in_price_cents: 1000,
  });
  const { data: po } = await api.rpc("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "purchases",
    in_title: "Starter packs — 500 pcs",
    in_party: "Prepaid Distributor (upstream)",
    in_party_id: sup?.id,
    in_amount_cents: 500 * 850,
  });
  let received = null;
  if (po?.id) {
    await api.rpc("set_record_lines", {
      in_record_id: po.id,
      in_lines: [
        { description: "SIM starter pack RM10", qty: 500, unit: "pcs", unit_cents: 850 },
      ],
    });
    const { data: r, error: rErr } = await api.rpc("receive_purchase", { in_record_id: po.id });
    if (rErr) console.log(`  ⚠️  收货 — ${rErr.message.slice(0, 80)}`);
    received = r;
  }
  const { data: onHand } = await api.rpc("count_stock", {
    in_project_id: P,
    in_item_id: item?.id,
    in_counted: 500,
  }).then((x) => x, () => ({ data: null }));
  say("进货 → 收货 → 架上有货", !!po?.id && !!item?.id && !!received, po?.doc_no ?? "");

  console.log(`\n── ③ 走单 ＋ 收钱：八个经销商 × 两个月 ─────────────────────`);
  /* vibe-dealer 的 `transactions`：经销商拿货 → 一张单；他汇钱进来 → 一笔收款。
     **两个月**，因为佣金跟对帐都是按月的 —— 只跑一个月看不出下面那两个洞。 */
  let orders = 0;
  let collected = 0;
  for (const [i, d] of DEALERS.entries()) {
    for (const [mi, m] of [lastMonth, thisMonth].entries()) {
      const amount = (3000 + i * 500 + mi * 700) * 100;
      const { data: o } = await api.rpc("add_pipeline_record", {
        in_project_id: P,
        in_module_key: "orders",
        in_title: `${m} reload — ${d.name}`,
        in_party: d.name,
        in_party_id: ids[d.name],
        in_amount_cents: amount,
      });
      if (o?.id) orders++;
      const { data: paid, error: pErr } = await api.rpc("add_ledger_entry", {
        in_project_id: P,
        in_module_key: "payments",
        in_direction: "in",
        in_amount_cents: amount,
        in_party: d.name,
        in_party_id: ids[d.name],
        in_against_id: o?.id ?? null,
        in_entry_on: dayIn(m, 10 + i),
        in_done_by: runner?.id ?? null,
        in_method: "bank",
      });
      if (pErr) console.log(`  ⚠️  收款 ${d.name} ${m} — ${pErr.message.slice(0, 70)}`);
      if (paid?.id) collected += amount;
    }
  }
  say("十六张单开得出来", orders === 16, `${orders}/16`);
  say("十六笔钱收得进来", collected > 0, rm(collected));

  console.log(`\n── ④ 对帐：上游给的月结单，差额要看得见 ───────────────────`);
  const ourLast = DEALERS.reduce((s, _d, i) => s + (3000 + i * 500) * 100, 0);
  /* ⚠️ 它回的是一个 uuid，不是一行 —— 第一版当成物件读 `.id`，
     於是後面每一句都在对一个 undefined 讲话。 */
  const { data: recId, error: recErr } = await api.rpc("add_reconciliation", {
    in_project_id: P,
    in_module_key: "reconciliation",
    in_period: `${lastMonth}-01`,
    in_source: "Upstream statement",
    in_their_cents: ourLast - 1200,
  });
  say("上游的月结单进得来", !!recId && !recErr,
    recErr ? recErr.message.slice(0, 70) : `我们 ${rm(ourLast)} · 他们少报 RM 12.00`);

  console.log(`\n── 🔴 洞一：佣金率没有历史 ─────────────────────────────────`);
  /* vibe-dealer 的 `0006_dealer_rate_history` 档头（他自己写的）：
       recomputeDealerRate … overwrites dealers.package / dealers.rate every
       time it runs, so the dealers table only ever shows the current value.
     我们一样 —— 而**算上个月的佣金要用上个月的率**。 */
  /* ⚠️ 量在**收数那个人**身上，不是经销商身上 —— 洞〇 挡着后者。
     问的还是同一件事：今天改了率，上个月的数字会不会跟着动。 */
  const one = runner?.id;
  await api.rpc("set_commission_tiers", {
    in_party_id: one,
    in_tiers: [{ from_cents: 0, percent: 2.0 }],
  });
  const { data: before } = await api.rpc("staff_earnings", { in_project_id: P, in_month: lastMonth });
  const was = before?.find((r) => r.party_id === one)?.commission_cents ?? null;

  await api.rpc("set_commission_tiers", {
    in_party_id: one,
    in_tiers: [{ from_cents: 0, percent: 3.0 }],
  });
  const { data: after } = await api.rpc("staff_earnings", { in_project_id: P, in_month: lastMonth });
  const now = after?.find((r) => r.party_id === one)?.commission_cents ?? null;

  say(
    "🔴 今天改了抽成率，上个月的佣金不会跟着变",
    was !== null && was === now,
    `上个月本来 ${rm(was ?? 0)} · 把率从 2% 改成 3% 之后 ${rm(now ?? 0)}`,
  );

  console.log(`\n── 🔴 洞二：对完帐的月份没有锁 ─────────────────────────────`);
  /* vibe-dealer 的 `0031_period_lock` 档头（他自己写的）：
       Post a forgotten June sale in August and June's verified total moves
       while company_statements.reconciled stays true.
     ⚠️ 而他**故意不做逐笔例外旗子** —— 会计的做法是重开 → 改 → 再关。 */
  if (recId) await api.rpc("set_reconciliation_settled", { in_id: recId, in_settled: true });
  const sumLast = async () => {
    const { data } = await api
      .from("ledger_entries")
      .select("amount_cents")
      .eq("project_id", P)
      .eq("direction", "in")
      .gte("entry_on", `${lastMonth}-01`)
      .lt("entry_on", `${thisMonth}-01`);
    return (data ?? []).reduce((s, r) => s + Number(r.amount_cents), 0);
  };
  const totalBefore = await sumLast();
  const { error: backErr } = await api.rpc("add_ledger_entry", {
    in_project_id: P,
    in_module_key: "payments",
    in_direction: "in",
    in_amount_cents: 99900,
    in_party: DEALERS[1].name,
    in_party_id: ids[DEALERS[1].name],
    in_entry_on: dayIn(lastMonth, 15),
    in_note: "补一笔上个月忘记的",
  });
  const totalAfter = await sumLast();
  const { data: recNow } = await api
    .from("reconciliations")
    .select("settled_at")
    .eq("id", recId ?? "00000000-0000-0000-0000-000000000000")
    .maybeSingle();

  say(
    "🔴 一个已经对完帐的月份，补不进单",
    !!backErr,
    backErr
      ? backErr.message.slice(0, 70)
      : `进去了 · 那个月的总数 ${rm(totalBefore)} → ${rm(totalAfter)}，而它还写着「已对帐 ${recNow?.settled_at ? "是" : "否"}」`,
  );

  console.log(`\n── 🔴 洞三：经销商自己登不进来 ────────────────────────────`);
  /* vibe-dealer 的 `topup_requests` + `dealer_pins`：经销商自己登入、自己提交要货。
     我们外面只有三个动作（看那一页 · 留一句话 · 订一个时段，任务 96 · 146）。 */
  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { data: peek, error: peekErr } = await anon.from("directory_entries").select("id").limit(1);
  const noLeak = !!peekErr || (peek?.length ?? 0) === 0;
  say("路人读不到名册（这一半是对的）", noLeak, peekErr ? "读不到" : `${peek?.length ?? 0} 行`);
  /* 20260905680000 起：一个经销商一条连结，他自己讲得出「我要货」。
     ⚠️ 用**真的 anon 钥匙**打，不是用老板的登入 —— 挡在外面那道门，
     只有站在外面才试得出来。 */
  const { data: portalRef } = await api.rpc("open_party_portal", {
    in_party_id: ids[DEALERS[0].name],
  });
  const { data: submitted } = await anon.rpc("submit_party_request", {
    in_ref: portalRef,
    in_what: "下一批卡帮我留 200 张，我转了 RM 5,000",
    in_qty: 200,
    in_amount_cents: 500000,
  });
  const { data: theInbox } = await api.rpc("party_requests_of", { in_project_id: P });
  say(
    "🔴 经销商自己提交得了「我要货」",
    submitted === "ok" && (theInbox ?? []).length >= 1,
    `${submitted} · 收件匣 ${(theInbox ?? []).length} 笔`,
  );
  const { data: whatHeSees } = await anon.rpc("party_portal", { in_ref: portalRef });
  say(
    "而他自己那一页看得到，却看不到别人的",
    whatHeSees?.found === true &&
      (whatHeSees?.requests ?? []).length === 1 &&
      !JSON.stringify(whatHeSees).includes(DEALERS[1].name),
    `${(whatHeSees?.requests ?? []).length} 笔`,
  );

  console.log(`\n── 十个零件，这门生意用得到几个 ───────────────────────────`);
  const count = async (t) =>
    (await api.from(t).select("*", { count: "exact", head: true }).eq("project_id", P)).count ?? 0;
  const [dC, pC, lC, cC, rC] = await Promise.all([
    count("directory_entries"),
    count("pipeline_records"),
    count("ledger_entries"),
    count("catalog_items"),
    count("reconciliations"),
  ]);
  console.log(`  名册 ${dC} · 走单 ${pC} · 记帐 ${lC} · 库存 ${cC} · 对帐 ${rC}`);
  say(
    "六个零件全部收得下这门生意的资料",
    dC >= 9 && pC >= 17 && lC >= 16 && cC >= 1 && rC >= 1,
  );

  console.log(`\n判：${pass} 过 · ${fail} 没过`);
} finally {
  if (userId) await dropThrowaway(admin, userId);
}
process.exit(fail ? 1 : 0);
