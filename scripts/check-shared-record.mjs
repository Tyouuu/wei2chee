/**
 * 客人自己打开那一张单 —— **用真的路人打**（没有登入的那一把钥匙）。
 *
 * ── 为什么一定要用 anon ──────────────────────────────────────────────────
 *
 * 这条线的呼叫者不是一个客户，是一个**拿着一条 WhatsApp 连结的屋主**。
 * 拿老板的登入去测它，测到的是一条根本不存在的路。
 *
 * ⚠️ 而这一支同时在守一件比功能更重要的事：**那一页漏不漏东西**。
 * 一张公开的报价单如果带着 project id、带着逐项的内部注解、
 * 带着这个客人的其他单，那不是一个 bug，那是把别人的生意摊出去。
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
/** 🔴 一个真的路人：anon key，没有登入过。 */
const stranger = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
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
const day = (n) => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

async function shop(tag) {
  const cred = { email: `shr-${tag}-${Date.now()}@formae.test`, password: `Shr-${Date.now()}-x!` };
  const { data: user, error } = await admin.auth.admin.createUser({
    email: cred.email, password: cred.password, email_confirm: true,
  });
  if (error) throw new Error(`createUser(${tag}): ${error.message}`);
  made.push(user.user.id);

  const as = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
  const { error: sErr } = await as.auth.signInWithPassword(cred);
  if (sErr) throw new Error(`sign-in(${tag}): ${sErr.message}`);
  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", user.user.id).single();
  await as.rpc("set_project_style", { new_style: "hearth" });
  for (const k of ["quotations", "projects", "tasks", "customers"]) {
    await as.rpc("add_project_page", { requested_key: k, new_title: k });
  }
  /* 公司名要是真的 —— 那一页上最大的那行字就是它，
     而它是**这一支存在的一半理由**：客人看到的是他的招牌，不是我们的。 */
  await admin.from("projects")
    .update({ business_name: `Hup Seng Reno ${tag}` }).eq("id", proj.id);
  return { as, projectId: proj.id };
}

try {
  const A = await shop("a");
  const c = A.as;
  const P = A.projectId;

  const { data: cust } = await c.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Mr Tan",
  });
  const { data: addrRows } = await c.rpc("set_directory_addresses", {
    in_party_id: cust.id,
    in_rows: [{ label: "Site", line: "Lot 42, Jalan Kebun", region: "Klang" }],
  });

  /* 一张真的报价单：三十天有效、两行逐项、三期分期。 */
  const { data: quote } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "Taman Desa 3-room reno", in_party: "Mr Tan", in_party_id: cust.id,
    in_amount_cents: 4850000, in_due_on: day(30),
    in_site_address_id: (addrRows ?? [])[0]?.id ?? null,
  });
  await c.rpc("set_record_lines", {
    in_record_id: quote.id,
    in_lines: [
      { description: "Strip out old kitchen", qty: "1", unit: "job",
        unit_price_cents: "1200000", note: "🔴 我们自己的成本大概 8000" },
      { description: "Cement 50kg", qty: "200", unit: "bags",
        unit_price_cents: "1850", note: "" },
    ],
  });
  await c.rpc("set_record_terms", {
    in_record_id: quote.id,
    in_terms: [
      { description: "Deposit", portion: "30" },
      { description: "On start", portion: "40" },
      { description: "On completion", portion: "30" },
    ],
  });

  /* ── ① 还没分享，那张单打不开 ─────────────────────────────────────── */
  console.log("\n① 还没分享");
  const { data: blind } = await stranger.rpc("public_shared_record", { in_ref: quote.id });
  check("🔴 拿那一行自己的 id 当门牌，打不开",
    (blind ?? []).length === 0, `${blind?.length}`);

  /* ── ② 开一条连结 ───────────────────────────────────────────────────── */
  console.log("\n② 开一条连结");
  const { data: shared, error: shErr } = await c.rpc("share_record", { in_record_id: quote.id });
  check("开得了", !shErr && !!shared?.share_ref, shErr?.message);
  check("门牌不是那一行的 id", shared?.share_ref !== quote.id,
    `${shared?.share_ref}`);
  const ref = shared?.share_ref;

  const { data: again } = await c.rpc("share_record", { in_record_id: quote.id });
  check("🔴 再按一次是同一条网址（不然他昨天发出去那条会静静死掉）",
    again?.share_ref === ref, `${again?.share_ref}`);

  /* ── ③ 路人打开它 ───────────────────────────────────────────────────── */
  console.log("\n③ 路人打开它");
  const { data: seenRows, error: seeErr } = await stranger.rpc("public_shared_record", { in_ref: ref });
  const seen = (seenRows ?? [])[0];
  check("打得开", !seeErr && !!seen, seeErr?.message ?? `${seenRows?.length}`);
  check("🔴 上面是他的招牌，不是我们的",
    seen?.business_name?.startsWith("Hup Seng Reno"), `${seen?.business_name}`);
  check("带着他自己选的那套样子（那一页穿他的漆）",
    !!seen?.style, `${seen?.style}`);
  check("单号 · 抬头 · 总额都在",
    !!seen?.doc_no && seen?.title === "Taman Desa 3-room reno" &&
    /* ⚠️ 这一条我第一版写错了，红的是我的期望不是产品（第六次）。
       我摆 48,500，而 `set_record_lines` 把**逐项的合计写回那一行** ——
       12,000 ＋ 200×18.50 = 15,700。**那正是对的**：
       一张纸上的总额如果跟逐项加起来不一样，那张纸自己在打架。 */
    Number(seen?.amount_cents) === 1570000,
    `${seen?.doc_no} · ${seen?.title} · ${seen?.amount_cents}`);
  check("逐项两行", (seen?.lines ?? []).length === 2,
    JSON.stringify((seen?.lines ?? []).map((l) => l.description)));
  check("分期三期", (seen?.terms ?? []).length === 3,
    JSON.stringify((seen?.terms ?? []).map((t) => t.description)));
  check("工地地址在（那是他自己的地址，印在纸上本来就有）",
    (seen?.site_address ?? "").includes("Lot 42"), `${seen?.site_address}`);
  check("还没过期", seen?.is_expired === false, `${seen?.is_expired}`);
  check("答得了", seen?.can_answer === true, `${seen?.can_answer}`);

  /* 🔴 漏不漏东西 —— 这一段比上面全部加起来重要。 */
  console.log("\n③b 🔴 漏不漏");
  const flat = JSON.stringify(seen);
  check("🔴 逐项的内部注解没有出去",
    !flat.includes("我们自己的成本"), "那句注解跑到公开页上了");
  check("🔴 一个 id 都没有出去（project · record · party · address）",
    !flat.includes(P) && !flat.includes(quote.id) &&
    !flat.includes(cust.id) && !((addrRows ?? [])[0]?.id && flat.includes((addrRows ?? [])[0].id)),
    "有 id 漏在里面");
  const keys = Object.keys(seen ?? {});
  check("回的栏位是名单上那几个，没有多",
    !keys.some((k) => /_id$/.test(k)), JSON.stringify(keys.filter((k) => /_id$/.test(k))));

  /* 这个客人的**另一张**单，路人不该因为拿到第一条连结就看得到。 */
  const { data: other } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "Second bathroom", in_party: "Mr Tan", in_party_id: cust.id,
    in_amount_cents: 990000,
  });
  const { data: seen2 } = await stranger.rpc("public_shared_record", { in_ref: ref });
  check("🔴 一条连结只开一张单，看不到他的另一张",
    !JSON.stringify(seen2?.[0]).includes("Second bathroom"), "另一张单漏出去了");

  /* ── ④ 按同意 ───────────────────────────────────────────────────────── */
  console.log("\n④ 按同意");
  const { data: wrong } = await stranger.rpc("answer_shared_record", {
    in_ref: ref, in_answer: "maybe", in_name: "Mr Tan",
  });
  check("乱送一个答案会被挡", wrong === "bad_answer", `${wrong}`);
  const { data: noName } = await stranger.rpc("answer_shared_record", {
    in_ref: ref, in_answer: "accepted", in_name: "   ",
  });
  check("没写名字会被挡", noName === "incomplete", `${noName}`);

  const { data: askedFirst } = await stranger.rpc("answer_shared_record", {
    in_ref: ref, in_answer: "changes", in_name: "Mr Tan",
    in_note: "Can the cement be a cheaper brand?",
  });
  check("「我要改一点」送得出去", askedFirst === "ok", `${askedFirst}`);

  const { data: afterAsk } = await stranger.rpc("public_shared_record", { in_ref: ref });
  check("那句话写在那张单上了",
    afterAsk?.[0]?.answer === "changes" &&
    (afterAsk?.[0]?.answer_note ?? "").includes("cheaper brand"),
    `${afterAsk?.[0]?.answer} · ${afterAsk?.[0]?.answer_note}`);

  const { data: accepted } = await stranger.rpc("answer_shared_record", {
    in_ref: ref, in_answer: "accepted", in_name: "Tan Ah Seng",
  });
  check("🔴 他改好了，客人回来按同意 —— 换得掉（问一句不是承诺）",
    accepted === "ok", `${accepted}`);

  const { data: twice } = await stranger.rpc("answer_shared_record", {
    in_ref: ref, in_answer: "changes", in_name: "Someone else",
  });
  check("🔴 同意过了就换不掉（答应是一个承诺）", twice === "answered", `${twice}`);

  const { data: afterYes } = await stranger.rpc("public_shared_record", { in_ref: ref });
  check("那一页上写着谁同意的", afterYes?.[0]?.answered_name === "Tan Ah Seng",
    `${afterYes?.[0]?.answered_name}`);
  check("同意过之后那颗按钮不再给按", afterYes?.[0]?.can_answer === false,
    `${afterYes?.[0]?.can_answer}`);

  /* 🔴 stage 一动都不动 —— 那是他自己流程里的那一格。 */
  const { data: stageNow } = await admin
    .from("pipeline_records").select("stage").eq("id", quote.id).single();
  const { data: stageWas } = await admin
    .from("record_changes").select("id").eq("entity_id", quote.id).eq("field", "stage");
  check("🔴 客人按了同意，他的流程一格都没有被搬动",
    (stageWas ?? []).length === 0, `stage=${stageNow?.stage} · 搬过 ${stageWas?.length} 次`);

  /* ── ⑤ 过期 ─────────────────────────────────────────────────────────── */
  console.log("\n⑤ 过期");
  const { data: old } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "quotations",
    in_title: "Last month's price", in_party: "Mr Tan", in_party_id: cust.id,
    in_amount_cents: 300000, in_due_on: day(-3),
  });
  const { data: oldShared } = await c.rpc("share_record", { in_record_id: old.id });
  const oldRef = oldShared?.share_ref;
  const { data: oldSeen } = await stranger.rpc("public_shared_record", { in_ref: oldRef });
  check("打得开，而且写着过期了", oldSeen?.[0]?.is_expired === true, `${oldSeen?.[0]?.is_expired}`);
  check("那颗同意不给按", oldSeen?.[0]?.can_answer === false, `${oldSeen?.[0]?.can_answer}`);
  const { data: lateYes } = await stranger.rpc("answer_shared_record", {
    in_ref: oldRef, in_answer: "accepted", in_name: "Mr Tan",
  });
  check("🔴 过期的价钱按不了同意（那张纸上印的字就是这个意思）",
    lateYes === "expired", `${lateYes}`);
  const { data: lateAsk } = await stranger.rpc("answer_shared_record", {
    in_ref: oldRef, in_answer: "changes", in_name: "Mr Tan",
    in_note: "Still available at this price?",
  });
  check("🔴 但「我要改一点」照旧准 —— 想问一句的人不该没有地方讲",
    lateAsk === "ok", `${lateAsk}`);

  /* ── ⑥ 哪几种单不给分享 ─────────────────────────────────────────────── */
  console.log("\n⑥ 哪几种单不给分享");
  const { data: task } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "tasks",
    in_title: "Chase the supplier about the late delivery", in_party: "",
  });
  const { error: taskErr } = await c.rpc("share_record", { in_record_id: task.id });
  check("🔴 内部的任务分享不了", !!taskErr, "居然分享得了");

  const { data: job } = await c.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "projects",
    in_title: "Taman Desa build", in_party: "Mr Tan", in_party_id: cust.id,
  });
  const { data: jobShared, error: jobErr } = await c.rpc("share_record", { in_record_id: job.id });
  check("工程分享得了（那是给他看进度的）", !jobErr && !!jobShared?.share_ref, jobErr?.message);
  const { data: jobSeen } = await stranger.rpc("public_shared_record", {
    in_ref: jobShared?.share_ref,
  });
  check("🔴 但一张在做的工程没有「同意」这个动作",
    jobSeen?.[0]?.can_answer === false, `${jobSeen?.[0]?.can_answer}`);
  const { data: jobAns } = await stranger.rpc("answer_shared_record", {
    in_ref: jobShared?.share_ref, in_answer: "accepted", in_name: "Mr Tan",
  });
  check("按下去也不算数", jobAns === "not_found", `${jobAns}`);

  /* ── ⑦ 收回 ─────────────────────────────────────────────────────────── */
  console.log("\n⑦ 收回那条连结");
  const { error: unErr } = await c.rpc("unshare_record", { in_record_id: quote.id });
  check("收得回", !unErr, unErr?.message);
  const { data: dead } = await stranger.rpc("public_shared_record", { in_ref: ref });
  check("🔴 那条网址当场打不开", (dead ?? []).length === 0, `${dead?.length}`);
  const { data: reShared } = await c.rpc("share_record", { in_record_id: quote.id });
  check("🔴 再开是一条新的网址（收回就是真的收回）",
    reShared?.share_ref && reShared.share_ref !== ref, `${reShared?.share_ref}`);
  const { data: keptAnswer } = await stranger.rpc("public_shared_record", {
    in_ref: reShared?.share_ref,
  });
  check("他答过的那一句留着（那是发生过的事，不是一个设定）",
    keptAnswer?.[0]?.answered_name === "Tan Ah Seng", `${keptAnswer?.[0]?.answered_name}`);

  /* 收起来的单，连结跟着死。 */
  await c.rpc("set_pipeline_archived", { in_id: quote.id, in_archived: true });
  const { data: putAway } = await stranger.rpc("public_shared_record", {
    in_ref: reShared?.share_ref,
  });
  check("单收起来了，连结也打不开", (putAway ?? []).length === 0, `${putAway?.length}`);
  await c.rpc("set_pipeline_archived", { in_id: quote.id, in_archived: false });

  /* ── ⑧ 别人家 ───────────────────────────────────────────────────────── */
  console.log("\n⑧ 别人家");
  const B = await shop("b");
  const { error: theirErr } = await B.as.rpc("share_record", { in_record_id: other.id });
  check("🔴 别人家分享不了这一家的单", !!theirErr, "居然分享得了");
  const { data: theirUnshare } = await B.as
    .rpc("unshare_record", { in_record_id: quote.id }).then((r) => ({ data: r.error }));
  check("别人家也收不回这一家的连结", !!theirUnshare, "居然收得回");

  /* 🔴 路人直接读那张表 —— 一支公开函式不可以顺手把表也开了。 */
  const { data: rawRead } = await stranger.from("pipeline_records").select("id").limit(1);
  check("🔴 路人直接读那张表，一行都读不到", (rawRead ?? []).length === 0, `${rawRead?.length}`);
  const { error: pushErr } = await stranger.rpc("share_record", { in_record_id: other.id });
  check("路人开不了连结", !!pushErr, "居然开得了");
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(stuck.length ? `\n🔴 ${stuck.length} 个临时帐号删不掉` : "\n临时帐号都删掉了");
}

console.log(`\n判：${failed.length === 0 ? "全过" : `${failed.length} 条没过`}`);
process.exit(failed.length ? 1 : 0);
