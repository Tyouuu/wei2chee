/**
 * 「结束这次服务」是一个动作，不是四个——老板 2026-09-11 那句
 * 「同一件事被拆得很杂」逼出来的。`complete_visit` 原样呼叫既有的
 * `set_appointment_status` · `add_visit_line` · `add_visit_product` ·
 * `set_visit_tip`，一个字都不重写；资料表照旧四张各自的表
 * （[重点 31] 第 1 条：串起来的是动作，不是表）。
 *
 * 🔴 这一支自己的幂等靠「这一单本来是不是已经 done」——按第二下
 * 直接吐回已经记过的那几行，不再多插一行。跟这个仓库别的每一支
 * 「按两下」同一条纪律。
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
  const email = `cv-${tag}-${stamp}@formae.test`;
  const password = `Cv-${stamp}-x!`;
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

let slot = 0;
const when = () => {
  slot += 1;
  const s = new Date(Date.now() + slot * 2 * 3600e3);
  const e = new Date(s.getTime() + 3600e3);
  return [s.toISOString(), e.toISOString()];
};

try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", boss.id).single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  for (const k of ["bookings", "customers", "staff", "inventory"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const { data: mrsLim } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Lim",
  });
  const { data: amy } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Amy",
  });
  const { data: shampoo } = await C.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Shampoo 250ml", in_unit: "bottle",
  });
  await C.rpc("move_stock", {
    in_item_id: shampoo.id, in_direction: "in", in_qty: 10, in_reason: "开帐",
  });

  const { data: pack } = await C.rpc("add_service_package", {
    in_party_id: mrsLim.id, in_name: "洗剪吹 ×10", in_sessions_total: 10,
  });

  const book = async (partyId) => {
    const [s, e] = when();
    const { data, error } = await C.rpc("add_appointment", {
      in_project_id: P, in_module_key: "bookings",
      in_starts_at: s, in_ends_at: e,
      in_party: "someone", in_party_id: partyId, in_service: "洗剪吹",
    });
    if (error) throw new Error(`add_appointment: ${error.message}`);
    return data;
  };

  /* ── ① 一个动作：标记做完 · 记明细 · 扣库存 · 记小费 ──────────── */
  console.log("\n① 一个动作做完四件事");
  const a1 = await book(mrsLim.id);
  const { data: r1, error: e1 } = await C.rpc("complete_visit", {
    in_appointment_id: a1,
    in_lines: [
      {
        service: "洗剪吹", staff_id: amy.id, price_cents: 4500, tip_cents: 500,
        products: [{ item_id: shampoo.id, qty: 1 }],
      },
    ],
  });
  check("按得下去", !e1 && !!r1, e1?.message);
  check("🔴 顺手扣了套票", r1?.why === "used", `${r1?.why}`);
  check("而且讲得出还剩几次", r1?.sessions_left === 9, `${r1?.sessions_left}`);
  check("🔴 明细记下来了", r1?.lines?.length === 1, JSON.stringify(r1?.lines));
  check("价钱是他讲的那个", r1?.lines?.[0]?.price_cents === 4500, `${r1?.lines?.[0]?.price_cents}`);
  check("小费也记下来了", r1?.lines?.[0]?.tip_cents === 500, `${r1?.lines?.[0]?.tip_cents}`);
  check("总额算得出来", r1?.total_cents === 4500, `${r1?.total_cents}`);

  const { data: onHand } = await admin
    .from("stock_on_hand").select("on_hand").eq("item_id", shampoo.id).maybeSingle();
  check("🔴 架上的货真的少了一支", Number(onHand?.on_hand) === 9, `${onHand?.on_hand}`);

  const { data: apptRow } = await admin
    .from("appointments").select("status").eq("id", a1).single();
  check("那一单真的标成做完了", apptRow?.status === "done", apptRow?.status);

  /* ── ② 🔴 按第二下——不再多插一行 ─────────────────────────────── */
  console.log("\n② 🔴 按第二下不再多插一行");
  const { data: r2, error: e2 } = await C.rpc("complete_visit", {
    in_appointment_id: a1,
    in_lines: [{ service: "又讲一次", price_cents: 9999 }],
  });
  check("按第二下不报错", !e2, e2?.message);
  check("🔴 讲的是已经做完过", r2?.already_done === true, JSON.stringify(r2));
  check("🔴 吐回原来那一行，不是新讲的那一行", r2?.lines?.[0]?.price_cents === 4500,
    JSON.stringify(r2?.lines));
  const { data: lines2 } = await admin
    .from("appointment_lines").select("id").eq("appointment_id", a1);
  check("🔴 资料库里还是只有一行", (lines2 ?? []).length === 1, `${lines2?.length}`);

  /* ── ③ 没带产品、没带小费也走得通 ─────────────────────────────── */
  console.log("\n③ 没带产品、没带小费");
  const a3 = await book(null);
  const { data: r3, error: e3 } = await C.rpc("complete_visit", {
    in_appointment_id: a3,
    in_lines: [{ service: "Quick trim", price_cents: 2000 }],
  });
  check("一样按得下去", !e3 && !!r3, e3?.message);
  check("没有客人不扣套票（讲得出为什么）", r3?.why === "no_party", `${r3?.why}`);
  check("总额还是对的", r3?.total_cents === 2000, `${r3?.total_cents}`);

  /* ── ④ 一次做两样、两个产品 ──────────────────────────────────── */
  console.log("\n④ 一次做两样");
  const a4 = await book(mrsLim.id);
  const { data: pomade } = await C.rpc("add_catalog_item", {
    in_project_id: P, in_module_key: "inventory", in_name: "Pomade", in_unit: "tin",
  });
  await C.rpc("move_stock", {
    in_item_id: pomade.id, in_direction: "in", in_qty: 5, in_reason: "开帐",
  });
  const { data: r4 } = await C.rpc("complete_visit", {
    in_appointment_id: a4,
    in_lines: [
      { service: "洗剪吹", price_cents: 3000, products: [{ item_id: shampoo.id, qty: 1 }] },
      { service: "抓发", price_cents: 1500, products: [{ item_id: pomade.id, qty: 1 }] },
    ],
  });
  check("两行都记下来了", r4?.lines?.length === 2, JSON.stringify(r4?.lines));
  check("两样产品都扣了", r4?.products_added === 2, `${r4?.products_added}`);
  check("总额是两行加起来", r4?.total_cents === 4500, `${r4?.total_cents}`);

  /* ── ⑤ 别人家 ─────────────────────────────────────────────────── */
  console.log("\n⑤ 别人家");
  const other = await person("other");
  const { error: crossErr } = await other.client.rpc("complete_visit", {
    in_appointment_id: a1, in_lines: [],
  });
  check("🔴 动不了别人家那一单", !!crossErr, "居然让它过了");

  console.log(
    bad.length ? `\n判：${bad.length} 条没过\n  ${bad.join("\n  ")}` : `\n判：全部过（${people.length} 个用完就删的帐号）`,
  );
} catch (err) {
  console.error(`\n🔴 尺子自己炸了：${err?.message ?? err}`);
  bad.push("尺子炸了");
} finally {
  await dropThrowaways(admin, people);
  process.exit(bad.length ? 1 : 0);
}
