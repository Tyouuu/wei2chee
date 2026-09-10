/**
 * 审计日志分得出「是他自己点的，还是他叫助手做的」了 —— 真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 同一个身分（changed_by 一模一样），只靠一个请求头分出 via_ai
 *   · 人手动按的那条路（没有那个头）——一律 false，什么都不用改
 *   · 助手那条路（带 x-formae-actor: assistant）——一律 true
 *
 * 这不是给 AI 开一条专用的写入路径（[重点 23] 禁的那件）——两边呼叫的是
 * 同一支 `update_pipeline_record`，唯一的差别是 HTTP 层的一个请求头，
 * 那是助手发请求的那台伺服器自己加的，不是资料库多认一种身分。
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
async function person(tag, extraHeaders) {
  const email = `aa-${tag}-${stamp}@formae.test`;
  const password = `Aa-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    ...(extraHeaders ? { global: { headers: extraHeaders } } : {}),
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
  await C.rpc("add_project_page", { requested_key: "quotations", new_title: "quotations" });

  /* 同一个人，第二把钥匙——带上助手那条伺服器路会送的头。
     同一个 email/password，所以 auth.uid() 跟 boss 一模一样。 */
  const asAssistant = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
    global: { headers: { "x-formae-actor": "assistant" } },
  });
  await asAssistant.auth.signInWithPassword({ email: boss.email, password: `Aa-${stamp}-x!` });

  const record = await say(C, "add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "Quotation for Hup Seng", in_party: "Hup Seng",
    in_amount_cents: 480000, in_stage: "quoted",
  });
  const recordId = typeof record === "object" ? record.id : record;

  console.log("\n① 他自己在浏览器上改——没有那个头，via_ai 是假的");
  await say(C, "update_pipeline_record", { in_id: recordId, in_title: "Quotation for Hup Seng Trading" });
  const { data: rowsPerson } = await admin
    .from("record_changes")
    .select("changed_by, via_ai, field, now_is")
    .eq("entity_id", recordId).eq("field", "title")
    .order("created_at", { ascending: false }).limit(1);
  check("记到了这一笔改动", rowsPerson?.[0]?.now_is === "Quotation for Hup Seng Trading",
    JSON.stringify(rowsPerson));
  check("🔴 via_ai 是假的", rowsPerson?.[0]?.via_ai === false, JSON.stringify(rowsPerson));
  check("changed_by 是他自己", rowsPerson?.[0]?.changed_by === boss.id, JSON.stringify(rowsPerson));

  console.log("\n② 🔴 他叫助手改——带那个头，via_ai 是真的，而身分一模一样");
  await say(asAssistant, "update_pipeline_record", { in_id: recordId, in_amount_cents: 520000 });
  const { data: rowsAssistant } = await admin
    .from("record_changes")
    .select("changed_by, via_ai, field, now_is")
    .eq("entity_id", recordId).eq("field", "amount_cents")
    .order("created_at", { ascending: false }).limit(1);
  check("记到了这一笔改动", rowsAssistant?.[0]?.now_is === "520000", JSON.stringify(rowsAssistant));
  check("🔴 via_ai 是真的", rowsAssistant?.[0]?.via_ai === true, JSON.stringify(rowsAssistant));
  check("🔴 changed_by 还是同一个人（同一个身分，只是多一个记号）",
    rowsAssistant?.[0]?.changed_by === boss.id, JSON.stringify(rowsAssistant));

  console.log("\n③ 🔴 同一个人接着又自己改——头没了，立刻变回假的");
  await say(C, "update_pipeline_record", { in_id: recordId, in_stage: "build" });
  const { data: rowsBack } = await admin
    .from("record_changes")
    .select("via_ai, field, now_is")
    .eq("entity_id", recordId).eq("field", "stage")
    .order("created_at", { ascending: false }).limit(1);
  check("这一笔 via_ai 又是假的——不是记在人身上，是记在这一次请求上",
    rowsBack?.[0]?.via_ai === false, JSON.stringify(rowsBack));

  console.log("\n④ 删掉那一笔——DELETE 那条分支也带得到这个记号");
  const record2 = await say(asAssistant, "add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "Throwaway quote", in_party: "Nobody", in_amount_cents: 100,
  });
  const record2Id = typeof record2 === "object" ? record2.id : record2;
  await say(asAssistant, "set_pipeline_archived", { in_id: record2Id, in_archived: true });
  await asAssistant.from("pipeline_records").delete().eq("id", record2Id);
  const { data: rowsDeleted } = await admin
    .from("record_changes")
    .select("via_ai, field")
    .eq("entity_id", record2Id).eq("field", "deleted")
    .order("created_at", { ascending: false }).limit(1);
  check("🔴 删除那一行也记了 via_ai 是真的（同一支触发器，两条分支都要接住）",
    rowsDeleted?.[0]?.via_ai === true, JSON.stringify(rowsDeleted));
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  const stuck = await dropThrowaways(admin, people);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
