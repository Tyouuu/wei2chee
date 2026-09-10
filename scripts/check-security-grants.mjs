/**
 * 老板问「安全指数到底掌握了没有」那一晚，逐支扫过全部 353 支
 * security definer 函式现在真的对谁开放（问 pg_proc.proacl，
 * 不是读迁移档案历史），抓到 Postgres 一条从来没有人明写过的默认
 * 行为：**建函式那一刻，EXECUTE 会自动送给 `public` 这个伪角色**
 * （每一个角色都算数，含 `anon`），除非当时手动 `revoke ... from public`。
 *
 * 🔴 验证过一次是真的能打穿：`sync_payslip_totals(in_payslip_id uuid)`
 * 撤销了 authenticated/anon 的明确授权之后，真登入照样呼叫成功——
 * 因为它从来没有明写过 `revoke ... from public`。任何一个 Formae
 * 的客户，哪怕刚免费注册，都能对猜到的 payslip id 直接改另一家生意
 * 的薪资单数字（20260911610000 / 20260911640000 已经补上）。
 *
 * ⚠️ `alter default privileges ... revoke execute on functions from
 * public` 试过一次，验证过没有真的生效（20260911710000 记录了整个
 * 排查过程）——所以这一支不是靠一条资料库设定默默挡住以后的新函式，
 * 是靠这把尺，**每一次 `npm run check` 都真的问一次现在的状态**。
 *
 * 触发器函式（`RETURNS trigger`）天生挡得住直接呼叫——Postgres 拒绝
 * 把它当一般函式呼叫，跟授权状态无关，所以不算。
 *
 * `ON_PURPOSE` 是**故意**开放给 anon/所有人的公开端点——客人不用
 * 登入、靠一个猜不到的 `ref`/`slug` 进来的那一类，本来就该对 public
 * 开放，不是这一把尺要挡的那一种。跟 check-closable.mjs 的例外清单
 * 同一个做法：一条规矩,例外要写下来、写清楚理由,不然下一个人会把
 * 一条故意的设计当成红灯改掉。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

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

/* 陌生人本来就该打得到的那一类——一个能猜到的 slug 或者一把只有
   收件人才有的 ref，不是身分。逐一核对过 ACL：这九支的 `anon=` 都是
   明写的直接授权，不是靠这次要堵住的那条隐藏默认值活着。 */
const ON_PURPOSE = new Set([
  "submit_site_booking",
  "submit_site_enquiry",
  "sign_consent",
  "sign_delivery",
  "cancel_shared_appointment",
  "answer_shared_record",
  "submit_appointment_review",
  "submit_party_request",
  "get_public_site",
]);

const stamp = Date.now();
const bad = [];
const people = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

try {
  const email = `secgrant-${stamp}@formae.test`;
  const password = `Sg-${stamp}-x!`;
  const { data: u, error: uerr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (uerr) throw new Error(`createUser: ${uerr.message}`);
  people.push(u.user.id);
  await admin.from("accounts").update({ role: "founder" }).eq("id", u.user.id);

  const founder = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: e2 } = await founder.auth.signInWithPassword({ email, password });
  if (e2) throw new Error(`signIn: ${e2.message}`);

  /* 🔴 控制组：不是老板打不到这一支。 */
  const otherEmail = `secgrant-other-${stamp}@formae.test`;
  const otherPassword = `Sg2-${stamp}-x!`;
  const { data: other, error: oerr } = await admin.auth.admin.createUser({
    email: otherEmail, password: otherPassword, email_confirm: true,
  });
  if (oerr) throw new Error(`createUser(other): ${oerr.message}`);
  people.push(other.user.id);
  const stranger = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  await stranger.auth.signInWithPassword({ email: otherEmail, password: otherPassword });
  const { error: strangerErr } = await stranger.rpc("security_grant_audit");
  check("🔴 不是老板打不到这一支", !!strangerErr, "居然让它过了");

  const { data, error } = await founder.rpc("security_grant_audit");
  if (error) throw new Error(`security_grant_audit: ${error.message}`);
  check("道具：读得到全部函式的授权状态", Array.isArray(data) && data.length > 100,
    `只读到 ${data?.length} 支`);

  const leaked = data.filter(
    (r) => !r.is_trigger && r.public_can_execute && !ON_PURPOSE.has(r.fn_name),
  );
  check(
    "🔴 没有一支不该开放的函式还留着 public 的执行权",
    leaked.length === 0,
    JSON.stringify(leaked.map((r) => `${r.fn_name}(${r.fn_args})`)),
  );

  /* 🔴 这一晚真的抓到的那四支，钉死成回归测试——就算上面那条整体
     扫描哪天被改坏，这四支自己也要单独红一次。 */
  for (const [fn, args] of [
    ["next_doc_no", { in_project_id: "00000000-0000-0000-0000-000000000000", in_module_key: "quotations" }],
    ["ledger_allocations_sync_one", { in_entry_id: "00000000-0000-0000-0000-000000000000" }],
    ["recompute_payslip_statutory", { in_payslip_id: "00000000-0000-0000-0000-000000000000" }],
    ["sync_payslip_totals", { in_payslip_id: "00000000-0000-0000-0000-000000000000" }],
  ]) {
    const { error: fErr } = await stranger.rpc(fn, args);
    check(`🔴 陌生人打不到 ${fn}`, !!fErr && /permission denied/i.test(fErr.message),
      fErr?.message ?? "居然成功了");
  }

  console.log(
    bad.length ? `\n判：${bad.length} 条没过\n  ${bad.join("\n  ")}` : "\n判：全部过",
  );
} catch (err) {
  console.error(`\n🔴 尺子自己炸了：${err?.message ?? err}`);
  bad.push("尺子炸了");
} finally {
  for (const id of people) {
    const { error } = await admin.auth.admin.deleteUser(id);
    if (error) console.log(`  ⚠️ 删不掉 ${id}：${error.message}`);
  }
  process.exit(bad.length ? 1 : 0);
}
