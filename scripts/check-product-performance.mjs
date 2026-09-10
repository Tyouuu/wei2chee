/**
 * 哪一件东西卖得好、要不要补货 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 「用完了」跟「卖给客人」不分——两边都是这瓶东西离开了架子
 *   · 没有出过货的东西答不出「还撑几天」，不硬填一个数字（[重点 33]）
 *   · 排在最前面的是卖得最快的那一件，不是打进去的顺序
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

const stamp = Date.now();
const bad = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

const people = [];
async function person(tag) {
  const email = `pp-${tag}-${stamp}@formae.test`;
  const password = `Pp-${stamp}-x!`;
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
const say = async (client, fn, args) => {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  for (const k of ["inventory", "bookings", "customers", "staff"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const shampoo = await say(C, "add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "洗发精 500ml",
    in_unit: "瓶", in_reorder_at: 5,
  });
  const wax = await say(C, "add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "发蜡",
    in_unit: "罐", in_reorder_at: 3,
  });
  const untouched = await say(C, "add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "从来没动过的货",
    in_unit: "件",
  });

  await say(C, "move_stock", {
    in_item_id: shampoo.id, in_direction: "in", in_qty: 30, in_reason: "开帐",
  });
  await say(C, "move_stock", {
    in_item_id: wax.id, in_direction: "in", in_qty: 10, in_reason: "开帐",
  });
  await say(C, "move_stock", {
    in_item_id: untouched.id, in_direction: "in", in_qty: 4, in_reason: "开帐",
  });

  console.log("\n① 还没出过货的时候");
  const before = await say(C, "product_performance", { in_project_id: P });
  const shampooRow0 = before.find((r) => r.item_id === shampoo.id);
  check("架上的数量对（30）", Number(shampooRow0?.on_hand) === 30, String(shampooRow0?.on_hand));
  check("🔴 还没出过货 → 撑几天答不出来（不是 0，也不是无穷大）",
    shampooRow0?.days_of_stock === null, String(shampooRow0?.days_of_stock));
  check("近期卖出是 0", Number(shampooRow0?.sold_recent) === 0, String(shampooRow0?.sold_recent));

  console.log("\n② 🔴 卖给客人跟疗程用掉，一样算「离开了架子」");
  await say(C, "move_stock", {
    in_item_id: shampoo.id, in_direction: "out", in_qty: 5, in_reason: "卖出",
  });
  const junior = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Ah Girl",
  });
  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });
  const visit = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() - 36e5).toISOString(),
    in_ends_at: new Date().toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "洗剪",
  });
  const line = await say(C, "add_visit_line", {
    in_appointment_id: visit, in_service: "洗", in_staff_id: junior.id, in_price_cents: 1200,
  });
  await say(C, "add_visit_product", {
    in_line_id: line.id, in_item_id: shampoo.id, in_qty: 2,
  });

  const after = await say(C, "product_performance", { in_project_id: P });
  const shampooRow = after.find((r) => r.item_id === shampoo.id);
  check("🔴 卖出 5 加疗程用掉 2，近期卖出算成 7（不分两种原因）",
    Number(shampooRow?.sold_recent) === 7, String(shampooRow?.sold_recent));
  check("架上剩 23（30 进 − 7 出）",
    Number(shampooRow?.on_hand) === 23, String(shampooRow?.on_hand));

  console.log("\n③ 🔴 照这个速度，还撑几天——算出来的，不是猜的");
  /* 30 天卖 7 瓶 = 一天 7/30 瓶，剩 23 瓶应该还撑 23 / (7/30) ≈ 98.6 天。 */
  const expectDays = Math.round((23 / (7 / 30)) * 10) / 10;
  check(`算出来的天数是 ${expectDays}（架上量 ÷ 每天卖出量）`,
    Math.abs(Number(shampooRow?.days_of_stock) - expectDays) < 0.2,
    String(shampooRow?.days_of_stock));

  console.log("\n④ 🔴 补货线沿用他自己订的那一条");
  await say(C, "move_stock", {
    in_item_id: wax.id, in_direction: "out", in_qty: 8, in_reason: "卖出",
  });
  const waxRow = (await say(C, "product_performance", { in_project_id: P }))
    .find((r) => r.item_id === wax.id);
  check("发蜡剩 2（低过补货线 3）", Number(waxRow?.on_hand) === 2, String(waxRow?.on_hand));
  check("🔴 讲得出该补货了", waxRow?.below_reorder === true, String(waxRow?.below_reorder));
  check("没订补货线的那一件，不硬判它该不该补",
    (await say(C, "product_performance", { in_project_id: P }))
      .find((r) => r.item_id === untouched.id)?.below_reorder === false,
    "居然判了");

  console.log("\n⑤ 🔴 排在最前面的是卖得最快的那一件");
  const ranked = await say(C, "product_performance", { in_project_id: P });
  check("发蜡（卖 8）排在洗发精（卖 7）前面",
    ranked.findIndex((r) => r.item_id === wax.id)
      < ranked.findIndex((r) => r.item_id === shampoo.id),
    JSON.stringify(ranked.map((r) => [r.name, r.sold_recent])));

  console.log("\n⑥ 别人家");
  const other = await person("other");
  check("🔴 别人家读不到我的货架分析",
    (await say(other.client, "product_performance", { in_project_id: P })).length === 0,
    "他读到了");
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
