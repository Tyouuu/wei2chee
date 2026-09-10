/**
 * 前后对比照挂在沙龙的一次来访上 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 三选一（单 · 疗程 · 来访的一行），不是四选一——一张照片只能属於一个
 *   · 路径第一段不是这一家 → 挡下来，跟单据／疗程那两条同一条规矩
 *   · 预设不给公开——`may_show` 要她自己一个动作才翻
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
  const email = `vp-${tag}-${stamp}@formae.test`;
  const password = `Vp-${stamp}-x!`;
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
  for (const k of ["bookings", "customers", "staff"]) {
    await C.rpc("add_project_page", { requested_key: k, new_title: k });
  }

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
    in_party: "Mrs Tan", in_party_id: her.id, in_service: "Colour",
  });
  const line = await say(C, "add_visit_line", {
    in_appointment_id: visit, in_service: "染", in_staff_id: junior.id,
    in_price_cents: 18000,
  });

  console.log("\n① 还没挂照片的时候");
  const before = await say(C, "visit_photos_of", { in_line_id: line.id });
  check("空的", before.length === 0, JSON.stringify(before));

  console.log("\n② 🔴 挂一张之前、一张之后");
  const beforePhoto = await say(C, "add_visit_photo", {
    in_line_id: line.id, in_path: `${P}/${line.id}/before.jpg`, in_stage: "before",
  });
  const afterPhoto = await say(C, "add_visit_photo", {
    in_line_id: line.id, in_path: `${P}/${line.id}/after.jpg`, in_stage: "after",
  });
  check("两张都记得进去", !!beforePhoto?.id && !!afterPhoto?.id, "记不进去");
  const photos = await say(C, "visit_photos_of", { in_line_id: line.id });
  check("两张都读得回来", photos.length === 2, JSON.stringify(photos));
  check("🔴 之前的排在之后的前面——她要的就是把两张摆在一起",
    photos[0]?.stage === "before" && photos[1]?.stage === "after",
    JSON.stringify(photos.map((p) => p.stage)));
  check("🔴 预设不给公开", photos.every((p) => p.may_show === false),
    JSON.stringify(photos.map((p) => p.may_show)));

  console.log("\n③ 🔴 她后来同意可以公开那一张");
  const shown = await say(C, "set_photo_may_show", { in_id: beforePhoto.id, in_may_show: true });
  check("那一张翻成可以公开了", shown?.may_show === true, String(shown?.may_show));
  const afterConsent = await say(C, "visit_photos_of", { in_line_id: line.id });
  check("而另一张没有被一起翻",
    afterConsent.find((p) => p.id === afterPhoto.id)?.may_show === false,
    "两张都翻了");

  console.log("\n④ 拒绝的每一种");
  check("第三种说法挡下来（before · during · after，一份封闭的）",
    (await refused(C, "add_visit_photo", {
      in_line_id: line.id, in_path: `${P}/${line.id}/x.jpg`, in_stage: "profile",
    })).includes("before, during or after"), "居然让它过了");
  check("🔴 档案不在这一家的资料夹里就挡下来",
    (await refused(C, "add_visit_photo", {
      in_line_id: line.id,
      in_path: "00000000-0000-0000-0000-000000000000/x/y.jpg",
    })).includes("not in this business"), "居然让它过了");
  check("🔴 一张不属於任何一次来访的照片，写不进去",
    (await refused(C, "add_visit_photo", {
      in_line_id: "00000000-0000-0000-0000-000000000000",
      in_path: `${P}/x/y.jpg`,
    })).includes("no such line"), "居然让它过了");

  console.log("\n⑤ 按两下不会开两张一样的");
  const again = await say(C, "add_visit_photo", {
    in_line_id: line.id, in_path: `${P}/${line.id}/before.jpg`, in_stage: "before",
  });
  check("还给她原本那一张，不是第二张", again?.id === beforePhoto.id,
    JSON.stringify([again?.id, beforePhoto.id]));
  const stillTwo = await say(C, "visit_photos_of", { in_line_id: line.id });
  check("还是两张，没有变三张", stillTwo.length === 2, String(stillTwo.length));

  console.log("\n⑤b 🔴 一张照片一定要属於某一个——三选一那条约束还在");
  const { error: zeroLinks } = await admin.from("record_photos").insert({
    project_id: P, path: `${P}/${line.id}/zero-links.jpg`,
  });
  check("🔴 一个链接都不设——资料库自己挡下来",
    !!zeroLinks, "居然让它插进去了");
  const { error: twoLinks } = await admin.from("record_photos").insert({
    project_id: P, line_id: line.id,
    record_id: "00000000-0000-0000-0000-000000000000",
    path: `${P}/${line.id}/two-links.jpg`,
  });
  check("🔴 同时设两个链接（一行 ＋ 一张单）——资料库自己挡下来",
    !!twoLinks, "居然让它插进去了");

  console.log("\n⑥ 别人家");
  const other = await person("other");
  check("🔴 别人家挂不了我这一行的照片",
    !!(await refused(other.client, "add_visit_photo", {
      in_line_id: line.id, in_path: `${P}/${line.id}/hack.jpg`,
    })), "他挂上了");
  check("🔴 别人家读不到我这一行的照片",
    (await say(other.client, "visit_photos_of", { in_line_id: line.id })).length === 0,
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
