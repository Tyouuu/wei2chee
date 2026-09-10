/**
 * 哪一样服务做得最多、赚得最多 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 服务是他自己的话，堆的时候原字堆，不猜一套分类
 *   · 只数做完的那几次 —— 还没来的客人身上的生意是一个愿望
 *   · 这一支回的是钱 —— 美发师看不到，那是老板排时段用的数字
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
  const email = `sp-${tag}-${stamp}@formae.test`;
  const password = `Sp-${stamp}-x!`;
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
  await C.rpc("set_project_style", { new_style: "hearth" });
  for (const k of ["bookings", "customers", "staff"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

  const senior = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Sifu",
  });
  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });

  /* 一支固定的锚点，不是每次呼叫各自读一次 Date.now() ——
     两次呼叫中间真的会过几百毫秒，「3 小时前」用晚一点那一刻算出来，
     会跟用早一点那一刻算出来的「2 小时前」撞在一起（真的撞过一次）。 */
  const anchor = Date.now();

  /** 一次做完的来访，一行服务，一个价钱。 */
  const done = async (hoursAgo, service, cents) => {
    const start = new Date(anchor - hoursAgo * 36e5).toISOString();
    const end = new Date(anchor - hoursAgo * 36e5 + 36e5).toISOString();
    const id = await say(C, "add_appointment", {
      in_project_id: P, in_module_key: "bookings",
      in_starts_at: start, in_ends_at: end,
      in_party: "Mrs Tan", in_party_id: her.id, in_service: service,
    });
    await say(C, "add_visit_line", {
      in_appointment_id: id, in_service: service, in_staff_id: senior.id,
      in_price_cents: cents,
    });
    await say(C, "set_appointment_status", { in_id: id, in_status: "done" });
    return id;
  };

  console.log("\n① 还没做过的时候");
  const before = await say(C, "service_performance", { in_project_id: P });
  check("空的（一次都没做过）", before.length === 0, JSON.stringify(before));

  console.log("\n② 🔴 剪三次、染一次 —— 剪排第一（做得最多）");
  await done(2, "剪", 3800);
  await done(26, "剪", 3800);
  await done(50, "剪", 3800);
  await done(3, "染", 18000);

  const ranked = await say(C, "service_performance", { in_project_id: P });
  const cut = ranked.find((r) => r.service === "剪");
  const colour = ranked.find((r) => r.service === "染");
  check("剪做了 3 次", Number(cut?.times_done) === 3, String(cut?.times_done));
  check("剪赚了 RM 114（38 × 3）", Number(cut?.total_cents) === 11400, String(cut?.total_cents));
  check("染做了 1 次", Number(colour?.times_done) === 1, String(colour?.times_done));
  check("染赚了 RM 180", Number(colour?.total_cents) === 18000, String(colour?.total_cents));
  check("🔴 剪排在染前面（做得比较多次）",
    ranked.findIndex((r) => r.service === "剪") < ranked.findIndex((r) => r.service === "染"),
    JSON.stringify(ranked.map((r) => [r.service, r.times_done])));

  console.log("\n③ 🔴 「剪发」跟「剪」是两行 —— 原字堆，不猜一套分类");
  await done(1, "剪发", 5000);
  const withVariant = await say(C, "service_performance", { in_project_id: P });
  check("「剪」还是 3 次（没有被併进去）",
    Number(withVariant.find((r) => r.service === "剪")?.times_done) === 3,
    JSON.stringify(withVariant));
  check("「剪发」自己另外一行",
    Number(withVariant.find((r) => r.service === "剪发")?.times_done) === 1,
    JSON.stringify(withVariant));

  console.log("\n④ 🔴 还没做完的那一次不算");
  const start = new Date(Date.now() + 36e5).toISOString();
  const end = new Date(Date.now() + 2 * 36e5).toISOString();
  const notYet = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: start, in_ends_at: end,
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "护理",
  });
  await say(C, "add_visit_line", {
    in_appointment_id: notYet, in_service: "护理", in_staff_id: senior.id,
    in_price_cents: 50000,
  });
  const stillPending = await say(C, "service_performance", { in_project_id: P });
  check("🔴 「护理」还没来 → 不出现在排行里（不是愿望）",
    !stillPending.some((r) => r.service === "护理"),
    JSON.stringify(stillPending.map((r) => r.service)));

  console.log("\n⑤ 🔴 美发师看不到钱 —— 那是老板排时段用的数字");
  const crew = await person("crew");
  await say(C, "add_project_member", { in_email: crew.email });
  check("🔴 她读到的是空的（那一支回的是钱）",
    (await say(crew.client, "service_performance", { in_project_id: P })).length === 0,
    "她读到了");

  console.log("\n⑥ 别人家");
  const other = await person("other");
  check("🔴 别人家读不到我的排行",
    (await say(other.client, "service_performance", { in_project_id: P })).length === 0,
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
