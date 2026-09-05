/**
 * 经销商自己讲得出「我要货」—— 用**真的 anon 钥匙**打。
 *
 * 🔴 这一支只用真的路人身分打那两支公开函式。拿老板的登入去打，
 *    每一条都会过，而**它证明不了任何事** —— 挡在外面那道门，
 *    只有站在外面才试得出来（check:public-booking 同一条）。
 *
 * ⚠️ 第 ⑬ 段是这一支真正的重点，而它不是「功能」：
 *    **那条连结外流之后，他看得到什么。** 一条只多一笔假请求的连结，
 *    跟一条看得到整个户口的连结，不是同一件事。
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

/** 🔴 一个真的路人：anon key，从来没有登入过。 */
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

async function person(tag, pages) {
  const cred = {
    email: `ptl-${tag}-${Date.now()}@formae.test`,
    password: `Ptl-${Date.now()}-x!`,
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
  for (const k of pages) await as.rpc("add_project_page", { requested_key: k, new_title: k });
  return { as, cred, userId: user.user.id, projectId: proj?.id };
}

const uuid = () => crypto.randomUUID();

async function main() {
  const owner = await person("owner", ["customers", "staff", "quotations", "orders"]);
  const { as: C, projectId: P } = owner;
  const { error: nameErr } = await admin
    .from("projects").update({ business_name: "Vibe Mobile Trading" }).eq("id", P);
  /* ⚠️ 看回传的错误。第一版写的是 `company_name`（那一栏不存在），
     而不看错误的话它静静地什么都没做 —— 然后底下那一条红看起来像产品坏了。 */
  if (nameErr) throw new Error(`set business_name: ${nameErr.message}`);

  // ── ① 一个经销商，一条连结 ────────────────────────────────────────────
  console.log("\n① 开一条连结给他");

  const { data: dealer } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Sunrise Mobile Sdn Bhd",
  });
  const { data: other } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "customers", in_name: "Kedai Telefon Ah Seng",
  });
  const { data: crewman } = await C.rpc("add_directory_entry", {
    in_project_id: P, in_module_key: "staff", in_name: "Faizal (our own runner)",
  });

  const { data: ref, error: openErr } = await C.rpc("open_party_portal", {
    in_party_id: dealer.id,
  });
  check("开得出一条连结", !openErr && !!ref, openErr?.message);
  check("🔴 而那条连结不是他那一行的 id", ref !== dealer.id, `${ref}`);

  const { data: again } = await C.rpc("open_party_portal", { in_party_id: dealer.id });
  check("再开一次是同一条（他弄丢了，再发一次）", again === ref, `${again}`);

  const { error: staffErr } = await C.rpc("open_party_portal", { in_party_id: crewman.id });
  check("师傅开不了 —— 他有登入，走里面那条路", !!staffErr, "居然让它过了");

  // ── ② 路人打开它 ─────────────────────────────────────────────────────
  console.log("\n② 路人打开那条连结");

  const { data: page0, error: pErr } = await stranger.rpc("party_portal", { in_ref: ref });
  check("打得开", !pErr && page0?.found === true, pErr?.message ?? JSON.stringify(page0));
  check("看得到公司名", page0?.business === "Vibe Mobile Trading", `${page0?.business}`);
  check("看得到自己的名字", page0?.you === "Sunrise Mobile Sdn Bhd", `${page0?.you}`);
  check("还没送过东西，所以是空的", (page0?.requests ?? []).length === 0,
    `${(page0?.requests ?? []).length}`);

  const { data: nope } = await stranger.rpc("party_portal", { in_ref: uuid() });
  check("乱猜一个号码打不开", nope?.found === false, JSON.stringify(nope));

  // ── ③ 他送一笔进来 ───────────────────────────────────────────────────
  console.log("\n③ 他自己送一笔");

  const { data: sent, error: sErr } = await stranger.rpc("submit_party_request", {
    in_ref: ref,
    in_what: "下一批卡帮我留 200 张，还有我转了 RM 5,000 请查一下",
    in_qty: 200,
    in_amount_cents: 500000,
    in_contact: "017-873 0408",
    in_idempotency_key: uuid(),
  });
  check("送得进去", !sErr && sent === "ok", sErr?.message ?? `${sent}`);

  const { data: page1 } = await stranger.rpc("party_portal", { in_ref: ref });
  check("他自己看得到那一笔", (page1?.requests ?? []).length === 1,
    `${(page1?.requests ?? []).length}`);
  check("而且是他自己讲的那句话，原样",
    page1?.requests?.[0]?.what?.includes("留 200 张"), page1?.requests?.[0]?.what);

  const { data: inbox, error: inErr } = await C.rpc("party_requests_of", { in_project_id: P });
  check("老板的收件匣看得到", !inErr && (inbox ?? []).length === 1,
    inErr?.message ?? `${(inbox ?? []).length}`);
  check("而且讲得出是谁送的", inbox?.[0]?.party_name === "Sunrise Mobile Sdn Bhd",
    `${inbox?.[0]?.party_name}`);

  /* 🔴 路人拿到的是那支函式挑出来的几栏，不是那张表。 */
  const { data: raw } = await stranger.from("party_requests").select("id");
  check("🔴 路人直接读那张表，一行都读不到", (raw ?? []).length === 0, `${(raw ?? []).length}`);
  const { data: rawDir } = await stranger.from("directory_entries").select("id, portal_ref");
  check("🔴 名册也读不到（那条连结不会外流）", (rawDir ?? []).length === 0,
    `${(rawDir ?? []).length}`);

  // ── ④ 按两下 ─────────────────────────────────────────────────────────
  console.log("\n④ 手机上双击");

  const twice = uuid();
  await stranger.rpc("submit_party_request", {
    in_ref: ref, in_what: "再来 50 张", in_idempotency_key: twice,
  });
  const { data: dup } = await stranger.rpc("submit_party_request", {
    in_ref: ref, in_what: "再来 50 张", in_idempotency_key: twice,
  });
  check("回同一个答案", dup === "ok", `${dup}`);
  const { data: page2 } = await stranger.rpc("party_portal", { in_ref: ref });
  check("而只有两笔，不是三笔", (page2?.requests ?? []).length === 2,
    `${(page2?.requests ?? []).length}`);

  // ── ⑤ 讲不清楚的、太长的 ─────────────────────────────────────────────
  console.log("\n⑤ 讲不清楚的送不进来");

  const { data: blank } = await stranger.rpc("submit_party_request", {
    in_ref: ref, in_what: "   ",
  });
  check("空白的挡下来", blank === "incomplete", `${blank}`);
  const { data: huge } = await stranger.rpc("submit_party_request", {
    in_ref: ref, in_what: "x".repeat(2500),
  });
  check("太长的挡下来", huge === "too_long", `${huge}`);
  const { data: neg } = await stranger.rpc("submit_party_request", {
    in_ref: ref, in_what: "负数", in_amount_cents: -100,
  });
  check("负数的金额挡下来", neg === "incomplete", `${neg}`);

  // ── ⑥ 一个人最多五笔在等 ─────────────────────────────────────────────
  console.log("\n⑥ 五笔在等，第六笔挡下来");

  /* 已经两笔，再送三笔到五笔。⚠️ 一分钟五笔的限流会先咬到，
     所以这三笔用 admin 直接写 —— 量的是**那个上限**，不是限流。 */
  /* ⚠️ 日子往回推 —— 一分钟五笔那道限流会数**这一分钟里的每一笔**，
     不管是谁写进去的。不往回推，红的是限流那一条，而我要量的是上限那一条。 */
  const anHourAgo = new Date(Date.now() - 3600 * 1000).toISOString();
  for (let i = 0; i < 3; i += 1) {
    const { error: fErr } = await admin.from("party_requests").insert({
      party_id: dealer.id, project_id: P, what: `filler ${i}`, created_at: anHourAgo,
    });
    if (fErr) throw new Error(`filler ${i}: ${fErr.message}`);
  }
  const { data: sixth } = await stranger.rpc("submit_party_request", {
    in_ref: ref, in_what: "第六笔",
  });
  check("回的是一个词，不是一句资料库的话", sixth === "too_many_open", `${sixth}`);
  /* 🔴 而绕过那支函式也挡得住 —— 「表格是礼貌，约束才是规矩」。 */
  const { error: capErr } = await admin.from("party_requests").insert({
    party_id: dealer.id, project_id: P, what: "绕过去的第六笔",
  });
  check("🔴 绕过那支函式直接写也挡得住", !!capErr && capErr.message.includes("too_many_open"),
    capErr?.message ?? "居然让它过了");

  // ── ⑦ 一按变一张单 ───────────────────────────────────────────────────
  console.log("\n⑦ 老板一按，变一张单");

  const first = (inbox ?? [])[0];
  const { data: doc, error: docErr } = await C.rpc("record_from_request", {
    in_request_id: first.id, in_module_key: "orders",
  });
  check("开得出一张单", !docErr && !!doc?.id, docErr?.message);
  check("🔴 有单号 —— 走的是人按的那一支", !!doc?.doc_no, `${doc?.doc_no}`);
  check("而且连到那个经销商", doc?.party_id === dealer.id, `${doc?.party_id}`);
  check("金额是他讲的那个数字", Number(doc?.amount_cents) === 500000, `${doc?.amount_cents}`);

  const { data: doc2 } = await C.rpc("record_from_request", {
    in_request_id: first.id, in_module_key: "orders",
  });
  check("再按一次是同一张，不是第二张", doc2?.id === doc.id, `${doc2?.id}`);

  const { data: page3 } = await stranger.rpc("party_portal", { in_ref: ref });
  const done = (page3?.requests ?? []).filter((r) => r.status === "done");
  check("他自己那一页看得到那一笔办好了", done.length === 1, `${done.length}`);

  // ── ⑧ 丢掉一笔 ───────────────────────────────────────────────────────
  console.log("\n⑧ 丢掉一笔");

  const { data: openNow } = await C.rpc("party_requests_of", { in_project_id: P });
  const toDrop = (openNow ?? [])[0];
  await C.rpc("drop_party_request", { in_request_id: toDrop.id });
  const { data: all } = await C.rpc("party_requests_of", {
    in_project_id: P, in_open_only: false,
  });
  const dropped = (all ?? []).find((r) => r.id === toDrop.id);
  check("🔴 不删，只是标着丢掉了", dropped?.status === "dropped", `${dropped?.status}`);

  // ── ⑨ 关掉那条连结 ───────────────────────────────────────────────────
  console.log("\n⑨ 关掉那条连结");

  await C.rpc("close_party_portal", { in_party_id: dealer.id });
  const { data: shut } = await stranger.rpc("party_portal", { in_ref: ref });
  check("当场打不开", shut?.found === false, JSON.stringify(shut));
  const { data: shutSend } = await stranger.rpc("submit_party_request", {
    in_ref: ref, in_what: "还送得进去吗",
  });
  check("也送不进去，而且跟乱猜一个号码同一个答案", shutSend === "not_found", `${shutSend}`);

  const { data: kept } = await C.rpc("party_requests_of", {
    in_project_id: P, in_open_only: false,
  });
  check("🔴 而他送过的那几笔一笔都没有少", (kept ?? []).length === 5, `${(kept ?? []).length}`);

  // ── ⑩ 换一条 ─────────────────────────────────────────────────────────
  console.log("\n⑩ 换一条新的");

  const { data: ref2 } = await C.rpc("open_party_portal", { in_party_id: dealer.id });
  check("开得出新的一条", !!ref2 && ref2 !== ref, `${ref2}`);
  const { data: newPage } = await stranger.rpc("party_portal", { in_ref: ref2 });
  check("新的打得开，而且历史还在", newPage?.found === true &&
    (newPage?.requests ?? []).length === 5, `${(newPage?.requests ?? []).length}`);

  const { data: ref3 } = await C.rpc("open_party_portal", {
    in_party_id: dealer.id, in_rotate: true,
  });
  check("叫它换，才换", ref3 !== ref2, `${ref3}`);
  const { data: deadNow } = await stranger.rpc("party_portal", { in_ref: ref2 });
  check("🔴 换完之后旧的那一条当场死掉", deadNow?.found === false, JSON.stringify(deadNow));

  // ── ⑪ 收起来的人 ─────────────────────────────────────────────────────
  console.log("\n⑪ 收起来的人");

  const { data: refOther } = await C.rpc("open_party_portal", { in_party_id: other.id });
  await C.rpc("set_directory_archived", { in_id: other.id, in_archived: true });
  const { data: gone } = await stranger.rpc("party_portal", { in_ref: refOther });
  check("连结跟着失效", gone?.found === false, JSON.stringify(gone));

  // ── ⑫ 别人家 ─────────────────────────────────────────────────────────
  console.log("\n⑫ 另一家公司");

  const outsider = await person("other", ["customers"]);
  const { data: theirInbox } = await outsider.as.rpc("party_requests_of", { in_project_id: P });
  check("读不到我的收件匣", (theirInbox ?? []).length === 0, `${(theirInbox ?? []).length}`);
  const { error: theirOpen } = await outsider.as.rpc("open_party_portal", {
    in_party_id: dealer.id,
  });
  check("开不了我的人的连结", !!theirOpen, "居然让它过了");
  const { data: theirRaw } = await outsider.as.from("party_requests").select("id");
  check("直接读那张表也是零行", (theirRaw ?? []).length === 0, `${(theirRaw ?? []).length}`);

  // ── ⑬ 🔴 漏不漏 —— 那条连结外流之后他看得到什么 ──────────────────────
  console.log("\n⑬ 🔴 那条连结外流之后");

  const { data: leak } = await stranger.rpc("party_portal", { in_ref: ref3 });
  const flat = JSON.stringify(leak);
  check("看不到别的客户", !flat.includes("Kedai Telefon Ah Seng"), flat.slice(0, 200));
  check("看不到我们自己人", !flat.includes("Faizal"), flat.slice(0, 200));
  check("🔴 一个 id 都没有", !flat.includes(dealer.id) && !flat.includes(P) &&
    !flat.includes(doc.id), "有 id 漏出去");
  /* 🔴 **这一条 2026-09-05 换过一次，理由写下来，而且换成更严的一条。**
     它本来写「看不到单号」。而接画面的时候看到那句「已经开单了」
     **讲不出是哪一张** —— 他下一句要问的正好是那一句，於是他回到
     WhatsApp 上问，而这一整件事存在的理由就是不要他回去问。
     20260905780000 把**他自己那一笔**变出来的单号加进去了。

     判准是这一句：**那个单号会印在那门生意寄给他的那张纸上** ——
     那张单的对方就是他（`record_from_request` 把 `party_id` 设成他）。
     所以它不是新的资讯，是同一张纸上的同一个号码。

     ⚠️ 而边界没有放松，是**移到更准的地方**：他看得到自己那一张，
     **看不到别人那一张** —— 下面那一条就是在量这件事。 */
  check("看得到自己那一张的单号", flat.includes(String(doc.doc_no)), flat.slice(0, 300));

  /* 🔴 别人那一张的单号不可以出现。少了这一条，上面那一条就只是放宽。 */
  const { data: notHis } = await C.rpc("add_pipeline_record", {
    in_project_id: P, in_module_key: "orders", in_party: "Kedai Telefon Ah Seng",
  });
  const { data: leak2 } = await stranger.rpc("party_portal", { in_ref: ref3 });
  check("🔴 而别人那一张的单号看不到",
    !JSON.stringify(leak2).includes(String(notHis?.doc_no)), `${notHis?.doc_no}`);
  /* ⚠️ 故意没有的两样，写下来免得下一轮当成漏做（migration 档头也写了）：
     他欠多少（那是 sees_money 的）· 他的单走到哪（那是一张单一个门牌）。 */
  check("🔴 看不到他欠多少", !/owe|outstanding|balance|欠/i.test(flat), flat.slice(0, 200));

  await dropThrowaways(admin, made);
}

main()
  .then(() => {
    console.log(
      failed.length === 0 ? `\n判：全过` : `\n判：${failed.length} 条没过 —— ${failed.join(" · ")}`,
    );
    process.exit(failed.length === 0 ? 0 : 1);
  })
  .catch(async (e) => {
    console.error("\n" + e.message);
    await dropThrowaways(admin, made).catch(() => {});
    process.exit(1);
  });
