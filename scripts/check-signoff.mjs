/**
 * 病历签核 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的四条：
 *   · 写下去那一刻**自动**就是签了，不用另外一颗「签核」按钮
 *   · 签了的那一笔，`what` / `area` / `note` / `done_on` / `staff_id` 一律拒绝改
 *   · 收起来（archived）不算改内容，签了照样收得起来
 *   · 想改，改用附注——附注本身写得进去、改不掉、删不掉
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
  const email = `signoff-${tag}-${stamp}@formae.test`;
  const password = `Signoff-${stamp}-x!`;
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

  const her = await say(C, "add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Ms Lim",
  });

  console.log("\n① 写下去那一刻自动就是签了");
  const note = await say(C, "add_treatment_note", {
    in_party_id: her.id, in_what: "Hydrafacial",
  });
  check("签的时间填了", !!note.signed_at, "还是空的");
  check("签的人是自己", note.signed_by === boss.id, note.signed_by);

  console.log("\n② 🔴 签了的这一笔，内容一律拒绝改");
  check("改 what 被拒", (await refused(C, "update_treatment_note", {
    in_id: note.id, in_what: "改成别的",
  })).includes("signed and cannot be edited"), "居然让它过了");
  check("改 area 被拒", (await refused(C, "update_treatment_note", {
    in_id: note.id, in_area: "脸颊",
  })).includes("signed and cannot be edited"), "居然让它过了");
  check("改 note 被拒", (await refused(C, "update_treatment_note", {
    in_id: note.id, in_note: "补一句",
  })).includes("signed and cannot be edited"), "居然让它过了");
  check("改 done_on 被拒", (await refused(C, "update_treatment_note", {
    in_id: note.id, in_done_on: "2026-01-01",
  })).includes("signed and cannot be edited"), "居然让它过了");
  check("换 staff_id 被拒", (await refused(C, "update_treatment_note", {
    in_id: note.id, in_staff_id: her.id,
  })).includes("signed and cannot be edited"), "居然让它过了");

  console.log("\n③ 🔴 收起来不算改内容，签了照样收得起来");
  const archived = await say(C, "update_treatment_note", {
    in_id: note.id, in_archived: true,
  });
  check("收起来了", !!archived.archived_at, "还是原来那样");
  const unarchived = await say(C, "update_treatment_note", {
    in_id: note.id, in_archived: false,
  });
  check("放回来了", unarchived.archived_at === null, "还是收着");

  console.log("\n④ 想改，改用附注");
  const add1 = await say(C, "add_treatment_note_addendum", {
    in_note_id: note.id, in_body: "更正：其实做的是果酸换肤，不是 Hydrafacial",
  });
  check("附注写得进去", !!add1.id, "写不进去");
  const read = await say(C, "treatment_notes_of", { in_party_id: her.id });
  const mine = read.find((r) => r.id === note.id);
  check("原文一个字没变（附注不是改写）", mine.what === "Hydrafacial", mine.what);
  check("附注读得回来", mine.addenda.length === 1 && mine.addenda[0].body === add1.body,
    JSON.stringify(mine.addenda));

  console.log("\n⑤ 🔴 附注本身写得进去、改不掉、删不掉");
  check("空的附注挡下来", (await refused(C, "add_treatment_note_addendum", {
    in_note_id: note.id, in_body: "  ",
  })).includes("say what the correction"), "居然让它过了");
  check("太长的附注挡下来", (await refused(C, "add_treatment_note_addendum", {
    in_note_id: note.id, in_body: "x".repeat(2001),
  })).includes("too long"), "居然让它过了");
  /* ⚠️ RLS 没有 update/delete policy 的表，PostgREST 回的是**空阵列，
     不是报错**——跟 `party_alert_of` 那一类同一个形状（RLS 是 WHERE 里的
     一个条件，不是 `raise exception`）。真的判准是「有没有真的被动到」，
     不是「有没有报错」。 */
  const { data: updData, error: updErr } = await C
    .from("treatment_note_addenda").update({ body: "偷改" }).eq("id", add1.id).select();
  check("直接改资料表 —— RLS 静静挡下来（回空阵列，不是报错）",
    !updErr && (updData ?? []).length === 0, JSON.stringify({ updErr, updData }));
  const { data: delData, error: delErr } = await C
    .from("treatment_note_addenda").delete().eq("id", add1.id).select();
  check("直接删资料表 —— RLS 静静挡下来（回空阵列，不是报错）",
    !delErr && (delData ?? []).length === 0, JSON.stringify({ delErr, delData }));
  const { data: stillRaw } = await admin
    .from("treatment_note_addenda").select("body").eq("id", add1.id).single();
  check("原文一个字没变（用 service role 亲眼查过，不是信前端回来的话）",
    stillRaw?.body === add1.body, stillRaw?.body);
  const stillThere = await say(C, "treatment_notes_of", { in_party_id: her.id });
  check("附注还在（刚才两下都没有真的动到它）",
    stillThere.find((r) => r.id === note.id).addenda.length === 1, "不见了");

  console.log("\n⑥ 别人家");
  const other = await person("other");
  check("别人家开不了她的附注", (await refused(other.client, "add_treatment_note_addendum", {
    in_note_id: note.id, in_body: "偷偷塞一句",
  })).includes("no such treatment note"), "居然让它过了");
  const otherRead = await say(other.client, "treatment_notes_of", { in_party_id: her.id });
  check("别人家读不到她的病历", otherRead.length === 0, JSON.stringify(otherRead));
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
