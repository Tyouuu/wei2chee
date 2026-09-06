/**
 * 从吉隆坡搬二十包去 Puchong —— 用真的登入身分打一次每一支。
 *
 * 🔴 这一支要守的不是「搬得动」，是**那两笔一定对得上**:
 *   他打了「出 20」，接一通电话，回来打「进 2」——
 *   架上从此少了十八包，而没有任何东西会讲。
 *   一次呼叫两笔，打错只能整个打错，不会打错一半。
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
  const email = `tr-${tag}-${stamp}@formae.test`;
  const password = `Tr-${stamp}-x!`;
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

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  await C.rpc("add_project_page", { requested_key: "inventory", new_title: "inventory" });

  const { data: kl } = await C.rpc("add_branch", {
    in_project_id: P, in_name: "Kuala Lumpur",
  });
  const { data: puchong } = await C.rpc("add_branch", {
    in_project_id: P, in_name: "Puchong",
  });
  check("道具：两间店开得起来", !!kl?.id && !!puchong?.id,
    `${kl?.id} / ${puchong?.id}`);

  const { data: item } = await C.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Cement 50kg",
    in_unit: "bags",
  });
  await C.rpc("move_stock", {
    in_item_id: item.id, in_direction: "in", in_qty: 100,
    in_reason: "进货", in_branch_id: kl.id,
  });

  const at = async (branchId) => {
    const { data } = await C.from("stock_by_branch")
      .select("item_id, branch_id, on_hand").eq("project_id", P);
    const r = (data ?? []).find(
      (x) => x.item_id === item.id && x.branch_id === branchId);
    return Number(r?.on_hand ?? 0);
  };
  check("道具：吉隆坡先有一百包", (await at(kl.id)) === 100, `${await at(kl.id)}`);

  /* ── ① 🔴 一个动作，两笔一定对得上 ────────────────────────── */
  console.log("\n① 🔴 一个动作，两笔对得上");
  const { data: t1, error: te } = await C.rpc("transfer_stock", {
    in_item_id: item.id, in_from_branch: kl.id, in_to_branch: puchong.id,
    in_qty: 20,
  });
  const one = t1?.[0];
  check("搬得动", !te && !!one?.transfer_id, te?.message);
  check("🔴 吉隆坡少了二十包", (await at(kl.id)) === 80, `${await at(kl.id)}`);
  check("🔴 Puchong 多了二十包", (await at(puchong.id)) === 20,
    `${await at(puchong.id)}`);
  check("整家还是一百包（搬来搬去不会凭空多也不会凭空少）",
    (await at(kl.id)) + (await at(puchong.id)) === 100,
    `${await at(kl.id)} + ${await at(puchong.id)}`);
  check("够的时候差多少是 0", Number(one?.short) === 0, `${one?.short}`);
  check("而且讲得出搬之前那一间店有几件", Number(one?.had) === 100, `${one?.had}`);

  const { data: moves } = await admin
    .from("stock_moves").select("id, direction, qty, branch_id, transfer_id")
    .eq("transfer_id", one.transfer_id);
  check("🔴 两笔，同一个编号串着", (moves ?? []).length === 2,
    `${moves?.length}`);
  check("🔴 一出一进，数量一样",
    (moves ?? []).filter((m) => m.direction === "out").length === 1
      && (moves ?? []).filter((m) => m.direction === "in").length === 1
      && new Set((moves ?? []).map((m) => Math.abs(Number(m.qty)))).size === 1,
    JSON.stringify(moves?.map((m) => [m.direction, m.qty])));

  /* ── ② 挡下来的那几种 ──────────────────────────────────────── */
  console.log("\n② 挡下来的那几种");
  const { error: same } = await C.rpc("transfer_stock", {
    in_item_id: item.id, in_from_branch: kl.id, in_to_branch: kl.id, in_qty: 5,
  });
  check("🔴 同一间搬到同一间 → 挡", !!same, "居然让它过了");
  const { error: zero } = await C.rpc("transfer_stock", {
    in_item_id: item.id, in_from_branch: kl.id, in_to_branch: puchong.id,
    in_qty: 0,
  });
  check("搬零件 → 挡", !!zero, "居然让它过了");
  const { error: noBranch } = await C.rpc("transfer_stock", {
    in_item_id: item.id, in_from_branch: kl.id, in_to_branch: null, in_qty: 5,
  });
  check("没讲搬去哪 → 挡", !!noBranch, "居然让它过了");
  check("被挡下来之后，两间店一件都没有动",
    (await at(kl.id)) === 80 && (await at(puchong.id)) === 20,
    `${await at(kl.id)} / ${await at(puchong.id)}`);

  /* ── ③ 🔴 架上不够照样搬，然后讲出来 ──────────────────────── */
  console.log("\n③ 🔴 不够照样搬，然后讲出来");
  const { data: t2 } = await C.rpc("transfer_stock", {
    in_item_id: item.id, in_from_branch: puchong.id, in_to_branch: kl.id,
    in_qty: 30,
  });
  const two = t2?.[0];
  check("🔴 照样搬（挡下去他就绕过系统搬）", !!two?.transfer_id,
    JSON.stringify(two));
  check("🔴 而且讲得出差十件", Number(two?.short) === 10, `${two?.short}`);
  check("Puchong 变成 −10（那是真的，而且看得见）",
    (await at(puchong.id)) === -10, `${await at(puchong.id)}`);

  /* ── ④ 🔴 撤销是写两笔反的，不是删掉 ──────────────────────── */
  console.log("\n④ 🔴 撤销是写反的，不是删掉");
  const { data: undone, error: ue } = await C.rpc("undo_transfer", {
    in_transfer_id: two.transfer_id,
  });
  check("撤销得了", !ue && Number(undone) === 2, ue?.message ?? `${undone}`);
  check("🔴 数字回去了", (await at(puchong.id)) === 20 && (await at(kl.id)) === 80,
    `${await at(puchong.id)} / ${await at(kl.id)}`);
  const { data: stillThere } = await admin
    .from("stock_moves").select("id").eq("transfer_id", two.transfer_id);
  check("🔴 而那两笔还在流水上（那次搬运真的发生过）",
    (stillThere ?? []).length === 2, `${stillThere?.length}`);
  const { error: noSuch } = await C.rpc("undo_transfer", {
    in_transfer_id: "00000000-0000-0000-0000-000000000000",
  });
  check("撤销一个不存在的 → 讲得出来", !!noSuch, "居然让它过了");

  /* ── ⑤ 按两下是一次 ───────────────────────────────────────── */
  console.log("\n⑤ 按两下是一次");
  const key = crypto.randomUUID();
  const before = await at(kl.id);
  for (let i = 0; i < 2; i += 1) {
    await C.rpc("transfer_stock", {
      in_item_id: item.id, in_from_branch: kl.id, in_to_branch: puchong.id,
      in_qty: 5, in_idempotency_key: key,
    });
  }
  check("🔴 按两下只搬一次", (await at(kl.id)) === before - 5,
    `${before} → ${await at(kl.id)}`);

  /* ── ⑥ 看得到这几次搬运 ───────────────────────────────────── */
  console.log("\n⑥ 看得到这几次搬运");
  const { data: list, error: le } = await C.rpc("transfers_of", { in_project_id: P });
  check("列得出来", !le && (list ?? []).length >= 2,
    le?.message ?? `${list?.length}`);
  const first = (list ?? []).find((r) => r.transfer_id === one.transfer_id);
  check("讲得出搬的是什么、几件", first?.item_name === "Cement 50kg"
    && Number(first?.qty) === 20, JSON.stringify(first));
  check("🔴 两间店的名字不一样（那正好是这一支要答的那一句）",
    first?.from_name === "Kuala Lumpur" && first?.to_name === "Puchong",
    `${first?.from_name} → ${first?.to_name}`);

  /* ── ⑦ 别人家 ─────────────────────────────────────────────── */
  console.log("\n⑦ 别人家");
  const other = await person("other");
  const O = other.client;
  await O.rpc("set_project_style", { new_style: "ledger" });
  const { error: crossErr } = await O.rpc("transfer_stock", {
    in_item_id: item.id, in_from_branch: kl.id, in_to_branch: puchong.id,
    in_qty: 1,
  });
  check("🔴 搬不了别人家的货", !!crossErr, "居然让它过了");
  const { data: theirList } = await O.rpc("transfers_of", { in_project_id: P });
  check("🔴 也看不到别人家搬过什么", (theirList ?? []).length === 0,
    `${theirList?.length}`);

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
