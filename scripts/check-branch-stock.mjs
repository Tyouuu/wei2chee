/**
 * 一件货，两间店 —— 用真的身分打，而且**故意去踩那个会毁资料的错**。
 *
 * ── 这一支真正在守的那一条 ──────────────────────────────────────────────
 *
 * 🔴 **不讲哪一间就盘点，会把别间的库存抹掉。**
 * Puchong 数出 84，而全公司有 91（那边 84 ＋ 吉隆坡 7）。
 * 一支不问哪一间的盘点会写 −7，把吉隆坡那 7 包抹掉，
 * **而画面上没有任何东西会讲**。
 *
 * 其余每一处这个仓库都是「讲事实，判断留给他」（额度不挡单 ·
 * 架上不够照样出货）—— 这里问，是因为**猜错会毁掉资料**。
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
  const cred = { email: `br-${tag}-${Date.now()}@formae.test`, password: `Br-${Date.now()}-x!` };
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
  await as.rpc("add_project_page", { requested_key: "inventory", new_title: "Stock" });
  return { as, projectId: proj?.id };
}

/** 全公司总数（既有那个 view）。 */
async function total(c, P, name) {
  const { data } = await c.from("stock_on_hand").select("name, on_hand").eq("project_id", P);
  return Number((data ?? []).find((r) => r.name === name)?.on_hand ?? NaN);
}
/** 一间店有几件（新的那个 view）。 */
async function atBranch(c, P, name, branchId) {
  const { data } = await c
    .from("stock_by_branch").select("name, branch_id, on_hand").eq("project_id", P);
  const row = (data ?? []).find(
    (r) => r.name === name && (branchId === null ? r.branch_id === null : r.branch_id === branchId),
  );
  return row ? Number(row.on_hand) : null;
}

try {
  const shop = await person("shop");
  const c = shop.as;
  const P = shop.projectId;
  if (!P) throw new Error("找不到那一家的专案");

  const { data: item } = await c.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Cement 50kg", in_unit: "bags",
  });

  /* ── ① 一间店的时候，什么都没有变 ─────────────────────────────────── */
  console.log("\n① 一间店（他今天的样子）");
  await c.rpc("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 91, in_reason: "Opening",
  });
  check("总数 91", (await total(c, P, "Cement 50kg")) === 91);
  check("🔴 分店那张表照样看得到（不是空的）",
    (await atBranch(c, P, "Cement 50kg", null)) === 91,
    `${await atBranch(c, P, "Cement 50kg", null)}`);

  const { data: counted, error: cErr } = await c.rpc("count_stock", {
    in_item_id: item.id, in_counted: 84,
  });
  check("一间店的时候，不讲哪一间也数得了", !cErr && Number(counted?.moved) === -7,
    cErr?.message ?? JSON.stringify(counted));
  check("总数变成 84", (await total(c, P, "Cement 50kg")) === 84);

  /* ── ② 开第二间店 ─────────────────────────────────────────────────── */
  console.log("\n② 开第二间店");
  const { data: kl } = await c.rpc("add_branch", { in_project_id: P, in_name: "KL" });
  const { data: pch } = await c.rpc("add_branch", { in_project_id: P, in_name: "Puchong" });
  check("两间店开得起来", !!kl?.id && !!pch?.id, JSON.stringify({ kl, pch }));

  /* 之前那 84 包是「还没分店」那一堆，留着不动 —— 那是历史。
     现在各店各进一批。 */
  await c.rpc("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 40, in_reason: "In",
    in_branch_id: kl.id,
  });
  await c.rpc("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 60, in_reason: "In",
    in_branch_id: pch.id,
  });
  check("KL 有 40", (await atBranch(c, P, "Cement 50kg", kl.id)) === 40);
  check("Puchong 有 60", (await atBranch(c, P, "Cement 50kg", pch.id)) === 60);
  check("🔴 全公司总数还是加起来的（84 + 40 + 60）",
    (await total(c, P, "Cement 50kg")) === 184, `${await total(c, P, "Cement 50kg")}`);
  check("以前那一堆还在，没有被吃掉",
    (await atBranch(c, P, "Cement 50kg", null)) === 84);

  /* ── ③ 🔴 那个会毁资料的错 ────────────────────────────────────────── */
  console.log("\n③ 两间店以上，不讲哪一间");
  const { error: blind } = await c.rpc("count_stock", {
    in_item_id: item.id, in_counted: 55,
  });
  check("🔴 挡下来了（不讲哪一间会抹掉别间）", !!blind, "居然让它过了");
  check("而且讲的是人话",
    /say which shelf|哪一间/.test(blind?.message ?? ""), blind?.message?.slice(0, 80));
  check("🔴 而且一件都没有动", (await total(c, P, "Cement 50kg")) === 184,
    `${await total(c, P, "Cement 50kg")}`);

  /* ── ④ 讲清楚就数得了，而且只动那一间 ─────────────────────────────── */
  console.log("\n④ 数 Puchong");
  const { data: pcCount, error: pcErr } = await c.rpc("count_stock", {
    in_item_id: item.id, in_counted: 55, in_branch_id: pch.id,
  });
  check("数得了", !pcErr && Number(pcCount?.before) === 60 && Number(pcCount?.moved) === -5,
    pcErr?.message ?? JSON.stringify(pcCount));
  check("Puchong 变成 55", (await atBranch(c, P, "Cement 50kg", pch.id)) === 55);
  check("🔴 KL 一件都没有被动到", (await atBranch(c, P, "Cement 50kg", kl.id)) === 40);
  check("总数跟着掉 5", (await total(c, P, "Cement 50kg")) === 179);

  /* ── ⑤ 别人家的店挂不上来 ─────────────────────────────────────────── */
  console.log("\n⑤ 别人家的店");
  const other = await person("other");
  const { data: theirBranch } = await other.as.rpc("add_branch", {
    in_project_id: other.projectId, in_name: "Theirs",
  });
  const { error: crossMove } = await c.rpc("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 5, in_reason: "x",
    in_branch_id: theirBranch?.id,
  });
  check("别人家的店挂不上一笔进出", !!crossMove, crossMove?.message ?? "居然让它过了");
  const { error: crossCount } = await c.rpc("count_stock", {
    in_item_id: item.id, in_counted: 1, in_branch_id: theirBranch?.id,
  });
  check("也数不了别人家的架子", !!crossCount, crossCount?.message ?? "居然让它过了");

  const { data: peek } = await other.as
    .from("stock_by_branch").select("name").eq("project_id", P);
  check("🔴 别人家读不到这张分店表", (peek ?? []).length === 0, `${peek?.length} 行`);
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${failed.length === 0 ? "全过" : `${failed.length} 条没过`}`);
process.exit(failed.length ? 1 : 0);
