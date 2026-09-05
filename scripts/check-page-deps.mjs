/**
 * 加一页的时候，把它需要的那一页也开出来。
 *
 * [任务 69] 的地基决定 5（2026-08-30 定的），一直靠人记得 ——
 * 而 2026-09-06 它变成一个看得见的洞：
 *
 *   一间五金店自己加了「进货单」而没有「供应商」
 *   → 那一页上一个供应商都建不了
 *   → 每一张进货单的 party_id 都是空的
 *   → 「我欠谁多少」（20260906020000）永远是空白的，而他看不出为什么
 *
 * 🔴 补在 `add_project_page` 里面，不是补在画面那一边 ——
 * 三个呼叫端（对话框 · AI · 模板那一页）全部走这一支，
 * 所以每一条路自动拿到（[重点 23]：不准有第二条写入路径）。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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
  const email = `dep-${tag}-${stamp}@formae.test`;
  const password = `Dep-${stamp}-x!`;
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

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id, page_count:project_pages(count)")
    .eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });

  const pages = async () => {
    const { data } = await admin
      .from("project_pages").select("page_key").eq("project_id", P);
    return (data ?? []).map((r) => r.page_key);
  };

  console.log("\n① 道具");
  const before = await pages();
  check("道具：一开始还没有供应商那一页", !before.includes("suppliers"),
    JSON.stringify(before));

  /* ── ② 🔴 加进货单，供应商跟着开 ─────────────────────────────────── */
  console.log("\n② 🔴 加进货单");
  const { error: addErr } = await C.rpc("add_project_page", {
    requested_key: "purchases", new_title: "Purchases",
  });
  check("加得起来", !addErr, addErr?.message);
  const after = await pages();
  check("🔴 供应商那一页跟着开出来了", after.includes("suppliers"),
    JSON.stringify(after));
  check("而且他要的那一页当然在", after.includes("purchases"), JSON.stringify(after));

  /* 🔴 而这才是它存在的理由：那一页开出来之后，「我欠谁多少」算得出来。 */
  const { data: sup, error: supErr } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "suppliers", in_name: "Seng Huat Hardware",
  });
  check("供应商建得进去", !supErr && !!sup?.id, supErr?.message);
  const { data: po } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "purchases", in_title: "Cement load",
    in_party: "Seng Huat Hardware", in_amount_cents: 185_000,
  });
  check("🔴 而那张单靠名字就认得出是哪一家（party_id 不是空的）",
    po?.party_id === sup.id, `${po?.party_id}`);
  const { data: owe } = await C.rpc("party_payables", { in_project_id: P });
  check("🔴 所以「我欠谁多少」上面有他 —— 那一整条通了",
    (owe ?? []).some((r) => r.party_id === sup.id),
    JSON.stringify(owe));

  /* ── ③ 已经有了就不重复开 ────────────────────────────────────────── */
  console.log("\n③ 已经有了就不重复开");
  const n1 = (await pages()).filter((k) => k === "suppliers").length;
  await C.rpc("add_project_page", { requested_key: "purchases", new_title: "P2" });
  const n2 = (await pages()).filter((k) => k === "suppliers").length;
  check("供应商那一页还是只有一张", n1 === 1 && n2 === 1, `${n1} → ${n2}`);

  /* ── ④ 佣金要有师傅 ──────────────────────────────────────────────── */
  console.log("\n④ 佣金要有师傅");
  check("道具：还没有师傅那一页", !(await pages()).includes("staff"),
    JSON.stringify(await pages()));
  await C.rpc("add_project_page", { requested_key: "commission", new_title: "Commission" });
  check("🔴 师傅那一页跟着开出来了", (await pages()).includes("staff"),
    JSON.stringify(await pages()));

  /* ── ⑤ 没有依赖的那几页，一页都不多开 ───────────────────────────── */
  console.log("\n⑤ 没有依赖的不多开");
  const b4 = (await pages()).length;
  await C.rpc("add_project_page", { requested_key: "expenses", new_title: "Expenses" });
  const af = await pages();
  check("🔴 开销只多一页（它不需要别的）", af.length === b4 + 1,
    `${b4} → ${af.length} · ${JSON.stringify(af)}`);

  /* ── ⑥ 🔴 满了的时候，他要的那一页照样开得出来 ──────────────────── */
  console.log("\n⑥ 🔴 满了的时候");
  /* 一路加自订页填到十九张 —— 上限是二十。 */
  let now = (await pages()).length;
  while (now < 19) {
    const { error } = await C.rpc("add_project_page", {
      requested_key: "", new_title: `Note ${now}`,
    });
    if (error) break;
    now = (await pages()).length;
  }
  check("道具：填到十九张", now === 19, `${now}`);
  const { error: lastErr } = await C.rpc("add_project_page", {
    requested_key: "reconciliation", new_title: "Reconcile",
  });
  const end = await pages();
  check("🔴 第二十张开得出来（他要的那一页）", !lastErr && end.includes("reconciliation"),
    lastErr?.message ?? JSON.stringify(end));
  check("🔴 而且没有超过上限", end.length === 20, `${end.length}`);
  /* 🔴 而满了的时候它依赖的那一页**不补** ——
     少一页依赖，比少他要的那一页好。
     （第一版这里写的是 `!hadRanking || true` —— **一条永远为真的断言**，
     那正是我自己在批评的那种。） */
  check("🔴 而它依赖的那一页满了就不补",
    end.filter((k) => k === "payments").length <= 1, JSON.stringify(end));
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  for (const id of people) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.log(`  ⚠️ 删不掉 ${id}：${error.message}`);
  }
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
