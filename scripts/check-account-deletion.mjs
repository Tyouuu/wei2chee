/**
 * 帐号真的删得掉了——真登入打一次每一支（[重点 26]）。
 *
 * 🔴 这一支最要紧的三条：
 *   · 有真的资料（走单·名册·收款·预约·打卡）也删得掉，不是只有空壳
 *   · 审计触发器不再挡这件事——层叠删除的时候它自己的写入会跳过，不抛例外
 *   · 44 个 `_by` 审计栏位不再拿 auth.users 当外键，值还是照样填得进去
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

const say = async (client, fn, args) => {
  const { data, error } = await client.rpc(fn, args);
  if (error) throw new Error(`${fn}: ${error.message}`);
  return data;
};

try {
  console.log("\n① 一个空壳帐号——本来就删得掉");
  {
    const email = `del-empty-${stamp}@formae.test`;
    const password = `Del-${stamp}-x!`;
    const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    const { error } = await admin.auth.admin.deleteUser(u.user.id);
    check("空壳帐号删得掉", !error, error?.message);
  }

  console.log("\n② 🔴 只有一个客户——这是最早发现挡住的最小重现");
  {
    const email = `del-min-${stamp}@formae.test`;
    const password = `Del-${stamp}-x!`;
    const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    await client.auth.signInWithPassword({ email, password });
    const { data: proj } = await admin.from("projects").select("id").eq("account_id", u.user.id).single();
    await say(client, "add_project_page", { requested_key: "customers", new_title: "customers" });
    await say(client, "add_directory_entry", { in_project_id: proj.id, in_module_key: "customers", in_name: "X" });
    const { error } = await admin.auth.admin.deleteUser(u.user.id);
    check("🔴 有一个客户的帐号也删得掉", !error, error?.message);
  }

  console.log("\n③ 🔴 五张审计相关表都有真的资料——全部一起删");
  {
    const email = `del-full-${stamp}@formae.test`;
    const password = `Del-${stamp}-x!`;
    const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    await client.auth.signInWithPassword({ email, password });
    const { data: proj } = await admin.from("projects").select("id").eq("account_id", u.user.id).single();
    for (const k of ["quotations", "customers", "payments", "bookings", "staff"]) {
      await say(client, "add_project_page", { requested_key: k, new_title: k });
    }
    const her = await say(client, "add_directory_entry", {
      in_project_id: proj.id, in_module_key: "customers", in_name: "Mrs Tan",
    });
    const amy = await say(client, "add_directory_entry", {
      in_project_id: proj.id, in_module_key: "staff", in_name: "Amy",
    });
    const rec = await say(client, "add_pipeline_record", {
      in_project_id: proj.id, in_module_key: "quotations",
      in_title: "Q", in_party: "Mrs Tan", in_party_id: her.id, in_amount_cents: 1000,
    });
    await say(client, "update_pipeline_record", { in_id: rec.id, in_title: "Q2" });
    await say(client, "add_ledger_entry", {
      in_project_id: proj.id, in_module_key: "payments",
      in_direction: "in", in_amount_cents: 500, in_party: "Mrs Tan", in_party_id: her.id,
    });
    const appt = await say(client, "add_appointment", {
      in_project_id: proj.id, in_module_key: "bookings",
      in_starts_at: new Date(Date.now() + 864e5).toISOString(),
      in_ends_at: new Date(Date.now() + 864e5 + 3600e3).toISOString(),
      in_party: "Mrs Tan", in_party_id: her.id, in_service: "Cut", in_staff_id: amy.id,
    });
    await say(client, "set_appointment_status", { in_id: appt, in_status: "cancelled" });
    const line = await say(client, "add_visit_line", {
      in_appointment_id: appt, in_service: "Cut", in_staff_id: amy.id, in_price_cents: 5000,
    });
    await say(client, "set_visit_tip", { in_line_id: line.id, in_tip_cents: 500 });
    await say(client, "clock_in", { in_staff_id: amy.id });

    const { count: changesBefore } = await admin
      .from("record_changes").select("id", { count: "exact", head: true }).eq("project_id", proj.id);
    check("🔴 真的留下了审计历史（改了单跟取消了预约）", changesBefore >= 2, String(changesBefore));

    const { error } = await admin.auth.admin.deleteUser(u.user.id);
    check("🔴 有走单·名册·收款·预约·打卡五张表资料的帐号，一起删得掉", !error, error?.message);
  }

  console.log("\n④ 🔴 直接删专案那一行——同一条层叠路径，跟删帐号一样的考验");
  {
    const email = `del-cascade-${stamp}@formae.test`;
    const password = `Del-${stamp}-x!`;
    const { data: u } = await admin.auth.admin.createUser({ email, password, email_confirm: true });
    const client = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
      auth: { persistSession: false },
    });
    await client.auth.signInWithPassword({ email, password });
    const { data: proj } = await admin.from("projects").select("id").eq("account_id", u.user.id).single();
    await say(client, "add_project_page", { requested_key: "customers", new_title: "customers" });
    await say(client, "add_directory_entry", { in_project_id: proj.id, in_module_key: "customers", in_name: "Y" });
    const { error: acctErr } = await admin.from("accounts").delete().eq("id", u.user.id).select();
    check("🔴 直接删 accounts 那一行也不再撞审计触发器",
      !acctErr || !acctErr.message?.includes("record_changes"), acctErr?.message);
    await admin.auth.admin.deleteUser(u.user.id).catch(() => {});
  }
} catch (e) {
  bad.push(`半路炸了：${e.message}`);
  console.log(`  FAIL  半路炸了 — ${e.message}`);
} finally {
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}`);
  process.exit(bad.length ? 1 : 0);
}
