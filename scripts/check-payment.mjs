/**
 * 客人付了钱，帐上自己多一行 —— 用真的身分打每一支。
 *
 * ── 为什么这一支非有不可 ──────────────────────────────────────────────────
 *
 * `supabase db push` 成功证明不了任何事：plpgsql 到**执行**才解析名字，
 * 而这一条线上每一段的失败都长得像成功。
 *
 * 这里量的是七件，而其中三件是这条线特有的、别的地方没有守：
 *
 *   ① 回呼来了，帐上真的多一行 —— 而且**没有人打过字**
 *   ② 🔴 **回呼来两次，只多一行**（每一家闸道都会重送）
 *   ③ 🔴 **浏览器打不到那一支** —— 打得到 = 任何人都可以宣称自己付过钱
 *   ④ 🔴 **core 一个人都打不到** —— 打得到 = 往任何一家的帐上写钱
 *   ⑤ 真的到帐多少就记多少，不是我们要求的那个数字
 *   ⑥ 师傅看不到付款要求（那上面写着金额跟客户）
 *   ⑦ 别人家看不到
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

const failed = [];
const check = (name, ok, detail = "") => {
  if (ok) console.log(`  PASS  ${name}`);
  else {
    failed.push(name);
    console.log(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
};

const made = [];

async function person(tag) {
  const cred = {
    email: `pay-${tag}-${Date.now()}@formae.test`,
    password: `Pay-${Date.now()}-x!`,
  };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email,
    password: cred.password,
    email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);

  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: sErr } = await as.auth.signInWithPassword(cred);
  if (sErr) throw new Error(`sign-in(${tag}): ${sErr.message}`);

  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", user.user.id)
    .single();
  return { as, cred, userId: user.user.id, projectId: proj?.id };
}

try {
  const owner = await person("owner");
  const other = await person("other");
  const P = owner.projectId;
  const c = owner.as;
  if (!P) throw new Error("找不到老板的专案");

  /* 一张真的报价单，让付款要求有东西可以指。 */
  const { data: job, error: jobErr } = await c.rpc("add_pipeline_record", {
    in_project_id: P,
    in_module_key: "quotations",
    in_title: "厨房翻新",
    in_party: "陈先生",
    in_amount_cents: 4_850_000,
  });
  check("开得起一张单", !jobErr && !!job?.id, jobErr?.message);

  /* ── ① 他开一张付款要求 ─────────────────────────────────────────── */
  console.log("\n① 开一张付款要求");
  const REF = `chip-${Date.now()}`;
  const { data: req, error: reqErr } = await c.rpc("open_payment_request", {
    in_project_id: P,
    in_amount_cents: 300_000,
    in_provider: "chip",
    in_provider_ref: REF,
    in_record_id: job.id,
    in_payer: "陈先生",
  });
  check("开得起来", !reqErr && !!req?.id, reqErr?.message);
  check("开出来是「还没付」", req?.status === "open", req?.status);

  /* 还没付，帐上不可以有任何东西。 */
  const { data: before } = await c
    .from("ledger_entries")
    .select("id")
    .eq("project_id", P)
    .eq("reference", REF);
  check("还没付的时候，帐上一行都没有", (before ?? []).length === 0, `${before?.length} 行`);

  /* 同一个闸道编号再开一次 = 同一张，不是第二张。 */
  const { data: again } = await c.rpc("open_payment_request", {
    in_project_id: P,
    in_amount_cents: 300_000,
    in_provider: "chip",
    in_provider_ref: REF,
    in_record_id: job.id,
  });
  check("同一个编号开两次是同一张", again?.id === req.id, `${again?.id} vs ${req.id}`);

  /* 别人家的单挂不上来。 */
  const { data: theirJob } = await other.as.rpc("add_pipeline_record", {
    in_project_id: other.projectId,
    in_module_key: "quotations",
    in_title: "别人的单",
    in_amount_cents: 100_000,
  });
  const { error: crossErr } = await c.rpc("open_payment_request", {
    in_project_id: P,
    in_amount_cents: 100_00,
    in_provider: "chip",
    in_provider_ref: `cross-${Date.now()}`,
    in_record_id: theirJob?.id,
  });
  check("别人家的单挂不上来", !!crossErr, crossErr?.message ?? "居然让它过了");

  /* ── ② 闸道说付了 —— 帐上自己多一行 ─────────────────────────────── */
  console.log("\n② 回呼来了");
  const { data: settled, error: setErr } = await admin.rpc("settle_payment_request", {
    in_provider: "chip",
    in_provider_ref: REF,
    in_paid_cents: 300_000,
    in_method: "card",
    in_payer: "陈先生",
  });
  check("结得掉", !setErr && settled?.status === "paid", setErr?.message ?? settled?.status);

  const { data: rows } = await c
    .from("ledger_entries")
    .select("id, doc_no, amount_cents, method, reference, recorded_by, against_id, allocated_cents")
    .eq("project_id", P)
    .eq("reference", REF);
  const row = (rows ?? [])[0];
  check("🔴 帐上自己多了一行", (rows ?? []).length === 1, `${rows?.length} 行`);
  check("金额对", Number(row?.amount_cents) === 300_000, `${row?.amount_cents}`);
  check("有自己的单号", !!row?.doc_no, `${row?.doc_no}`);
  check("记得住是刷卡进来的", row?.method === "card", `${row?.method}`);
  check("记得住闸道的编号", row?.reference === REF, `${row?.reference}`);
  /* 🔴 没有人打过这一笔 —— 填一个老板的 id 进去会让那本「谁改的」帐说谎。 */
  check("🔴 没有人打过这一笔（记的人是空的）", row?.recorded_by === null, `${row?.recorded_by}`);
  check("自动挂上那张单", row?.against_id === job.id, `${row?.against_id}`);
  check("而且自动分摊了", Number(row?.allocated_cents) === 300_000, `${row?.allocated_cents}`);
  check("付款要求指得回那一行", settled?.entry_id === row?.id, `${settled?.entry_id}`);

  /* ── ③ 重送 ──────────────────────────────────────────────────────── */
  console.log("\n③ 闸道重送同一个回呼");
  const { data: twice, error: twiceErr } = await admin.rpc("settle_payment_request", {
    in_provider: "chip",
    in_provider_ref: REF,
    in_paid_cents: 300_000,
    in_method: "card",
  });
  check("重送不报错（报错闸道会一直重送）", !twiceErr, twiceErr?.message);
  const { data: after } = await c
    .from("ledger_entries")
    .select("id")
    .eq("project_id", P)
    .eq("reference", REF);
  check("🔴 重送之后还是只有一行", (after ?? []).length === 1, `${after?.length} 行`);
  check("而且回的是同一张", twice?.entry_id === row?.id, `${twice?.entry_id}`);

  /* ── ④ 收到的跟要求的不一样 ─────────────────────────────────────── */
  console.log("\n④ 他只付了一半");
  const HALF = `chip-half-${Date.now()}`;
  await c.rpc("open_payment_request", {
    in_project_id: P,
    in_amount_cents: 200_000,
    in_provider: "chip",
    in_provider_ref: HALF,
    in_record_id: job.id,
  });
  const { data: part } = await admin.rpc("settle_payment_request", {
    in_provider: "chip",
    in_provider_ref: HALF,
    in_paid_cents: 120_000,
  });
  const { data: partRow } = await c
    .from("ledger_entries")
    .select("amount_cents")
    .eq("project_id", P)
    .eq("reference", HALF)
    .single();
  check("🔴 记的是真的到帐的那个数字", Number(partRow?.amount_cents) === 120_000,
    `要求 200000，到帐 120000，记了 ${partRow?.amount_cents}`);
  check("而且那张要求自己记得两个数字都", Number(part?.amount_cents) === 200_000 &&
    Number(part?.paid_cents) === 120_000, `${part?.amount_cents} / ${part?.paid_cents}`);

  /* 付了 0 = 失败，不是一笔 0 元的收款。 */
  const ZERO = `chip-zero-${Date.now()}`;
  await c.rpc("open_payment_request", {
    in_project_id: P, in_amount_cents: 50_000,
    in_provider: "chip", in_provider_ref: ZERO,
  });
  const { data: zero } = await admin.rpc("settle_payment_request", {
    in_provider: "chip", in_provider_ref: ZERO, in_paid_cents: 0,
  });
  check("付了零块是失败，不是一笔零元的收款", zero?.status === "failed", zero?.status);
  const { data: zeroRows } = await c
    .from("ledger_entries").select("id").eq("project_id", P).eq("reference", ZERO);
  check("而且帐上什么都没有", (zeroRows ?? []).length === 0, `${zeroRows?.length} 行`);

  /* ── ⑤ 门锁着吗 ─────────────────────────────────────────────────── */
  console.log("\n⑤ 两道门");
  /* 🔴 一个登入的人打得到 settle = 任何人都可以宣称自己付过钱。 */
  const OPEN = `chip-open-${Date.now()}`;
  await c.rpc("open_payment_request", {
    in_project_id: P, in_amount_cents: 90_000,
    in_provider: "chip", in_provider_ref: OPEN,
  });
  const { error: byUser } = await c.rpc("settle_payment_request", {
    in_provider: "chip", in_provider_ref: OPEN, in_paid_cents: 90_000,
  });
  check("🔴 登入的人自己结不了帐", !!byUser, byUser?.message ?? "居然让它过了");
  const { data: stillOpen } = await c
    .from("payment_requests").select("status").eq("provider_ref", OPEN).single();
  check("而且那一张还是「还没付」", stillOpen?.status === "open", stillOpen?.status);

  /* 🔴 core 一个人都不给。 */
  const { error: coreErr } = await c.rpc("add_ledger_entry_core", {
    in_actor: null, in_project_id: P, in_module_key: "payments",
    in_direction: "in", in_amount_cents: 999_999,
  });
  check("🔴 那份共用的写入逻辑，登入的人也打不到", !!coreErr, coreErr?.message ?? "居然让它过了");

  /* ── ⑥ 谁看得到 ─────────────────────────────────────────────────── */
  console.log("\n⑥ 谁看得到那张付款要求");
  const { data: ownerSees } = await c
    .from("payment_requests").select("id").eq("project_id", P);
  check("老板看得到（控制组）", (ownerSees ?? []).length >= 4, `${ownerSees?.length} 张`);

  const staff = await person("staff");
  const { error: memberErr } = await c.rpc("add_project_member", {
    in_email: staff.cred.email,
    in_role: "staff",
  });
  if (memberErr) check("加得进一个师傅", false, memberErr.message);
  else {
    check("加得进一个师傅", true);
    /* 重新登入一次，让他的 workspace 解析到老板那一家。 */
    const { data: staffSees } = await staff.as
      .from("payment_requests").select("id").eq("project_id", P);
    check("🔴 师傅看不到（那上面写着金额跟客户）", (staffSees ?? []).length === 0,
      `${staffSees?.length} 张`);
  }

  const { data: otherSees } = await other.as
    .from("payment_requests").select("id").eq("project_id", P);
  check("别人家看不到", (otherSees ?? []).length === 0, `${otherSees?.length} 张`);
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(
    stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了",
  );
}

console.log(`\n判：${failed.length === 0 ? "全过" : `${failed.length} 条没过`}`);
process.exit(failed.length ? 1 : 0);
