/**
 * 保存不再收钱 · 交接留下一行 —— 用真的登入身分打，不是读 SQL。
 *
 * ── 这一支真正在守的四条 ────────────────────────────────────────────────
 *
 *  🔴 **一个还没付款的老板存得了他的设计。**
 *     那是 2026-09-05 拆掉的那道闸（任务 159）。这一条要是红了，
 *     他上门 demo 到最兴奋那一秒，画面会盖起来跟客户要钱。
 *
 *  🔴 **存得了就一定退得回去。** 一个存得进去、退不回来的编辑器，
 *     比不给存更糟 —— 客户改坏了一页，没有出路。
 *
 *  🔴 **按下「交给我去建」，资料库里真的多一行。**
 *     那一行是**广告进来那一群唯一的线索**（上门那一群人在旁边，
 *     漏了还救得回来）。而它必须在 WhatsApp 之前就写好 ——
 *     讯息送不送得出去，都不影响老板看得到。
 *
 *  🔴 **按两下只留一行，而真的第二次请求留两行。**
 *     手机上双击是常态，不是错；而他先要 A、后来又要 B 是两件事。
 *
 * ⚠️ 跑完把临时帐号删掉，而且**看那个 error**（scripts/lib/throwaway.mjs
 *    的档头写着为什么：那句「删掉了」讲了三个星期都是假的）。
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
  const cred = { email: `ho-${tag}-${Date.now()}@formae.test`, password: `Ho-${Date.now()}-x!` };
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
    .select("id, paid, stage")
    .eq("account_id", user.user.id)
    .single();
  return { as, userId: user.user.id, projectId: proj?.id, paid: proj?.paid, stage: proj?.stage };
}

const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
  auth: { persistSession: false },
});

try {
  const boss = await person("boss");
  const other = await person("other");

  /* ① 前提：这个帐号真的是没付款的，不然下面每一条都在量空气。
     🔴 这一条是控制组 —— 任务 125 学到的：一条守卫在一个没有资料的
     专案上永远是绿的，而它量的是空气。 */
  console.log("\n① 前提");
  check("这个新帐号真的还没付款", boss.paid === false, `paid=${boss.paid}`);
  check("交付状态从 designing 开始", boss.stage === "designing", `stage=${boss.stage}`);

  /* ② 没付款也存得了 —— 拆掉的那道闸 */
  console.log("\n② 没付款的老板，存得了他的设计");
  const { error: addErr } = await boss.as.rpc("add_project_page", {
    requested_key: "quotations",
    new_title: "Quotations",
  });
  check("加得了一页（这一件本来就不用付款）", !addErr, addErr?.message);

  const layoutA = { root: {}, content: [{ type: "PageHeader", props: { id: "h1", title: "第一版" } }] };
  const { error: saveErr } = await boss.as.rpc("save_project_page", {
    target_page_key: "quotations",
    new_layout: layoutA,
  });
  check("🔴 没付款也存得了", !saveErr, saveErr?.message);

  const { data: savedRow } = await admin
    .from("project_pages")
    .select("layout_json")
    .eq("project_id", boss.projectId)
    .eq("page_key", "quotations")
    .single();
  check(
    "存进去的真的是他那一版",
    savedRow?.layout_json?.content?.[0]?.props?.title === "第一版",
    JSON.stringify(savedRow?.layout_json)?.slice(0, 80),
  );

  /* ③ 存得了就退得回去 */
  console.log("\n③ 退得回去");
  const layoutB = { root: {}, content: [{ type: "PageHeader", props: { id: "h1", title: "第二版" } }] };
  await boss.as.rpc("save_project_page", { target_page_key: "quotations", new_layout: layoutB });
  const { data: versions, error: verErr } = await boss.as.rpc("list_page_versions", {
    target_page_key: "quotations",
  });
  check("看得到历史", !verErr && (versions?.length ?? 0) >= 1, verErr?.message ?? `${versions?.length} 版`);

  if (versions?.length) {
    const { error: resErr } = await boss.as.rpc("restore_page_version", { version_id: versions[0].id });
    check("🔴 没付款也退得回去", !resErr, resErr?.message);
  }

  /* ④ 交接留下一行 */
  console.log("\n④ 按下「交给我去建」");
  const { data: id1, error: hoErr } = await boss.as.rpc("request_handoff", {
    in_note: "我想要一页记我的车队油钱",
    in_phone: "012-345 6789",
  });
  check("按得下去", !hoErr && !!id1, hoErr?.message);

  const { data: rows1 } = await admin
    .from("handoff_requests")
    .select("id, note")
    .eq("project_id", boss.projectId);
  check("🔴 资料库里真的多一行", rows1?.length === 1, `${rows1?.length} 行`);
  check("他要的那个功能写下来了", rows1?.[0]?.note === "我想要一页记我的车队油钱", rows1?.[0]?.note);

  const { data: p1 } = await admin
    .from("projects")
    .select("contact_phone, stage, stage_changed_at")
    .eq("id", boss.projectId)
    .single();
  check("🔴 号码顺手记下来了", p1?.contact_phone === "012-345 6789", `${p1?.contact_phone}`);
  check("交付状态推到了「已报价」", p1?.stage === "quoted", `stage=${p1?.stage}`);
  check("而且盖了时间章", !!p1?.stage_changed_at, `${p1?.stage_changed_at}`);

  /* ⑤ 按两下 vs 真的第二次 */
  console.log("\n⑤ 按两下，跟真的第二次");
  const { data: id2 } = await boss.as.rpc("request_handoff", {
    in_note: "我想要一页记我的车队油钱",
  });
  check("🔴 按两下回同一行，不新增", id2 === id1, `${id1} vs ${id2}`);

  const { data: id3 } = await boss.as.rpc("request_handoff", { in_note: "还有员工的打卡" });
  const { data: rows2 } = await admin
    .from("handoff_requests")
    .select("id")
    .eq("project_id", boss.projectId);
  check("换一件事要，是真的第二次", id3 !== id1 && rows2?.length === 2, `${rows2?.length} 行`);

  /* ⑥ 什么都不填也交接得了 */
  console.log("\n⑥ 什么都不填");
  const empty = await person("empty");
  const { data: id4, error: e4 } = await empty.as.rpc("request_handoff", {});
  check("「我看完了，就这样」也是一次完整的交接", !e4 && !!id4, e4?.message);
  const { data: emptyRow } = await admin
    .from("handoff_requests")
    .select("note")
    .eq("project_id", empty.projectId)
    .single();
  check("没打字就是 null，不是空字串", emptyRow?.note === null, JSON.stringify(emptyRow?.note));

  /* ⑦ 号码坏掉，不可以整支拒绝 */
  console.log("\n⑦ 号码打坏了");
  const bad = await person("bad");
  const { data: id5, error: e5 } = await bad.as.rpc("request_handoff", {
    in_note: "帮我建",
    in_phone: "01",
  });
  check("🔴 号码太短，交接照样成立", !e5 && !!id5, e5?.message);
  const { data: p5 } = await admin
    .from("projects")
    .select("contact_phone")
    .eq("id", bad.projectId)
    .single();
  check("而那一格留空，不是存一个坏号码", p5?.contact_phone === null, `${p5?.contact_phone}`);

  /* ⑧ 状态不可以倒退 */
  console.log("\n⑧ 已经在建的，不可以被推回去");
  await admin.from("projects").update({ stage: "building" }).eq("id", bad.projectId);
  await bad.as.rpc("request_handoff", { in_note: "再加一样东西" });
  const { data: p6 } = await admin
    .from("projects")
    .select("stage")
    .eq("id", bad.projectId)
    .single();
  check("🔴 building 不会被推回 quoted", p6?.stage === "building", `stage=${p6?.stage}`);

  /* ⑨ 别人家的 */
  console.log("\n⑨ 别人家的");
  const { data: seen } = await other.as.from("handoff_requests").select("id");
  check("别人看不到我的交接记录", (seen?.length ?? 0) === 0, `${seen?.length} 行`);

  const { data: otherPhone } = await other.as.from("projects").select("contact_phone");
  check(
    "别人也读不到我的号码",
    !otherPhone?.some((r) => r.contact_phone === "012-345 6789"),
    JSON.stringify(otherPhone),
  );

  /* ⑩ 没登入的 */
  console.log("\n⑩ 没登入的");
  const { error: anonErr } = await anon.rpc("request_handoff", { in_note: "x" });
  check("路人交接不了", !!anonErr, anonErr?.message ?? "居然让它过了");
  const { data: anonRows } = await anon.from("handoff_requests").select("id");
  check("路人一行都读不到", (anonRows?.length ?? 0) === 0, `${anonRows?.length} 行`);

  /* ⑪ 伪造不了 */
  console.log("\n⑪ 伪造不了");
  const { error: forgeErr } = await boss.as
    .from("handoff_requests")
    .insert({ project_id: other.projectId, note: "假的" });
  check("没有人插得进一行（只有那支函式写得进去）", !!forgeErr, forgeErr?.message ?? "居然让它过了");
} finally {
  const stuck = await dropThrowaways(admin, made);
  console.log(
    stuck.length ? `\n🔴 有 ${stuck.length} 个临时帐号删不掉` : `\n临时帐号 ${made.length} 个，全部删掉了`,
  );
}

console.log(
  failed.length
    ? `\n判：${failed.length} 条没过 —— ${failed.join(" · ")}`
    : `\n判：全部过了。保存不再收钱，交接会留下一行。`,
);
process.exit(failed.length ? 1 : 0);
