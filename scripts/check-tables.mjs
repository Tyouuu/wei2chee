/**
 * 三号桌点了什么 · 几号桌空着 —— 用**真的登入身分**打一次。
 *
 * 🔴 `db push` 成功证明不了任何事（[重点 26](../docs/founder-points.md)）。
 *
 * 它守的那几件：
 *   · 开台走 add_pipeline_record —— 单号 · 连到客户全部白捡（重点 23）
 *   · 🔴 那一桌已经坐着人 → **把那一张单还给他，不开第二张**
 *   · 🔴 结帐一按做两件：收钱 ＋ 清桌，而且讲出发生了什么
 *   · 🔴 赊数照样清桌，然后讲出还欠多少
 *   · 🔴 那张单永远记得它在哪一桌 —— 桌子空了，历史还在
 *   · 🔴 伙计开得了台、清得了桌，**收不了钱**，而且读到的是一句人话
 *   · 别人家开不了、结不了、也读不到
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";

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

const people = [];
let pass = 0;
let fail = 0;
const check = (what, ok, detail) => {
  if (ok) {
    pass += 1;
    console.log("  PASS  " + what);
  } else {
    fail += 1;
    console.log("  FAIL  " + what + (detail ? " — " + detail : ""));
  }
};
const one = (d) => (Array.isArray(d) ? d[0] : d);

async function person(tag) {
  const email = "kopi-" + tag + "-" + Date.now() + "@formae.test";
  const password = "Kopi-" + Date.now() + "-x!";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw new Error("createUser(" + tag + "): " + error.message);
  const client = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false } },
  );
  const { error: e2 } = await client.auth.signInWithPassword({ email, password });
  if (e2) throw new Error("signIn(" + tag + "): " + e2.message);
  people.push(data.user.id);
  return { id: data.user.id, email, client };
}
dropThrowawayOnExit(admin, () => people);

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", boss.id)
    .single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "counter" });
  for (const k of ["orders", "customers", "payments"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  /* ── ① 开几张桌 ───────────────────────────────────────────── */
  console.log("\n① 开几张桌");
  const { data: t3, error: t3Err } = await C.rpc("add_dining_table", {
    in_project_id: P,
    in_name: "3",
    in_seats: 4,
    in_sort_order: 30,
  });
  check("开得了一张桌", !t3Err && !!t3?.id, t3Err?.message);
  check("四个位子", Number(t3?.seats) === 4, String(t3?.seats));
  check("空的", t3?.seated_record_id === null, String(t3?.seated_record_id));
  const { data: t5 } = await C.rpc("add_dining_table", {
    in_project_id: P,
    in_name: "5",
    in_seats: 2,
    in_sort_order: 50,
  });
  const { data: again } = await C.rpc("add_dining_table", {
    in_project_id: P,
    in_name: "3",
    in_seats: 4,
  });
  check("🔴 同名那一张不会开出第二张", again?.id === t3.id, String(again?.id));
  const { error: blank } = await C.rpc("add_dining_table", {
    in_project_id: P,
    in_name: "   ",
  });
  check("没有名字的桌开不了", !!blank, "居然让它过了");

  /* ── ② 客人坐下 ───────────────────────────────────────────── */
  console.log("\n② 客人坐下（三号桌）");
  const { data: seated, error: seatErr } = await C.rpc("seat_table", {
    in_project_id: P,
    in_table_id: t3.id,
    in_module_key: "orders",
    in_party: "Walk-in",
    in_title: "Table 3",
  });
  const s = one(seated);
  check("开得了台", !seatErr && !!s?.record_id, seatErr?.message);
  check("🔴 有单号 —— 走的是人按的那一支", !!s?.doc_no, String(s?.doc_no));
  check("讲得出是哪一桌", s?.table_name === "3", String(s?.table_name));
  check("真的是这一按开的", s?.seated === true, String(s?.seated));

  const { data: sameAgain } = await C.rpc("seat_table", {
    in_project_id: P,
    in_table_id: t3.id,
    in_module_key: "orders",
  });
  const s2 = one(sameAgain);
  check(
    "🔴 那一桌已经坐着人 → 把同一张单还给他",
    s2?.record_id === s.record_id,
    String(s2?.record_id),
  );
  check("🔴 而且讲出这一按什么都没做", s2?.seated === false, String(s2?.seated));
  const { count: howMany } = await C.from("pipeline_records")
    .select("id", { count: "exact", head: true })
    .eq("project_id", P)
    .eq("module_key", "orders");
  check("🔴 所以那一家只有一张单，不是两张", howMany === 1, howMany + " 张");

  /* ── ③ 点菜 ───────────────────────────────────────────────── */
  console.log("\n③ 点菜（云吞面 ×2 · 咖啡 ×1 = RM 21.50）");
  const { error: lineErr } = await C.rpc("set_record_lines", {
    in_record_id: s.record_id,
    in_lines: [
      {
        description: "Wantan mee",
        qty: 2,
        unit: "plate",
        unit_price_cents: 800,
        amount_cents: 1600,
      },
      {
        description: "Kopi O",
        qty: 1,
        unit: "cup",
        unit_price_cents: 550,
        amount_cents: 550,
      },
    ],
  });
  check("写得进去", !lineErr, lineErr?.message);

  const map1 = await C.rpc("tables_now", { in_project_id: P }).then((r) => r.data ?? []);
  const three = map1.find((r) => r.name === "3");
  const five = map1.find((r) => r.name === "5");
  check("那一屏两张桌都在", map1.length === 2, String(map1.length));
  check("🔴 三号桌坐着人", three?.record_id === s.record_id, String(three?.record_id));
  check(
    "🔴 而且写着两行 · RM 21.50",
    Number(three?.lines) === 2 && Number(three?.total_cents) === 2150,
    three?.lines + " 行 / " + three?.total_cents,
  );
  check(
    "坐多久了算得出来",
    Number.isInteger(three?.seated_minutes),
    String(three?.seated_minutes),
  );
  check(
    "🔴 五号桌空着，而且不带任何单据",
    five?.record_id === null && five?.total_cents === null,
    five?.record_id + " / " + five?.total_cents,
  );
  check(
    "排序照他自己给的",
    map1[0]?.name === "3" && map1[1]?.name === "5",
    map1.map((r) => r.name).join(","),
  );

  /* ── ④ 结帐 ───────────────────────────────────────────────── */
  console.log("\n④ 结帐（收 RM 25，找 RM 3.50）");
  const { data: closed, error: closeErr } = await C.rpc("close_table", {
    in_project_id: P,
    in_table_id: t3.id,
    in_paid_cents: 2500,
    in_method: "cash",
  });
  const c = one(closed);
  check("结得了帐", !closeErr && c?.record_id === s.record_id, closeErr?.message);
  check(
    "🔴 这一桌 RM 21.50 —— 明细加起来的",
    Number(c?.total_cents) === 2150,
    String(c?.total_cents),
  );
  check("🔴 找他 RM 3.50", Number(c?.change_cents) === 350, String(c?.change_cents));
  check("不欠", Number(c?.owed_cents) === 0, String(c?.owed_cents));
  check("桌子放开了", c?.freed === true, String(c?.freed));

  const { data: paid } = await C.from("ledger_entries")
    .select("amount_cents, direction, against_id")
    .eq("project_id", P);
  check(
    "🔴 进帐是 RM 21.50，不是他手上那张 RM 25",
    (paid ?? []).length === 1 &&
      Number(paid[0].amount_cents) === 2150 &&
      paid[0].direction === "in",
    JSON.stringify(paid),
  );
  check(
    "而且挂在那一张单上",
    paid?.[0]?.against_id === s.record_id,
    String(paid?.[0]?.against_id),
  );

  const map2 = await C.rpc("tables_now", { in_project_id: P }).then((r) => r.data ?? []);
  check(
    "🔴 三号桌空了",
    map2.find((r) => r.name === "3")?.record_id === null,
    String(map2.find((r) => r.name === "3")?.record_id),
  );

  const { data: hist } = await C.from("pipeline_records")
    .select("id, table_id")
    .eq("id", s.record_id)
    .single();
  check(
    "🔴 而那张单还记得它在三号桌 —— 历史，永不改",
    hist?.table_id === t3.id,
    String(hist?.table_id),
  );

  const { data: twice } = await C.rpc("close_table", {
    in_project_id: P,
    in_table_id: t3.id,
    in_paid_cents: 0,
  });
  check(
    "🔴 空桌上再按一次：什么都没做，而且讲出来",
    one(twice)?.freed === false,
    String(one(twice)?.freed),
  );
  const { data: stillOne } = await C.from("ledger_entries")
    .select("id")
    .eq("project_id", P);
  check("🔴 而且没有多记一笔钱", (stillOne ?? []).length === 1, String(stillOne?.length));

  /* ── ⑤ 赊数 ───────────────────────────────────────────────── */
  console.log("\n⑤ 赊数（熟客，一分钱都没给）");
  /* 熟客要在名册上 —— 「谁欠我钱」只答得了名册上的人（任务 89：
     靠名字认人会把钱记到另一个人头上）。一个散客赊数，那份名单上没有他，
     而那是对的：那份名单是他要打的那几通电话。 */
  const { data: ahSeng } = await C.rpc("add_directory_entry", {
    in_project_id: P,
    in_module_key: "customers",
    in_name: "Ah Seng",
  });
  const { data: tab } = await C.rpc("seat_table", {
    in_project_id: P,
    in_table_id: t5.id,
    in_module_key: "orders",
    in_party: "Ah Seng",
    in_party_id: ahSeng?.id,
  });
  const tabRec = one(tab).record_id;
  await C.rpc("set_record_lines", {
    in_record_id: tabRec,
    in_lines: [
      { description: "Nasi lemak", qty: 3, unit: "plate", amount_cents: 1800 },
    ],
  });
  const { data: onTab } = await C.rpc("close_table", {
    in_project_id: P,
    in_table_id: t5.id,
    in_paid_cents: 0,
  });
  const tb = one(onTab);
  check("🔴 一分钱都没给，桌子照样放开", tb?.freed === true, String(tb?.freed));
  check("🔴 而且讲出还欠 RM 18", Number(tb?.owed_cents) === 1800, String(tb?.owed_cents));
  const { data: noExtra } = await C.from("ledger_entries").select("id").eq("project_id", P);
  check("🔴 一分都没付就不记帐", (noExtra ?? []).length === 1, String(noExtra?.length));
  const { data: owing } = await C.rpc("party_debts", { in_project_id: P });
  check(
    "而那张单自己留在「谁欠我钱」上",
    (owing ?? []).some((r) => Number(r.owed_cents) === 1800),
    JSON.stringify(owing),
  );

  /* ── ⑥ 伙计 ───────────────────────────────────────────────── */
  console.log("\n⑥ 伙计（开得了台、清得了桌，收不了钱）");
  const crew = await person("crew");
  const { error: memErr } = await C.rpc("add_project_member", { in_email: crew.email });
  check("控制组：那个伙计真的进了这一家", !memErr, memErr?.message);
  const W = crew.client;

  const crewMap = await W.rpc("tables_now", { in_project_id: P }).then((r) => r.data ?? []);
  check("🔴 伙计看得到哪一桌空着", crewMap.length === 2, String(crewMap.length));
  const { data: crewSeat, error: crewSeatErr } = await W.rpc("seat_table", {
    in_project_id: P,
    in_table_id: t3.id,
    in_module_key: "orders",
  });
  check("🔴 伙计开得了台", !crewSeatErr && !!one(crewSeat)?.record_id, crewSeatErr?.message);

  const { error: crewMoney } = await W.rpc("close_table", {
    in_project_id: P,
    in_table_id: t3.id,
    in_paid_cents: 500,
  });
  check("🔴 伙计收不了钱", !!crewMoney, "居然让它过了");
  check(
    "🔴 而且读到的是一句人话，不是资料库那一句",
    /owner/i.test(crewMoney?.message ?? "") &&
      !/auth|rpc|null|column/i.test(crewMoney?.message ?? ""),
    crewMoney?.message,
  );
  const crewStill = await W.rpc("tables_now", { in_project_id: P }).then((r) => r.data ?? []);
  check(
    "🔴 被挡下来之后那一桌还坐着人",
    crewStill.find((r) => r.name === "3")?.record_id !== null,
    String(crewStill.find((r) => r.name === "3")?.record_id),
  );

  const { data: crewFree, error: crewFreeErr } = await W.rpc("close_table", {
    in_project_id: P,
    in_table_id: t3.id,
    in_paid_cents: 0,
  });
  check(
    "🔴 而他按得了「这桌走了」",
    !crewFreeErr && one(crewFree)?.freed === true,
    crewFreeErr?.message,
  );

  const { error: crewNewTable } = await W.rpc("add_dining_table", {
    in_project_id: P,
    in_name: "9",
  });
  check("开一张新的桌是老板的事", !!crewNewTable, "居然让它过了");

  /* ── ⑦ 别人家 ─────────────────────────────────────────────── */
  console.log("\n⑦ 别人家");
  const other = await person("other");
  const O = other.client;
  await O.rpc("set_project_style", { new_style: "counter" });
  const { data: theirRows } = await O.from("dining_tables").select("id");
  check("🔴 另一家一行都读不到", (theirRows ?? []).length === 0, String(theirRows?.length));
  const { data: theirMap } = await O.rpc("tables_now", { in_project_id: P });
  check("🔴 那一屏也是空的", (theirMap ?? []).length === 0, String(theirMap?.length));
  const { error: theirSeat } = await O.rpc("seat_table", {
    in_project_id: P,
    in_table_id: t3.id,
    in_module_key: "orders",
  });
  check("🔴 开不了别人家的台", !!theirSeat, "居然让它过了");
  const { error: theirClose } = await O.rpc("close_table", {
    in_project_id: P,
    in_table_id: t5.id,
    in_paid_cents: 100,
  });
  check("🔴 也结不了别人家的帐", !!theirClose, "居然让它过了");

  console.log(
    fail === 0
      ? "\n判：全部过（" + people.length + " 个用完就删的帐号）"
      : "\n判：" + pass + " 过 · " + fail + " 没过",
  );
  if (fail > 0) process.exitCode = 1;
} catch (err) {
  console.error("\n🔴 走到一半炸了：" + (err?.message ?? err));
  process.exitCode = 1;
} finally {
  await dropThrowaways(admin, people);
}
