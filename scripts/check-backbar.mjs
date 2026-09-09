/**
 * 沙龙用掉一支染膏，架上要真的少一支 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · **架上真的少了**（在这之前库存只有他自己记得的时候才会少）
 *   · 少的是**效期最早**那一支，而且**跟医美那一边挑的是同一个批号**
 *   · 一笔用料**要嘛挂在疗程上、要嘛挂在来访那一行上，不可以两个都挂**
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
  const email = `bb-${tag}-${stamp}@formae.test`;
  const password = `Bb-${stamp}-x!`;
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
const refused = async (client, fn, args) => {
  const { error } = await client.rpc(fn, args);
  return error?.message ?? "";
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "hearth" });
  for (const k of ["bookings", "customers", "staff", "inventory"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const { data: today } = await admin.rpc("today_myt");
  const day = (n) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const at = (h) => {
    const d = new Date(`${today}T00:00:00Z`);
    d.setUTCHours(h - 8);
    return d.toISOString();
  };

  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });
  const sifu = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Sifu",
  });
  const tube = await say(C, "add_catalog_item", {
    in_project_id: P, in_module_key: "inventory",
    in_name: "染膏 6/34", in_unit: "支", in_cost_cents: 2800, in_reorder_at: 3,
  });

  /* 两批：一批 60 天后过期（3 支），一批 400 天后（5 支）。 */
  const soon = await say(C, "add_stock_batch", {
    in_item_id: tube.id, in_code: "LOT-A", in_expiry_on: day(60),
  });
  const later = await say(C, "add_stock_batch", {
    in_item_id: tube.id, in_code: "LOT-B", in_expiry_on: day(400),
  });
  await say(C, "move_stock", {
    in_item_id: tube.id, in_direction: "in", in_qty: 3,
    in_reason: "supplier", in_batch_id: soon.id,
  });
  await say(C, "move_stock", {
    in_item_id: tube.id, in_direction: "in", in_qty: 5,
    in_reason: "supplier", in_batch_id: later.id,
  });

  const visit = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: at(10), in_ends_at: at(12),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "染",
  });
  const line = await say(C, "add_visit_line", {
    in_appointment_id: visit, in_service: "染", in_staff_id: sifu.id,
    in_price_cents: 18000,
  });

  console.log("\n① 🔴 用掉两支，架上真的少两支");
  const used = await say(C, "add_visit_product", {
    in_line_id: line.id, in_item_id: tube.id, in_qty: 2,
  });
  check("记得进去", !!used?.id, "记不进去");
  const lots = await say(C, "batches_of", { in_item_id: tube.id });
  const a = lots.find((r) => r.code === "LOT-A");
  const b = lots.find((r) => r.code === "LOT-B");
  check(
    "🔴 少的是快过期那一批（3 → 1）",
    Number(a?.on_hand) === 1,
    `LOT-A ${a?.on_hand}`,
  );
  check("🔴 而新那一批一支都没动（还是 5）", Number(b?.on_hand) === 5, `LOT-B ${b?.on_hand}`);
  check("批号记在那一笔上了", used?.batch_id === a?.batch_id, String(used?.batch_id));
  check("单位是那件货自己的（支）", used?.unit === "支", String(used?.unit));

  console.log("\n② 这一次来访用掉了什么");
  const list = await say(C, "visit_products_of", { in_appointment_id: visit });
  check("读得回来，一行", list.length === 1, String(list.length));
  check(
    "而且讲得出是哪一样活用掉的（染）· 哪一件 · 哪一批",
    list[0]?.service === "染" && /6\/34/.test(String(list[0]?.item))
      && list[0]?.batch_code === "LOT-A",
    JSON.stringify(list[0]),
  );

  console.log("\n③ 🔴 挑批号那一段只有一份");
  /* 医美那一边问同一件货同一个数量，要挑到同一个批号 —— 两份会漂。 */
  const picked = await say(C, "pick_batch", { in_item_id: tube.id, in_qty: 1 });
  check(
    "🔴 共用那一支挑出来的，还是快过期那一批",
    picked === a?.batch_id,
    `${picked} ⟂ ${a?.batch_id}`,
  );

  console.log("\n④ 🔴 一笔用料只挂一个地方");
  const { error: both } = await admin.from("treatment_products").insert({
    project_id: P, item_id: tube.id, qty: 1, unit: "支",
    line_id: line.id,
    note_id: "00000000-0000-0000-0000-000000000000",
  });
  check("🔴 两个都挂 → 资料库自己挡下来", !!both, "它让它进去了");
  const { error: neither } = await admin.from("treatment_products").insert({
    project_id: P, item_id: tube.id, qty: 1, unit: "支",
  });
  check("🔴 两个都不挂 → 也挡下来（一笔没有主人的用料没有用）",
    !!neither, "它让它进去了");

  console.log("\n⑤ 🔴 而补货线那一句现在是真的了");
  /* 架上本来 8 支，用掉 2 支 → 6 支，补货线 3 —— 还没破。
     再用掉 4 支就破了，而那一条讯号现在读的是**真的**数字。 */
  await say(C, "add_visit_product", {
    in_line_id: line.id, in_item_id: tube.id, in_qty: 4,
  });
  const low = await say(C, "nudges_due", { in_project_id: P });
  check(
    "🔴 用到剩 2 支 → 「低过补货线」自己叫了",
    low.some((r) => r.kind === "below_reorder"),
    JSON.stringify(low.map((r) => r.kind)),
  );

  console.log("\n⑥ 拒绝的每一种");
  check("数量 0 挡下来",
    (await refused(C, "add_visit_product", {
      in_line_id: line.id, in_item_id: tube.id, in_qty: 0,
    })).includes("say how much"), "居然让它过了");
  check("不是他架上的货挡下来",
    (await refused(C, "add_visit_product", {
      in_line_id: line.id, in_item_id: her.id, in_qty: 1,
    })).includes("not on your shelf"), "居然让它过了");

  console.log("\n⑦ 🔴 美发师记得下（那是她的活）");
  const crew = await person("crew");
  await say(C, "add_project_member", { in_email: crew.email });
  check(
    "🔴 她记得下用掉了什么",
    (await refused(crew.client, "add_visit_product", {
      in_line_id: line.id, in_item_id: tube.id, in_qty: 1,
    })) === "",
    "它把她挡下来了",
  );

  console.log("\n⑧ 别人家");
  const other = await person("other");
  check("🔴 别人家记不进我的",
    !!(await refused(other.client, "add_visit_product", {
      in_line_id: line.id, in_item_id: tube.id, in_qty: 1,
    })), "他记进来了");
  check("🔴 别人家读不到我这一次用了什么",
    (await say(other.client, "visit_products_of", { in_appointment_id: visit })).length === 0,
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
