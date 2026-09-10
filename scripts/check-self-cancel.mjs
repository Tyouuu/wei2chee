/**
 * 客人自己按得了取消 —— 真登入 + 一把没有登入过的钥匙（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 陌生人看得到的只有她自己那一笔——不带任何 id，不带别的预约，不带钱
 *   · 回一个词，不抛例外——她是站在自己那张预约前面的人
 *   · 取消两次讲得出「已经处理过了」，跟门牌是假的分开讲
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
/* 一把从头到尾没有登入过的钥匙 —— 她拿着那条连结就是这个身分。 */
const stranger = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
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
  const email = `sc-${tag}-${stamp}@formae.test`;
  const password = `Sc-${stamp}-x!`;
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
  await admin.from("projects").update({ business_name: "Xing Fa Salon" }).eq("id", P);
  await C.rpc("add_project_page", { requested_key: "bookings", new_title: "bookings" });
  await C.rpc("add_project_page", { requested_key: "customers", new_title: "customers" });

  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mrs Tan",
  });
  const apptId = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() + 864e5).toISOString(),
    in_ends_at: new Date(Date.now() + 864e5 + 36e5).toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Colour",
  });
  const { data: apptRow } = await admin
    .from("appointments").select("public_ref").eq("id", apptId).single();
  const ref = apptRow.public_ref;
  check("道具：门牌一开始就有了（建表那天的预设值）", !!ref, "居然是空的");

  console.log("\n① 她拿着那条连结打开");
  const seen = await say(stranger, "public_appointment", { in_ref: ref });
  const page = (seen ?? [])[0];
  check("打得开", !!page, "打不开");
  check("写着这一家的名字", page?.business_name === "Xing Fa Salon", page?.business_name);
  check("写着她自己的名字", page?.party_name === "Mrs Tan", page?.party_name);
  check("讲得出是什么服务、几点", page?.service === "Colour" && !!page?.starts_at,
    JSON.stringify([page?.service, page?.starts_at]));
  check("🔴 现在还能取消", page?.can_cancel === true, String(page?.can_cancel));

  const keys = Object.keys(page ?? {});
  check("🔴 一个 id 都没有漏出去", !keys.some((k) => /_id$|^id$/.test(k)), keys.join(","));

  console.log("\n② 门牌是假的");
  const nothing = await say(stranger, "public_appointment", {
    in_ref: "00000000-0000-0000-0000-000000000000",
  });
  check("什么都不回（不告诉她这个门牌存不存在）", (nothing ?? []).length === 0,
    JSON.stringify(nothing));

  console.log("\n③ 🔴 她按下取消");
  const cancelled = await say(stranger, "cancel_shared_appointment", { in_ref: ref });
  check("回的是 ok", cancelled === "ok", cancelled);
  const { data: afterCancel } = await admin
    .from("appointments").select("status").eq("id", apptId).single();
  check("资料库里真的取消了", afterCancel?.status === "cancelled", afterCancel?.status);

  console.log("\n④ 🔴 再按一次，讲得出「已经处理过了」");
  const again = await say(stranger, "cancel_shared_appointment", { in_ref: ref });
  check("回的是 already_settled，不是资料库的错误讯息",
    again === "already_settled", again);
  const seenAfter = await say(stranger, "public_appointment", { in_ref: ref });
  check("🔴 打开还看得到（不是整个消失），只是不能再取消了",
    seenAfter[0]?.status === "cancelled" && seenAfter[0]?.can_cancel === false,
    JSON.stringify(seenAfter[0]));

  console.log("\n⑤ 假的门牌取消不了");
  const fakeCancel = await say(stranger, "cancel_shared_appointment", {
    in_ref: "00000000-0000-0000-0000-000000000000",
  });
  check("回的是 not_found", fakeCancel === "not_found", fakeCancel);

  console.log("\n⑥ 🔴 做完了的那一笔，取消不了");
  const doneAppt = await say(C, "add_appointment", {
    in_project_id: P, in_module_key: "bookings",
    in_starts_at: new Date(Date.now() - 36e5).toISOString(),
    in_ends_at: new Date().toISOString(),
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Cut",
  });
  await say(C, "set_appointment_status", { in_id: doneAppt, in_status: "done" });
  const { data: doneRow } = await admin
    .from("appointments").select("public_ref").eq("id", doneAppt).single();
  const doneCancel = await say(stranger, "cancel_shared_appointment", {
    in_ref: doneRow.public_ref,
  });
  check("回的是 already_settled，不是 ok", doneCancel === "already_settled", doneCancel);
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
