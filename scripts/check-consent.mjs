/**
 * 她签下的那一张纸 —— 真的登入、真的发一条连结、真的用一把没有登入的钥匙签。
 *
 *   npm run check:consent
 *
 * `supabase db push` 成功证明不了任何事（[重点 26](../docs/founder-points.md)）。
 *
 * 🔴 这一支量的最重要的一件是**快照**：
 * 她今年三月改了那份同意书的措辞，而去年十月那个客人签的是**当时那一份**。
 * 一份会跟着范本变的证据不是证据 —— 而那正是她被问
 * 「她签的时候你那张纸上写的是什么」时唯一答得出来的东西。
 *
 * ⚠️ 而它同时量**漏不漏**：一个拿着连结的陌生人，看得到她自己的名字跟
 * 那份文字，看不到她的疗程记录、她欠多少、她别的同意书。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowawayOnExit, dropThrowaway } from "./lib/throwaway.mjs";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("=") && !l.trim().startsWith("#"))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, "")];
    }),
);

const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
const ANON = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const SERVICE = env.SUPABASE_SERVICE_ROLE_KEY;
if (!URL_ || !ANON || !SERVICE) {
  console.error("Missing Supabase env vars in .env.local");
  process.exit(2);
}
const admin = createClient(URL_, SERVICE, { auth: { persistSession: false } });

let pass = 0;
const bad = [];
const check = (what, ok, saw) => {
  if (ok) {
    pass++;
    console.log(`  PASS  ${what}`);
  } else {
    bad.push(what);
    console.log(`  FAIL  ${what}${saw === undefined ? "" : ` — ${saw}`}`);
  }
};

const stamp = Date.now();
let ownerId = null;
let mateId = null;
let otherId = null;
dropThrowawayOnExit(admin, () => [ownerId, mateId, otherId]);

/* 一把从头到尾没有登入过的钥匙 —— 她拿着那条连结就是这个身分。 */
const stranger = createClient(URL_, ANON, { auth: { persistSession: false } });

const BODY_ONE = [
  "我明白肉毒杆菌注射的效果是暂时的，通常维持三到六个月。",
  "常见反应包括注射处瘀青、轻微头痛、短暂的不对称。",
  "我已经告知美疗师我目前服用的药物跟过敏史。",
].join("\n");
const BODY_TWO = BODY_ONE + "\n（2026 年三月修订：孕期或哺乳期不做。）";

try {
  /* ── 台面 ────────────────────────────────────────────────────────────── */
  const email = `consent-${stamp}@formae.test`;
  const password = `Cx-${stamp}-x!`;
  const { data: made, error: mkErr } = await admin.auth.admin.createUser({
    email, password, email_confirm: true,
  });
  if (mkErr) throw new Error(`createUser: ${mkErr.message}`);
  ownerId = made.user.id;

  const c = createClient(URL_, ANON, { auth: { persistSession: false } });
  const { error: inErr } = await c.auth.signInWithPassword({ email, password });
  if (inErr) throw new Error(`signIn: ${inErr.message}`);

  const { data: proj } = await admin
    .from("projects").select("id").eq("account_id", ownerId).single();
  if (!proj?.id) throw new Error("the signup trigger did not provision a project");
  const P = proj.id;

  await admin.from("projects").update({ business_name: "Lumi Aesthetics" }).eq("id", P);

  for (const [k, t] of [["customers", "Clients"], ["staff", "Team"]]) {
    const { error } = await c.rpc("add_project_page", { requested_key: k, new_title: t });
    if (error && !/already/i.test(error.message)) throw new Error(`add_project_page ${k}: ${error.message}`);
  }

  const person = async (name, key) => {
    const { data, error } = await c.rpc("add_directory_entry", {
      in_project_id: P, in_module_key: key, in_name: name,
    });
    if (error) throw new Error(`add_directory_entry ${name}: ${error.message}`);
    return data?.id ?? data;
  };
  const client = await person("Ms Lim", "customers");
  await person("Amy", "staff");

  /* ── ① 一份范本 ───────────────────────────────────────────────────── */
  console.log("\n① 她自己写的那一份");
  const { data: form, error: fErr } = await c.rpc("add_consent_form", {
    in_project_id: P, in_name: "肉毒同意书", in_body: BODY_ONE,
  });
  check("写得下来", !!form?.id, fErr?.message);
  check("内容是她自己的字，一个字都不是我们给的", form?.body === BODY_ONE, form?.body?.slice(0, 30));

  const { error: blankErr } = await c.rpc("add_consent_form", {
    in_project_id: P, in_name: "空的", in_body: "   ",
  });
  check("没有写要她同意什么就挡下来", !!blankErr, blankErr?.message?.slice(0, 60));

  const { error: dupErr } = await c.rpc("add_consent_form", {
    in_project_id: P, in_name: "肉毒同意书", in_body: "另一段",
  });
  check("同一家不准两份同名（发出去之前她要选得出是哪一份）", !!dupErr, dupErr?.message?.slice(0, 60));

  const { data: laser } = await c.rpc("add_consent_form", {
    in_project_id: P, in_name: "激光同意书", in_body: "激光那一份的风险不一样。",
  });
  check("而不同疗程分开几份（外面那几家都是这样做的）", !!laser?.id);

  /* ── ② 发一份给她 ─────────────────────────────────────────────────── */
  console.log("\n② 发出去 —— 那条连结就是要给她的东西");
  const { data: sent, error: sErr } = await c.rpc("request_consent", {
    in_party_id: client, in_form_id: form.id,
  });
  check("发得出去", !!sent?.id, sErr?.message);
  check("一发出去就有门牌", !!sent?.share_ref, sent?.share_ref);
  check("🔴 门牌不是那一行的 id（收得回来，而 id 收不回来）", sent?.share_ref !== sent?.id);
  check("快照抄下来了", sent?.form_body === BODY_ONE, sent?.form_body?.slice(0, 30));
  check("还没签", sent?.signed_at === null, sent?.signed_at);

  /* ── ③ 改范本，已经发出去的一个字都不变 ───────────────────────────── */
  console.log("\n③ 🔴 她三月改了措辞 —— 而客人手上那一份不会跟着变");
  const { error: upErr } = await c.rpc("update_consent_form", {
    in_id: form.id, in_body: BODY_TWO,
  });
  check("范本改得了", !upErr, upErr?.message);

  const { data: after } = await admin
    .from("consent_signatures").select("form_body").eq("id", sent.id).single();
  check(
    "🔴 已经发出去的那一份，一个字都没有变 —— 一份会跟着范本变的证据不是证据",
    after?.form_body === BODY_ONE,
    after?.form_body?.slice(-30),
  );

  /* ── ④ 她打开那一页（一把没有登入的钥匙） ─────────────────────────── */
  console.log("\n④ 她拿着那条连结打开");
  const { data: seen, error: seeErr } = await stranger.rpc("public_consent_form", {
    in_ref: sent.share_ref,
  });
  const page = (seen ?? [])[0];
  check("打得开", !!page, seeErr?.message);
  check("写着这一家的名字", page?.business_name === "Lumi Aesthetics", page?.business_name);
  check("写着她自己的名字（不然她不知道这是不是给她的）", page?.person_name === "Ms Lim", page?.person_name);
  check("读得到那一份文字", page?.form_body === BODY_ONE, page?.form_body?.slice(0, 20));
  check("而它是发出去那一刻那一份，不是今天的范本", !String(page?.form_body ?? "").includes("2026 年三月"));
  check("而且穿的是这一家自己那套样子", page?.style !== undefined);
  check("按得下去", page?.can_sign === true, page?.can_sign);

  const keys = Object.keys(page ?? {});
  check(
    "🔴 一个 id 都没有漏出去",
    !keys.some((k) => /_id$|^id$/.test(k)),
    keys.join(","),
  );

  const { data: nothing } = await stranger.rpc("public_consent_form", {
    in_ref: "00000000-0000-0000-0000-000000000000",
  });
  check("门牌是假的就什么都不回（不告诉他这份表单存不存在）", (nothing ?? []).length === 0);

  const { data: raw } = await stranger.from("consent_signatures").select("id");
  check("而他直接读那张表，一行都读不到", (raw ?? []).length === 0, JSON.stringify(raw));

  /* ── ⑤ 她签下去 ───────────────────────────────────────────────────── */
  console.log("\n⑤ 她签下去");
  const { data: noName } = await stranger.rpc("sign_consent", {
    in_ref: sent.share_ref, in_name: "  ",
  });
  check("不打名字就不算签（而且回一个词，不是一句资料库的话）", noName === "incomplete", noName);

  const { data: signed } = await stranger.rpc("sign_consent", {
    in_ref: sent.share_ref, in_name: "Lim Sook Yee", in_note: "我有在吃血压药",
  });
  check("签得下去", signed === "ok", signed);

  const { data: again } = await stranger.rpc("sign_consent", {
    in_ref: sent.share_ref, in_name: "Lim Sook Yee",
  });
  check("🔴 签两次挡下来 —— 一次签名是一个承诺，不是一个设定", again === "signed", again);

  const { data: reopened } = await stranger.rpc("public_consent_form", { in_ref: sent.share_ref });
  const back = (reopened ?? [])[0];
  check("签完她照样回得去看自己签了什么", !!back?.signed_at, back?.signed_at);
  check("上面写着她打的那个名字", back?.signed_name === "Lim Sook Yee", back?.signed_name);
  check("她补的那一句也在", back?.signed_note === "我有在吃血压药", back?.signed_note);
  check("而不给再按一次", back?.can_sign === false, back?.can_sign);
  check(
    "🔴 签完回去看，读到的还是她当时签的那一份",
    back?.form_body === BODY_ONE,
    back?.form_body?.slice(-30),
  );

  /* ── ⑥ 老板那一边读回来 ───────────────────────────────────────────── */
  console.log("\n⑥ 她开工前问的那一句：她签了没有");
  const { data: mine, error: mErr } = await c.rpc("consents_of", { in_party_id: client });
  const one = (mine ?? [])[0];
  check("读得回来", (mine ?? []).length === 1, mErr?.message ?? (mine ?? []).length);
  check("讲得出签了没有", !!one?.signed_at, one?.signed_at);
  check("讲得出她签的是哪一份", one?.form_name === "肉毒同意书", one?.form_name);
  check("而那条连结还在（她要重发）", !!one?.share_ref, one?.share_ref);

  const { data: forms } = await c.rpc("consent_forms_of", { in_project_id: P });
  const botox = (forms ?? []).find((f) => f.name === "肉毒同意书");
  check("范本那一页数得出签过几个", Number(botox?.signed_count) === 1, botox?.signed_count);
  check("也数得出还有几个在等", Number(botox?.waiting_count) === 0, botox?.waiting_count);

  /* ── ⑦ 收回那条连结 ───────────────────────────────────────────────── */
  console.log("\n⑦ 发错人了 —— 收得回来，而签过的收不回来");
  const { error: revSigned } = await c.rpc("revoke_consent_request", { in_id: sent.id });
  check("🔴 签过的那一份收不回来（那是发生过的事，不是一个设定）", !!revSigned, revSigned?.message?.slice(0, 60));

  const { data: second } = await c.rpc("request_consent", {
    in_party_id: client, in_form_id: laser.id,
  });
  const secondRef = second?.share_ref;
  check("再发一份是另一条连结", secondRef && secondRef !== sent.share_ref);

  const { error: revErr } = await c.rpc("revoke_consent_request", { in_id: second.id });
  check("还没签的收得回来", !revErr, revErr?.message);

  const { data: dead } = await stranger.rpc("public_consent_form", { in_ref: secondRef });
  check("🔴 而那条网址当场就打不开了", (dead ?? []).length === 0, JSON.stringify(dead));

  /* ── ⑧ 关掉的范本发不出去 ─────────────────────────────────────────── */
  console.log("\n⑧ 关掉的那一份");
  await c.rpc("update_consent_form", { in_id: laser.id, in_archived: true });
  const { error: offErr } = await c.rpc("request_consent", {
    in_party_id: client, in_form_id: laser.id,
  });
  check("关掉的范本发不出去，而且讲得出该怎么做", !!offErr, offErr?.message?.slice(0, 60));

  const { data: stillThere } = await c.rpc("consent_forms_of", { in_project_id: P });
  check("而它还在（关掉不是删掉）", (stillThere ?? []).some((f) => f.name === "激光同意书" && f.archived));

  /* ── ⑨ 别人家 ─────────────────────────────────────────────────────── */
  console.log("\n⑨ 另一家公司");
  const otherEmail = `consent-other-${stamp}@formae.test`;
  const { data: other, error: oErr } = await admin.auth.admin.createUser({
    email: otherEmail, password, email_confirm: true,
  });
  if (oErr) throw new Error(`createUser other: ${oErr.message}`);
  otherId = other.user.id;
  const c3 = createClient(URL_, ANON, { auth: { persistSession: false } });
  await c3.auth.signInWithPassword({ email: otherEmail, password });

  const { data: theirs } = await c3.rpc("consents_of", { in_party_id: client });
  check("看不到我的客人签了什么", (theirs ?? []).length === 0, JSON.stringify(theirs));
  const { data: theirForms } = await c3.rpc("consent_forms_of", { in_project_id: P });
  check("看不到我的范本", (theirForms ?? []).length === 0, JSON.stringify(theirForms));
  const { error: theirSend } = await c3.rpc("request_consent", {
    in_party_id: client, in_form_id: form.id,
  });
  check("也发不了我的表单给我的客人", !!theirSend, theirSend?.message?.slice(0, 50));

  /* ── ⑩ 美疗师 ─────────────────────────────────────────────────────── */
  console.log("\n⑩ 做那个疗程的美疗师");
  const mateEmail = `consent-mate-${stamp}@formae.test`;
  const { data: mate, error: meErr } = await admin.auth.admin.createUser({
    email: mateEmail, password, email_confirm: true,
  });
  if (meErr) throw new Error(`createUser mate: ${meErr.message}`);
  mateId = mate.user.id;
  const { error: joinErr } = await c.rpc("add_project_member", {
    in_email: mateEmail, in_role: "staff",
  });
  if (joinErr) throw new Error(`add_project_member: ${joinErr.message}`);

  const c2 = createClient(URL_, ANON, { auth: { persistSession: false } });
  await c2.auth.signInWithPassword({ email: mateEmail, password });

  const { data: sawIt } = await c2.rpc("consents_of", { in_party_id: client });
  check(
    "🔴 她看得到「她签了没有」—— 那正是她开工前要问的那一句",
    (sawIt ?? []).length >= 1,
    JSON.stringify(sawIt),
  );
  /* 控制组：钱那条线还在（[任务 125] 付过这一次学费 —— 少了它，
     上面那一条在一个什么都看得到的世界里也会全绿）。 */
  const { data: money } = await c2.rpc("party_debts", { in_project_id: P });
  check("而她读不到钱那一边（那条线没有被动过）", (money ?? []).length === 0, JSON.stringify(money));
} catch (e) {
  bad.push(String(e?.message ?? e));
  console.log(`\n🔴 ${e?.message ?? e}`);
} finally {
  const ok = [];
  for (const id of [ownerId, mateId, otherId]) ok.push(await dropThrowaway(admin, id));
  console.log(ok.every(Boolean) ? "\n临时帐号删掉了" : "\n🔴 有帐号删不掉");
}

console.log(`\n判：${pass} 过 · ${bad.length} 没过`);
if (bad.length) {
  for (const x of bad) console.log(`  · ${x}`);
  process.exitCode = 1;
}
