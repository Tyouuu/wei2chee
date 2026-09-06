/**
 * 「他来过几次 · 上一次是几时 · 他平常隔多久」—— 用真的登入身分打一次。
 *
 * 🔴 `db push` 成功证明不了任何事（重点 26）：plpgsql 到**执行**才解析名字。
 *
 * ⚠️ 这一支的道具全部照**马来西亚的墙上时钟**造，而且那个「今天」是
 *    **从资料库自己拿的**，不是这台机的 UTC ——
 *    [任务 209](../docs/founder-tasks.md#209) 付过一次学费：
 *    马来西亚凌晨到早上八点之间跑，每一个天数都差一天，
 *    而那条红看起来完全像产品坏了。
 */
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { dropThrowaways, dropThrowawayOnExit } from "./lib/throwaway.mjs";
import { openAllPages } from "./lib/seed-demo.mjs";

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

const stamp = Date.now();
const bad = [];
const check = (name, ok, detail) => {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : ` — ${detail}`}`);
  if (!ok) bad.push(name);
};

const people = [];
async function person(tag) {
  const email = `vis-${tag}-${stamp}@formae.test`;
  const password = `Vis-${stamp}-x!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
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
dropThrowawayOnExit(admin, () => people);

let ok = false;
try {
  const boss = await person("boss");
  const { data: proj } = await admin
    .from("projects")
    .select("id")
    .eq("account_id", boss.id)
    .single();
  const P = proj.id;
  const C = boss.client;
  await C.rpc("set_project_style", { new_style: "ledger" });
  await openAllPages(C, { quiet: true });

  /* 🔴 「今天」跟资料库同一个 —— 不是这台机的。 */
  const { data: todayRaw, error: tErr } = await C.rpc("today_myt");
  if (tErr || !todayRaw) throw new Error(`拿不到资料库的今天：${tErr?.message ?? "空的"}`);
  const TODAY = String(todayRaw).slice(0, 10);
  const day = (back) => {
    const d = new Date(`${TODAY}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() - back);
    return d.toISOString().slice(0, 10);
  };
  /* 马来西亚那一天的早上几点，写成 UTC。 */
  const at = (back, hour) =>
    `${day(back)}T${String(hour - 8).padStart(2, "0")}:00:00Z`;

  const party = async (name) => {
    const { data, error } = await C.rpc("add_directory_entry", {
      in_project_id: P,
      in_module_key: "customers",
      in_name: name,
    });
    if (error) throw new Error(`建客户 ${name}：${error.message}`);
    return typeof data === "string" ? data : data?.id;
  };
  const job = async (pid, on, title) => {
    const { error } = await C.rpc("add_pipeline_record", {
      in_project_id: P,
      in_module_key: "quotations",
      in_title: title,
      in_party_id: pid,
      in_issued_on: on,
      in_amount_cents: 100000,
    });
    if (error) throw new Error(`开单 ${title}：${error.message}`);
  };
  const booking = async (pid, back, hour) => {
    const { data, error } = await C.rpc("add_appointment", {
      in_project_id: P,
      in_module_key: "bookings",
      in_starts_at: at(back, hour),
      in_ends_at: at(back, hour + 1),
      in_party_id: pid,
      in_service: "cut",
    });
    if (error) throw new Error(`排预约：${error.message}`);
    return typeof data === "string" ? data : data?.id;
  };
  const visitsOf = async (client, pid) => {
    const { data, error } = await client.rpc("party_visits", {
      in_project_id: P,
      in_party_id: pid,
    });
    if (error) throw new Error(`party_visits：${error.message}`);
    return (data ?? [])[0] ?? null;
  };

  /* ── ① 几次 vs 几天 ────────────────────────────────────────────────── */
  console.log("\n① 🔴 「几次」跟「几天」是两个数字");
  const ming = await party("阿明");
  /* 间隔 7 · 7 · 180 —— 中位数 7，平均 64.7。**两个不一样才量得到。** */
  for (const [b, t] of [
    [201, "一"],
    [194, "二"],
    [187, "三"],
    [7, "四"],
  ]) {
    await job(ming, day(b), `工程${t}`);
  }
  let v = await visitsOf(C, ming);
  check("道具：阿明真的有四张单", v?.visits === 4, JSON.stringify(v));
  check("上一次来是最近那一张", v?.last_on === day(7), `${v?.last_on} 对 ${day(7)}`);
  check("第一次来是最早那一张", v?.first_on === day(201), `${v?.first_on}`);
  check("多久没来 = 资料库的今天减掉那一天", v?.days_since === 7, `${v?.days_since}`);

  await job(ming, day(7), "同一天第二张");
  v = await visitsOf(C, ming);
  check("🔴 同一天再开一张：几次 4 → 5", v?.visits === 5, `${v?.visits}`);
  check("🔴 而几天还是 4 —— 同一天不算两次", v?.visit_days === 4, `${v?.visit_days}`);

  /* ── ② 平常隔多久 = 中位数，不是平均 ──────────────────────────────── */
  console.log("\n② 🔴 平常隔多久 —— 他自己的历史，一个写死的天数都没有");
  check("🔴 中位数 7，不是平均 64", v?.usual_gap_days === 7, `${v?.usual_gap_days}`);
  check("以前最久那一次是 180", v?.longest_gap_days === 180, `${v?.longest_gap_days}`);

  const wah = await party("阿华");
  await job(wah, day(30), "只有两次 A");
  await job(wah, day(10), "只有两次 B");
  const vw = await visitsOf(C, wah);
  check("道具：阿华真的来过两天", vw?.visit_days === 2, `${vw?.visit_days}`);
  check(
    "🔴 只来过两天就不给「平常」—— 一个间隔不是习惯",
    vw?.usual_gap_days === null && vw?.longest_gap_days === null,
    `usual=${vw?.usual_gap_days} longest=${vw?.longest_gap_days}`,
  );

  /* ── ③ 哪一种预约算「来过」 ──────────────────────────────────────── */
  console.log("\n③ 🔴 三种预约不算来过，而第四种算");
  const chan = await party("阿珍");
  await booking(chan, 40, 10); /* 过去 · booked */
  const b2 = await booking(chan, 30, 11); /* 过去 · 等下改成没来 */
  const b3 = await booking(chan, 20, 12); /* 过去 · 等下取消 */
  await booking(chan, -30, 14); /* 还没到 */
  let vc = await visitsOf(C, chan);
  check(
    "控制组：三个过去的预约都排进去了（未来那一个本来就不算）",
    vc?.visits === 3,
    `现在 ${vc?.visits}`,
  );
  await C.rpc("set_appointment_status", { in_id: b2, in_status: "no_show" });
  await C.rpc("set_appointment_status", { in_id: b3, in_status: "cancelled" });
  vc = await visitsOf(C, chan);
  check("🔴 没来的不算来过", vc?.visits === 1, `${vc?.visits}`);
  check("🔴 取消的不算来过", vc?.visit_days === 1, `${vc?.visit_days}`);
  check(
    "🔴 而已经过去的 booked 照算 —— 那颗按钮他可能从来没按过",
    vc?.last_on === day(40),
    `${vc?.last_on}`,
  );
  check(
    "🔴 还没到的那一天不会变成「上一次来」",
    vc?.last_on <= TODAY && vc?.days_since >= 0,
    `last_on=${vc?.last_on} days_since=${vc?.days_since} today=${TODAY}`,
  );

  /* ── ④ 谁不在这份清单上 ─────────────────────────────────────────── */
  console.log("\n④ 谁不在这份清单上");
  const keung = await party("阿强"); /* 从来没来过 */
  const gone = await party("走了的");
  await job(gone, day(5), "他最后一单");
  /* 🔴 **摆完当场问回传的错误。** 第一版写的是 `update_directory_entry`
     加一个 `in_archived` —— **那个参数不存在**，那一句静静地什么都没做，
     然后底下那一条红看起来完全像产品坏了（第二十二次红的是我的道具）。
     一句不看错误的写入，跟一句没有写过的写入，在报告里长得一模一样。 */
  const { error: arcErr } = await C.rpc("set_directory_archived", {
    in_id: gone,
    in_archived: true,
  });
  if (arcErr) throw new Error(`道具没摆好 —— 收不起来那个客户：${arcErr.message}`);

  const { data: all, error: allErr } = await C.rpc("party_visits", { in_project_id: P });
  if (allErr) throw new Error(`整家：${allErr.message}`);
  const ids = new Set((all ?? []).map((r) => r.party_id));
  check("控制组：整家真的回了东西", (all ?? []).length >= 3, `${(all ?? []).length} 行`);
  check("🔴 从来没来过的不在清单上", !ids.has(keung), "阿强在里面");
  check("🔴 收起来的名册行不在清单上", !ids.has(gone), "走了的在里面");
  check("来过的都在", ids.has(ming) && ids.has(wah) && ids.has(chan), [...ids].join(","));

  /* ── ⑤ 师傅打得开，而里面一分钱都没有 ────────────────────────────── */
  console.log("\n⑤ 师傅那一边");
  const crew = await person("crew");
  const { error: joinErr } = await C.rpc("add_project_member", { in_email: crew.email });
  check("道具：师傅加得进这家公司", !joinErr, joinErr?.message);
  const vcrew = await visitsOf(crew.client, ming);
  check(
    "🔴 师傅看得到「这位是熟客」—— 那是他一天的工作",
    vcrew?.visits === 5 && vcrew?.visit_days === 4,
    JSON.stringify(vcrew),
  );
  const moneyCols = Object.keys(vcrew ?? {}).filter((k) => /_cents$/.test(k));
  check("🔴 而这一支一个金额都没有回", moneyCols.length === 0, moneyCols.join(","));

  /* ── ⑥ 别人家 ──────────────────────────────────────────────────── */
  console.log("\n⑥ 别人家");
  const other = await person("other");
  const { data: theirs, error: tE } = await other.client.rpc("party_visits", {
    in_project_id: P,
  });
  check("🔴 别人家问不到", !tE && (theirs ?? []).length === 0, `${(theirs ?? []).length} 行`);

  ok = true;
} catch (e) {
  console.log(`  FAIL  半路炸了 — ${e.message}`);
  bad.push("半路炸了");
} finally {
  const stuck = await dropThrowaways(admin, people);
  if (stuck.length) bad.push("临时帐号删不掉");
  console.log(`\n判：${bad.length ? `${bad.length} 条没过 — ${bad.join(" · ")}` : "全部过"}\n`);
  process.exitCode = bad.length || !ok ? 1 : 0;
}
